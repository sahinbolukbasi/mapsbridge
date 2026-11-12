import { GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { getDynamoClient } from "./dynamo";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

export const AI_CONTROL_KEY = "SYSTEM#AI_CONTROL";
export const AI_RUNTIME_KEY = "SYSTEM#AI_RUNTIME";
export const AI_EVENTS_KEY = "AI#OPERATIONS";
export const AI_AGENTS_KEY = "SYSTEM#AI_AGENTS";
export interface AIControl {
  enabled: boolean;
  defaultModel: string;
  disabledModels: string[];
  version: number;
}
export function configuredModels(env = process.env): string[] {
  return [
    ...new Set(
      [
        env.BEDROCK_MODEL_ID,
        env.BEDROCK_INTAKE_MODEL_ID,
        env.BEDROCK_FAST_MODEL_ID,
        "anthropic.claude-3-5-haiku-20241022-v1:0",
        "meta.llama3-1-8b-instruct-v1:0",
        "amazon.nova-micro-v1:0",
      ].filter((id): id is string => !!id),
    ),
  ];
}
export function defaultControl(): AIControl {
  return {
    enabled: true,
    defaultModel: process.env.BEDROCK_MODEL_ID || "",
    disabledModels: [],
    version: 0,
  };
}
export function chooseModel(control: AIControl, requested?: string): string {
  const model = requested || control.defaultModel;
  if (!control.enabled) throw new Error("AI_DISABLED");
  if (!configuredModels().includes(model)) throw new Error("MODEL_NOT_CONFIGURED");
  if (control.disabledModels.includes(model)) throw new Error("MODEL_DISABLED");
  return model;
}
const defaultEnabledAgents = new Set(["context", "transit", "discovery", "emergency"]);
export async function readEnabledAIAgents(): Promise<Set<string>> {
  if (!process.env.DYNAMODB_TABLE) return new Set(defaultEnabledAgents);
  try {
    const result = await client().send(
      new GetItemCommand({
        TableName: process.env.DYNAMODB_TABLE,
        Key: marshall({ PK: AI_AGENTS_KEY, SK: "META" }),
        ConsistentRead: true,
      }),
      { abortSignal: AbortSignal.timeout(1200) },
    );
    if (!result.Item) return new Set(defaultEnabledAgents);
    const row = unmarshall(result.Item);
    const enabled = Array.isArray(row.agents)
      ? (row.agents as Array<{ enabled?: boolean; id?: string }>)
          .filter((agent) => agent?.enabled === true && typeof agent.id === "string")
          .map((agent) => agent.id as string)
      : [];
    return new Set(enabled);
  } catch {
    console.warn("AI_AGENT_CATALOG_READ_FAILED");
    return new Set(defaultEnabledAgents);
  }
}
const client = () => getDynamoClient({ maxAttempts: 1 });
export async function readAIControl(): Promise<AIControl> {
  if (!process.env.DYNAMODB_TABLE) return defaultControl();
  const result = await client().send(
    new GetItemCommand({
      TableName: process.env.DYNAMODB_TABLE,
      Key: marshall({ PK: AI_CONTROL_KEY, SK: "META" }),
      ConsistentRead: true,
    }),
    { abortSignal: AbortSignal.timeout(2000) },
  );
  return { ...defaultControl(), ...(result.Item ? unmarshall(result.Item) : {}) };
}
export function runtimeSnapshot() {
  return {
    models: configuredModels(),
    primaryModel: process.env.BEDROCK_MODEL_ID || "",
    intakeModel: process.env.BEDROCK_INTAKE_MODEL_ID || "",
    customModelEnabled: process.env.CUSTOM_MODEL_ENABLED === "true",
    region: process.env.AWS_REGION || "eu-central-1",
    services: [
      {
        id: "bedrock",
        name: "Amazon Bedrock",
        configured: !!process.env.BEDROCK_MODEL_ID,
        purpose: "Niyet çıkarımı ve yanıt üretimi",
      },
      {
        id: "rag",
        name: "Seyahat bilgi tabanı (RAG)",
        configured: !!process.env.TRAVEL_KNOWLEDGE_BASE_ID,
        purpose: "Onaylı, herkese açık ve geçerlilik süresi dolmamış kaynakları getirir",
      },
      {
        id: "guardrail",
        name: "Bedrock Guardrail",
        configured: !!process.env.BEDROCK_GUARDRAIL_ID,
        purpose: "Model çağrılarında içerik güvenliği",
      },
      {
        id: "places",
        name: "Amazon Location Places",
        configured: process.env.PLACE_RESEARCH_ENABLED === "true",
        purpose: "Yer adı, adres ve koordinat araştırması",
      },
      {
        id: "gateway",
        name: "AgentCore Gateway",
        configured: !!process.env.AGENTCORE_GATEWAY_URL,
        purpose: "IAM doğrulamalı MCP üzerinden sınırlı mekân araştırması",
      },
      {
        id: "memory",
        name: "AgentCore kişisel hafıza",
        configured:
          !!process.env.AI_MEMORY_TABLE &&
          !!process.env.AGENTCORE_MEMORY_ID &&
          (process.env.MEMORY_READ_ENABLED === "true" ||
            process.env.MEMORY_WRITE_ENABLED === "true"),
        purpose: "Kullanıcı iznine bağlı kalıcı tercihler ve geçmiş bağlamı",
      },
      {
        id: "training",
        name: "Eğitim verisi kuyruğu",
        configured: process.env.AI_TRAINING_COLLECTION_ENABLED === "true",
        purpose: "Açık rızalı mesajları inceleme için kalıcı kuyruğa alır; otomatik eğitim yapmaz",
      },
      {
        id: "storage",
        name: "DynamoDB",
        configured: !!process.env.DYNAMODB_TABLE,
        purpose: "Kredi, ayarlar, konuşma ve operasyon kayıtları",
      },
      {
        id: "place_intelligence",
        name: "Place Intelligence Pipeline",
        configured: !!(process.env.GOOGLE_PLACES_API_KEY || process.env.FOURSQUARE_API_KEY),
        purpose:
          "Çok kaynaklı mekan keşfi (OSM, Google Places, Foursquare) ve LLM eğitim verisi üretimi",
      },
    ],
    observedAt: new Date().toISOString(),
  };
}
/** RAG getirme sonucunun kaba durumu — teşhis ve grounding ölçümü için. */
export type RetrievalStatus = "disabled" | "available" | "empty" | "unavailable";

/** Kanıt birleştirme sayıları (retrieval.ts + bundled-evidence.ts mergeEvidence çıktısı). */
export interface EvidenceCounts {
  remote: number;
  local: number;
  merged: number;
}

/**
 * CloudWatch EMF (embedded metric format) metrik yayımı — training-worker.ts
 * `trainingMetric` deseniyle aynı. Sadece sayısal/kategorik; prompt/yanıt/kimlik
 * asla loglanmaz. `dimensions` kardinalitesi düşük tutulur (retrievalStatus gibi).
 */
export function aiMetric(
  name: string,
  value: number,
  unit = "Count",
  dimensions?: Record<string, string>,
) {
  const dimKeys = dimensions ? Object.keys(dimensions) : [];
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: "MapsBridge/AI",
            Dimensions: [["Service", ...dimKeys]],
            Metrics: [{ Name: name, Unit: unit }],
          },
        ],
      },
      Service: "ai",
      ...dimensions,
      [name]: value,
    }),
  );
}

// No prompts, responses, user IDs or provider error messages enter the operations log.
export async function recordAIOperation(
  event: {
    kind: "request" | "model";
    status: "running" | "succeeded" | "failed";
    model?: string;
    role?: string;
    durationMs?: number;
    errorCode?: string;
    agents?: Array<{ agentId: string; status: string; durationMs?: number }>;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadInputTokens?: number;
    cacheWriteInputTokens?: number;
    invoked?: boolean;
    estimatedModelCostUsd?: number | null;
    pricingStatus?: string;
    responseMode?: string;
    retrievalStatus?: RetrievalStatus;
    evidenceCounts?: EvidenceCounts;
  },
  key?: string,
): Promise<string> {
  const now = new Date().toISOString();
  const SK = key || `${now}#${crypto.randomUUID()}`;
  // Terminal istek olaylarında CloudWatch metriği yay: gecikme + retrievalStatus
  // dağılımı + grounding kanıt sayısı. Geriye uyumlu — alanlar opsiyonel.
  if (event.kind === "request" && event.status !== "running") {
    try {
      if (typeof event.durationMs === "number")
        aiMetric("RequestLatency", event.durationMs, "Milliseconds", {
          Status: event.status,
        });
      if (event.retrievalStatus)
        aiMetric("RetrievalOutcome", 1, "Count", { RetrievalStatus: event.retrievalStatus });
      if (event.evidenceCounts)
        aiMetric("EvidenceMerged", event.evidenceCounts.merged, "Count");
    } catch {
      // Metrik yayımı asla ana akışı düşürmez.
    }
  }
  if (!process.env.DYNAMODB_TABLE) return SK;
  try {
    await client().send(
      new PutItemCommand({
        TableName: process.env.DYNAMODB_TABLE,
        Item: marshall(
          {
            PK: AI_EVENTS_KEY,
            SK,
            ...event,
            startedAt: SK.split("#")[0],
            updatedAt: now,
            expiresAt: Math.floor(Date.now() / 1000) + 7 * 86400,
          },
          { removeUndefinedValues: true },
        ),
      }),
      { abortSignal: AbortSignal.timeout(1000) },
    );
  } catch {
    console.warn("AI_OPERATIONS_WRITE_FAILED");
  }
  return SK;
}
export async function publishAIRuntime() {
  if (!process.env.DYNAMODB_TABLE) return;
  try {
    await client().send(
      new PutItemCommand({
        TableName: process.env.DYNAMODB_TABLE,
        Item: marshall({ PK: AI_RUNTIME_KEY, SK: "META", ...runtimeSnapshot() }),
      }),
      { abortSignal: AbortSignal.timeout(1000) },
    );
  } catch {
    console.warn("AI_RUNTIME_WRITE_FAILED");
  }
}
