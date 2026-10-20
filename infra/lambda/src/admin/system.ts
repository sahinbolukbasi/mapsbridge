import type { ApiGatewayEvent } from "../shared/http";
import { ok, parseBody, badRequest } from "../shared/http";
import { get, commit, getTableName } from "./management";

export async function handleGetSystemConfig() {
  const { DynamoDBClient, GetItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const result = await ddb.send(
    new GetItemCommand({
      TableName: getTableName(),
      Key: { PK: { S: "SYSTEM#CONFIG" }, SK: { S: "META" } },
    }),
  );

  const config = result.Item
    ? unmarshall(result.Item)
    : { maintenanceMode: false, updatedAt: new Date().toISOString() };
  return ok({ config });
}

export async function handleUpdateSystemConfig(event: ApiGatewayEvent) {
  const body = parseBody<Record<string, any>>(event);
  if (!body || typeof body.maintenanceMode !== "boolean")
    return badRequest("Bakım modu boolean olmalıdır.");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 1000)
    return badRequest("En fazla 1000 karakterlik gerekçe gerekli.");
  const previous = await get("SYSTEM#CONFIG");
  if (body.version !== undefined && body.version !== (previous?.version || 0))
    return {
      statusCode: 409,
      headers: ok({}).headers,
      body: JSON.stringify({ error: "Ayarlar değişti. Yenileyip tekrar deneyin." }),
    };
  const next = {
    ...previous,
    PK: "SYSTEM#CONFIG",
    SK: "META",
    maintenanceMode: body.maintenanceMode,
    maintenanceMessage:
      previous?.maintenanceMessage ||
      "Kısa süreli bakım yapılıyor. Lütfen daha sonra tekrar deneyin.",
    routeCreationEnabled: previous?.routeCreationEnabled ?? true,
    sharesEnabled: previous?.sharesEnabled ?? true,
    reason,
    updatedBy: (event as any).verifiedUser.sub,
  };
  for (const flag of ["routeCreationEnabled", "sharesEnabled"] as const) {
    if (body[flag] !== undefined) {
      if (typeof body[flag] !== "boolean") return badRequest("Geçersiz özellik ayarı.");
      next[flag] = body[flag];
    }
  }
  if (body.maintenanceMessage !== undefined) {
    if (
      typeof body.maintenanceMessage !== "string" ||
      !body.maintenanceMessage.trim() ||
      body.maintenanceMessage.length > 500
    )
      return badRequest("Bakım mesajı 1–500 karakter olmalıdır.");
    next.maintenanceMessage = body.maintenanceMessage.trim();
  }
  const config = await commit(event, next, "system_config_updated", reason, previous);
  return ok({ config });
}

export async function handleGetModuleConfig() {
  const row = await get("SYSTEM#MODULES");
  const moduleConfig = row || {
    mapEnabled: true,
    aiEnabled: true,
    communityEnabled: true,
    messagingEnabled: true,
  };
  return ok({ moduleConfig });
}

export async function handleUpdateModuleConfig(event: ApiGatewayEvent) {
  const body = parseBody<Record<string, any>>(event);
  if (!body) return badRequest("Geçerli istek verisi gerekli.");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 1000)
    return badRequest("En fazla 1000 karakterlik gerekçe gerekli.");

  const previous = await get("SYSTEM#MODULES");
  const current = previous || {
    PK: "SYSTEM#MODULES",
    SK: "META",
    mapEnabled: true,
    aiEnabled: true,
    communityEnabled: true,
    messagingEnabled: true,
  };

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

export async function handleSystemHealth() {
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
  } catch (_err) {
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
        cognito: {
          status: "healthy",
          poolId: process.env.COGNITO_USER_POOL_ID || "not-configured",
        },
        bedrock: { status: "unknown", model: bedrockModel },
        apiGateway: { status: "healthy", protocol: "HTTP API v2" },
        stripe: { status: process.env.STRIPE_SECRET_KEY ? "configured" : "offline" },
        osrm: { status: "unknown", engine: "OSRM Public Routing" },
        geocoding: { status: "unknown", provider: "Nominatim / Photomap" },
      },
    },
  });
}

export async function handleAgentCoreStatus() {
  const region = process.env.AWS_REGION || "eu-central-1";
  const memoryId = process.env.AGENTCORE_MEMORY_ID;
  const gatewayId = process.env.AGENTCORE_GATEWAY_ID;
  const workerName = `${process.env.ENVIRONMENT === "prod" ? "mapsbridge-prod" : "mapsbridge-dev"}-ai-memory-worker`;
  const dlqUrl = process.env.MEMORY_DLQ_URL;
  const result: Record<string, any> = { observedAt: new Date().toISOString(), region };

  if (gatewayId) {
    try {
      const { BedrockAgentCoreControlClient, GetGatewayCommand, ListGatewayTargetsCommand } =
        await import("@aws-sdk/client-bedrock-agentcore-control");
      const client = new BedrockAgentCoreControlClient({ region, maxAttempts: 1 });
      const [gw, targets] = await Promise.all([
        client.send(new GetGatewayCommand({ gatewayIdentifier: gatewayId })),
        client.send(new ListGatewayTargetsCommand({ gatewayIdentifier: gatewayId })),
      ]);
      result.gateway = {
        id: gw.gatewayId,
        name: gw.name,
        status: gw.status,
        url: gw.gatewayUrl,
        protocol: gw.protocolType,
        targets: (targets.items || []).map((t) => ({
          id: t.targetId,
          name: t.name,
          status: t.status,
          type: t.targetType,
        })),
      };
      client.destroy();
    } catch (e) {
      result.gateway = { status: "unknown", error: (e as Error).name };
    }
  } else {
    result.gateway = { status: "not_configured" };
  }

  if (memoryId) {
    try {
      const { BedrockAgentCoreControlClient, GetMemoryCommand } =
        await import("@aws-sdk/client-bedrock-agentcore-control");
      const client = new BedrockAgentCoreControlClient({ region, maxAttempts: 1 });
      const mem = await client.send(new GetMemoryCommand({ memoryId }));
      result.memory = {
        id: memoryId,
        name: mem.memory?.name,
        status: mem.memory?.status,
        strategies: (mem.memory?.strategies || []).map((s) => ({
          name: s.name,
          type: s.type,
          status: s.status,
        })),
      };
      client.destroy();
    } catch (e) {
      result.memory = { id: memoryId, status: "unknown", error: (e as Error).name };
    }
  } else {
    result.memory = { status: "not_configured" };
  }

  try {
    const [lambdaSdk, cwSdk, sqsSdk] = await Promise.all([
      import("@aws-sdk/client-lambda"),
      import("@aws-sdk/client-cloudwatch"),
      import("@aws-sdk/client-sqs"),
    ]);
    const lambda = new lambdaSdk.LambdaClient({ region, maxAttempts: 1 });
    const cw = new cwSdk.CloudWatchClient({ region, maxAttempts: 1 });
    const since = new Date(Date.now() - 3600000);
    const now = new Date();
    const [fn, errors, invocations] = await Promise.all([
      lambda.send(new lambdaSdk.GetFunctionConfigurationCommand({ FunctionName: workerName })),
      cw.send(
        new cwSdk.GetMetricStatisticsCommand({
          Namespace: "AWS/Lambda",
          MetricName: "Errors",
          Dimensions: [{ Name: "FunctionName", Value: workerName }],
          StartTime: since,
          EndTime: now,
          Period: 3600,
          Statistics: ["Sum"],
        }),
      ),
      cw.send(
        new cwSdk.GetMetricStatisticsCommand({
          Namespace: "AWS/Lambda",
          MetricName: "Invocations",
          Dimensions: [{ Name: "FunctionName", Value: workerName }],
          StartTime: since,
          EndTime: now,
          Period: 3600,
          Statistics: ["Sum"],
        }),
      ),
    ]);
    let dlqMessages: string | number = "unknown";
    if (dlqUrl) {
      const sqs = new sqsSdk.SQSClient({ region, maxAttempts: 1 });
      const dlqResult = await sqs
        .send(
          new sqsSdk.GetQueueAttributesCommand({
            QueueUrl: dlqUrl,
            AttributeNames: ["ApproximateNumberOfMessages"],
          }),
        )
        .catch(() => null);
      dlqMessages = dlqResult?.Attributes?.ApproximateNumberOfMessages ?? "unknown";
      sqs.destroy();
    }
    result.worker = {
      name: workerName,
      state: fn.State,
      lastUpdate: fn.LastUpdateStatus,
      errorsLastHour: errors.Datapoints?.[0]?.Sum ?? 0,
      invocationsLastHour: invocations.Datapoints?.[0]?.Sum ?? 0,
      dlqMessages,
    };
    lambda.destroy();
    cw.destroy();
  } catch (e) {
    result.worker = { name: workerName, status: "unknown", error: (e as Error).name };
  }

  return ok(result);
}
