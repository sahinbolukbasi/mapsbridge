import { aiOverview, updateAIControl, aiTrainingQueue, reviewAITraining, aiReleaseOverview, proposeAIRelease, publishAIRelease, rollbackAIRelease, listFineTuneJobs, triggerFineTune } from "./ai-operations";
import { aiAgentCatalog, updateAIAgent } from "./agent-catalog";
import { managementRoutes, AdminError, protectAccount, commit, get, scan } from "./management";
import { can, routePermission } from "./permissions";
import { stripeClient } from "../billing/stripe-client";
import { read } from "../shared/data";
import { Router } from "../shared/router";
import { getVerifiedUser } from "../shared/auth";
/**
 * MapsBridge Admin Domain — Lambda handler
 * Routes:
 *   - GET /admin/metrics
 *   - GET /admin/users
 *   - GET /admin/finance
 *   - GET /admin/token-usage
 *   - POST /admin/users/{id}/suspend
 *   - POST /admin/users/{id}/unsuspend
 *   - POST /admin/users/{id}/refund
 *   - GET /admin/payments
 *   - GET /admin/system-health
 *   - GET /admin/reports
 *   - POST /admin/reports/{id}/resolve
 *   - GET /admin/audit-logs
 *
 * Admin access: restricted to users with admin claim in Cognito (custom:role=admin)
 */

import type { ApiGatewayEvent } from "../shared/http";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError, handlePreflight, extractBearerToken, parseBody } from "../shared/http";

type Handler = (event: ApiGatewayEvent) => Promise<{ statusCode: number; headers: Record<string, string>; body: string }>;

const routes: Record<string, Handler> = {
  "GET /admin/ai-operations": aiOverview,
  "POST /admin/ai-control": updateAIControl,
  "GET /admin/ai-agents": aiAgentCatalog,
  "POST /admin/ai-agents/{id}/config": updateAIAgent,
  "GET /admin/ai-training": aiTrainingQueue,
  "POST /admin/ai-training/{id}/review": reviewAITraining,
  "GET /admin/ai-training/jobs": listFineTuneJobs,
  "POST /admin/ai-training/fine-tune": triggerFineTune,
  "GET /admin/ai-release": aiReleaseOverview,
  "POST /admin/ai-release/propose": proposeAIRelease,
  "POST /admin/ai-release/publish": publishAIRelease,
  "POST /admin/ai-release/rollback": rollbackAIRelease,
  "GET /admin/metrics": handleMetrics,
  "GET /admin/users": handleListUsers,
  "GET /admin/analytics/devices": handleDeviceAnalytics,
  "GET /admin/analytics/ai-topics": handleAITopicAnalytics,
  "GET /admin/analytics/community": handleCommunityAnalytics,
  "GET /admin/analytics/subscriptions": handleSubscriptionAnalytics,
  "POST /admin/analytics/track": handleTrackSession,
  "GET /admin/finance": handleFinance,
  "GET /admin/token-usage": handleTokenUsageAdmin,
  "POST /admin/users/{id}/suspend": handleSuspendUser,
  "POST /admin/users/{id}/unsuspend": handleUnsuspendUser,
  "POST /admin/users/{id}/refund": handleRefund,
  "GET /admin/payments": handlePayments,
  "GET /admin/system-health": handleSystemHealth,
  "GET /admin/agentcore-status": handleAgentCoreStatus,
  "GET /admin/reports": handleListReports,
  "POST /admin/reports/{id}/resolve": handleResolveReport,
  "GET /admin/audit-logs": handleAuditLogs,
  "GET /admin/realtime": handleRealtimeTelemetry,
  "GET /admin/routes": handleAdminListRoutes,
  "POST /admin/routes/{id}/action": handleAdminRouteAction,
  "GET /admin/system-config": handleGetSystemConfig,
  "POST /admin/system-config": handleUpdateSystemConfig,
  "GET /admin/module-config": handleGetModuleConfig,
  "POST /admin/module-config": handleUpdateModuleConfig,
  "GET /admin/credit-stats": handleGetCreditStats,
  "GET /admin/stripe-config": handleGetStripeConfig,
  "POST /admin/stripe-config": handleUpdateStripeConfig,
  "GET /admin/plans": handleGetPlans,
  "POST /admin/plans/{id}": handleUpdatePlan,
  "GET /admin/credit-packs": handleGetCreditPacks,
  "POST /admin/credit-packs/{id}": handleUpdateCreditPack,
};

Object.assign(routes, managementRoutes);
const router = new Router();
for (const [key, value] of Object.entries(routes)) router.add(key, value);

export const handler = async (event: ApiGatewayEvent) => {
  if (event.requestContext?.http?.method === "OPTIONS") return handlePreflight();

  // Admin auth check
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const user = await getVerifiedUser(token);
  if (!user) return unauthorized();

  let role: "admin" | "moderator" | "support" | undefined;
  if (process.env.ADMIN_GROUP_NAME || process.env.MODERATOR_GROUP_NAME || process.env.SUPPORT_GROUP_NAME) {
    const { CognitoIdentityProviderClient, AdminListGroupsForUserCommand } = await import("@aws-sdk/client-cognito-identity-provider");
    const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || "eu-central-1" });
    const poolId = process.env.COGNITO_USER_POOL_ID || "";
    try {
      const groupRes = await cognito.send(new AdminListGroupsForUserCommand({ UserPoolId: poolId, Username: user.originalSub || user.sub }));
      const groupNames = (groupRes.Groups || []).map((g: any) => g.GroupName);
      if (process.env.ADMIN_GROUP_NAME && groupNames.includes(process.env.ADMIN_GROUP_NAME)) {
        role = "admin";
      } else if (process.env.MODERATOR_GROUP_NAME && groupNames.includes(process.env.MODERATOR_GROUP_NAME)) {
        role = "moderator";
      } else if (process.env.SUPPORT_GROUP_NAME && groupNames.includes(process.env.SUPPORT_GROUP_NAME)) {
        role = "support";
      }
    } catch {
      role = undefined;
    }
  } else {
    role = user.staffRole || (user.isAdmin ? "admin" : undefined);
  }

  if (!role) return forbidden();
  user.staffRole = role;
  user.isAdmin = role === "admin";
  const needed = routePermission(event.requestContext.http.path.replace(/\/$/, ""), event.requestContext.http.method);
  if (needed && !can(role, needed)) return forbidden("Bu bölüm için yetkiniz bulunmuyor.");

  (event as any).verifiedUser = user;

  try {
    return await router.dispatch(event);
  } catch (err) {
    if (err instanceof AdminError) return { statusCode: err.status, headers: ok({}).headers, body: JSON.stringify({ error: err.message }) };
    console.error(`[Admin] Error:`, err);
    return serverError();
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function getTableName(): string {
  return process.env.DYNAMODB_TABLE || `adreskopru-${process.env.ENVIRONMENT || "prod"}-data`;
}

async function scanAll(ddb: any, command: any) {
  const { ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const Items: any[] = [];
  let Count = 0;
  let cursor = command.input.ExclusiveStartKey;
  do {
    const page = await ddb.send(new ScanCommand({ ...command.input, ExclusiveStartKey: cursor }));
    Items.push(...(page.Items || []));
    Count += page.Count || 0;
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return { Items, Count, LastEvaluatedKey: undefined };
}

async function findRoute(routeId: string) {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });
  const result = await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: "(PK = :route AND SK = :meta) OR (begins_with(PK, :user) AND SK = :route)",
    ExpressionAttributeValues: { ":route": { S: `ROUTE#${routeId}` }, ":meta": { S: "META" }, ":user": { S: "USER#" } },
  }));
  return result.Items.length === 1 ? unmarshall(result.Items[0]) : null;
}

async function recordAuditLog(actorSub: string, action: string, targetId: string, reason: string, details?: Record<string, unknown>) {
  try {
    const { DynamoDBClient, PutItemCommand } = await import("@aws-sdk/client-dynamodb");
    const { marshall } = await import("@aws-sdk/util-dynamodb");
    const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });
    const auditId = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    await ddb.send(new PutItemCommand({
      TableName: getTableName(),
      Item: marshall({
        PK: `AUDIT#${auditId}`,
        SK: "META",
        auditId,
        actorSub,
        action,
        targetId,
        reason: reason || "Belirtilmedi",
        details: details || {},
        createdAt: now,
      }),
    }));
    return auditId;
  } catch (err) {
    console.error("[Admin] Audit log recording failed:", err);
    return null;
  }
}

// ─── Metrics Dashboard ────────────────────────────────────────────────────
async function handleMetrics() {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const now = new Date();

  // Count users via COUNT scan — avoids the 50-item list limit
  const userCountResult = await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: "SK = :sk AND begins_with(PK, :pk)",
    ExpressionAttributeValues: { ":sk": { S: "META" }, ":pk": { S: "USER#" } },
    Select: "COUNT",
  }));
  const totalUsers = userCountResult.Count || 0;

  // Count active subscriptions
  const subCount = await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: "SK = :sk AND #status = :active",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":sk": { S: "SUBSCRIPTION" }, ":active": { S: "active" } },
    Select: "COUNT",
    Limit: 10000,
  }));

  // Count guides
  const guideCount = await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk)",
    ExpressionAttributeValues: { ":pk": { S: "GUIDE#" } },
    Select: "COUNT",
    Limit: 10000,
  }));

  // Today's revenue (from payments)
  const todayStart = `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
  const payments = (await paymentRecords()).filter(p => p.createdAt && p.createdAt >= todayStart);

  return ok({
    metrics: {
      totalUsers,
      activeSubscriptions: subCount.Count || 0,
      totalGuides: guideCount.Count || 0,
      todayPayments: payments.length,
      timestamp: now.toISOString(),
    },
  });
}

// ─── List Users ───────────────────────────────────────────────────────────
async function handleListUsers(event: ApiGatewayEvent) {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const limit = Math.min(Number(event.queryStringParameters?.limit) || 50, 200);


  const result = await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk)",
    ExpressionAttributeValues: { ":pk": { S: "USER#" } },
    Limit: limit,

  }));

  const grouped = new Map<string, any>();
  for (const item of result.Items) {
    const row = unmarshall(item);
    const userId = row.PK?.replace(/^USER#/, "");
    if (!userId) continue;
    const user = grouped.get(userId) || { userId, routesCount: 0 };
    if (row.SK === "META" || row.SK === "PROFILE") {
      for (const field of ["email", "name", "role", "suspended", "suspendReason", "createdAt"]) {
        if (row[field] !== undefined) user[field] = row[field];
      }
    }
    if (row.SK === "SUBSCRIPTION") user.tier = row.tier;
    if (row.SK?.startsWith("ROUTE#")) user.routesCount++;
    grouped.set(userId, user);
  }
  if (process.env.COGNITO_USER_MANAGEMENT === "true") {
    const { CognitoIdentityProviderClient, ListUsersCommand } = await import("@aws-sdk/client-cognito-identity-provider");
    const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
    let token: string | undefined;
    do {
      const page = await cognito.send(new ListUsersCommand({ UserPoolId: process.env.COGNITO_USER_POOL_ID, PaginationToken: token, Limit: 60 }));
      for (const account of page.Users || []) {
        const attributes = Object.fromEntries((account.Attributes || []).map(a => [a.Name, a.Value]));
        const id = attributes.sub;
        if (!id) continue;
        grouped.set(id, { ...grouped.get(id), userId: id, username: account.Username, email: attributes.email,
          name: attributes.name, suspended: account.Enabled === false || grouped.get(id)?.suspended === true,
          createdAt: account.UserCreateDate?.toISOString() });
      }
      token = page.PaginationToken;
    } while (token);
  }
  const users = [...grouped.values()];
  return ok({ users, count: users.length, nextCursor: null });
}

// ─── Finance Dashboard ────────────────────────────────────────────────────
async function handleFinance() {
  const payments = await paymentRecords();

  const totalRevenue = payments
    .filter(p => p.status === "succeeded")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const failedCount = payments.filter(p => p.status === "failed").length;

  // Group by month
  const monthly: Record<string, number> = {};
  for (const p of payments) {
    if (p.status === "succeeded" && p.createdAt) {
      const month = p.createdAt.slice(0, 7);
      monthly[month] = (monthly[month] || 0) + (p.amount || 0);
    }
  }

  return ok({
    finance: {
      totalRevenueTRY: totalRevenue / 100, // convert from cents
      totalTransactions: payments.length,
      failedTransactions: failedCount,
      monthlyRevenue: Object.entries(monthly).map(([month, amount]) => ({ month, amount: amount / 100 })),
      currency: "TRY",
    },
  });
}

// ─── Token Usage (Admin view) ─────────────────────────────────────────────
async function handleTokenUsageAdmin() {
  return ok({ usage: { note: "Token ölçüm kaynağı henüz bağlanmadı.", totalInvocations: null, estimatedTokensMonth: null, activeModels: [], quotaUtilizationPct: null } });
}

// ─── Suspend User ─────────────────────────────────────────────────────────
async function handleSuspendUser(event: ApiGatewayEvent) {
  const userId = event.pathParameters?.id;
  if (!userId) return badRequest("Kullanıcı ID gerekli.");

  if (userId === (event as any).verifiedUser?.sub) return badRequest("Kendi hesabınızın durumunu değiştiremezsiniz.");
  await protectAccount(event, userId);
  const body = parseBody<{ reason?: string }>(event);
  const reason = body?.reason?.trim() || "Yönetici tarafından askıya alındı.";

  const { DynamoDBClient, UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const now = new Date().toISOString();
  await ddb.send(new UpdateItemCommand({
    TableName: getTableName(),
    Key: marshall({ PK: `USER#${userId}`, SK: "META" }),
    UpdateExpression: "SET suspended = :true, suspendedAt = :now, suspendReason = :reason",
    ExpressionAttributeValues: marshall({ ":true": true, ":now": now, ":reason": reason }),
  }));

  if (process.env.COGNITO_USER_MANAGEMENT === "true") {
    const { CognitoIdentityProviderClient, AdminDisableUserCommand } = await import("@aws-sdk/client-cognito-identity-provider");
    await new CognitoIdentityProviderClient({ region: process.env.AWS_REGION }).send(new AdminDisableUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID, Username: userId,
    }));
  }

  const actorSub = (event as any).verifiedUser?.sub || "admin";
  await recordAuditLog(actorSub, "user_suspended", userId, reason);

  return ok({ status: "suspended", userId, reason, suspendedAt: now });
}

// ─── Unsuspend User ───────────────────────────────────────────────────────
async function handleUnsuspendUser(event: ApiGatewayEvent) {
  const userId = event.pathParameters?.id;
  if (!userId) return badRequest("Kullanıcı ID gerekli.");

  if (userId === (event as any).verifiedUser?.sub) return badRequest("Kendi hesabınızın durumunu değiştiremezsiniz.");
  const body = parseBody<{ reason?: string }>(event);
  const reason = body?.reason?.trim() || "Yönetici tarafından askı kaldırıldı.";

  const { DynamoDBClient, UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const now = new Date().toISOString();
  await ddb.send(new UpdateItemCommand({
    TableName: getTableName(),
    Key: marshall({ PK: `USER#${userId}`, SK: "META" }),
    UpdateExpression: "SET suspended = :false, unsuspendedAt = :now REMOVE suspendReason",
    ExpressionAttributeValues: marshall({ ":false": false, ":now": now }),
  }));

  if (process.env.COGNITO_USER_MANAGEMENT === "true") {
    const { CognitoIdentityProviderClient, AdminEnableUserCommand } = await import("@aws-sdk/client-cognito-identity-provider");
    await new CognitoIdentityProviderClient({ region: process.env.AWS_REGION }).send(new AdminEnableUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID, Username: userId,
    }));
  }

  const actorSub = (event as any).verifiedUser?.sub || "admin";
  await recordAuditLog(actorSub, "user_unsuspended", userId, reason);

  return ok({ status: "active", userId, unsuspendedAt: now });
}

// ─── Refund Payment ───────────────────────────────────────────────────────
async function handleRefund(event: ApiGatewayEvent) {
  const userId = event.pathParameters?.id;
  if (!userId) return badRequest("Kullanıcı ID gerekli.");

  const body = parseBody<{ paymentIntentId?: string; reason?: string }>(event);
  if (!body?.paymentIntentId) return badRequest("Ödeme ID gerekli.");
  const reason = body?.reason?.trim() || "Yönetici tarafından iade edildi.";

  try {
    const stripe = await stripeClient();
    const customer = await read(`USER#${userId}`, "STRIPE_CUSTOMER");
    const payment = await stripe.paymentIntents.retrieve(body.paymentIntentId);
    const customerId = typeof payment.customer === "string" ? payment.customer : payment.customer?.id;
    if (!customer?.customerId || customerId !== customer.customerId) return badRequest("Ödeme bu kullanıcıya ait değil.");
    const refund = await stripe.refunds.create({
      payment_intent: body.paymentIntentId,
      metadata: { refundedBy: "admin", userId, reason },
    }, { idempotencyKey: `full-refund:${body.paymentIntentId}` });

    // Record refund in DynamoDB
    const { DynamoDBClient, PutItemCommand } = await import("@aws-sdk/client-dynamodb");
    const { marshall } = await import("@aws-sdk/util-dynamodb");
    const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

    await ddb.send(new PutItemCommand({
      TableName: getTableName(),
      Item: marshall({
        PK: `REFUND#${refund.id}`,
        SK: "META",
        paymentIntentId: body.paymentIntentId,
        userId,
        amount: refund.amount,
        status: refund.status,
        reason,
        createdAt: new Date().toISOString(),
      }),
    }));

    const actorSub = (event as any).verifiedUser?.sub || "admin";
    await recordAuditLog(actorSub, "payment_refunded", body.paymentIntentId, reason, { userId, amount: refund.amount });

    return ok({ status: refund.status === "succeeded" ? "refunded" : refund.status, refundId: refund.id, amount: refund.amount, reason });
  } catch (err: any) {
    return serverError("İade durumu doğrulanamadı. İşlem kimliğiyle tekrar kontrol edin.");
  }
}

// ─── Payments Log ─────────────────────────────────────────────────────────
async function paymentRecords() {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });
  const result = await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: "(begins_with(PK, :payment) AND SK = :meta) OR (begins_with(PK, :billing) AND SK = :receipt) OR begins_with(PK, :refund)",
    ExpressionAttributeValues: { ":payment": { S: "PAYMENT#" }, ":meta": { S: "META" }, ":billing": { S: "BILLING#" }, ":receipt": { S: "RECEIPT" }, ":refund": { S: "REFUND#" } },
  }));
  const records = result.Items.map((item: any) => unmarshall(item));
  const refunded = new Set(records.filter((r: any) => r.PK?.startsWith("REFUND#") && r.status === "succeeded").map((r: any) => r.paymentIntentId));
  const payments = new Map<string, any>();
  for (const row of records) {
    if (row.PK?.startsWith("REFUND#") || (row.currency && row.currency.toLowerCase() !== "try")) continue;
    const id = row.paymentIntentId || row.id || row.PK;
    payments.set(id, { ...row, id, status: refunded.has(row.paymentIntentId) ? "refunded" : row.status || (row.SK === "RECEIPT" ? "succeeded" : "pending") });
  }
  return [...payments.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

async function handlePayments(event: ApiGatewayEvent) {
  const records = await paymentRecords();
  const status = event.queryStringParameters?.status;
  const payments = status ? records.filter(p => p.status === status) : records;
  return ok({ payments, count: payments.length });
}

// ─── System Health ────────────────────────────────────────────────────────
async function handleSystemHealth() {
  const region = process.env.AWS_REGION || "eu-central-1";
  const now = new Date().toISOString();

  let ddbStatus = "healthy";
  let ddbLatencyMs = 0;
  try {
    const t0 = performance.now();
    const { DynamoDBClient, DescribeTableCommand } = await import("@aws-sdk/client-dynamodb");
    const ddb = new DynamoDBClient({ region });
    await ddb.send(new DescribeTableCommand({ TableName: getTableName() }));
    ddbLatencyMs = Math.round(performance.now() - t0);
  } catch (err) {
    ddbStatus = "degraded";
  }

  const bedrockModel = process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-haiku-20240307-v1:0";

  return ok({
    health: {
      status: ddbStatus === "healthy" ? "operational" : "degraded",
      timestamp: now,
      environment: process.env.ENVIRONMENT || "production",
      region,
      services: {
        dynamodb: { status: ddbStatus, latencyMs: ddbLatencyMs, table: getTableName() },
        cognito: { status: "healthy", poolId: process.env.COGNITO_USER_POOL_ID || "eu-central-1_TKABiLn5f" },
        bedrock: { status: "unknown", model: bedrockModel },
        apiGateway: { status: "healthy", protocol: "HTTP API v2" },
        stripe: { status: process.env.STRIPE_SECRET_KEY ? "configured" : "offline" },
        osrm: { status: "unknown", engine: "OSRM Public Routing" },
        geocoding: { status: "unknown", provider: "Nominatim / Photomap" },
      },
    },
  });
}

// ─── AgentCore Status ─────────────────────────────────────────────────────
async function handleAgentCoreStatus() {
  const region = process.env.AWS_REGION || 'eu-central-1';
  const memoryId = process.env.AGENTCORE_MEMORY_ID;
  const gatewayId = process.env.AGENTCORE_GATEWAY_ID;
  const workerName = `${process.env.ENVIRONMENT === 'prod' ? 'adreskopru-prod' : 'adreskopru-dev'}-ai-memory-worker`;
  const dlqUrl = process.env.MEMORY_DLQ_URL;
  const result: Record<string, any> = { observedAt: new Date().toISOString(), region };

  // Gateway status
  if (gatewayId) {
    try {
      const { BedrockAgentCoreControlClient, GetGatewayCommand, ListGatewayTargetsCommand } = await import('@aws-sdk/client-bedrock-agentcore-control');
      const client = new BedrockAgentCoreControlClient({ region, maxAttempts: 1 });
      const [gw, targets] = await Promise.all([
        client.send(new GetGatewayCommand({ gatewayIdentifier: gatewayId })),
        client.send(new ListGatewayTargetsCommand({ gatewayIdentifier: gatewayId })),
      ]);
      result.gateway = { id: gw.gatewayId, name: gw.name, status: gw.status, url: gw.gatewayUrl, protocol: gw.protocolType,
        targets: (targets.items || []).map(t => ({ id: t.targetId, name: t.name, status: t.status, type: t.targetType })) };
      client.destroy();
    } catch (e) { result.gateway = { status: 'unknown', error: (e as Error).name }; }
  } else {
    result.gateway = { status: 'not_configured' };
  }

  // Memory stats
  if (memoryId) {
    try {
      const { BedrockAgentCoreControlClient, GetMemoryCommand } = await import('@aws-sdk/client-bedrock-agentcore-control');
      const client = new BedrockAgentCoreControlClient({ region, maxAttempts: 1 });
      const mem = await client.send(new GetMemoryCommand({ memoryId }));
      result.memory = { id: memoryId, name: mem.memory?.name, status: mem.memory?.status,
        strategies: (mem.memory?.strategies || []).map(s => ({ name: s.name, type: s.type, status: s.status })) };
      client.destroy();
    } catch (e) { result.memory = { id: memoryId, status: 'unknown', error: (e as Error).name }; }
  } else {
    result.memory = { status: 'not_configured' };
  }

  // Memory worker Lambda health + DLQ
  try {
    const [lambdaSdk, cwSdk, sqsSdk] = await Promise.all([
      import('@aws-sdk/client-lambda'),
      import('@aws-sdk/client-cloudwatch'),
      import('@aws-sdk/client-sqs'),
    ]);
    const lambda = new lambdaSdk.LambdaClient({ region, maxAttempts: 1 });
    const cw = new cwSdk.CloudWatchClient({ region, maxAttempts: 1 });
    const since = new Date(Date.now() - 3600000); const now = new Date();
    const [fn, errors, invocations] = await Promise.all([
      lambda.send(new lambdaSdk.GetFunctionConfigurationCommand({ FunctionName: workerName })),
      cw.send(new cwSdk.GetMetricStatisticsCommand({ Namespace: 'AWS/Lambda', MetricName: 'Errors', Dimensions: [{ Name: 'FunctionName', Value: workerName }], StartTime: since, EndTime: now, Period: 3600, Statistics: ['Sum'] })),
      cw.send(new cwSdk.GetMetricStatisticsCommand({ Namespace: 'AWS/Lambda', MetricName: 'Invocations', Dimensions: [{ Name: 'FunctionName', Value: workerName }], StartTime: since, EndTime: now, Period: 3600, Statistics: ['Sum'] })),
    ]);
    let dlqMessages: string | number = 'unknown';
    if (dlqUrl) {
      const sqs = new sqsSdk.SQSClient({ region, maxAttempts: 1 });
      const dlqResult = await sqs.send(new sqsSdk.GetQueueAttributesCommand({ QueueUrl: dlqUrl, AttributeNames: ['ApproximateNumberOfMessages'] })).catch(() => null);
      dlqMessages = dlqResult?.Attributes?.ApproximateNumberOfMessages ?? 'unknown';
      sqs.destroy();
    }
    result.worker = { name: workerName, state: fn.State, lastUpdate: fn.LastUpdateStatus, errorsLastHour: errors.Datapoints?.[0]?.Sum ?? 0, invocationsLastHour: invocations.Datapoints?.[0]?.Sum ?? 0, dlqMessages };
    lambda.destroy(); cw.destroy();
  } catch (e) { result.worker = { name: workerName, status: 'unknown', error: (e as Error).name }; }

  return ok(result);
}

// ─── Reports & Moderation Queue ───────────────────────────────────────────
async function handleListReports(event: ApiGatewayEvent) {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const status = event.queryStringParameters?.status;
  const limit = Math.min(Number(event.queryStringParameters?.limit) || 50, 100);

  const result = await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: status
      ? "begins_with(PK, :pk) AND SK = :sk AND #status = :status"
      : "begins_with(PK, :pk) AND SK = :sk",
    ExpressionAttributeNames: status ? { "#status": "status" } : undefined,
    ExpressionAttributeValues: status
      ? { ":pk": { S: "REPORT#" }, ":sk": { S: "META" }, ":status": { S: status } }
      : { ":pk": { S: "REPORT#" }, ":sk": { S: "META" } },
    Limit: limit,
  }));

  const reports = (result.Items || []).map(i => unmarshall(i));
  return ok({ reports, count: reports.length });
}

async function handleResolveReport(event: ApiGatewayEvent) {
  const reportId = event.pathParameters?.id;
  if (!reportId) return badRequest("Şikâyet ID gerekli.");

  const body = parseBody<{ action?: "dismiss" | "hide_content" | "suspend_user"; notes?: string }>(event);
  const action = body?.action;
  if (!action || !["dismiss", "hide_content", "suspend_user"].includes(action)) return badRequest("Geçerli şikâyet işlemi gerekli.");
  const report = await read(`REPORT#${reportId}`, "META");
  if (!report) return notFound("Şikâyet bulunamadı.");
  if (report.status !== "pending") return badRequest("Şikâyet zaten karara bağlanmış.");
  if (action === "hide_content" && report.contentType !== "route") return badRequest("Bu içerik türü için gizleme desteklenmiyor.");
  if (action === "suspend_user" && report.contentType !== "user") return badRequest("Şikâyet bir kullanıcıyı hedeflemiyor.");
  const notes = body?.notes?.trim() || "Şikâyet yönetici tarafından incelendi.";

  const { DynamoDBClient, UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  if (action !== "dismiss") {
    const targetEvent = { ...event, pathParameters: { id: report.contentId }, body: JSON.stringify({ action: "suspend", reason: notes }), isBase64Encoded: false };
    const outcome = action === "hide_content" ? await handleAdminRouteAction(targetEvent) : await handleSuspendUser(targetEvent);
    if (outcome.statusCode !== 200) return outcome;
  }
  const now = new Date().toISOString();
  await ddb.send(new UpdateItemCommand({
    TableName: getTableName(),
    Key: marshall({ PK: `REPORT#${reportId}`, SK: "META" }),
    UpdateExpression: "SET #status = :status, resolvedAt = :now, resolutionAction = :action, resolutionNotes = :notes",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: marshall({
      ":status": action === "dismiss" ? "dismissed" : "resolved",
      ":now": now,
      ":action": action,
      ":notes": notes,
    }),
  }));

  const actorSub = (event as any).verifiedUser?.sub || "admin";
  await recordAuditLog(actorSub, `report_${action}`, reportId, notes);

  return ok({ status: action === "dismiss" ? "dismissed" : "resolved", reportId, action, resolvedAt: now });
}

// ─── Audit Logs ───────────────────────────────────────────────────────────
async function handleAuditLogs(event: ApiGatewayEvent) {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const limit = Math.min(Number(event.queryStringParameters?.limit) || 50, 100);

  const result = await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk) AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": { S: "AUDIT#" },
      ":sk": { S: "META" },
    },
    Limit: limit,
  }));

  const logs = (result.Items || []).map(i => unmarshall(i));
  logs.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return ok({ logs, count: logs.length });
}

// ─── Realtime Telemetry & Live Map/Social Sync ────────────────────────────
async function handleRealtimeTelemetry() {
  const metrics = JSON.parse((await handleMetrics()).body).metrics;
  return ok({ realtime: { timestamp: metrics.timestamp, registeredUsers: metrics.totalUsers,
    activeExplorers: null, currentMapUsers: null, aiQueriesToday: null,
    grossMarketplaceTRY: null, netCommissionTRY: null, mapClusters: [],
    telemetry: { topoLoadPercent: null, waypointsPerSec: null, geocodingLatencyMs: null, liveSyncRooms: null },
    note: "Canlı konum ve performans ölçümleri henüz bağlanmadı." } });
}

// ─── Routes List & Moderation ─────────────────────────────────────────────
async function handleAdminListRoutes(event: ApiGatewayEvent) {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const limit = Math.min(Number(event.queryStringParameters?.limit) || 50, 100);

  const result = await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk) OR begins_with(SK, :sk)",
    ExpressionAttributeValues: {
      ":pk": { S: "ROUTE#" },
      ":sk": { S: "ROUTE#" },
    },
    Limit: limit,
  }));

  const routes = (result.Items || []).map(i => unmarshall(i));
  return ok({ routes, count: routes.length });
}

async function handleAdminRouteAction(event: ApiGatewayEvent) {
  const routeId = event.pathParameters?.id;
  if (!routeId) return badRequest("Rota ID gerekli.");

  const body = parseBody<{ action?: "approve" | "feature" | "suspend"; reason?: string }>(event);
  const action = body?.action;
  if (!action || !["approve", "feature", "suspend"].includes(action)) return badRequest("Geçerli rota işlemi gerekli.");
  const route = await findRoute(routeId);
  if (!route) return notFound("Rota bulunamadı.");
  const reason = body?.reason?.trim() || `Yönetici rota işlemi: ${action}`;

  const { DynamoDBClient, UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const now = new Date().toISOString();
  await ddb.send(new UpdateItemCommand({
    TableName: getTableName(),
    Key: marshall({ PK: route.PK, SK: route.SK }),
    ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
    UpdateExpression: "SET adminStatus = :status, adminActionAt = :now, adminReason = :reason" + (action === "suspend" ? ", isPublic = :public" : ""),
    ExpressionAttributeValues: marshall({
      ...(action === "suspend" ? { ":public": false } : {}),
      ":status": action === "suspend" ? "suspended" : action === "feature" ? "featured" : "approved",
      ":now": now,
      ":reason": reason,
    }),
  }));

  const actorSub = (event as any).verifiedUser?.sub || "admin";
  await recordAuditLog(actorSub, `route_${action}`, routeId, reason);

  return ok({ status: "success", routeId, action, reason, timestamp: now });
}

// ─── Global System Config (Maintenance Mode) ──────────────────────────────
async function handleGetSystemConfig() {
  const { DynamoDBClient, GetItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const result = await ddb.send(new GetItemCommand({
    TableName: getTableName(),
    Key: {
      PK: { S: "SYSTEM#CONFIG" },
      SK: { S: "META" },
    },
  }));

  const config = result.Item ? unmarshall(result.Item) : { maintenanceMode: false, updatedAt: new Date().toISOString() };
  return ok({ config });
}

async function handleUpdateSystemConfig(event: ApiGatewayEvent) {
  const body = parseBody<Record<string, any>>(event);
  if (!body || typeof body.maintenanceMode !== "boolean") return badRequest("Bakım modu boolean olmalıdır.");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 1000) return badRequest("En fazla 1000 karakterlik gerekçe gerekli.");
  const previous = await get("SYSTEM#CONFIG");
  if (body.version !== undefined && body.version !== (previous?.version || 0)) return { statusCode: 409, headers: ok({}).headers, body: JSON.stringify({ error: "Ayarlar değişti. Yenileyip tekrar deneyin." }) };
  const next = { ...previous, PK: "SYSTEM#CONFIG", SK: "META", maintenanceMode: body.maintenanceMode,
    maintenanceMessage: previous?.maintenanceMessage || "Kısa süreli bakım yapılıyor. Lütfen daha sonra tekrar deneyin.",
    routeCreationEnabled: previous?.routeCreationEnabled ?? true, sharesEnabled: previous?.sharesEnabled ?? true,
    reason, updatedBy: (event as any).verifiedUser.sub };
  for (const flag of ["routeCreationEnabled", "sharesEnabled"] as const) {
    if (body[flag] !== undefined) { if (typeof body[flag] !== "boolean") return badRequest("Geçersiz özellik ayarı."); next[flag] = body[flag]; }
  }
  if (body.maintenanceMessage !== undefined) {
    if (typeof body.maintenanceMessage !== "string" || !body.maintenanceMessage.trim() || body.maintenanceMessage.length > 500) return badRequest("Bakım mesajı 1–500 karakter olmalıdır.");
    next.maintenanceMessage = body.maintenanceMessage.trim();
  }
  const config = await commit(event, next, "system_config_updated", reason, previous);
  return ok({ ...config, config });
}

// ─── Module Config ───────────────────────────────────────────────────────
async function handleGetModuleConfig() {
  const row = await get("SYSTEM#MODULES");
  const moduleConfig = row || { mapEnabled: true, aiEnabled: true, communityEnabled: true, messagingEnabled: true };
  return ok({ moduleConfig });
}

async function handleUpdateModuleConfig(event: ApiGatewayEvent) {
  const body = parseBody<Record<string, any>>(event);
  if (!body) return badRequest("Geçerli istek verisi gerekli.");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 1000) return badRequest("En fazla 1000 karakterlik gerekçe gerekli.");

  const previous = await get("SYSTEM#MODULES");
  const current = previous || { PK: "SYSTEM#MODULES", SK: "META", mapEnabled: true, aiEnabled: true, communityEnabled: true, messagingEnabled: true };

  for (const key of ["mapEnabled", "aiEnabled", "communityEnabled", "messagingEnabled"] as const) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "boolean") return badRequest(`${key} boolean olmalıdır.`);
      current[key] = body[key];
    }
  }
  current.PK = "SYSTEM#MODULES";
  current.SK = "META";
  current.updatedBy = (event as any).verifiedUser.sub;

  const moduleConfig = await commit(event, current, "module_config_updated", reason, previous);
  return ok({ status: "updated", moduleConfig });
}

// ─── Credit Statistics ───────────────────────────────────────────────────
async function handleGetCreditStats() {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const walletResult = await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk) AND SK = :sk",
    ExpressionAttributeValues: { ":pk": { S: "USER#" }, ":sk": { S: "CREDITS" } },
  }));
  const wallets = walletResult.Items.map((item: any) => unmarshall(item));

  const subResult = await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk) AND SK = :sk",
    ExpressionAttributeValues: { ":pk": { S: "USER#" }, ":sk": { S: "SUBSCRIPTION" } },
  }));
  const subs = new Map(subResult.Items.map((item: any) => { const r = unmarshall(item); return [r.PK, r]; }));

  const usageResult = await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk) AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": { S: "USER#" }, ":sk": { S: "AI#" } },
  }));
  const usageRows = usageResult.Items.map((item: any) => unmarshall(item));

  let totalGranted = 0;
  let totalConsumed = 0;
  let totalRemaining = 0;
  const activeWallets = wallets.filter(w => (w.credits || 0) > 0).length;

  for (const w of wallets) {
    const credits = w.credits || 0;
    totalRemaining += credits;
  }

  const byModule = { ai_chat: 0, ai_deep_trip: 0, ai_stay_dining: 0, route_optimize: 0 };
  for (const u of usageRows) {
    const cost = u.cost || 0;
    totalConsumed += cost;
    const kind = (u.SK || "").toLowerCase();
    if (kind.includes("deep") || kind.includes("trip")) byModule.ai_deep_trip += cost;
    else if (kind.includes("stay") || kind.includes("dining")) byModule.ai_stay_dining += cost;
    else if (kind.includes("route") || kind.includes("optim")) byModule.route_optimize += cost;
    else byModule.ai_chat += cost;
  }
  totalGranted = totalRemaining + totalConsumed;

  const tierCounts: Record<string, { count: number; totalCredits: number }> = {};
  for (const w of wallets) {
    const userId = w.PK;
    const sub = subs.get(userId);
    const tier = sub?.tier || "free";
    if (!tierCounts[tier]) tierCounts[tier] = { count: 0, totalCredits: 0 };
    tierCounts[tier].count++;
    tierCounts[tier].totalCredits += w.credits || 0;
  }

  const planDistribution = Object.entries(tierCounts).map(([tier, data]) => ({
    tier,
    userCount: data.count,
    avgCredits: data.count > 0 ? Math.round(data.totalCredits / data.count) : 0,
  }));

  const topConsumers = wallets
    .map(w => {
      const userId = w.PK?.replace(/^USER#/, "") || "";
      const sub = subs.get(w.PK);
      const consumed = usageRows.filter(u => u.PK === w.PK).reduce((sum, u) => sum + (u.cost || 0), 0);
      return { userId, email: w.email, tier: sub?.tier || "free", consumed };
    })
    .filter(c => c.consumed > 0)
    .sort((a, b) => b.consumed - a.consumed)
    .slice(0, 20);

  // Build daily consumption for last 30 days
  const now30 = new Date();
  const dailyMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now30); d.setDate(d.getDate() - i);
    dailyMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const u of usageRows) {
    const day = (u.createdAt || u.SK || "").slice(0, 10);
    if (day in dailyMap) dailyMap[day] += u.cost || 0;
  }
  const dailyConsumption = Object.entries(dailyMap).map(([date, credits]) => ({ date, credits: Math.round(credits * 100) / 100 }));

  return ok({
    stats: {
      totalCreditsGranted: totalGranted,
      totalCreditsConsumed: totalConsumed,
      totalCreditsRemaining: totalRemaining,
      activeWallets,
      averageBalancePerUser: wallets.length > 0 ? Math.round((totalRemaining / wallets.length) * 10) / 10 : 0,
      byModule,
      dailyConsumption,
      planDistribution,
      topConsumers,
    },
  });
}

// ─── Stripe Config ───────────────────────────────────────────────────────────
async function handleGetStripeConfig() {
  const config = await get("STRIPE#CONFIG");
  const envConnected = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);
  const envMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ? "test" : "unconfigured";

  const stripe = {
    connected: config ? !!(config.publishableKey && config.secretKeyHash) : envConnected,
    mode: config?.mode || (envConnected ? envMode : "unconfigured"),
    publishableKey: config?.publishableKey || process.env.STRIPE_PUBLISHABLE_KEY || "",
    webhookConfigured: config ? !!config.webhookSecret : !!process.env.STRIPE_WEBHOOK_SECRET,
    webhookUrl: config?.webhookUrl || "https://api.mapsbridge.com/stripe/webhook",
    lastWebhookAt: config?.lastWebhookAt,
    supportedCurrencies: config?.supportedCurrencies || ["try"],
    defaultCurrency: config?.defaultCurrency || "try",
    taxEnabled: config?.taxEnabled || false,
    version: config?.version || 0,
    updatedAt: config?.updatedAt,
    updatedBy: config?.updatedBy,
  };
  return ok({ stripe });
}

async function handleUpdateStripeConfig(event: ApiGatewayEvent) {
  const body = parseBody<Record<string, any>>(event);
  if (!body) return badRequest("Geçerli yapılandırma verisi gerekli.");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 1000) return badRequest("Gerekçe zorunludur (en fazla 1000 karakter).");

  const previous = await get("STRIPE#CONFIG");
  let mode = body.mode || previous?.mode || "unconfigured";
  if (body.publishableKey) mode = body.publishableKey.startsWith("pk_live_") ? "live" : body.publishableKey.startsWith("pk_test_") ? "test" : mode;

  const next: Record<string, any> = {
    PK: "STRIPE#CONFIG",
    SK: "META",
    ...(previous || {}),
    mode,
    defaultCurrency: body.defaultCurrency || previous?.defaultCurrency || "try",
    taxEnabled: body.taxEnabled !== undefined ? !!body.taxEnabled : (previous?.taxEnabled || false),
    webhookUrl: body.webhookUrl || previous?.webhookUrl || "https://api.mapsbridge.com/stripe/webhook",
    supportedCurrencies: previous?.supportedCurrencies || ["try"],
  };
  if (body.publishableKey) next.publishableKey = body.publishableKey;
  if (body.secretKey) next.secretKeyHash = `configured:${Date.now()}`;
  if (body.webhookSecret) next.webhookSecret = `configured:${Date.now()}`;

  const saved = await commit(event, next, "stripe_config_updated", reason, previous) as Record<string, any>;
  return ok({
    status: "updated",
    stripe: {
      connected: !!(saved.publishableKey && saved.secretKeyHash),
      mode: saved.mode,
      publishableKey: saved.publishableKey,
      webhookConfigured: !!saved.webhookSecret,
      webhookUrl: saved.webhookUrl,
      supportedCurrencies: saved.supportedCurrencies || ["try"],
      defaultCurrency: saved.defaultCurrency,
      taxEnabled: saved.taxEnabled,
      version: saved.version,
      updatedAt: saved.updatedAt,
      updatedBy: saved.updatedBy,
    },
  });
}

// ─── Plans ───────────────────────────────────────────────────────────────────
const DEFAULT_PLANS = [
  { id: "free", name: "Gezgin", tagline: "Temel seyahat planlama", badge: "ÜCRETSİZ", monthlyPriceTry: 0, yearlyPriceTry: 0, monthlyCredits: 10, color: "#64748b", highlight: false, enabled: true },
  { id: "explorer", name: "Kaşif", tagline: "Aktif seyahat planlamacılar için", badge: "KAŞİF", monthlyPriceTry: 14900, yearlyPriceTry: 9900, monthlyCredits: 100, color: "#0d9488", highlight: false, enabled: true },
  { id: "pro", name: "Pro Kaşif", tagline: "Sık seyahat edenler için", badge: "PRO", monthlyPriceTry: 29900, yearlyPriceTry: 24900, monthlyCredits: 300, color: "#7c3aed", highlight: true, enabled: true },
  { id: "agency", name: "Tur Lideri", tagline: "Tur operatörleri ve profesyoneller", badge: "LİDER", monthlyPriceTry: 79900, yearlyPriceTry: 64900, monthlyCredits: 1000, color: "#c2410c", highlight: false, enabled: true },
];

async function handleGetPlans() {
  const rows = await scan("begins_with(PK, :pk) AND SK = :sk", { ":pk": "PLAN#", ":sk": "META" });
  const subRows = await scan("begins_with(PK, :pk) AND SK = :sk", { ":pk": "USER#", ":sk": "SUBSCRIPTION" });
  const tierCounts: Record<string, number> = {};
  for (const sub of subRows) {
    if (sub.status === "active" && sub.tier) tierCounts[sub.tier] = (tierCounts[sub.tier] || 0) + 1;
  }

  const plans = rows.length > 0
    ? rows.map(r => ({ ...r, id: r.planId || r.id || r.PK?.replace(/^PLAN#/, ""), activeSubscribers: tierCounts[r.planId || r.id] || 0 }))
    : DEFAULT_PLANS.map(p => ({ ...p, activeSubscribers: tierCounts[p.id] || 0, stripePriceIdMonthly: "", stripePriceIdYearly: "" }));

  return ok({ plans });
}

async function handleUpdatePlan(event: ApiGatewayEvent) {
  const planId = event.pathParameters?.id;
  if (!planId) return badRequest("Plan ID gerekli.");

  const body = parseBody<Record<string, any>>(event);
  if (!body) return badRequest("Geçerli plan verisi gerekli.");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 1000) return badRequest("Gerekçe zorunludur.");

  const previous = await get(`PLAN#${planId}`);
  const defaults: Record<string, any> = DEFAULT_PLANS.find(p => p.id === planId) || { monthlyPriceTry: 0, yearlyPriceTry: 0, monthlyCredits: 0, color: "#64748b", highlight: false };

  const next: Record<string, any> = {
    PK: `PLAN#${planId}`,
    SK: "META",
    planId,
    id: planId,
    name: body.name || previous?.name || defaults.id,
    tagline: body.tagline !== undefined ? body.tagline : (previous?.tagline || ""),
    badge: body.badge || previous?.badge || planId.toUpperCase(),
    monthlyPriceTry: Number(body.monthlyPriceTry ?? previous?.monthlyPriceTry ?? defaults.monthlyPriceTry),
    yearlyPriceTry: Number(body.yearlyPriceTry ?? previous?.yearlyPriceTry ?? defaults.yearlyPriceTry),
    monthlyCredits: Number(body.monthlyCredits ?? previous?.monthlyCredits ?? defaults.monthlyCredits),
    color: previous?.color || defaults.color,
    highlight: previous?.highlight ?? defaults.highlight,
    enabled: body.enabled !== undefined ? !!body.enabled : (previous?.enabled !== false),
    stripePriceIdMonthly: body.stripePriceIdMonthly !== undefined ? body.stripePriceIdMonthly : (previous?.stripePriceIdMonthly || ""),
    stripePriceIdYearly: body.stripePriceIdYearly !== undefined ? body.stripePriceIdYearly : (previous?.stripePriceIdYearly || ""),
  };

  const saved = await commit(event, next, "plan_updated", reason, previous ? { ...previous } : null) as Record<string, any>;
  return ok({ status: "updated", plan: saved });
}

// ─── Credit Packs ─────────────────────────────────────────────────────────────
const DEFAULT_CREDIT_PACKS = [
  { id: "starter", title: "Başlangıç Paketi", description: "Seyahat planlamaya başlamak için", credits: 50, bonusCredits: 0, priceTry: 4900, unitPriceTry: 98, popular: false, enabled: true },
  { id: "explorer", title: "Kaşif Paketi", description: "Aktif seyahat planlamacılar için", credits: 150, bonusCredits: 15, priceTry: 12900, unitPriceTry: 86, popular: true, enabled: true },
  { id: "pro", title: "Pro Paket", description: "En iyi değer — sık seyahat edenler için", credits: 400, bonusCredits: 60, priceTry: 29900, unitPriceTry: 74, popular: false, enabled: true },
];

async function handleGetCreditPacks() {
  const rows = await scan("begins_with(PK, :pk) AND SK = :sk", { ":pk": "CREDITPACK#", ":sk": "META" });
  const paymentRows = await scan("begins_with(PK, :pk) AND SK = :sk", { ":pk": "PAYMENT#", ":sk": "META" });
  const packCounts: Record<string, number> = {};
  for (const p of paymentRows) {
    if (p.packId && p.status === "succeeded") packCounts[p.packId] = (packCounts[p.packId] || 0) + 1;
  }

  const packs = rows.length > 0
    ? rows.map(r => {
        const id = r.packId || r.id || r.PK?.replace(/^CREDITPACK#/, "");
        const credits = r.credits || 0;
        const priceTry = r.priceTry || 0;
        return { ...r, id, totalPurchases: packCounts[id] || r.totalPurchases || 0, unitPriceTry: credits > 0 ? Math.round(priceTry / credits) : 0 };
      })
    : DEFAULT_CREDIT_PACKS.map(p => ({ ...p, totalPurchases: packCounts[p.id] || 0, stripeProductId: "" }));

  return ok({ packs });
}

async function handleUpdateCreditPack(event: ApiGatewayEvent) {
  const packId = event.pathParameters?.id;
  if (!packId) return badRequest("Paket ID gerekli.");

  const body = parseBody<Record<string, any>>(event);
  if (!body) return badRequest("Geçerli paket verisi gerekli.");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 1000) return badRequest("Gerekçe zorunludur.");

  const previous = await get(`CREDITPACK#${packId}`);
  const defaults: Record<string, any> = DEFAULT_CREDIT_PACKS.find(p => p.id === packId) || { credits: 0, bonusCredits: 0, priceTry: 0, popular: false };

  const credits = Number(body.credits ?? previous?.credits ?? defaults.credits);
  const priceTry = Number(body.priceTry ?? previous?.priceTry ?? defaults.priceTry);

  const next: Record<string, any> = {
    PK: `CREDITPACK#${packId}`,
    SK: "META",
    packId,
    id: packId,
    title: body.title || previous?.title || packId,
    description: body.description !== undefined ? body.description : (previous?.description || ""),
    credits,
    bonusCredits: Number(body.bonusCredits ?? previous?.bonusCredits ?? defaults.bonusCredits),
    priceTry,
    unitPriceTry: credits > 0 ? Math.round(priceTry / credits) : 0,
    popular: body.popular !== undefined ? !!body.popular : (previous?.popular ?? defaults.popular),
    enabled: body.enabled !== undefined ? !!body.enabled : (previous?.enabled !== false),
    stripeProductId: body.stripeProductId !== undefined ? body.stripeProductId : (previous?.stripeProductId || ""),
  };

  const saved = await commit(event, next, "creditpack_updated", reason, previous ? { ...previous } : null) as Record<string, any>;
  return ok({ status: "updated", pack: { ...saved, totalPurchases: previous?.totalPurchases || 0 } });
}

// ─── Analytics: Device Breakdown (mobile vs web) ─────────────────────────
async function handleDeviceAnalytics() {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const result = await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk) AND SK = :sk",
    ExpressionAttributeValues: { ":pk": { S: "SESSION#" }, ":sk": { S: "META" } },
  }));
  const sessions = result.Items.map((i: any) => unmarshall(i));

  let mobile = 0; let web = 0; let tablet = 0;
  const byDay: Record<string, { mobile: number; web: number }> = {};

  for (const s of sessions) {
    const deviceType = s.deviceType || "web";
    if (deviceType === "mobile") mobile++;
    else if (deviceType === "tablet") tablet++;
    else web++;

    const day = (s.createdAt || "").slice(0, 10);
    if (day) {
      if (!byDay[day]) byDay[day] = { mobile: 0, web: 0 };
      if (deviceType === "mobile" || deviceType === "tablet") byDay[day].mobile++;
      else byDay[day].web++;
    }
  }

  const total = mobile + web + tablet;
  const trend = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([date, counts]) => ({ date, ...counts }));

  return ok({
    devices: {
      total,
      mobile,
      web,
      tablet,
      mobilePercent: total > 0 ? Math.round((mobile + tablet) * 100 / total) : 0,
      webPercent: total > 0 ? Math.round(web * 100 / total) : 0,
      trend,
    },
  });
}

// ─── Analytics: Track Session (called from frontend on page load) ─────────
async function handleTrackSession(event: ApiGatewayEvent) {
  const body = parseBody<{ deviceType?: string; page?: string; sessionId?: string }>(event);
  if (!body) return badRequest("Geçersiz istek.");

  const deviceType = ["mobile", "tablet", "web"].includes(body.deviceType || "") ? body.deviceType : "web";
  const page = typeof body.page === "string" ? body.page.slice(0, 200) : "/";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : `s_${Date.now()}`;
  const user = (event as any).verifiedUser;

  const { DynamoDBClient, PutItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  await ddb.send(new PutItemCommand({
    TableName: getTableName(),
    Item: marshall({
      PK: `SESSION#${sessionId}`,
      SK: "META",
      sessionId, deviceType, page,
      userId: user?.sub || "anonymous",
      createdAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 3600, // 90 days
    }),
  }));

  return ok({ tracked: true });
}

// ─── Analytics: AI Topic Analysis ────────────────────────────────────────
async function handleAITopicAnalytics() {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString();

  const result = await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: "begins_with(SK, :sk) AND createdAt >= :cutoff",
    ExpressionAttributeValues: { ":sk": { S: "AI#" }, ":cutoff": { S: cutoffStr } },
    ProjectionExpression: "PK, SK, #prompt, createdAt, cost",
    ExpressionAttributeNames: { "#prompt": "prompt" },
  }));

  const rows = result.Items.map((i: any) => unmarshall(i));

  // Topic classification by keyword patterns
  const topicKeywords: Record<string, string[]> = {
    "Uçuş": ["uçuş", "bilet", "havalimanı", "uçak", "flight"],
    "Otel": ["otel", "konaklama", "hotel", "kal", "rezervasyon"],
    "Gezi Rotası": ["rota", "plan", "gün", "tur", "seyahat"],
    "Vize": ["vize", "pasaport", "giriş", "belge", "visa"],
    "Yeme-İçme": ["restoran", "yemek", "kafe", "lokanta", "food"],
    "Aktivite": ["müze", "gezil", "ziyaret", "aktivite", "attraction"],
    "Ulaşım": ["toplu", "metro", "taksi", "transfer", "ulaşım"],
    "Bütçe": ["fiyat", "bütçe", "ucuz", "para", "maliyet"],
  };

  const topicCounts: Record<string, number> = {};
  const destCounts: Record<string, number> = {};
  let totalRequests = rows.length;
  let totalCost = 0;
  const dailyMap: Record<string, number> = {};

  for (const row of rows) {
    const prompt = (row.prompt || "").toLowerCase();
    totalCost += row.cost || 0;
    const day = (row.createdAt || "").slice(0, 10);
    if (day) dailyMap[day] = (dailyMap[day] || 0) + 1;

    // Classify topic
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(k => prompt.includes(k))) {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      }
    }

    // Extract destination mentions
    const destPatterns = ["istanbul", "barcelona", "paris", "londra", "roma", "amsterdam", "berlin", "madrid", "atina", "dubai"];
    for (const dest of destPatterns) {
      if (prompt.includes(dest)) destCounts[dest] = (destCounts[dest] || 0) + 1;
    }
  }

  const topTopics = Object.entries(topicCounts).sort(([, a], [, b]) => b - a).map(([topic, count]) => ({ topic, count, percent: totalRequests > 0 ? Math.round(count * 100 / totalRequests) : 0 }));
  const topDestinations = Object.entries(destCounts).sort(([, a], [, b]) => b - a).slice(0, 10).map(([destination, count]) => ({ destination, count }));
  const dailyActivity = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([date, requests]) => ({ date, requests }));

  return ok({
    aiAnalytics: {
      totalRequests,
      totalCost: Math.round(totalCost * 100) / 100,
      avgCostPerRequest: totalRequests > 0 ? Math.round(totalCost / totalRequests * 100) / 100 : 0,
      topTopics,
      topDestinations,
      dailyActivity,
      periodDays: 30,
    },
  });
}

// ─── Analytics: Community Activity ───────────────────────────────────────
async function handleCommunityAnalytics() {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const result = await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk)",
    ExpressionAttributeValues: { ":pk": { S: "POST#" } },
  }));
  const posts = result.Items.map((i: any) => unmarshall(i));

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 3600_000).toISOString();
  const last7d = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString();

  const recentPosts = posts.filter(p => p.createdAt >= last24h).length;
  const weekPosts = posts.filter(p => p.createdAt >= last7d).length;
  const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.comments || 0), 0);

  // Top posts (last 7 days)
  const topPosts = posts
    .filter(p => p.createdAt >= last7d)
    .sort((a, b) => ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0)))
    .slice(0, 10)
    .map(p => ({ id: p.postId || p.PK, title: (p.content || "").slice(0, 80), author: p.authorEmail || "—", likes: p.likes || 0, comments: p.comments || 0, createdAt: p.createdAt }));

  // Daily post trend
  const dailyMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    dailyMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const p of posts) {
    const day = (p.createdAt || "").slice(0, 10);
    if (day in dailyMap) dailyMap[day]++;
  }
  const dailyTrend = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

  return ok({
    community: {
      totalPosts: posts.length,
      postsLast24h: recentPosts,
      postsLast7d: weekPosts,
      totalLikes,
      totalComments,
      engagementRate: posts.length > 0 ? Math.round((totalLikes + totalComments) / posts.length * 10) / 10 : 0,
      topPosts,
      dailyTrend,
    },
  });
}

// ─── Analytics: Subscription Trends ──────────────────────────────────────
async function handleSubscriptionAnalytics() {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const result = await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: "SK = :sk",
    ExpressionAttributeValues: { ":sk": { S: "SUBSCRIPTION" } },
  }));
  const subs = result.Items.map((i: any) => unmarshall(i));

  const payments = await paymentRecords();

  const tierCount: Record<string, number> = {};
  const tierRevenue: Record<string, number> = {};
  let activeCount = 0; let cancelledCount = 0;

  for (const s of subs) {
    const tier = s.tier || "free";
    tierCount[tier] = (tierCount[tier] || 0) + 1;
    if (s.status === "active") activeCount++;
    else if (s.status === "cancelled") cancelledCount++;
  }

  for (const p of payments) {
    if (p.status === "succeeded" && p.tier) {
      tierRevenue[p.tier] = (tierRevenue[p.tier] || 0) + (p.amount || 0);
    }
  }

  const now = new Date();
  const last30Start = new Date(now); last30Start.setDate(last30Start.getDate() - 30);
  const newSubscribers30d = subs.filter(s => s.createdAt >= last30Start.toISOString()).length;
  const churnedLast30d = subs.filter(s => s.cancelledAt && s.cancelledAt >= last30Start.toISOString()).length;

  const planBreakdown = Object.entries(tierCount).map(([plan, count]) => ({
    plan,
    count,
    revenue: tierRevenue[plan] || 0,
    percent: subs.length > 0 ? Math.round(count * 100 / subs.length) : 0,
  })).sort((a, b) => b.count - a.count);

  // MRR estimate
  const PLAN_MONTHLY_TRY: Record<string, number> = { explorer: 49, pro: 99, agency: 299, free: 0 };
  const mrr = Object.entries(tierCount).reduce((sum, [tier, count]) => sum + (PLAN_MONTHLY_TRY[tier] || 0) * count, 0);

  // Conversion funnel (registrations → paid)
  const totalUsers = (await scanAll(ddb, new ScanCommand({
    TableName: getTableName(),
    FilterExpression: "SK = :sk AND begins_with(PK, :pk)",
    ExpressionAttributeValues: { ":sk": { S: "META" }, ":pk": { S: "USER#" } },
    Select: "COUNT",
  }))).Count || 0;
  const paidUsers = subs.filter(s => s.tier !== "free" && s.status === "active").length;
  const conversionRate = totalUsers > 0 ? Math.round(paidUsers * 100 / totalUsers * 10) / 10 : 0;

  return ok({
    subscriptions: {
      total: subs.length,
      active: activeCount,
      cancelled: cancelledCount,
      newLast30d: newSubscribers30d,
      churnLast30d: churnedLast30d,
      churnRate: activeCount > 0 ? Math.round(churnedLast30d * 100 / activeCount * 10) / 10 : 0,
      mrrTry: mrr,
      paidUsers,
      conversionRate,
      planBreakdown,
    },
  });
}
