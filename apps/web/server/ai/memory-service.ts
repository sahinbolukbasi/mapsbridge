import { createHash, randomUUID } from "node:crypto";
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  TransactWriteItem,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { sanitizePreferences, type TravelPreferences } from "../../app/lib/ai/preferences";

export interface MemorySettings {
  generation: string;
  version: number;
  enabled: boolean;
  changedAt: string;
  erasedAt?: string;
}
export interface PersonalMemory {
  id: string;
  text: string;
  kind: "preference" | "summary";
  updatedAt?: string;
}
export interface MemoryJob {
  PK: string;
  SK: string;
  kind: "write" | "purge";
  userId: string;
  generation: string;
  sessionId?: string;
  requestId: string;
  createdAt: string;
  status: "pending";
  payload?: string;
  eraseHistory?: boolean;
  expiresAt?: number;
}
let db: DynamoDBClient | undefined;
export const memoryTable = () => process.env.AI_MEMORY_TABLE || "";
export const memoryDb = () =>
  (db ||= new DynamoDBClient({ region: process.env.AWS_REGION || "eu-central-1", maxAttempts: 2 }));
export const actorFor = (userId: string, generation: string) =>
  "u_" +
  createHash("sha256")
    .update(JSON.stringify([userId, generation]))
    .digest("hex");
export const memoryNamespace = (actor: string, kind: "preferences" | "summaries") =>
  `/users/${actor}/${kind}/`;
export const defaultSettings = (): MemorySettings => ({
  generation: "initial",
  version: 0,
  enabled: false,
  changedAt: "1970-01-01T00:00:00.000Z",
});
export async function getMemorySettings(userId: string): Promise<MemorySettings> {
  if (!memoryTable()) return defaultSettings();
  const result = await memoryDb().send(
    new GetItemCommand({
      TableName: memoryTable(),
      Key: marshall({ PK: `USER#${userId}`, SK: "SETTINGS" }),
      ConsistentRead: true,
    }),
  );
  return result.Item ? (unmarshall(result.Item) as MemorySettings) : defaultSettings();
}
export function settingsCondition(userId: string, settings: MemorySettings) {
  return {
    ConditionCheck: {
      TableName: memoryTable(),
      Key: marshall({ PK: `USER#${userId}`, SK: "SETTINGS" }),
      ConditionExpression:
        settings.version === 0 ? "attribute_not_exists(PK)" : "#version = :version",
      ...(settings.version === 0
        ? {}
        : {
            ExpressionAttributeNames: { "#version": "version" },
            ExpressionAttributeValues: marshall({ ":version": settings.version }),
          }),
    },
  };
}
export function writeJob(
  userId: string,
  settings: MemorySettings,
  requestId: string,
  sessionId: string,
  preferences: TravelPreferences,
  trip?: { destination?: string; days?: number },
  userTags?: string[],
): MemoryJob | undefined {
  if (
    !memoryTable() ||
    !process.env.AGENTCORE_MEMORY_ID ||
    process.env.MEMORY_WRITE_ENABLED !== "true" ||
    !settings.enabled
  )
    return undefined;
  // Do not ship raw conversation, coordinates, identity, or model prose to personal memory.
  const safe = sanitizePreferences(preferences);
  const summary = trip?.destination
    ? { destination: trip.destination.slice(0, 120), days: trip.days }
    : undefined;
  const cleanTags = Array.isArray(userTags)
    ? userTags
        .filter((t): t is string => typeof t === "string" && /^[a-z0-9:_]{2,40}$/.test(t))
        .slice(0, 16)
    : [];
  if (!Object.keys(safe).length && !summary && !cleanTags.length) return undefined;
  return {
    PK: `USER#${userId}`,
    SK: `OUTBOX#${requestId}`,
    kind: "write",
    userId,
    generation: settings.generation,
    requestId,
    sessionId: "s_" + createHash("sha256").update(sessionId).digest("hex"),
    createdAt: new Date().toISOString(),
    status: "pending",
    payload: JSON.stringify({
      confirmedTravelPreferences: safe,
      currentTripOnly: summary,
      ...(cleanTags.length ? { userTags: cleanTags } : {}),
    }),
  };
}
export async function retrievePersonalMemory(
  userId: string,
  settings: MemorySettings,
  query: string,
): Promise<PersonalMemory[]> {
  if (
    !settings.enabled ||
    process.env.MEMORY_READ_ENABLED !== "true" ||
    !process.env.AGENTCORE_MEMORY_ID
  )
    return [];
  const sdk = await import("@aws-sdk/client-bedrock-agentcore");
  const client = new sdk.BedrockAgentCoreClient({
    region: process.env.AWS_REGION || "eu-central-1",
    maxAttempts: 1,
  });
  const actor = actorFor(userId, settings.generation),
    signal = AbortSignal.timeout(800);
  try {
    // Preferences are authoritative in DynamoDB. Derived records only supply trip recollection.
    const result = await client.send(
      new sdk.RetrieveMemoryRecordsCommand({
        memoryId: process.env.AGENTCORE_MEMORY_ID,
        namespacePath: memoryNamespace(actor, "summaries"),
        searchCriteria: { searchQuery: query.slice(0, 1000), topK: 5 },
      }),
      { abortSignal: signal },
    );
    const records = (result.memoryRecordSummaries || [])
      .filter((r) => r.memoryRecordId && r.content?.text)
      .map((r) => ({
        id: r.memoryRecordId!,
        text: r.content!.text!.slice(0, 1000),
        kind: "summary" as const,
        updatedAt: r.createdAt?.toISOString(),
      }));
    // Recheck consent after the remote call to reject a racing forget/disable operation.
    const current = await getMemorySettings(userId);
    return current.enabled &&
      current.generation === settings.generation &&
      current.version === settings.version
      ? records
      : [];
  } catch (error: unknown) {
    console.warn("PersonalMemoryUnavailable", error instanceof Error ? error.name : "Error");
    return [];
  } finally {
    client.destroy();
  }
}
export async function changeMemory(
  userId: string,
  input: {
    enabled?: boolean;
    preferences?: TravelPreferences;
    eraseHistory?: boolean;
    reset?: boolean;
  },
): Promise<MemorySettings> {
  if (!memoryTable()) throw new Error("MEMORY_NOT_CONFIGURED");
  const before = await getMemorySettings(userId),
    now = new Date().toISOString();
  // Rotation also on a correction prevents stale asynchronous extraction from resurrecting it.
  const rotate =
    input.reset || input.eraseHistory || input.preferences !== undefined || input.enabled === false;
  const next: MemorySettings = {
    ...before,
    version: before.version + 1,
    generation: rotate ? randomUUID() : before.generation,
    enabled: input.enabled ?? before.enabled,
    changedAt: now,
    ...(input.eraseHistory ? { erasedAt: now } : {}),
  };
  const PK = `USER#${userId}`;
  const operations: TransactWriteItem[] = [
    {
      Put: {
        TableName: memoryTable(),
        Item: marshall({ PK, SK: "SETTINGS", ...next }),
        ConditionExpression:
          before.version === 0 ? "attribute_not_exists(PK)" : "#version = :version",
        ...(before.version === 0
          ? {}
          : {
              ExpressionAttributeNames: { "#version": "version" },
              ExpressionAttributeValues: marshall({ ":version": before.version }),
            }),
      },
    },
  ];
  if (rotate) {
    const job: MemoryJob = {
      PK,
      SK: `PURGE#${before.generation}`,
      kind: "purge",
      userId,
      generation: before.generation,
      requestId: randomUUID(),
      createdAt: now,
      status: "pending",
      eraseHistory: input.eraseHistory === true,
    };
    operations.push({ Put: { TableName: memoryTable(), Item: marshall(job) } });
  }
  if (input.preferences !== undefined || input.reset || input.eraseHistory) {
    operations.push({
      Put: {
        TableName: process.env.DYNAMODB_TABLE!,
        Item: marshall({
          PK,
          SK: "AI_PREFERENCES",
          ...sanitizePreferences(input.preferences),
          updatedAt: now,
          source: "user_confirmed",
          schemaVersion: 1,
        }),
      },
    });
  }
  await memoryDb().send(new TransactWriteItemsCommand({ TransactItems: operations }));
  return next;
}
export async function deletionStatus(userId: string) {
  if (!memoryTable()) return { status: "not_configured", jobs: [] };
  const result = await memoryDb().send(
    new QueryCommand({
      TableName: memoryTable(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: marshall({ ":pk": `USER#${userId}`, ":prefix": "PURGE#" }),
      ConsistentRead: true,
    }),
  );
  const jobs = (result.Items || []).map((item) => {
    const r = unmarshall(item);
    return { status: r.status, requestedAt: r.createdAt, lastCheckedAt: r.lastCheckedAt };
  });
  return {
    status:
      jobs.some((j) => j.status !== "done") || result.LastEvaluatedKey ? "pending" : "complete",
    jobs,
  };
}
