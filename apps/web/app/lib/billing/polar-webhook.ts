import { DynamoDBClient, TransactWriteItemsCommand, UpdateItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
// @ts-ignore
import { webhooks } from "@polar-sh/sdk/2026-10";

let ddb: DynamoDBClient | null = null;
function getDynamo(): DynamoDBClient {
  return (ddb ||= new DynamoDBClient({
    region: process.env.AWS_REGION || "eu-central-1",
    maxAttempts: 2,
  }));
}

function getTable(): string | null {
  return process.env.DYNAMODB_TABLE || null;
}

const CREDIT_PACK_MAP: Record<string, number> = {
  explorer: 100,
  pro: 500,
  agency: 2500,
  "pack-30": 30,
  "pack-100": 100,
  "pack-300": 300,
  "pack-pro": 3000,
  polar_prod_pack_30: 30,
  polar_prod_pack_100: 100,
  polar_prod_pack_300: 300,
  polar_prod_pack_pro: 3000,
};

export async function processPolarWebhook(
  rawBody: string,
  headers: Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const secret = process.env.POLAR_WEBHOOK_SECRET;

  let payload: { type: string; data: Record<string, any>; id?: string };

  if (secret) {
    try {
      const lowerHeaders = Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
      );
      payload = (await webhooks.validateEvent(rawBody, lowerHeaders, secret)) as any;
    } catch (err) {
      console.error("[Polar Next.js Webhook] Validation failed:", err);
      return { status: 401, body: { error: "Geçersiz webhook kimlik doğrulaması." } };
    }
  } else {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { status: 400, body: { error: "Geçersiz webhook gövdesi." } };
    }
  }

  const evType = payload?.type;
  const data = payload?.data;
  if (!evType || !data) {
    return { status: 400, body: { error: "Eksik webhook alanları." } };
  }

  const tableName = getTable();
  if (!tableName) {
    // If DynamoDB is not configured in this runtime, accept event cleanly
    return { status: 200, body: { received: true, note: "table_not_configured" } };
  }

  const client = getDynamo();
  const eventId = (payload.id || data.id || `${evType}_${Date.now()}`) as string;

  // Idempotency check
  try {
    await client.send(
      new PutItemCommand({
        TableName: tableName,
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
      return { status: 200, body: { received: true, duplicate: true } };
    }
  }

  // 1. Order paid / created
  if (evType === "order.created" || evType === "order.paid") {
    const order = data;
    const userId =
      order.metadata?.userId ||
      order.customer?.external_id ||
      order.customer_metadata?.userId ||
      order.custom_field_data?.userId;

    if (userId) {
      const prodId = order.product_id || order.product?.id || order.metadata?.targetId || "";
      const credits = CREDIT_PACK_MAP[prodId] || Number(order.metadata?.credits) || 0;

      if (credits > 0 && (!order.subscription_id || order.metadata?.mode === "credit_pack")) {
        try {
          await client.send(
            new TransactWriteItemsCommand({
              TransactItems: [
                {
                  Put: {
                    TableName: tableName,
                    Item: marshall({
                      PK: `BILLING#POLAR_ORDER_${order.id}`,
                      SK: "RECEIPT",
                      userId,
                      credits,
                      orderId: order.id,
                      amount: order.total_amount,
                      currency: order.currency,
                    }),
                    ConditionExpression: "attribute_not_exists(PK)",
                  },
                },
                {
                  Update: {
                    TableName: tableName,
                    Key: marshall({ PK: `USER#${userId}`, SK: "CREDITS" }),
                    UpdateExpression: "ADD credits :credits",
                    ExpressionAttributeValues: marshall({ ":credits": credits }),
                  },
                },
              ],
            }),
          );
        } catch (txErr: unknown) {
          // If transaction failed due to receipt existing, it was already granted
          console.warn("[Polar Webhook] Order credit grant:", txErr);
        }
      }
    }
  }

  // 2. Subscription active / created / updated
  if (
    evType === "subscription.created" ||
    evType === "subscription.active" ||
    evType === "subscription.updated"
  ) {
    const sub = data;
    const userId =
      sub.metadata?.userId ||
      sub.customer?.external_id ||
      sub.customer_metadata?.userId;

    if (userId) {
      const prodId = sub.product_id || sub.product?.id || sub.metadata?.targetId || "";
      let tier = "pro";
      if (prodId.includes("explorer")) tier = "explorer";
      else if (prodId.includes("agency")) tier = "agency";
      else if (prodId.includes("pro")) tier = "pro";

      const status = sub.status || "active";
      const currentPeriodEnd = sub.current_period_end
        ? new Date(sub.current_period_end).toISOString()
        : new Date(Date.now() + 30 * 86400000).toISOString();
      const eventTime = Math.floor(Date.now() / 1000);

      try {
        await client.send(
          new UpdateItemCommand({
            TableName: tableName,
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
      } catch (subErr: unknown) {
        if ((subErr as { name?: string })?.name !== "ConditionalCheckFailedException") {
          console.warn("[Polar Webhook] Subscription update:", subErr);
        }
      }
    }
  }

  // 3. Subscription canceled / revoked
  if (evType === "subscription.canceled" || evType === "subscription.revoked") {
    const sub = data;
    const userId =
      sub.metadata?.userId ||
      sub.customer?.external_id ||
      sub.customer_metadata?.userId;

    if (userId) {
      const eventTime = Math.floor(Date.now() / 1000);
      try {
        await client.send(
          new UpdateItemCommand({
            TableName: tableName,
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
      } catch (cancelErr: unknown) {
        if ((cancelErr as { name?: string })?.name !== "ConditionalCheckFailedException") {
          console.warn("[Polar Webhook] Subscription cancel:", cancelErr);
        }
      }
    }
  }

  return { status: 200, body: { received: true } };
}
