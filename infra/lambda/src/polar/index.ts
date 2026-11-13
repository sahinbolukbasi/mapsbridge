import { getVerifiedUser } from "../shared/auth";
import { resolveEnvSecret, jsonResponse } from "../shared/http";
import type { ApiGatewayEvent } from "../shared/http";
import {
  BillingError,
  table,
  wallet,
  subscription,
  grantCredits,
  initializeTrial,
} from "../billing/store";
import { polarCatalog, isPolarProductAvailable } from "../billing/catalog";
import { getDynamoClient } from "../shared/dynamo";
import { UpdateItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
// @ts-expect-error Subpath export requires nodenext
import { createPolar, webhooks } from "@polar-sh/sdk/2026-10";

function appOrigin(): string {
  const origin = process.env.APP_ORIGIN || "https://mapsbridge.com";
  try {
    const url = new URL(origin);
    return url.origin;
  } catch {
    return "https://mapsbridge.com";
  }
}

function getPolarClient(token: string) {
  const env = process.env.POLAR_ENVIRONMENT === "production" ? "production" : "sandbox";
  return createPolar({
    accessToken: token,
    environment: env,
  });
}

async function getPolarSecrets(): Promise<{ token: string; webhookSecret: string }> {
  let token = process.env.POLAR_ACCESS_TOKEN || "";
  let webhookSecret = process.env.POLAR_WEBHOOK_SECRET || "";

  if (!token || !webhookSecret) {
    try {
      const raw = await resolveEnvSecret("secret:mapsbridge/polar");
      if (raw) {
        const parsed = JSON.parse(raw);
        token = token || parsed.POLAR_ACCESS_TOKEN || "";
        webhookSecret = webhookSecret || parsed.POLAR_WEBHOOK_SECRET || "";
      }
    } catch {}
  }

  return {
    token: (await resolveEnvSecret(token)) || token,
    webhookSecret: (await resolveEnvSecret(webhookSecret)) || webhookSecret,
  };
}

export async function handler(event: ApiGatewayEvent) {
  try {
    const method = event.requestContext?.http?.method;
    const path = (event.rawPath || event.requestContext?.http?.path || "").replace(/\/$/, "");

    if (method === "OPTIONS") return jsonResponse(200, {});

    // Webhook route
    if (method === "POST" && (path === "/polar/webhook" || path === "/api/webhook/polar")) {
      return await handleWebhook(event);
    }

    // Public plans catalog route
    if (method === "GET" && (path === "/polar/plans" || path === "/api/polar/plans")) {
      return jsonResponse(200, {
        enabled: process.env.BILLING_ENABLED !== "false",
        products: polarCatalog().map((p) => ({
          ...p,
          available: isPolarProductAvailable(p),
        })),
        welcomeCredits: 100,
        costs: { route: 5, chat: 1, clarify: 0 },
      });
    }

    // Authenticated endpoints
    const token = (event.headers?.authorization || event.headers?.Authorization || "").replace(
      /^Bearer /,
      "",
    );
    const user = await getVerifiedUser(token);
    const userId = user?.sub;
    if (!userId) return jsonResponse(401, { error: "Oturumunuz doğrulanamadı." });

    if (method === "GET" && (path === "/polar/wallet" || path === "/api/polar/wallet")) {
      return jsonResponse(200, await wallet(userId));
    }

    if (method === "GET" && (path === "/polar/subscription" || path === "/api/polar/subscription")) {
      return jsonResponse(200, await subscription(userId));
    }

    let body: Record<string, unknown> = {};
    if (event.body) {
      try {
        body = JSON.parse(
          event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body,
        );
      } catch {
        return jsonResponse(400, { error: "Geçersiz istek gövdesi." });
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return jsonResponse(400, { error: "Geçersiz istek gövdesi." });
      }
    }

    // Create Polar Checkout Session
    if (method === "POST" && (path === "/polar/checkout" || path === "/api/checkout/polar" || path === "/api/polar/checkout")) {
      const targetId = (body.targetId || body.productId) as string;
      const product = polarCatalog().find(
        (p) => p.id === targetId || p.productId === targetId,
      );
      if (!product) {
        return jsonResponse(400, { error: "Satışa açık bir paket seçin." });
      }

      await initializeTrial(userId);

      const { token: secretToken } = await getPolarSecrets();
      if (!secretToken) {
        const directUrl =
          product.checkoutUrl ||
          `${appOrigin()}/checkout?mock_success=true&product=${product.id}`;
        return jsonResponse(201, {
          url: directUrl,
          checkoutId: `polar_direct_${Date.now()}`,
          polarRedirectUrl: directUrl,
          stripeRedirectUrl: directUrl,
        });
      }

      try {
        const polar = getPolarClient(secretToken);
        const origin = appOrigin();
        const checkout = await polar.checkouts.create({
          products: [product.productId || product.id],
          external_customer_id: userId,
          customer_email: user.email || undefined,
          metadata: {
            userId,
            targetId: product.id,
            mode: product.mode,
          },
          success_url: `${origin}/checkout?success=true&checkout_id={CHECKOUT_ID}`,
          return_url: `${origin}/checkout`,
        });

        return jsonResponse(201, {
          url: checkout.url,
          checkoutId: checkout.id,
          polarRedirectUrl: checkout.url,
          stripeRedirectUrl: checkout.url,
        });
      } catch (checkoutErr) {
        if (product.checkoutUrl) {
          const fallbackUrl = new URL(product.checkoutUrl);
          if (user.email) fallbackUrl.searchParams.set("customer_email", user.email);
          return jsonResponse(201, {
            url: fallbackUrl.href,
            checkoutId: `polar_link_${Date.now()}`,
            polarRedirectUrl: fallbackUrl.href,
            stripeRedirectUrl: fallbackUrl.href,
          });
        }
        throw checkoutErr;
      }
    }

    // Create Polar Customer Portal Session
    if (method === "POST" && (path === "/polar/portal" || path === "/api/portal/polar" || path === "/api/polar/portal")) {
      const { token: secretToken } = await getPolarSecrets();
      if (!secretToken) {
        return jsonResponse(200, {
          url: `${appOrigin()}/checkout`,
        });
      }

      const polar = getPolarClient(secretToken);
      const session = await polar.customerSessions.create({
        external_customer_id: userId,
      });

      return jsonResponse(200, {
        url: session.customer_portal_url,
      });
    }

    return jsonResponse(404, { error: "Uç nokta bulunamadı." });
  } catch (err) {
    if (err instanceof BillingError) {
      return jsonResponse(err.status, { error: err.message, code: err.code });
    }
    console.error("[Polar] Unhandled error:", err);
    return jsonResponse(500, { error: "Ödeme veya kredi servisine şu anda erişilemiyor." });
  }
}

// ─── Polar Webhook Handler ──────────────────────────────────────────────────

async function handleWebhook(event: ApiGatewayEvent) {
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "";

  const { webhookSecret: secret } = await getPolarSecrets();

  let payload: { type: string; data: Record<string, any>; id?: string };

  if (secret) {
    try {
      const headers = Object.fromEntries(
        Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v || ""]),
      );
      payload = (await webhooks.validateEvent(rawBody, headers, secret)) as any;
    } catch (verifErr) {
      console.error("[Polar Webhook] Signature verification failed:", verifErr);
      return jsonResponse(401, { error: "Geçersiz webhook kimlik doğrulaması." });
    }
  } else {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse(400, { error: "Geçersiz webhook gövdesi." });
    }
  }

  const evType = payload?.type;
  const data = payload?.data;
  if (!evType || !data) {
    return jsonResponse(400, { error: "Eksik webhook alanları." });
  }

  // Idempotency: verify event has not been processed
  const eventId = (payload.id || data.id || `${evType}_${Date.now()}`) as string;
  try {
    await getDynamoClient().send(
      new PutItemCommand({
        TableName: table(),
        Item: marshall({
          PK: `BILLING#POLAR_EVENT#${eventId}`,
          SK: "PROCESSED",
          type: evType,
          processedAt: new Date().toISOString(),
        }),
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
  } catch (err: unknown) {
    if ((err as { name?: string })?.name === "ConditionalCheckFailedException") {
      // Already processed idempotently
      return jsonResponse(200, { received: true, duplicate: true });
    }
  }

  const catalogProducts = polarCatalog();

  // 1. Order Created / Paid (Credit Pack or Subscription Order)
  if (evType === "order.created" || evType === "order.paid") {
    const order = data;
    const userId =
      order.metadata?.userId ||
      order.customer?.external_id ||
      order.customer_metadata?.userId ||
      order.custom_field_data?.userId;

    if (userId) {
      const productId = order.product_id || order.product?.id;
      const matched = catalogProducts.find(
        (p) => p.productId === productId || p.id === order.metadata?.targetId,
      );

      if (matched && matched.credits > 0 && matched.mode === "credit_pack") {
        await grantCredits(userId, `POLAR_ORDER_${order.id}`, matched.credits, {
          orderId: order.id,
          amount: order.total_amount,
          currency: order.currency,
          productTitle: matched.name,
        });
      }
    }
  }

  // 2. Subscription Created / Active / Updated
  if (
    evType === "subscription.created" ||
    evType === "subscription.active" ||
    evType === "subscription.updated"
  ) {
    const sub = data;
    const userId =
      sub.metadata?.userId ||
      sub.customer?.external_id ||
      sub.customer_metadata?.userId ||
      sub.custom_field_data?.userId;

    if (userId) {
      const productId = sub.product_id || sub.product?.id;
      const matched = catalogProducts.find(
        (p) => p.productId === productId || p.id === sub.metadata?.targetId,
      );
      const tier = matched?.mode === "subscription" ? matched.id : "pro";
      const status = sub.status || "active";
      const currentPeriodEnd = sub.current_period_end
        ? new Date(sub.current_period_end).toISOString()
        : new Date(Date.now() + 30 * 86400000).toISOString();
      const eventTime = Math.floor(Date.now() / 1000);

      try {
        await getDynamoClient().send(
          new UpdateItemCommand({
            TableName: table(),
            Key: marshall({ PK: `USER#${userId}`, SK: "SUBSCRIPTION" }),
            UpdateExpression:
              "SET tier = :tier, #status = :status, currentPeriodEnd = :end, polarSubscriptionId = :id, eventTime = :time",
            ConditionExpression: "attribute_not_exists(eventTime) OR eventTime <= :time",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: marshall({
              ":tier": status === "active" ? tier : "free",
              ":status": status,
              ":end": currentPeriodEnd,
              ":id": sub.id,
              ":time": eventTime,
            }),
          }),
        );
      } catch (e: unknown) {
        if ((e as { name?: string })?.name !== "ConditionalCheckFailedException") throw e;
      }

      // Grant recurring credits if active
      if (status === "active" && matched && matched.credits > 0) {
        const periodKey = sub.current_period_start
          ? new Date(sub.current_period_start).toISOString().slice(0, 7)
          : new Date().toISOString().slice(0, 7);
        await grantCredits(
          userId,
          `POLAR_SUB_${sub.id}_${periodKey}`,
          matched.credits,
          {
            subscriptionId: sub.id,
            tier,
            periodKey,
          },
        ).catch(() => null);
      }
    }
  }

  // 3. Subscription Canceled / Revoked
  if (evType === "subscription.canceled" || evType === "subscription.revoked") {
    const sub = data;
    const userId =
      sub.metadata?.userId ||
      sub.customer?.external_id ||
      sub.customer_metadata?.userId;

    if (userId) {
      const eventTime = Math.floor(Date.now() / 1000);
      try {
        await getDynamoClient().send(
          new UpdateItemCommand({
            TableName: table(),
            Key: marshall({ PK: `USER#${userId}`, SK: "SUBSCRIPTION" }),
            UpdateExpression: "SET #status = :status, tier = :tier, eventTime = :time",
            ConditionExpression: "attribute_not_exists(eventTime) OR eventTime <= :time",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: marshall({
              ":status": evType === "subscription.revoked" ? "revoked" : "canceled",
              ":tier": "free",
              ":time": eventTime,
            }),
          }),
        );
      } catch (e: unknown) {
        if ((e as { name?: string })?.name !== "ConditionalCheckFailedException") throw e;
      }
    }
  }

  return jsonResponse(200, { received: true });
}
