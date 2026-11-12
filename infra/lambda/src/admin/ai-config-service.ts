import type { ApiGatewayEvent } from "../shared/http";
import { ok, badRequest, parseBody } from "../shared/http";
import { getDynamoClient } from "../shared/dynamo";
import { getTableName, scanAllRaw, recordAuditLog } from "./management";
import type { AuthorizedEvent } from "../shared/types";

export interface AIAgentDetailedConfig {
  PK: string;
  SK: string;
  prompts: {
    systemPrompt: string;
    conciergeGreeting: string;
    behaviorGuidelines: string;
    questionFlow: string;
  };
  routing: {
    fastModel: string; // "meta.llama3-1-8b-instruct-v1:0" / "amazon.nova-micro-v1:0"
    routingModel: string; // "anthropic.claude-3-5-haiku-20241022-v1:0"
    postRouteHarnessModel: string;
    temperature: number;
    maxTokens: number;
  };
  tools: {
    placesSearch: boolean;
    weatherCheck: boolean;
    transitDirections: boolean;
    esimLookup: boolean;
    hotelLookup: boolean;
  };
  vectorDb: {
    indexName: string;
    status: "active" | "syncing" | "error";
    totalVectors: number;
    lastSyncedAt: string;
  };
  updatedAt: string;
  updatedBy: string;
}

const DEFAULT_AI_DETAILED_CONFIG: AIAgentDetailedConfig = {
  PK: "SYSTEM#AI_CONFIG",
  SK: "META",
  prompts: {
    systemPrompt:
      "Sen MapsBridge Seyahat Danışmanısın. Kullanıcıların gerçek ihtiyaçlarını anlayarak en pratik, coğrafi açıdan mantıklı ve keyifli rotaları oluşturursun.",
    conciergeGreeting: "Merhaba {userName}, nasıl yardımcı olabilirim?",
    behaviorGuidelines:
      "- Kullanıcı bilinen tercihleri veritabanında varsa asla tekrar sorma.\n- Günübirlik, hafta sonu veya iş seyahati gibi bilgileri mesajdan otomatik çıkar.\n- Soru-cevap aşamasında sadece 3 nokta animasyonu göster.\n- Rota oluştuktan sonra otel, ulaşım ve e-SIM harness bilgilerini sağla.",
    questionFlow:
      "1. Destinasyon & Süre tespiti\n2. Seyahat amacı & İlgi alanları\n3. Bütçe ve tempo tercihi\n4. Rota oluşturma & Doğrulama",
  },
  routing: {
    fastModel: "meta.llama3-1-8b-instruct-v1:0",
    routingModel: "anthropic.claude-3-5-haiku-20241022-v1:0",
    postRouteHarnessModel: "anthropic.claude-3-5-haiku-20241022-v1:0",
    temperature: 0.3,
    maxTokens: 2048,
  },
  tools: {
    placesSearch: true,
    weatherCheck: true,
    transitDirections: true,
    esimLookup: true,
    hotelLookup: true,
  },
  vectorDb: {
    indexName: "mapsbridge-agentcore-memory",
    status: "active",
    totalVectors: 14850,
    lastSyncedAt: new Date().toISOString(),
  },
  updatedAt: new Date().toISOString(),
  updatedBy: "system",
};

export async function handleGetAIDetailedConfig() {
  const { GetItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall, unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  const res = await ddb.send(
    new GetItemCommand({
      TableName: getTableName(),
      Key: marshall({ PK: "SYSTEM#AI_CONFIG", SK: "META" }),
    }),
  );

  const config = res.Item
    ? (unmarshall(res.Item) as AIAgentDetailedConfig)
    : DEFAULT_AI_DETAILED_CONFIG;

  return ok({ config });
}

export async function handleUpdateAIDetailedConfig(event: ApiGatewayEvent) {
  const { PutItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  const body = parseBody<Partial<AIAgentDetailedConfig>>(event);
  if (!body) return badRequest("Geçerli AI konfigürasyon verisi gerekli.");

  const actorSub = (event as AuthorizedEvent).verifiedUser?.sub || "admin";
  const now = new Date().toISOString();

  const next: AIAgentDetailedConfig = {
    ...DEFAULT_AI_DETAILED_CONFIG,
    ...body,
    PK: "SYSTEM#AI_CONFIG",
    SK: "META",
    updatedAt: now,
    updatedBy: actorSub,
  };

  await ddb.send(
    new PutItemCommand({
      TableName: getTableName(),
      Item: marshall(next, { removeUndefinedValues: true }),
    }),
  );

  await recordAuditLog(
    actorSub,
    "ai_config_updated",
    "SYSTEM#AI_CONFIG",
    "Bedrock AgentCore sistem promptları ve model yönlendirme güncellendi.",
  );

  return ok({ status: "updated", config: next });
}

export async function handleListAIFeedback(event: ApiGatewayEvent) {
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  const limit = Math.min(Number(event.queryStringParameters?.limit) || 50, 100);

  const result = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk) AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": { S: "FEEDBACK#AI#" },
      ":sk": { S: "META" },
    },
    Limit: limit,
  });

  const feedbacks = (result.Items || []).map((i) => unmarshall(i));
  feedbacks.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return ok({ feedbacks, count: feedbacks.length });
}

