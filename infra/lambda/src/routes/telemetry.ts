// Davranışsal Analitik Telemetri (R6 — routes/index.ts'ten ayrıldı)
// -----------------------------------------------------------------
// Kullanıcı etkileşim olaylarını (davranışsal analitik) DynamoDB'ye yazar.
// routes/index.ts "kova" god-file'ından çıkarıldı; davranış BİREBİR korundu.
// Router kaydı (POST /routes/telemetry) index.ts'te kalır.
//
// Not (I5): davranıştan sinyal toplanır; demografiden ilgi ÇIKARILMAZ — bu handler
// yalnız ham olay yazar, yorumlamaz. TTL 90 gün.

import type { ApiGatewayEvent } from "../shared/http";
import {
  extractBearerToken,
  unauthorized,
  badRequest,
  ok,
  parseBody,
} from "../shared/http";
import { verifiedUserId } from "../shared/auth";
import { getDynamoClient, getTableName } from "../shared/dynamo";

export async function handleTelemetry(event: ApiGatewayEvent) {
  try {
    // Require authentication — anonymous writes are not accepted
    const token = extractBearerToken(event);
    if (!token) return unauthorized();
    const userId = await verifiedUserId(token);
    if (!userId) return unauthorized();
    // Payload size guard (raw body must not exceed 32 KB)
    const rawBody = event.body || "";
    if (rawBody.length > 32768) return badRequest("Telemetry payload too large.");
    const body = parseBody<{ events?: Array<Record<string, unknown>> }>(event);
    if (!body?.events || !Array.isArray(body.events) || body.events.length === 0) {
      return ok({ received: 0 });
    }
    // Size limit: accept at most 10 events per request
    if (body.events.length > 10) return badRequest("Too many events; maximum is 10 per request.");
    // Schema validation: each event must have type (string ≤50) and ts (number)
    for (const ev of body.events) {
      if (!ev || typeof ev !== "object") return badRequest("Each event must be an object.");
      if (typeof ev.type !== "string" || ev.type.length === 0 || ev.type.length > 50)
        return badRequest("Each event must have a valid 'type' string (max 50 chars).");
      if (typeof ev.ts !== "number" || !Number.isFinite(ev.ts))
        return badRequest("Each event must have a valid numeric 'ts' timestamp.");
    }
    const { PutItemCommand } = await import("@aws-sdk/client-dynamodb");
    const { marshall } = await import("@aws-sdk/util-dynamodb");
    const ddb = getDynamoClient();
    const batch = body.events.slice(0, 10);
    const now = new Date().toISOString();
    const batchId = crypto.randomUUID().slice(0, 8);
    await ddb.send(
      new PutItemCommand({
        TableName: getTableName(),
        Item: marshall({
          PK: `USER#${userId}`,
          SK: `TELEMETRY#${Date.now()}#${batchId}`,
          userId,
          events: batch,
          count: batch.length,
          updatedAt: now,
          // Expire telemetry records after 90 days
          ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
        }),
      }),
    );
    return ok({ received: batch.length, status: "logged" });
  } catch (err: unknown) {
    console.error("[Telemetry Error]", err);
    return ok({ received: 0, status: "fallback" });
  }
}
