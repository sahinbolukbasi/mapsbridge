import { getVerifiedUser } from "../shared/auth";
import { resolveEnvSecret } from "../shared/http";
import type { ApiGatewayEvent } from "../shared/http";
import { BillingError, table, wallet, grantCredits, initializeTrial } from "../billing/store";
import { getDynamoClient } from "../shared/dynamo";
import { catalog } from "../billing/catalog";
import { UpdateItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { timingSafeEqual } from "node:crypto";
import { marshall } from "@aws-sdk/util-dynamodb";

// Tek entitlement kaynağı. Dashboard'daki entitlement lookup_key ile aynı olmalı.
// Kademe (explorer/pro/agency) entitlement adından DEĞİL, product_id'den çözülür.
const RC_ENTITLEMENT_ID = process.env.RC_ENTITLEMENT_ID || "mapsbridge_pro";

/**
 * RevenueCat subscriber payload'ından aktif aboneliğin product_identifier'ını bulur.
 * Önce entitlement'ın bağlı olduğu ürüne, sonra aktif subscriptions kaydına bakar.
 * Bulamazsa null döner.
 */
function activeProductIdFromSubscriber(subscriber: Record<string, unknown>): string | null {
  const entitlements =
    (subscriber.entitlements as Record<
      string,
      { expires_date?: string | null; product_identifier?: string }
    >) || {};
  const ent = entitlements[RC_ENTITLEMENT_ID];
  const now = Date.now();
  // Entitlement aktif mi? (expires_date yoksa lifetime kabul edilir)
  const entActive = !!ent && (!ent.expires_date || Date.parse(ent.expires_date) > now);
  if (!entActive) return null;
  // 1) Entitlement doğrudan product_identifier taşıyorsa onu kullan
  if (ent.product_identifier) return ent.product_identifier;
  // 2) Aksi halde aktif subscriptions kayıtlarından süresi geçmemiş ilkini seç
  const subscriptions =
    (subscriber.subscriptions as Record<string, { expires_date?: string | null }>) || {};
  for (const [productId, sub] of Object.entries(subscriptions)) {
    if (!sub?.expires_date || Date.parse(sub.expires_date) > now) return productId;
  }
  return null;
}

const reply = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(body),
});

/** Sabit-zamanlı secret karşılaştırması (timing attack koruması). */
function secretMatches(authHeader: string, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
function appOrigin() {
  const url = new URL(process.env.APP_ORIGIN || "");
  if (
    url.protocol !== "https:" &&
    !(process.env.ENVIRONMENT === "dev" && url.hostname === "localhost")
  )
    throw new Error("Invalid APP_ORIGIN");
  return url.origin;
}

export async function handler(event: ApiGatewayEvent) {
  try {
    const method = event.requestContext?.http?.method;
    const path = (event.rawPath || event.requestContext?.http?.path || "").replace(/\/$/, "");
    if (method === "OPTIONS") return reply(200, {});
    if (method === "POST" && path === "/revenuecat/webhook") return await handleWebhook(event);
    if (method === "GET" && path === "/revenuecat/plans")
      return reply(200, {
        enabled: process.env.BILLING_ENABLED === "true",
        products: catalog().map((p) => ({
          ...p,
          available: process.env.BILLING_ENABLED === "true" && !!p.productId,
        })),
        welcomeCredits: 5,
        costs: { route: 5, chat: 1, clarify: 0 },
      });

    const token = (event.headers?.authorization || event.headers?.Authorization || "").replace(
      /^Bearer /,
      "",
    );
    const user = await getVerifiedUser(token);
    const userId = user?.sub;
    if (!userId) return reply(401, { error: "Oturumunuz doğrulanamadı." });

    if (method === "GET" && path === "/revenuecat/wallet") return reply(200, await wallet(userId));

    let body: Record<string, unknown> = {};
    if (event.body) {
      try {
        body = JSON.parse(
          event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body,
        );
      } catch {
        return reply(400, { error: "Geçersiz istek." });
      }
      if (!body || typeof body !== "object" || Array.isArray(body))
        return reply(400, { error: "Geçersiz istek." });
    }

    if (method === "POST" && path === "/revenuecat/checkout") {
      if (process.env.BILLING_ENABLED !== "true")
        return reply(503, {
          error: "Kredi satışı ödeme hesabı bağlantısı tamamlandığında açılacak.",
        });
      if (!user?.emailVerified)
        return reply(403, { error: "Satın almadan önce e-postanızı doğrulayın." });
      await initializeTrial(userId);
      const product = catalog().find(
        (p) =>
          p.productId && (body.productId ? p.productId === body.productId : p.id === body.targetId),
      );
      if (!product) return reply(400, { error: "Satışa açık bir paket seçin." });
      const url = await createWebCheckoutUrl(userId, product, user.email);
      return reply(201, { url, productId: product.productId });
    }

    if (method === "POST" && path === "/revenuecat/verify") {
      // After a mobile purchase, sync the subscriber's entitlements to DynamoDB
      const subscriber = await getRcSubscriber(userId);
      if (!subscriber) return reply(404, { error: "RevenueCat abonelik bilgisi bulunamadı." });
      await syncFromSubscriber(userId, subscriber, Math.floor(Date.now() / 1000));
      return reply(200, await wallet(userId));
    }

    return reply(404, { error: "Uç nokta bulunamadı." });
  } catch (err) {
    if (err instanceof BillingError)
      return reply(err.status, { error: err.message, code: err.code });
    console.error("[RevenueCat] Unhandled error:", err);
    return reply(503, { error: "Ödeme veya kredi servisine şu anda erişilemiyor." });
  }
}

// ─── Webhook ──────────────────────────────────────────────────────────────

async function handleWebhook(event: ApiGatewayEvent) {
  // RevenueCat sends Authorization: Bearer <secret>
  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
  const secret = await resolveEnvSecret(process.env.RC_WEBHOOK_AUTH_SECRET);
  if (!secret || !secretMatches(authHeader, secret))
    return reply(401, { error: "Geçersiz webhook kimlik doğrulama." });

  interface RCEvent {
    id: string;
    type: string;
    app_user_id: string;
    event_timestamp_ms: number;
    product_id?: string;
    expiration_at_ms?: number;
    transaction_id?: string;
    new_product_id?: string;
    transferred_from?: string[];
    transferred_to?: string[];
    store?: string;
    environment?: string;
  }
  interface RCPayload {
    event?: RCEvent;
  }

  let payload: RCPayload;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body!, "base64").toString("utf8")
      : event.body!;
    payload = JSON.parse(raw) as RCPayload;
  } catch {
    return reply(400, { error: "Geçersiz webhook gövdesi." });
  }

  const ev = payload?.event;
  if (!ev?.id || !ev?.type || !ev?.app_user_id)
    return reply(400, { error: "Eksik webhook alanları." });

  const userId: string = ev.app_user_id;
  const eventTime = Math.floor((ev.event_timestamp_ms || Date.now()) / 1000);
  const productId: string = ev.product_id || "";
  const expiresAt: string | null = ev.expiration_at_ms
    ? new Date(ev.expiration_at_ms).toISOString()
    : null;

  // Idempotency guard: aynı event.id yalnızca BİR kez işlenir. Conditional put
  // başarısızsa (attribute_exists) bu event daha önce işlenmiştir → sessizce 200.
  try {
    await getDynamoClient().send(
      new PutItemCommand({
        TableName: table(),
        Item: marshall({
          PK: `BILLING#RC_EVENT#${ev.id}`,
          SK: "PROCESSED",
          type: ev.type,
          userId,
          processedAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + 90 * 86400,
        }),
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
  } catch (err: unknown) {
    if ((err as { name?: string })?.name === "ConditionalCheckFailedException") {
      console.log(JSON.stringify({ msg: "rc_webhook_duplicate", eventId: ev.id, type: ev.type }));
      return reply(200, { received: true, duplicate: true });
    }
    throw err;
  }
  try {
    switch (ev.type as string) {
      case "INITIAL_PURCHASE": {
        const product = catalog().find((p) => p.productId === productId);
        if (!product) break;
        await initializeTrial(userId);
        if (product.mode === "subscription") {
          await syncSubscription(userId, product.id, "active", expiresAt, ev.id, eventTime);
          await grantCredits(userId, `RC_INITIAL#${ev.transaction_id}`, product.credits, {
            eventId: ev.id,
            productId,
            store: ev.store,
            environment: ev.environment,
            createdAt: new Date(ev.event_timestamp_ms).toISOString(),
          });
        } else {
          // one-time credit pack
          await grantCredits(userId, `RC_PURCHASE#${ev.transaction_id}`, product.credits, {
            eventId: ev.id,
            productId,
            store: ev.store,
            environment: ev.environment,
            createdAt: new Date(ev.event_timestamp_ms).toISOString(),
          });
        }
        break;
      }
      case "RENEWAL": {
        const product = catalog().find((p) => p.productId === productId);
        if (!product || product.mode !== "subscription") break;
        await syncSubscription(userId, product.id, "active", expiresAt, ev.id, eventTime);
        await grantCredits(userId, `RC_RENEWAL#${ev.transaction_id}`, product.credits, {
          eventId: ev.id,
          productId,
          store: ev.store,
          environment: ev.environment,
          createdAt: new Date(ev.event_timestamp_ms).toISOString(),
        });
        break;
      }
      case "PRODUCT_CHANGE": {
        const product = catalog().find(
          (p) => p.productId === ev.new_product_id || p.productId === productId,
        );
        if (!product) break;
        await syncSubscription(userId, product.id, "active", expiresAt, ev.id, eventTime);
        break;
      }
      case "CANCELLATION":
        await syncSubscriptionStatus(userId, "cancelled", ev.id, eventTime);
        break;
      case "UNCANCELLATION":
        await syncSubscriptionStatus(userId, "active", ev.id, eventTime);
        break;
      case "EXPIRATION":
        await syncSubscription(userId, "free", "expired", null, ev.id, eventTime);
        break;
      case "BILLING_ISSUE":
        await syncSubscriptionStatus(userId, "billing_issue", ev.id, eventTime);
        break;
      case "REFUND": {
        await getDynamoClient().send(
          new UpdateItemCommand({
            TableName: table(),
            Key: marshall({ PK: `USER#${userId}`, SK: "CREDITS" }),
            UpdateExpression: "SET frozen = :yes, reviewEvent = :event",
            ExpressionAttributeValues: marshall({ ":yes": true, ":event": ev.id }),
          }),
        );
        break;
      }
      case "TRANSFER": {
        // Satın alma kullanıcılar arası taşındı. Hak kaybı/çift hak riskine girmemek
        // için burada entitlement'ı elle değiştirmeyiz; etkilenen kullanıcıları
        // reconciliation'a işaretleriz — gerçek durum RevenueCat'ten doğrulanır.
        const affected = new Set<string>([
          ...(ev.transferred_from || []),
          ...(ev.transferred_to || []),
          userId,
        ]);
        for (const uid of affected) {
          if (!uid) continue;
          try {
            await getDynamoClient().send(
              new UpdateItemCommand({
                TableName: table(),
                Key: marshall({ PK: `USER#${uid}`, SK: "SUBSCRIPTION" }),
                UpdateExpression: "SET needsReconcile = :yes, rcEventId = :evId",
                ConditionExpression: "attribute_exists(PK)",
                ExpressionAttributeValues: marshall({ ":yes": true, ":evId": ev.id }),
              }),
            );
          } catch (e: unknown) {
            if ((e as { name?: string })?.name !== "ConditionalCheckFailedException") throw e;
          }
        }
        console.log(
          JSON.stringify({ msg: "rc_transfer", eventId: ev.id, affected: [...affected] }),
        );
        break;
      }
      default:
        break;
    }
  } catch (err: unknown) {
    // Log but don't fail — RC retries on non-2xx
    if ((err as { name?: string })?.name !== "ConditionalCheckFailedException") {
      console.error(`[RevenueCat] Webhook processing error for ${ev.type}:`, err);
      return reply(500, { error: "İşlem hatası." });
    }
  }

  if (ev.type === "INITIAL_PURCHASE" || ev.type === "RENEWAL") {
    await publishConversion(ev.id, userId, ev.type, productId, ev.store);
  }
  return reply(200, { received: true });
}

// ─── Subscription sync helpers ─────────────────────────────────────────────

async function syncSubscription(
  userId: string,
  tier: string,
  status: string,
  currentPeriodEnd: string | null,
  eventId: string,
  eventTime: number,
) {
  try {
    await getDynamoClient().send(
      new UpdateItemCommand({
        TableName: table(),
        Key: marshall({ PK: `USER#${userId}`, SK: "SUBSCRIPTION" }),
        UpdateExpression:
          "SET tier = :tier, #status = :status, currentPeriodEnd = :end, eventTime = :time, rcEventId = :evId",
        ConditionExpression: "attribute_not_exists(eventTime) OR eventTime < :time",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
          ":tier": tier,
          ":status": status,
          ":end": currentPeriodEnd || new Date(0).toISOString(),
          ":time": eventTime,
          ":evId": eventId,
        }),
      }),
    );
  } catch (err: unknown) {
    if ((err as { name?: string })?.name !== "ConditionalCheckFailedException") throw err;
  }
}

async function syncSubscriptionStatus(
  userId: string,
  status: string,
  eventId: string,
  eventTime: number,
) {
  try {
    await getDynamoClient().send(
      new UpdateItemCommand({
        TableName: table(),
        Key: marshall({ PK: `USER#${userId}`, SK: "SUBSCRIPTION" }),
        UpdateExpression: "SET #status = :status, eventTime = :time, rcEventId = :evId",
        ConditionExpression:
          "attribute_exists(PK) AND (attribute_not_exists(eventTime) OR eventTime < :time)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
          ":status": status,
          ":time": eventTime,
          ":evId": eventId,
        }),
      }),
    );
  } catch (err: unknown) {
    if ((err as { name?: string })?.name !== "ConditionalCheckFailedException") throw err;
  }
}

// ─── RevenueCat REST API ────────────────────────────────────────────────────

async function rcSecretKey(): Promise<string> {
  const key = await resolveEnvSecret(process.env.RC_SECRET_API_KEY);
  if (!key || key.includes("placeholder"))
    throw new BillingError(503, "RC_UNAVAILABLE", "RevenueCat servisi yapılandırılmadı.");
  return key;
}

export async function getRcSubscriber(userId: string): Promise<Record<string, unknown> | null> {
  const key = await rcSecretKey();
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    {
      headers: { Authorization: `Bearer ${key}` },
    },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new BillingError(502, "RC_API_ERROR", "RevenueCat bağlantı hatası.");
  const data = (await res.json()) as { subscriber?: Record<string, unknown> };
  return data?.subscriber ?? null;
}

async function createWebCheckoutUrl(
  userId: string,
  product: ReturnType<typeof catalog>[number],
  email?: string,
): Promise<string> {
  const baseUrl = process.env.RC_BILLING_CHECKOUT_URL;
  if (!baseUrl) throw new BillingError(503, "RC_UNAVAILABLE", "Web ödeme adresi yapılandırılmadı.");
  const url = new URL(baseUrl);
  url.searchParams.set("app_user_id", userId);
  url.searchParams.set("product_id", product.productId!);
  url.searchParams.set("success_url", `${appOrigin()}/odeme/?success=true`);
  url.searchParams.set("cancel_url", `${appOrigin()}/odeme/?canceled=true`);
  if (email) url.searchParams.set("email", email);
  return url.href;
}

export async function syncFromSubscriber(
  userId: string,
  subscriber: Record<string, unknown>,
  eventTime: number,
) {
  // Kademe, webhook ana yoluyla AYNI stratejiden çözülür: product_id -> catalog().
  // Entitlement adı yalnızca "aktif abonelik var mı" bilgisini verir.
  const productId = activeProductIdFromSubscriber(subscriber);
  if (!productId) return; // aktif mapsbridge_pro entitlement'i yok -> yapılacak bir şey yok
  const product = catalog().find((p) => p.productId === productId);
  if (!product || product.mode !== "subscription") {
    // Sessiz fallthrough bu bug'ın fark edilmemesinin sebebiydi: artık logla.
    console.warn(
      JSON.stringify({
        msg: "rc_sync_from_subscriber_unresolved",
        userId,
        productId,
        entitlement: RC_ENTITLEMENT_ID,
      }),
    );
    return;
  }
  const entitlements =
    (subscriber.entitlements as Record<string, { expires_date?: string | null }>) || {};
  const periodEnd = entitlements[RC_ENTITLEMENT_ID]?.expires_date ?? null;
  await syncSubscription(
    userId,
    product.id,
    "active",
    periodEnd,
    `rc-verify-${Date.now()}`,
    eventTime,
  );
}

// ─── Conversion publish (best-effort, attribution) ──────────────────────────
let snsClient: SNSClient | null = null;
async function publishConversion(
  eventId: string,
  userId: string,
  type: string,
  productId: string,
  store?: string,
): Promise<void> {
  const topic = process.env.BILLING_CONVERSIONS_TOPIC_ARN;
  if (!topic) return;
  try {
    snsClient = snsClient || new SNSClient({});
    await snsClient.send(
      new PublishCommand({
        TopicArn: topic,
        Message: JSON.stringify({ eventId, userId, type, productId, store }),
      }),
    );
  } catch (err) {
    console.error("[RevenueCat] conversion publish failed (best-effort):", (err as Error).name);
  }
}
