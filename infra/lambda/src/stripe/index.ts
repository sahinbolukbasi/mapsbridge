import { getVerifiedUser } from "../shared/auth";
import { resolveEnvSecret, jsonResponse } from "../shared/http";
import { stripeClient } from "../billing/stripe-client";
import {
  BillingError,
  table,
  read,
  wallet,
  grantCredits,
  subscription,
  initializeTrial,
} from "../billing/store";
import { catalog } from "../billing/catalog";
import { getDynamoClient } from "../shared/dynamo";
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
function appOrigin() {
  const url = new URL(process.env.APP_ORIGIN || "");
  if (
    url.protocol !== "https:" &&
    !(process.env.ENVIRONMENT === "dev" && url.hostname === "localhost")
  )
    throw new Error("Invalid APP_ORIGIN");
  return url.origin;
}
function idempotency(event: any, userId: string) {
  const key = event.headers?.["idempotency-key"] || event.headers?.["Idempotency-Key"];
  if (typeof key !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(key))
    throw new BillingError(400, "REQUEST_ID_REQUIRED", "Ödeme işlem kimliği gerekli.");
  return `${userId}:${key}`;
}
export async function handler(event: any) {
  // Old direct-to-SQS messages lack a verifiable raw body/signature. Retain for DLQ inspection, never grant rights.
  if (Array.isArray(event.Records))
    return { batchItemFailures: event.Records.map((r: any) => ({ itemIdentifier: r.messageId })) };
  try {
    const method = event.requestContext?.http?.method;
    const path = (event.rawPath || event.requestContext?.http?.path || "").replace(/\/$/, "");
    if (method === "OPTIONS") return jsonResponse(200, {});
    if (method === "POST" && path === "/stripe/webhook") return await webhook(event);
    if (method === "GET" && path === "/stripe/plans")
      return jsonResponse(200, {
        enabled: process.env.BILLING_ENABLED === "true",
        products: catalog().map((p) => ({
          ...p,
          available: process.env.BILLING_ENABLED === "true" && !!p.priceId,
        })),
        welcomeCredits: 100,
        costs: { route: 5, chat: 1, clarify: 0 },
      });
    const token = (event.headers?.authorization || event.headers?.Authorization || "").replace(
      /^Bearer /,
      "",
    );
    const user = await getVerifiedUser(token);
    const userId = user?.sub;
    if (!userId) return jsonResponse(401, { error: "Oturumunuz doğrulanamadı." });
    if (method === "GET" && path === "/stripe/wallet")
      return jsonResponse(200, await wallet(userId));
    if (method === "GET" && path === "/stripe/subscription")
      return jsonResponse(200, await subscription(userId));
    if (method === "GET" && path === "/stripe/session") {
      const id = event.queryStringParameters?.session_id;
      if (typeof id !== "string" || !/^cs_[a-zA-Z0-9_]{8,200}$/.test(id))
        return jsonResponse(400, { error: "Geçersiz ödeme kimliği." });
      const session = await (await stripeClient()).checkout.sessions.retrieve(id);
      if (session.client_reference_id !== userId || session.metadata?.userId !== userId)
        return jsonResponse(404, { error: "Ödeme bulunamadı." });
      let receipt = await read(`BILLING#CHECKOUT#${id}`, "RECEIPT");
      if (session.mode === "subscription" && session.invoice) {
        const invoiceId =
          typeof session.invoice === "string" ? session.invoice : session.invoice.id;
        receipt = await read(`BILLING#INVOICE#${invoiceId}`, "RECEIPT");
      }
      return jsonResponse(200, {
        status:
          receipt?.userId === userId
            ? "credited"
            : session.payment_status === "paid"
              ? "processing"
              : session.status === "expired"
                ? "expired"
                : "pending",
      });
    }
    let body: any = {};
    if (event.body) {
      try {
        body = JSON.parse(
          event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body,
        );
      } catch {
        return jsonResponse(400, { error: "Geçersiz istek." });
      }
      if (!body || typeof body !== "object" || Array.isArray(body))
        return jsonResponse(400, { error: "Geçersiz istek." });
    }
    if (method === "POST" && path === "/stripe/checkout") {
      if (process.env.BILLING_ENABLED !== "true")
        return jsonResponse(503, {
          error: "Kredi satışı ödeme hesabı bağlantısı tamamlandığında açılacak.",
        });
      if (!user?.emailVerified)
        return jsonResponse(403, { error: "Satın almadan önce e-postanızı doğrulayın." });
      await initializeTrial(userId);
      const product = catalog().find(
        (p) =>
          p.priceId &&
          (body.targetId
            ? p.id === body.targetId && p.mode === body.mode
            : p.priceId === body.priceId),
      );
      if (!product) return jsonResponse(400, { error: "Satışa açık bir paket seçin." });
      if (body.cycle && body.cycle !== "monthly")
        return jsonResponse(400, { error: "Yıllık ödeme henüz kullanıma açık değil." });
      const key = idempotency(event, userId);
      const stripe = await stripeClient();
      // Price amount, currency and recurrence are server-controlled, never client amounts or price metadata.
      const price = await stripe.prices.retrieve(product.priceId);
      if (
        !price.active ||
        price.currency !== "try" ||
        price.unit_amount !== product.amount ||
        (product.mode === "subscription"
          ? price.recurring?.interval !== "month" || price.recurring?.interval_count !== 1
          : !!price.recurring)
      ) {
        throw new BillingError(503, "PRICE_CONFIGURATION", "Paket fiyatı doğrulanamadı.");
      }
      let customer = await read(`USER#${userId}`, "STRIPE_CUSTOMER");
      if (!customer?.customerId) {
        const created = await stripe.customers.create(
          { metadata: { userId } },
          { idempotencyKey: `customer:${userId}` },
        );
        await bindCustomer(userId, created.id);
        customer = { customerId: created.id };
      }
      const origin = appOrigin();
      const session = await stripe.checkout.sessions.create(
        {
          mode: product.mode === "subscription" ? "subscription" : "payment",
          line_items: [{ price: product.priceId, quantity: 1 }],
          client_reference_id: userId,
          ...(customer?.customerId ? { customer: customer.customerId } : {}),
          success_url: `${origin}/odeme/?success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/odeme/?canceled=true`,
          metadata: { userId, productId: product.id },
          ...(product.mode === "subscription"
            ? { subscription_data: { metadata: { userId } } }
            : { payment_intent_data: { metadata: { userId, productId: product.id } } }),
        },
        { idempotencyKey: key },
      );
      return jsonResponse(201, { url: session.url, sessionId: session.id });
    }
    if (method === "POST" && path === "/stripe/portal") {
      const customer = await read(`USER#${userId}`, "STRIPE_CUSTOMER");
      if (!customer?.customerId) return jsonResponse(400, { error: "Abonelik bulunamadı." });
      const session = await (
        await stripeClient()
      ).billingPortal.sessions.create({
        customer: customer.customerId,
        ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID
          ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID }
          : {}),
        return_url: `${appOrigin()}/odeme/`,
      });
      return jsonResponse(200, { url: session.url });
    }
    if (method === "POST" && path === "/stripe/balance/topup")
      return jsonResponse(410, {
        error: "Tutarla bakiye yükleme kaldırıldı. Doğrulanmış kredi paketini kullanın.",
      });
    return jsonResponse(404, { error: "Uç nokta bulunamadı." });
  } catch (err) {
    if (err instanceof BillingError)
      return jsonResponse(err.status, { error: err.message, code: err.code });
    return jsonResponse(503, { error: "Ödeme veya kredi servisine şu anda erişilemiyor." });
  }
}
async function webhook(event: any) {
  const signature = Object.entries(event.headers || {}).find(
    ([k]) => k.toLowerCase() === "stripe-signature",
  )?.[1];
  if (typeof signature !== "string" || !event.body)
    return jsonResponse(400, { error: "Ödeme imzası gerekli." });
  const secret = await resolveEnvSecret(process.env.STRIPE_WEBHOOK_SECRET);
  if (!secret.startsWith("whsec_"))
    throw new BillingError(503, "WEBHOOK_CONFIGURATION", "Ödeme doğrulaması yapılandırılmadı.");
  const stripe = await stripeClient();
  let verified: any;
  try {
    verified = stripe.webhooks.constructEvent(
      event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body,
      signature,
      secret,
    );
  } catch {
    return jsonResponse(400, { error: "Geçersiz ödeme imzası." });
  }
  if (!verified.id || !Number.isFinite(verified.created))
    return jsonResponse(400, { error: "Geçersiz ödeme olayı." });
  const object = verified.data.object;
  switch (verified.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      // Read current provider state; a completed but unpaid checkout grants nothing.
      const session = await stripe.checkout.sessions.retrieve(object.id, {
        expand: ["line_items"],
      });
      const userId = session.client_reference_id;
      if (typeof userId !== "string" || userId !== session.metadata?.userId)
        throw new Error("Checkout identity mismatch");
      if (session.payment_status !== "paid")
        return jsonResponse(200, { received: true, pending: true });
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (customerId) await bindCustomer(userId, customerId);
      if (session.mode === "payment") {
        const lines = session.line_items?.data;
        const product = catalog().find(
          (p) =>
            p.mode === "credit_pack" &&
            p.id === session.metadata?.productId &&
            p.priceId === lines?.[0]?.price?.id,
        );
        if (
          !product ||
          lines.length !== 1 ||
          lines[0].quantity !== 1 ||
          session.currency !== "try" ||
          session.amount_total !== product.amount
        )
          throw new Error("Unexpected paid product");
        await grantCredits(userId, `CHECKOUT#${session.id}`, product.credits, {
          eventId: verified.id,
          amount: session.amount_total,
          currency: session.currency,
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id || "",
          createdAt: new Date(verified.created * 1000).toISOString(),
        });
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = await stripe.subscriptions.retrieve(object.id);
      await syncSubscription(sub, verified.created);
      break;
    }
    case "invoice.paid": {
      const invoice = await stripe.invoices.retrieve(object.id);
      if (invoice.status !== "paid" || !invoice.paid || !invoice.subscription) break;
      // Proration invoices do not create a second monthly credit allocation.
      if (!["subscription_create", "subscription_cycle"].includes(invoice.billing_reason)) break;
      const sub = await stripe.subscriptions.retrieve(
        typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id,
      );
      const product = catalog().find(
        (p) =>
          p.mode === "subscription" && p.priceId && p.priceId === sub.items?.data?.[0]?.price?.id,
      );
      const line = invoice.lines?.data?.find(
        (l: any) => l.type === "subscription" && !l.proration && l.price?.id === product?.priceId,
      );
      if (
        !product ||
        !line ||
        line.quantity !== 1 ||
        invoice.currency !== "try" ||
        invoice.amount_paid < product.amount ||
        !sub.metadata?.userId
      )
        throw new Error("Invoice product mismatch");
      const invoiceCustomer =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      const subCustomer = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
      if (!invoiceCustomer || invoiceCustomer !== subCustomer)
        throw new Error("Invoice customer mismatch");
      await bindCustomer(sub.metadata.userId, invoiceCustomer);
      await syncSubscription(sub, verified.created);
      await grantCredits(sub.metadata.userId, `INVOICE#${invoice.id}`, product.credits, {
        eventId: verified.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        paymentIntentId:
          typeof invoice.payment_intent === "string"
            ? invoice.payment_intent
            : invoice.payment_intent?.id || "",
        createdAt: new Date(verified.created * 1000).toISOString(),
      });
      break;
    }
    case "charge.refunded":
    case "charge.dispute.created": {
      const charge = await stripe.charges.retrieve(
        verified.type === "charge.refunded" ? object.id : object.charge,
      );
      const customerId =
        typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
      if (!customerId) throw new Error("Refund customer missing");
      const customer = await stripe.customers.retrieve(customerId);
      const userId = customer.metadata?.userId;
      if (!userId || (await read(`USER#${userId}`, "STRIPE_CUSTOMER"))?.customerId !== customerId)
        throw new Error("Refund owner mismatch");
      // Fail closed pending financial reconciliation; do not allow refunded credits to be spent.
      await getDynamoClient().send(
        new UpdateItemCommand({
          TableName: table(),
          Key: marshall({ PK: `USER#${userId}`, SK: "CREDITS" }),
          UpdateExpression: "SET frozen = :yes, reviewEvent = :event",
          ExpressionAttributeValues: marshall({ ":yes": true, ":event": verified.id }),
        }),
      );
      break;
    }
    // Failed payments never overwrite successful receipts or grant balance.
    default:
      break;
  }
  return jsonResponse(200, { received: true });
}
async function bindCustomer(userId: string, customerId: string) {
  await getDynamoClient().send(
    new UpdateItemCommand({
      TableName: table(),
      Key: marshall({ PK: `USER#${userId}`, SK: "STRIPE_CUSTOMER" }),
      UpdateExpression: "SET customerId = :id",
      ConditionExpression: "attribute_not_exists(customerId) OR customerId = :id",
      ExpressionAttributeValues: marshall({ ":id": customerId }),
    }),
  );
}
async function syncSubscription(sub: any, eventTime: number) {
  const userId = sub.metadata?.userId;
  if (typeof userId !== "string" || !userId) throw new Error("Missing subscription owner");
  const product = catalog().find(
    (p) => p.mode === "subscription" && p.priceId && p.priceId === sub.items?.data?.[0]?.price?.id,
  );
  const active = sub.status === "active" && product && Number.isFinite(sub.current_period_end);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) throw new Error("Missing customer");
  await bindCustomer(userId, customerId);
  try {
    await getDynamoClient().send(
      new UpdateItemCommand({
        TableName: table(),
        Key: marshall({ PK: `USER#${userId}`, SK: "SUBSCRIPTION" }),
        UpdateExpression:
          "SET tier = :tier, #status = :status, currentPeriodEnd = :end, stripeSubscriptionId = :id, eventTime = :time",
        ConditionExpression: "attribute_not_exists(eventTime) OR eventTime < :time",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
          ":tier": active ? product.id : "free",
          ":status": sub.status,
          ":end": new Date((sub.current_period_end || 0) * 1000).toISOString(),
          ":id": sub.id,
          ":time": eventTime,
        }),
      }),
    );
  } catch (err: any) {
    if (err.name !== "ConditionalCheckFailedException") throw err;
  }
}
