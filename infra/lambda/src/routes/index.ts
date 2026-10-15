import { verifiedUserId } from "../shared/auth";
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

import type { ApiGatewayEvent } from "../shared/http";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  jsonResponse,
  forbidden,
  notFound,
  serverError,
  handlePreflight,
  extractBearerToken,
  parseBody,
} from "../shared/http";
import { Router } from "../shared/router";
import { read, subscription } from "../shared/data";

const router = new Router();

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

export const handler = async (event: ApiGatewayEvent) => {
  try {
    const method = event.requestContext.http.method;
    const path = event.requestContext.http.path;
    if (path === "/routes/telemetry" && method === "POST") {
      const token = extractBearerToken(event);
      const sub = token ? await verifiedUserId(token) : null;
      (event as any).verifiedUser = sub ? { sub } : null;
      return await handleTelemetry(event);
    }
    if (["POST", "PUT", "DELETE"].includes(method)) {
      const sub = await verifiedUserId(extractBearerToken(event));
      if (!sub) return unauthorized();
      (event as any).verifiedUser = { sub };
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
async function getDdb() {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  return new DynamoDBClient({ region: process.env.AWS_REGION });
}

function getTableName(): string {
  return process.env.DYNAMODB_TABLE || `mapsbridge-${process.env.ENVIRONMENT}-data`;
}

// ─── List Routes (user's saved routes) ────────────────────────────────────
async function handleListRoutes(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = (event as any).verifiedUser?.sub || (await verifiedUserId(token));
  if (!userId) return unauthorized();

  const { DynamoDBClient, QueryCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

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
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = (event as any).verifiedUser?.sub || (await verifiedUserId(token));
  if (!userId) return unauthorized();

  const body = parseBody<{ name?: string; stops?: any[]; days?: any[]; isPublic?: boolean }>(event);
  if (!body?.name) return badRequest("Rota adı zorunludur.");

  const routeId = crypto.randomUUID();
  const now = new Date().toISOString();

  const { DynamoDBClient, PutItemCommand, QueryCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

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
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = (event as any).verifiedUser?.sub || (await verifiedUserId(token));
  if (!userId) return unauthorized();

  const routeId = event.pathParameters?.id;
  if (!routeId) return badRequest("Rota ID gerekli.");

  const { DynamoDBClient, GetItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

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
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = (event as any).verifiedUser?.sub || (await verifiedUserId(token));
  if (!userId) return unauthorized();

  const routeId = event.pathParameters?.id;
  if (!routeId) return badRequest("Rota ID gerekli.");

  const current = await read(`USER#${userId}`, `ROUTE#${routeId}`);
  if (!current) return notFound("Rota bulunamadı.");
  if (current.adminStatus === "suspended")
    return forbidden("Askıdaki rota yönetici onayı olmadan değiştirilemez.");

  const body = parseBody<{ name?: string; stops?: any[]; days?: any[]; isPublic?: boolean }>(event);
  if (!body) return badRequest("Güncelleme verisi gerekli.");

  const { DynamoDBClient, UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const updateExpr: string[] = ["updatedAt = :now"];
  const exprAttr: Record<string, any> = { ":now": new Date().toISOString() };
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
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = (event as any).verifiedUser?.sub || (await verifiedUserId(token));
  if (!userId) return unauthorized();

  const routeId = event.pathParameters?.id;
  if (!routeId) return badRequest("Rota ID gerekli.");

  const { DynamoDBClient, DeleteItemCommand } = await import("@aws-sdk/client-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

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
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = (event as any).verifiedUser?.sub || (await verifiedUserId(token));
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

  const { DynamoDBClient, PutItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

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

  const osrmBase = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";
  const url = `${osrmBase}/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=true&alternatives=false`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      return badRequest(`OSRM hatası: ${response.status}`);
    }
    const data = (await response.json()) as {
      code?: string;
      message?: string;
      routes?: Array<{ distance: number; duration: number; geometry: unknown; legs?: any[] }>;
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
      legs: route.legs?.map((leg: any) => ({
        distance: leg.distance,
        duration: leg.duration,
        steps: leg.steps?.map((step: any) => ({
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
  } catch (err: any) {
    console.error("[OSRM Error]", err);
    return serverError("Rota hesaplanamadı. Lütfen tekrar deneyin.");
  }
}

// ─── AI Route Planner (Bedrock + Token Rate Limit) ────────────────────────
async function handleAiRoutePlanner(event: ApiGatewayEvent) {
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

    const body = parseBody<{ events?: any[] }>(event);
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

    const { DynamoDBClient, PutItemCommand } = await import("@aws-sdk/client-dynamodb");
    const { marshall } = await import("@aws-sdk/util-dynamodb");
    const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

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
  } catch (err: any) {
    console.error("[Telemetry Error]", err);
    return ok({ received: 0, status: "fallback" });
  }
}
