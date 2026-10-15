import { getVerifiedUser } from "../shared/auth";
import { resolveEnvSecret } from "../shared/http";
import {
  BillingError,
  table,
  read,
  wallet,
  grantCredits,
  initializeTrial,
} from "../billing/store";
import { getDynamoClient } from "../shared/dynamo";
import { catalog } from "../billing/catalog";
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const reply = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(body),
});

function appOrigin() {
  const url = new URL(process.env.APP_ORIGIN || "");
  if (
    url.protocol !== "https:" &&
    !(process.env.ENVIRONMENT === "dev" && url.hostname === "localhost")
  )
    throw new Error("Invalid APP_ORIGIN");
  return url.origin;
}

export async function handler(event: any) {
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

    let body: any = {};
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

async function handleWebhook(event: any) {
  // RevenueCat sends Authorization: Bearer <secret>
  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
  const secret = await resolveEnvSecret(process.env.RC_WEBHOOK_AUTH_SECRET);
  if (!secret || `Bearer ${secret}` !== authHeader)
    return reply(401, { error: "Geçersiz webhook kimlik doğrulama." });

  let payload: any;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    payload = JSON.parse(raw);
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
      default:
        break;
    }
  } catch (err: any) {
    // Log but don't fail — RC retries on non-2xx
    if (err?.name !== "ConditionalCheckFailedException") {
      console.error(`[RevenueCat] Webhook processing error for ${ev.type}:`, err);
      return reply(500, { error: "İşlem hatası." });
    }
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
  } catch (err: any) {
    if (err.name !== "ConditionalCheckFailedException") throw err;
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
  } catch (err: any) {
    if (err.name !== "ConditionalCheckFailedException") throw err;
  }
}

// ─── RevenueCat REST API ────────────────────────────────────────────────────

async function rcSecretKey(): Promise<string> {
  const key = await resolveEnvSecret(process.env.RC_SECRET_API_KEY);
  if (!key || key.includes("placeholder"))
    throw new BillingError(503, "RC_UNAVAILABLE", "RevenueCat servisi yapılandırılmadı.");
  return key;
}

async function getRcSubscriber(userId: string): Promise<any | null> {
  const key = await rcSecretKey();
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    {
      headers: { Authorization: `Bearer ${key}` },
    },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new BillingError(502, "RC_API_ERROR", "RevenueCat bağlantı hatası.");
  const data = await res.json();
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

async function syncFromSubscriber(userId: string, subscriber: any, eventTime: number) {
  const entitlements: Record<string, any> = subscriber.entitlements || {};
  // Find the highest-tier active entitlement
  const tiers = ["agency", "pro", "explorer"];
  let activeTier = "free";
  let periodEnd: string | null = null;

  for (const tier of tiers) {
    const ent = entitlements[tier];
    if (ent?.expires_date && Date.parse(ent.expires_date) > Date.now()) {
      activeTier = tier;
      periodEnd = ent.expires_date;
      break;
    }
  }

  if (activeTier !== "free") {
    await syncSubscription(
      userId,
      activeTier,
      "active",
      periodEnd,
      `rc-verify-${Date.now()}`,
      eventTime,
    );
  }
}
