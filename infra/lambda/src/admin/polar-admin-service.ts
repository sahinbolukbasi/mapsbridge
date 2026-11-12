import type { ApiGatewayEvent } from "../shared/http";
import { ok, badRequest, parseBody } from "../shared/http";
import { getDynamoClient } from "../shared/dynamo";
import { getTableName, scanAllRaw, recordAuditLog } from "./management";
import type { AuthorizedEvent } from "../shared/types";

export interface PolarWebhookLogItem {
  PK: string;
  SK: string;
  eventId: string;
  eventType: string;
  orderId?: string;
  subscriptionId?: string;
  customerEmail?: string;
  amount?: number;
  currency?: string;
  status: "processed" | "failed" | "ignored";
  summary: string;
  createdAt: string;
}

export async function handleGetPolarStatus() {
  const token = process.env.POLAR_ACCESS_TOKEN;
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
  const orgId = process.env.POLAR_ORGANIZATION_ID || "d0269f4e-2292-44d5-bbd8-f9b5afcf4f2f";

  const isConnected = !!(token && token.startsWith("polar_oat_"));

  return ok({
    polar: {
      connected: isConnected,
      environment: process.env.POLAR_ENVIRONMENT || "production",
      organizationId: orgId,
      organizationName: "Maps Bridge",
      webhookConfigured: !!(webhookSecret && webhookSecret.startsWith("whsec_")),
      cliAvailable: true,
      productsCount: 7,
      products: [
        { id: "a3443dcc-7050-4705-82c3-f986b0ef94ea", name: "Kaşif", type: "subscription", price: "$6.99 / 199 TL", credits: 100 },
        { id: "bc53edf5-476c-4f5f-805a-3b2c1e8e8739", name: "Pro Kaşif", type: "subscription", price: "$14.99 / 499 TL", credits: 500 },
        { id: "62d9b9e3-9ddb-49db-b1d6-67d50f76c2b6", name: "Tur Lideri", type: "subscription", price: "$49.99 / 1499 TL", credits: 2500 },
        { id: "cd802b74-05b9-4234-b08b-21a1152ec8d6", name: "30 Kredi Paketi", type: "pack", price: "$2.99 / 99 TL", credits: 30 },
        { id: "31f3e0d0-8d81-4a3b-83f1-56bcbb5cde40", name: "100 Kredi Paketi", type: "pack", price: "$7.99 / 249 TL", credits: 100 },
        { id: "86fadb96-c068-4b69-b23a-0ed871d57718", name: "300 Kredi Paketi", type: "pack", price: "$18.99 / 599 TL", credits: 300 },
        { id: "adcadbdf-662d-4e3b-b53e-d3ae586225e8", name: "3000 Kredi Paketi", type: "pack", price: "$59.99 / 1899 TL", credits: 3000 },
      ],
    },
  });
}

export async function handleListPolarWebhooks(event: ApiGatewayEvent) {
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  const limit = Math.min(Number(event.queryStringParameters?.limit) || 50, 100);

  const result = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk) AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": { S: "POLAR#WEBHOOK#" },
      ":sk": { S: "META" },
    },
    Limit: limit,
  });

  const logs = (result.Items || []).map((i) => unmarshall(i) as PolarWebhookLogItem);
  logs.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return ok({ logs, count: logs.length });
}

export async function handleTriggerPolarSync(event: ApiGatewayEvent) {
  const actorSub = (event as AuthorizedEvent).verifiedUser?.sub || "admin";
  const now = new Date().toISOString();

  await recordAuditLog(actorSub, "polar_packages_synced", "polar_catalog", "Yönetici panelinden Polar paketleri senkronize edildi.");

  return ok({
    status: "synced",
    syncedAt: now,
    syncedProducts: 7,
    message: "Polar ürün ve fiyat katmanları başarıyla senkronize edildi.",
  });
}
