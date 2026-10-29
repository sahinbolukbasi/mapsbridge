import { verifiedUserId } from "../shared/auth";
import { resolveUserId } from "../shared/with-auth";
/**
 * MapsBridge Routes Domain — Lambda handler
 * Routes: GET/POST/PUT/DELETE /routes, /routes/{id}
 *         POST /routes/{id}/share, GET /routes/{id}/osrm/{profile}
 *         POST /ai/route-planner (Bedrock integration with token rate-limit)
 *
 * OSRM integration: uses the open OSRM demo server (router.project-osrm.org)
 * for driving/walking/cycling route profiles. For production, deploy a
 * self-hosted OSRM instance or use Mapbox Directions API.
 */

import type { ApiGatewayEvent, ApiResponse } from "../shared/http";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  jsonResponse,
  forbidden,
  notFound,
  serverError,
  handlePreflight as _handlePreflight,
  extractBearerToken,
  parseBody,
} from "../shared/http";
import { Router } from "../shared/router";
import { read, subscription } from "../shared/data";
import { handler as slackBotHandler } from "../slack-bot";
import { getDynamoClient } from "../shared/dynamo";

// Augmented event type used to thread the verified user across route handlers
type EventWithUser = ApiGatewayEvent & { verifiedUser?: { sub: string } | null };

// OSRM leg/step shapes for typed route responses
type OsrmStep = {
  distance: number;
  duration: number;
  maneuver?: {
    instruction?: string;
    bearing_after?: number;
    type?: string;
    modifier?: string;
    location?: unknown;
  };
};
type OsrmLeg = {
  distance: number;
  duration: number;
  steps?: OsrmStep[];
};

const router = new Router();

// Slack Bot routes — bridge between ApiGatewayEvent and slack-bot's narrower event type
const slackRoute = async (event: ApiGatewayEvent): Promise<ApiResponse> => {
  const result = await slackBotHandler(event as unknown as Parameters<typeof slackBotHandler>[0]);
  return { ...result, headers: { "content-type": "application/json" } };
};
router.add("POST /slack-bot/deploy", slackRoute);
router.add("POST /slack-bot/status", slackRoute);
router.add("POST /slack-bot/health", slackRoute);
router.add("POST /slack-bot/logs", slackRoute);
router.add("POST /slack-bot/rollback", slackRoute);
router.add("POST /slack-bot/interactive", slackRoute);
router.add("POST /slack-bot/events", slackRoute);

router.add("GET /routes", handleListRoutes);
router.add("POST /routes", handleCreateRoute);
router.add("GET /routes/{id}", handleGetRoute);
router.add("PUT /routes/{id}", handleUpdateRoute);
router.add("DELETE /routes/{id}", handleDeleteRoute);
router.add("POST /routes/{id}/share", handleShareRoute);
router.add("GET /routes/{id}/osrm/{profile}", handleOsrmRoute);
router.add("POST /ai/route-planner", handleAiRoutePlanner);
router.add("GET /media/presign-upload", handlePresignUpload);
router.add("POST /routes/telemetry", handleTelemetry);
router.add("GET /user/saved-addresses", handleGetSavedAddresses);
router.add("PUT /user/saved-addresses", handlePutSavedAddresses);
router.add("GET /user/ai-memory", handleGetAiMemory);
router.add("PUT /user/ai-memory", handlePutAiMemory);
router.add("GET /user/affiliate-stats", handleGetAffiliateStats);
router.add("GET /prices/flights", handleGetFlightPrices);
router.add("GET /prices/hotels", handleGetHotelPrices);
router.add("GET /prices/popular", handleGetPopularRoutes);

export const handler = async (event: ApiGatewayEvent) => {
  try {
    const method = event.requestContext.http.method;
    const path = event.requestContext.http.path;

    if (path === "/health" && method === "GET") {
      return ok({ status: "ok", service: "routes", timestamp: new Date().toISOString() });
    }
    // Slack bot routes: auth handled internally via HMAC signing secret
    if (path.startsWith("/slack-bot/")) {
      return await router.dispatch(event);
    }
    if (path === "/routes/telemetry" && method === "POST") {
      const token = extractBearerToken(event);
      const sub = token ? await verifiedUserId(token) : null;
      (event as EventWithUser).verifiedUser = sub ? { sub } : null;
      return await handleTelemetry(event);
    }
    if (["POST", "PUT", "DELETE"].includes(method)) {
      const sub = await verifiedUserId(extractBearerToken(event));
      if (!sub) return unauthorized();
      (event as EventWithUser).verifiedUser = { sub };
      const config = await read("SYSTEM#CONFIG", "META");
      if (config?.maintenanceMode)
        return jsonResponse(503, {
          error:
            config.maintenanceMessage || "Bakım nedeniyle yazma işlemleri geçici olarak kapalı.",
        });
      if (
        event.requestContext.http.path === "/routes" &&
        method === "POST" &&
        config?.routeCreationEnabled === false
      )
        return forbidden("Yeni rota oluşturma geçici olarak kapalı.");
      if (event.requestContext.http.path.endsWith("/share") && config?.sharesEnabled === false)
        return forbidden("Yeni paylaşım oluşturma geçici olarak kapalı.");
    }
    return await router.dispatch(event);
  } catch (err) {
    console.error(`[Routes] Error:`, err);
    return serverError();
  }
};

// ─── DynamoDB helpers ─────────────────────────────────────────────────────
function getTableName(): string {
  return process.env.DYNAMODB_TABLE || `mapsbridge-${process.env.ENVIRONMENT}-data`;
}

// ─── List Routes (user's saved routes) ────────────────────────────────────
async function handleListRoutes(event: ApiGatewayEvent) {
  const userId = await resolveUserId(event);
  if (!userId) return unauthorized();

  const { QueryCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  const result = await ddb.send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": { S: `USER#${userId}` }, ":sk": { S: "ROUTE#" } },
    }),
  );

  const items = (result.Items || []).map((i) => unmarshall(i));
  return ok({ routes: items });
}

// ─── Create Route ─────────────────────────────────────────────────────────
async function handleCreateRoute(event: ApiGatewayEvent) {
  const userId = await resolveUserId(event);
  if (!userId) return unauthorized();

  const body = parseBody<{ name?: string; stops?: unknown[]; days?: unknown[]; isPublic?: boolean }>(event);
  if (!body?.name) return badRequest("Rota adı zorunludur.");

  const routeId = crypto.randomUUID();
  const now = new Date().toISOString();

  const { PutItemCommand, QueryCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  // Free tier limit enforcement (max 3 routes)
  const userTier = (await subscription(userId)).tier;
  if (userTier === "free") {
    const existing = await ddb.send(
      new QueryCommand({
        TableName: getTableName(),
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": { S: `USER#${userId}` }, ":sk": { S: "ROUTE#" } },
        Select: "COUNT",
      }),
    );
    if ((existing.Count || 0) >= 3) {
      return {
        statusCode: 403,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error:
            "Ücretsiz Gezgin planında en fazla 3 aktif rota oluşturabilirsiniz. Sınırsız rota kaydetmek için Kaşif veya Pro Plana geçin.",
          code: "ROUTE_LIMIT_REACHED",
          upgradeUrl: "/odeme/?tab=plans",
        }),
      };
    }
  }

  await ddb.send(
    new PutItemCommand({
      TableName: getTableName(),
      Item: marshall({
        PK: `USER#${userId}`,
        SK: `ROUTE#${routeId}`,
        routeId,
        name: body.name.slice(0, 120),
        stops: (body.stops || []).slice(0, 50),
        days: (body.days || []).slice(0, 30),
        isPublic: body.isPublic ?? false,
        createdAt: now,
        updatedAt: now,
        userId,
      }),
    }),
  );

  return created({ routeId, name: body.name });
}

// ─── Get Route ────────────────────────────────────────────────────────────
async function handleGetRoute(event: ApiGatewayEvent) {
  const userId = await resolveUserId(event);
  if (!userId) return unauthorized();

  const routeId = event.pathParameters?.id;
  if (!routeId) return badRequest("Rota ID gerekli.");

  const { GetItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  const result = await ddb.send(
    new GetItemCommand({
      TableName: getTableName(),
      Key: { PK: { S: `USER#${userId}` }, SK: { S: `ROUTE#${routeId}` } },
    }),
  );

  if (!result.Item) return notFound("Rota bulunamadı.");
  return ok(unmarshall(result.Item));
}

// ─── Update Route ─────────────────────────────────────────────────────────
async function handleUpdateRoute(event: ApiGatewayEvent) {
  const userId = await resolveUserId(event);
  if (!userId) return unauthorized();

  const routeId = event.pathParameters?.id;
  if (!routeId) return badRequest("Rota ID gerekli.");

  const current = await read(`USER#${userId}`, `ROUTE#${routeId}`);
  if (!current) return notFound("Rota bulunamadı.");
  if (current.adminStatus === "suspended")
    return forbidden("Askıdaki rota yönetici onayı olmadan değiştirilemez.");

  const body = parseBody<{ name?: string; stops?: unknown[]; days?: unknown[]; isPublic?: boolean }>(event);
  if (!body) return badRequest("Güncelleme verisi gerekli.");

  const { UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  const updateExpr: string[] = ["updatedAt = :now"];
  const exprAttr: Record<string, unknown> = { ":now": new Date().toISOString() };
  const names: Record<string, string> = {};

  if (body.name !== undefined) {
    updateExpr.push("#name = :name");
    names["#name"] = "name";
    exprAttr[":name"] = body.name.slice(0, 120);
  }
  if (body.stops !== undefined) {
    updateExpr.push("stops = :stops");
    exprAttr[":stops"] = body.stops.slice(0, 50);
  }
  if (body.days !== undefined) {
    updateExpr.push("days = :days");
    exprAttr[":days"] = body.days.slice(0, 30);
  }
  if (body.isPublic !== undefined) {
    updateExpr.push("isPublic = :pub");
    exprAttr[":pub"] = body.isPublic;
  }

  await ddb.send(
    new UpdateItemCommand({
      TableName: getTableName(),
      Key: { PK: { S: `USER#${userId}` }, SK: { S: `ROUTE#${routeId}` } },
      UpdateExpression: `SET ${updateExpr.join(", ")}`,
      ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
      ExpressionAttributeValues: marshall(exprAttr),
      ConditionExpression: "attribute_exists(PK)",
    }),
  );

  return ok({ status: "updated", routeId });
}

// ─── Delete Route ─────────────────────────────────────────────────────────
async function handleDeleteRoute(event: ApiGatewayEvent) {
  const userId = await resolveUserId(event);
  if (!userId) return unauthorized();

  const routeId = event.pathParameters?.id;
  if (!routeId) return badRequest("Rota ID gerekli.");

  const { DeleteItemCommand } = await import("@aws-sdk/client-dynamodb");
  const ddb = getDynamoClient();

  await ddb.send(
    new DeleteItemCommand({
      TableName: getTableName(),
      Key: { PK: { S: `USER#${userId}` }, SK: { S: `ROUTE#${routeId}` } },
    }),
  );

  return ok({ status: "deleted" });
}

// ─── Share Route ──────────────────────────────────────────────────────────
async function handleShareRoute(event: ApiGatewayEvent) {
  const userId = await resolveUserId(event);
  if (!userId) return unauthorized();

  const routeId = event.pathParameters?.id;
  if (!routeId) return badRequest("Rota ID gerekli.");

  const current = await read(`USER#${userId}`, `ROUTE#${routeId}`);
  if (!current) return notFound("Rota bulunamadı.");
  if (current.adminStatus === "suspended") return forbidden("Askıdaki rota paylaşılamaz.");

  const body = parseBody<{ expiresInHours?: number }>(event);
  const expiresInHours = Math.min(Math.max(body?.expiresInHours || 24, 1), 168); // 1h–7d

  const shareCode = crypto.randomUUID().slice(0, 8);
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInHours * 3600;

  const { PutItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  await ddb.send(
    new PutItemCommand({
      TableName: getTableName(),
      Item: marshall({
        PK: `SHARE#${shareCode}`,
        SK: "ROUTE",
        routeId,
        userId,
        expiresAt,
        createdAt: new Date().toISOString(),
      }),
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );

  return created({ shareCode, expiresAt, url: `/s/${shareCode}` });
}

// ─── OSRM Route (real road routing) ───────────────────────────────────────
async function handleOsrmRoute(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  const userId = token ? await verifiedUserId(token) : null;
  if (!userId) return unauthorized();

  const profile = event.pathParameters?.profile || "driving";
  const validProfiles = ["driving", "walking", "cycling"];
  if (!validProfiles.includes(profile)) {
    return badRequest(
      `Geçersiz rota profili: ${profile}. Şunlardan biri olmalı: ${validProfiles.join(", ")}`,
    );
  }

  const coords = event.queryStringParameters?.coords;
  if (!coords) return badRequest("coords parametresi gerekli (format: lon1,lat1;lon2,lat2;...)");

  const COORDS_RE =
    /^(-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?)(;-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?)*$/;
  if (!COORDS_RE.test(coords))
    return badRequest("coords formatı geçersiz (beklenen: lon,lat;lon,lat;...)");

  // OSRM_BASE_URL ayarlı değilse public demo sunucuya düşülür. Demo sunucu
  // rate-limit uygular ve production için uygun değildir — görünür uyarı bırak.
  const osrmBase = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";
  if (!process.env.OSRM_BASE_URL) {
    console.warn(
      "[routes] OSRM_BASE_URL tanımlı değil — public demo sunucu (router.project-osrm.org) kullanılıyor. Production'da rate-limit riski var; OSRM_BASE_URL ayarlayın.",
    );
  }
  const url = `${osrmBase}/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=true&alternatives=false`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      return badRequest(`OSRM hatası: ${response.status}`);
    }
    const data = (await response.json()) as {
      code?: string;
      message?: string;
      routes?: Array<{ distance: number; duration: number; geometry: unknown; legs?: OsrmLeg[] }>;
    };
    if (data.code !== "Ok") {
      return badRequest(`OSRM: ${data.message || "Rota hesaplanamadı."}`);
    }

    const route = data.routes?.[0];
    if (!route) return badRequest("Rota bulunamadı.");

    return ok({
      distance: route.distance, // meters
      duration: route.duration, // seconds
      polyline: route.geometry, // GeoJSON LineString
      legs: route.legs?.map((leg) => ({
        distance: leg.distance,
        duration: leg.duration,
        steps: leg.steps?.map((step) => ({
          instruction: step.maneuver?.instruction || "",
          distance: step.distance,
          duration: step.duration,
          bearingAfter: step.maneuver?.bearing_after,
          type: step.maneuver?.type,
          modifier: step.maneuver?.modifier,
          location: step.maneuver?.location,
        })),
      })),
      profile,
    });
  } catch (err: unknown) {
    console.error("[OSRM Error]", err);
    return serverError("Rota hesaplanamadı. Lütfen tekrar deneyin.");
  }
}

// ─── AI Route Planner (Bedrock + Token Rate Limit) ────────────────────────
async function handleAiRoutePlanner(_event: ApiGatewayEvent) {
  // All billable AI work belongs to the canonical handler with atomic credit reservations.
  return {
    statusCode: 410,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ error: "AI servisi yeni güvenli uç noktaya taşındı." }),
  };
}

// Media signing remains available while the legacy AI route is retired.
async function handlePresignUpload(event: ApiGatewayEvent) {
  const userId = await verifiedUserId(extractBearerToken(event));
  if (!userId) return unauthorized();
  const query = event.queryStringParameters || {};
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensions[query.contentType || ""];
  const category = query.category || "traveler-photos";
  if (!extension || !["avatars", "route-covers", "traveler-photos"].includes(category))
    return badRequest("Desteklenmeyen görsel türü.");
  if (!process.env.MEDIA_BUCKET || !process.env.MEDIA_PUBLIC_BASE_URL)
    return serverError("Medya servisi yapılandırılmadı.");
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const fileKey = `${category}/${userId}/${crypto.randomUUID()}.${extension}`;
  const uploadUrl = await getSignedUrl(
    new S3Client({ region: process.env.AWS_REGION }),
    new PutObjectCommand({
      Bucket: process.env.MEDIA_BUCKET,
      Key: fileKey,
      ContentType: query.contentType,
    }),
    { expiresIn: 300 },
  );
  return ok({
    uploadUrl,
    fileKey,
    publicUrl: `${process.env.MEDIA_PUBLIC_BASE_URL.replace(/\/$/, "")}/${fileKey}`,
    expiresInSeconds: 300,
  });
}

// ─── Interaction Telemetry Logger (Behavioral Analytics) ───────────────────
async function handleTelemetry(event: ApiGatewayEvent) {
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

async function handleGetSavedAddresses(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const { GetItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const tableName =
    process.env.DYNAMODB_TABLE || `mapsbridge-${process.env.ENVIRONMENT || "prod"}-data`;
  const ddb = getDynamoClient();

  const result = await ddb.send(
    new GetItemCommand({
      TableName: tableName,
      Key: { PK: { S: `USER#${userId}` }, SK: { S: "SAVED_ADDRESSES" } },
    }),
  );

  const addresses = result.Item ? (unmarshall(result.Item).addresses ?? []) : [];
  return ok({ addresses });
}

async function handlePutSavedAddresses(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const body = parseBody<{ addresses?: unknown[] }>(event);
  if (!body || !Array.isArray(body.addresses)) return badRequest("addresses array gerekli.");
  if (body.addresses.length > 500) return badRequest("En fazla 500 adres kaydedilebilir.");

  const { PutItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const tableName =
    process.env.DYNAMODB_TABLE || `mapsbridge-${process.env.ENVIRONMENT || "prod"}-data`;
  const ddb = getDynamoClient();

  await ddb.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall({
        PK: `USER#${userId}`,
        SK: "SAVED_ADDRESSES",
        addresses: body.addresses,
        updatedAt: new Date().toISOString(),
      }),
    }),
  );

  return ok({ status: "saved", count: body.addresses.length });
}

// ─── Affiliate Revenue Analytics ──────────────────────────────────────────
async function handleGetAffiliateStats(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const { QueryCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffSK = `TELEMETRY#${cutoff.getTime()}`;

  const result = await ddb.send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: "PK = :pk AND SK >= :since",
      FilterExpression: "contains(events[0].#type, :evType)",
      ExpressionAttributeNames: { "#type": "type" },
      ExpressionAttributeValues: {
        ":pk": { S: `USER#${userId}` },
        ":since": { S: cutoffSK },
        ":evType": { S: "affiliate" },
      },
      Limit: 200,
    }),
  );

  const rows = (result.Items || []).map((i) => unmarshall(i));

  let totalClicks = 0;
  const byDestination: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byWeek: Record<string, number> = {};

  for (const row of rows) {
    for (const ev of row.events || []) {
      if (!ev.type?.includes("affiliate")) continue;
      totalClicks++;
      const dest = ev.destination || "unknown";
      const evType = ev.type || "affiliate_click";
      const week = ev.coarseWeek || row.updatedAt?.slice(0, 10) || "unknown";
      byDestination[dest] = (byDestination[dest] || 0) + 1;
      byType[evType] = (byType[evType] || 0) + 1;
      byWeek[week] = (byWeek[week] || 0) + 1;
    }
  }

  const topDestinations = Object.entries(byDestination)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([destination, clicks]) => ({ destination, clicks }));

  const weeklyTrend = Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, clicks]) => ({ week, clicks }));

  return ok({
    affiliate: {
      period: "last_30_days",
      totalClicks,
      byType,
      topDestinations,
      weeklyTrend,
      note: "Gelir raporlama için Travelpayouts dashboard'unu kullanın. Bu veriler tıklama sayımlarıdır.",
    },
  });
}

// ─── AI User Memory ────────────────────────────────────────────────────────
async function handleGetAiMemory(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const { GetItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  const result = await ddb.send(
    new GetItemCommand({
      TableName: getTableName(),
      Key: { PK: { S: `USER#${userId}` }, SK: { S: "AI_MEMORY" } },
    }),
  );

  const memory = result.Item ? unmarshall(result.Item).memory ?? {} : {};
  return ok({ memory });
}

async function handlePutAiMemory(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const body = parseBody<{ memory?: Record<string, unknown> }>(event);
  if (!body || typeof body.memory !== "object" || Array.isArray(body.memory))
    return badRequest("memory object gerekli.");

  const { PutItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  await ddb.send(
    new PutItemCommand({
      TableName: getTableName(),
      Item: marshall({
        PK: `USER#${userId}`,
        SK: "AI_MEMORY",
        memory: body.memory,
        updatedAt: new Date().toISOString(),
      }),
    }),
  );

  return ok({ status: "saved" });
}

// ─── Travelpayouts Price Endpoints ─────────────────────────────────────────

async function handleGetFlightPrices(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const q = event.queryStringParameters || {};
  const origin = (q.origin || "IST").toUpperCase().slice(0, 3);
  const destination = (q.destination || "").toUpperCase().slice(0, 3);
  if (!destination) return badRequest("destination parametresi gerekli (IATA kodu, örn: BCN)");
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination))
    return badRequest("Geçersiz IATA kodu.");

  try {
    const { getCheapestFlights } = await import("../shared/travelpayouts");
    const prices = await getCheapestFlights({
      origin,
      destination,
      currency: q.currency || "usd",
      departDate: q.departDate,
      returnDate: q.returnDate,
    });
    return ok({ origin, destination, prices, currency: q.currency || "usd", source: "travelpayouts_cache" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "TP_RATE_LIMIT") return jsonResponse(429, { error: "Fiyat servisi meşgul, lütfen tekrar deneyin." });
    console.error("[TP Flights]", msg);
    return serverError("Uçuş fiyatları alınamadı.");
  }
}

async function handleGetHotelPrices(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const q = event.queryStringParameters || {};
  const location = (q.location || q.destination || "").trim();
  if (!location) return badRequest("location parametresi gerekli (şehir adı)");

  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 86400000);
  const checkIn = q.checkIn || today.toISOString().slice(0, 10);
  const checkOut = q.checkOut || nextWeek.toISOString().slice(0, 10);

  try {
    const { getHotelPrices } = await import("../shared/travelpayouts");
    const hotels = await getHotelPrices({
      location,
      checkIn,
      checkOut,
      adultsCount: q.adults ? parseInt(q.adults, 10) : 2,
      currency: q.currency || "usd",
      limit: 10,
    });
    return ok({ location, checkIn, checkOut, hotels, currency: q.currency || "usd", source: "hotellook_cache" });
  } catch (err: unknown) {
    console.error("[TP Hotels]", err instanceof Error ? err.message : String(err));
    return serverError("Otel fiyatları alınamadı.");
  }
}

async function handleGetPopularRoutes(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const q = event.queryStringParameters || {};
  const origin = (q.origin || "IST").toUpperCase().slice(0, 3);
  if (!/^[A-Z]{3}$/.test(origin)) return badRequest("Geçersiz IATA kodu.");

  try {
    const { getPopularDestinations } = await import("../shared/travelpayouts");
    const destinations = await getPopularDestinations({
      origin,
      currency: q.currency || "usd",
      limit: 10,
    });
    return ok({ origin, destinations, currency: q.currency || "usd", source: "travelpayouts_popular" });
  } catch (err: unknown) {
    console.error("[TP Popular]", err instanceof Error ? err.message : String(err));
    return serverError("Popüler rotalar alınamadı.");
  }
}
