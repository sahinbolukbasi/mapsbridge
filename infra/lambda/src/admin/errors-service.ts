import type { ApiGatewayEvent } from "../shared/http";
import { ok, badRequest, parseBody, notFound } from "../shared/http";
import { getDynamoClient } from "../shared/dynamo";
import { getTableName, scanAllRaw, recordAuditLog } from "./management";
import type { AuthorizedEvent } from "../shared/types";

export interface SystemErrorItem {
  PK: string;
  SK: string;
  errorId: string;
  source: "web" | "mobile" | "api" | "ai";
  severity: "critical" | "warning" | "info";
  message: string;
  stack?: string;
  endpoint?: string;
  userId?: string;
  status: "open" | "resolved";
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  createdAt: string;
}

export async function handleListSystemErrors(event: ApiGatewayEvent) {
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  const limit = Math.min(Number(event.queryStringParameters?.limit) || 50, 100);
  const statusFilter = event.queryStringParameters?.status; // "open" | "resolved"

  const result = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk) AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": { S: "SYSTEM#ERROR#" },
      ":sk": { S: "META" },
    },
    Limit: limit,
  });

  let errors = (result.Items || []).map((i) => unmarshall(i) as SystemErrorItem);
  if (statusFilter && (statusFilter === "open" || statusFilter === "resolved")) {
    errors = errors.filter((e) => e.status === statusFilter);
  }

  errors.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return ok({ errors, count: errors.length });
}

export async function handleLogSystemError(event: ApiGatewayEvent) {
  const { PutItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  const body = parseBody<{
    source?: "web" | "mobile" | "api" | "ai";
    severity?: "critical" | "warning" | "info";
    message?: string;
    stack?: string;
    endpoint?: string;
    userId?: string;
  }>(event);

  if (!body?.message) return badRequest("Hata mesajı zorunludur.");

  const errorId = `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const item: SystemErrorItem = {
    PK: `SYSTEM#ERROR#${errorId}`,
    SK: "META",
    errorId,
    source: body.source || "api",
    severity: body.severity || "warning",
    message: body.message.slice(0, 500),
    stack: body.stack ? body.stack.slice(0, 3000) : undefined,
    endpoint: body.endpoint?.slice(0, 200),
    userId: body.userId,
    status: "open",
    createdAt: now,
  };

  await ddb.send(
    new PutItemCommand({
      TableName: getTableName(),
      Item: marshall(item, { removeUndefinedValues: true }),
    }),
  );

  return ok({ status: "logged", errorId });
}

export async function handleResolveSystemError(event: ApiGatewayEvent) {
  const { UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  const errorId = event.pathParameters?.id;
  if (!errorId) return badRequest("Hata ID gerekli.");

  const body = parseBody<{ resolutionNote?: string; status?: "open" | "resolved" }>(event);
  const status = body?.status || "resolved";
  const note = body?.resolutionNote?.trim() || "Sorun giderildi";
  const now = new Date().toISOString();
  const actorSub = (event as AuthorizedEvent).verifiedUser?.sub || "admin";

  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName: getTableName(),
        Key: marshall({ PK: `SYSTEM#ERROR#${errorId}`, SK: "META" }),
        UpdateExpression:
          "SET #st = :status, resolvedAt = :now, resolvedBy = :actor, resolutionNote = :note",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: marshall({
          ":status": status,
          ":now": now,
          ":actor": actorSub,
          ":note": note,
        }),
      }),
    );

    await recordAuditLog(actorSub, "system_error_resolved", errorId, note, { status });
    return ok({ status: "updated", errorId });
  } catch (err) {
    return notFound("Hata kaydı bulunamadı veya güncellenemedi.");
  }
}

