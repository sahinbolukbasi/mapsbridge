import type { ApiGatewayEvent } from "../shared/http";
import { ok, badRequest, notFound, parseBody } from "../shared/http";
import { read } from "../shared/data";
import { getTableName, scanAllRaw, findRouteRecord, recordAuditLog } from "./management";
import { handleSuspendUser } from "./users";

export async function handleListReports(event: ApiGatewayEvent) {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const status = event.queryStringParameters?.status;
  const limit = Math.min(Number(event.queryStringParameters?.limit) || 50, 100);

  const result = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: status
      ? "begins_with(PK, :pk) AND SK = :sk AND #status = :status"
      : "begins_with(PK, :pk) AND SK = :sk",
    ExpressionAttributeNames: status ? { "#status": "status" } : undefined,
    ExpressionAttributeValues: status
      ? { ":pk": { S: "REPORT#" }, ":sk": { S: "META" }, ":status": { S: status } }
      : { ":pk": { S: "REPORT#" }, ":sk": { S: "META" } },
    Limit: limit,
  });

  const reports = (result.Items || []).map((i) => unmarshall(i));
  return ok({ reports, count: reports.length });
}

export async function handleResolveReport(event: ApiGatewayEvent) {
  const reportId = event.pathParameters?.id;
  if (!reportId) return badRequest("Şikâyet ID gerekli.");

  const body = parseBody<{ action?: "dismiss" | "hide_content" | "suspend_user"; notes?: string }>(event);
  const action = body?.action;
  if (!action || !["dismiss", "hide_content", "suspend_user"].includes(action))
    return badRequest("Geçerli şikâyet işlemi gerekli.");
  const report = await read(`REPORT#${reportId}`, "META");
  if (!report) return notFound("Şikâyet bulunamadı.");
  if (report.status !== "pending") return badRequest("Şikâyet zaten karara bağlanmış.");
  if (action === "hide_content" && report.contentType !== "route")
    return badRequest("Bu içerik türü için gizleme desteklenmiyor.");
  if (action === "suspend_user" && report.contentType !== "user")
    return badRequest("Şikâyet bir kullanıcıyı hedeflemiyor.");
  const notes = body?.notes?.trim() || "Şikâyet yönetici tarafından incelendi.";

  const { DynamoDBClient, UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  if (action !== "dismiss") {
    const targetEvent = {
      ...event,
      pathParameters: { id: report.contentId },
      body: JSON.stringify({ action: "suspend", reason: notes }),
      isBase64Encoded: false,
    };
    const outcome =
      action === "hide_content"
        ? await handleAdminRouteAction(targetEvent)
        : await handleSuspendUser(targetEvent);
    if (outcome.statusCode !== 200) return outcome;
  }
  const now = new Date().toISOString();
  await ddb.send(
    new UpdateItemCommand({
      TableName: getTableName(),
      Key: marshall({ PK: `REPORT#${reportId}`, SK: "META" }),
      UpdateExpression:
        "SET #status = :status, resolvedAt = :now, resolutionAction = :action, resolutionNotes = :notes",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: marshall({
        ":status": action === "dismiss" ? "dismissed" : "resolved",
        ":now": now,
        ":action": action,
        ":notes": notes,
      }),
    }),
  );

  const actorSub = (event as any).verifiedUser?.sub || "admin";
  await recordAuditLog(actorSub, `report_${action}`, reportId, notes);

  return ok({
    status: action === "dismiss" ? "dismissed" : "resolved",
    reportId,
    action,
    resolvedAt: now,
  });
}

export async function handleAuditLogs(event: ApiGatewayEvent) {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const limit = Math.min(Number(event.queryStringParameters?.limit) || 50, 100);

  const result = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk) AND SK = :sk",
    ExpressionAttributeValues: { ":pk": { S: "AUDIT#" }, ":sk": { S: "META" } },
    Limit: limit,
  });

  const logs = (result.Items || []).map((i) => unmarshall(i));
  logs.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return ok({ logs, count: logs.length });
}

export async function handleAdminListRoutes(event: ApiGatewayEvent) {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const limit = Math.min(Number(event.queryStringParameters?.limit) || 50, 100);

  const result = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk) OR begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": { S: "ROUTE#" }, ":sk": { S: "ROUTE#" } },
    Limit: limit,
  });

  const routes = (result.Items || []).map((i) => unmarshall(i));
  return ok({ routes, count: routes.length });
}

export async function handleAdminRouteAction(event: ApiGatewayEvent) {
  const routeId = event.pathParameters?.id;
  if (!routeId) return badRequest("Rota ID gerekli.");

  const body = parseBody<{ action?: "approve" | "feature" | "suspend"; reason?: string }>(event);
  const action = body?.action;
  if (!action || !["approve", "feature", "suspend"].includes(action))
    return badRequest("Geçerli rota işlemi gerekli.");
  const route = await findRouteRecord(routeId);
  if (!route) return notFound("Rota bulunamadı.");
  const reason = body?.reason?.trim() || `Yönetici rota işlemi: ${action}`;

  const { DynamoDBClient, UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const now = new Date().toISOString();
  await ddb.send(
    new UpdateItemCommand({
      TableName: getTableName(),
      Key: marshall({ PK: route.PK, SK: route.SK }),
      ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
      UpdateExpression:
        "SET adminStatus = :status, adminActionAt = :now, adminReason = :reason" +
        (action === "suspend" ? ", isPublic = :public" : ""),
      ExpressionAttributeValues: marshall({
        ...(action === "suspend" ? { ":public": false } : {}),
        ":status":
          action === "suspend" ? "suspended" : action === "feature" ? "featured" : "approved",
        ":now": now,
        ":reason": reason,
      }),
    }),
  );

  const actorSub = (event as any).verifiedUser?.sub || "admin";
  await recordAuditLog(actorSub, `route_${action}`, routeId, reason);

  return ok({ status: "success", routeId, action, reason, timestamp: now });
}
