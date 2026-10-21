import { createHash } from "node:crypto";
import {
  BedrockAgentCoreClient,
  CreateEventCommand,
  ListEventsCommand,
  ListSessionsCommand,
  DeleteEventCommand,
  ListMemoryRecordsCommand,
  DeleteMemoryRecordCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import {
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
  QueryCommand,
  DeleteItemCommand,
  UpdateItemCommand,
  type AttributeValue,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  actorFor,
  getMemorySettings,
  memoryDb,
  memoryNamespace,
  memoryTable,
  type MemoryJob,
} from "./memory-service";

const memoryId = () => process.env.AGENTCORE_MEMORY_ID!;
const core = () =>
  new BedrockAgentCoreClient({ region: process.env.AWS_REGION || "eu-central-1", maxAttempts: 2 });
const missing = (error: unknown) => error instanceof Error && error.name === "ResourceNotFoundException";
async function save(job: Record<string, unknown>) {
  await memoryDb().send(
    new PutItemCommand({
      TableName: memoryTable(),
      Item: marshall(job, { removeUndefinedValues: true }),
    }),
  );
}

export async function processMemoryJob(PK: string, SK: string) {
  if (!SK.startsWith("OUTBOX#") && !SK.startsWith("PURGE#")) return;
  const result = await memoryDb().send(
    new GetItemCommand({
      TableName: memoryTable(),
      Key: marshall({ PK, SK }),
      ConsistentRead: true,
    }),
  );
  if (!result.Item) return;
  const job = unmarshall(result.Item) as MemoryJob & {
    lastCheckedAt?: string;
    emptySince?: string;
    attempts?: number;
  };
  if (job.status !== "pending" || PK !== `USER#${job.userId}`) return;
  if (!memoryId()) throw new Error("Memory is not configured");
  const client = core(),
    actorId = actorFor(job.userId, job.generation);
  try {
    if (job.kind === "write") {
      const settings = await getMemorySettings(job.userId);
      if (
        !settings.enabled ||
        settings.generation !== job.generation ||
        process.env.MEMORY_WRITE_ENABLED !== "true"
      ) {
        await save({
          ...job,
          payload: undefined,
          status: "cancelled",
          expiresAt: Math.floor(Date.now() / 1000) + 86400,
        });
        return;
      }
      await client.send(
        new CreateEventCommand({
          memoryId: memoryId(),
          actorId,
          sessionId: job.sessionId,
          clientToken: createHash("sha256")
            .update(JSON.stringify([actorId, job.requestId]))
            .digest("hex"),
          eventTimestamp: new Date(job.createdAt),
          payload: [{ conversational: { role: "USER", content: { text: job.payload! } } }],
        }),
      );
      // If revocation raced with CreateEvent, the retired actor is unreadable and purge keeps retrying.
      await save({
        ...job,
        payload: undefined,
        status: "done",
        expiresAt: Math.floor(Date.now() / 1000) + 30 * 86400,
      });
      console.log(JSON.stringify({ metric: "MemoryEventWritten", value: 1 }));
      return;
    }
    const settings = await getMemorySettings(job.userId);
    if (settings.generation === job.generation) throw new Error("Refusing to purge active actor");
    let found = false,
      sessionToken: string | undefined;
    do {
      const sessions = await client
        .send(
          new ListSessionsCommand({
            memoryId: memoryId(),
            actorId,
            nextToken: sessionToken,
            maxResults: 100,
          }),
        )
        .catch((error) => {
          if (missing(error)) return { sessionSummaries: [], nextToken: undefined };
          throw error;
        });
      for (const session of sessions.sessionSummaries || []) {
        let eventToken: string | undefined;
        do {
          const events = await client
            .send(
              new ListEventsCommand({
                memoryId: memoryId(),
                actorId,
                sessionId: session.sessionId!,
                nextToken: eventToken,
                maxResults: 100,
              }),
            )
            .catch((error) => {
              if (missing(error)) return { events: [], nextToken: undefined };
              throw error;
            });
          for (const event of events.events || []) {
            found = true;
            try {
              await client.send(
                new DeleteEventCommand({
                  memoryId: memoryId(),
                  actorId,
                  sessionId: session.sessionId!,
                  eventId: event.eventId!,
                }),
              );
            } catch (error) {
              if (!missing(error)) throw error;
            }
          }
          eventToken = events.nextToken;
        } while (eventToken);
      }
      sessionToken = sessions.nextToken;
    } while (sessionToken);
    for (const kind of ["preferences", "summaries"] as const) {
      let nextToken: string | undefined;
      do {
        const records = await client
          .send(
            new ListMemoryRecordsCommand({
              memoryId: memoryId(),
              namespacePath: memoryNamespace(actorId, kind),
              nextToken,
              maxResults: 100,
            }),
          )
          .catch((error) => {
            if (missing(error)) return { memoryRecordSummaries: [], nextToken: undefined };
            throw error;
          });
        for (const record of records.memoryRecordSummaries || []) {
          found = true;
          try {
            await client.send(
              new DeleteMemoryRecordCommand({
                memoryId: memoryId(),
                memoryRecordId: record.memoryRecordId!,
              }),
            );
          } catch (error) {
            if (!missing(error)) throw error;
          }
        }
        nextToken = records.nextToken;
      } while (nextToken);
    }
    if (job.eraseHistory) await eraseHistory(job);
    // Keep sweeping the retired actor through the raw-event retention horizon. No stale actor is read.
    const retentionElapsed = Date.now() - Date.parse(job.createdAt) > 31 * 86400000;
    const emptySince = found ? undefined : job.emptySince || new Date().toISOString();
    const complete =
      retentionElapsed && emptySince && Date.now() - Date.parse(emptySince) >= 3600000;
    await save({
      ...job,
      lastCheckedAt: new Date().toISOString(),
      emptySince,
      status: complete ? "done" : "pending",
      ...(complete ? { expiresAt: Math.floor(Date.now() / 1000) + 7 * 86400 } : {}),
    });
  } finally {
    client.destroy();
  }
}

async function eraseHistory(job: MemoryJob) {
  // Preserve financial accounting; erase stored response content and pre-request conversation snapshots.
  let cursor: Record<string, AttributeValue> | undefined;
  do {
    const result = await memoryDb().send(
      new QueryCommand({
        TableName: process.env.DYNAMODB_TABLE!,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: marshall({ ":pk": job.PK }),
        ExclusiveStartKey: cursor,
        ConsistentRead: true,
      }),
    );
    for (const item of result.Items || []) {
      const row = unmarshall(item),
        key = marshall({ PK: row.PK, SK: row.SK });
      try {
        if (row.SK.startsWith("AI_CHAT#") && (!row.updatedAt || row.updatedAt <= job.createdAt)) {
          await memoryDb().send(
            new DeleteItemCommand({
              TableName: process.env.DYNAMODB_TABLE!,
              Key: key,
              ConditionExpression: "attribute_not_exists(updatedAt) OR updatedAt <= :cutoff",
              ExpressionAttributeValues: marshall({ ":cutoff": job.createdAt }),
            }),
          );
        } else if (
          row.SK.startsWith("AI#") &&
          row.response &&
          (!row.createdAt || row.createdAt <= job.createdAt)
        ) {
          await memoryDb().send(
            new UpdateItemCommand({
              TableName: process.env.DYNAMODB_TABLE!,
              Key: key,
              UpdateExpression: "REMOVE #response",
              ConditionExpression: "attribute_not_exists(createdAt) OR createdAt <= :cutoff",
              ExpressionAttributeNames: { "#response": "response" },
              ExpressionAttributeValues: marshall({ ":cutoff": job.createdAt }),
            }),
          );
        }
      } catch (error: unknown) {
        if (!(error instanceof Error) || error.name !== "ConditionalCheckFailedException") throw error;
      }
    }
    cursor = result.LastEvaluatedKey;
  } while (cursor);
}
export async function sweepMemoryJobs() {
  let cursor: Record<string, AttributeValue> | undefined;
  do {
    const result = await memoryDb().send(
      new ScanCommand({
        TableName: memoryTable(),
        ExclusiveStartKey: cursor,
        FilterExpression: "#status = :pending",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({ ":pending": "pending" }),
      }),
    );
    for (const item of result.Items || []) {
      const row = unmarshall(item);
      try {
        await processMemoryJob(row.PK, row.SK);
      } catch (error: unknown) {
        console.warn("MemorySweepFailed", error instanceof Error ? error.name : "Error");
        throw error;
      }
    }
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  // Long-term records have a separate lifecycle from 30-day raw events.
  let settingsCursor: Record<string, AttributeValue> | undefined;
  const client = core();
  try {
    do {
      const settingsPage = await memoryDb().send(
        new ScanCommand({
          TableName: memoryTable(),
          ExclusiveStartKey: settingsCursor,
          FilterExpression: "SK = :settings",
          ExpressionAttributeValues: marshall({ ":settings": "SETTINGS" }),
        }),
      );
      for (const item of settingsPage.Items || []) {
        const row = unmarshall(item),
          actor = actorFor(String(row.PK).slice(5), row.generation);
        let nextToken: string | undefined;
        do {
          const records = await client
            .send(
              new ListMemoryRecordsCommand({
                memoryId: memoryId(),
                namespacePath: memoryNamespace(actor, "summaries"),
                nextToken,
                maxResults: 100,
              }),
            )
            .catch((error) => {
              if (missing(error)) return { memoryRecordSummaries: [], nextToken: undefined };
              throw error;
            });
          for (const record of records.memoryRecordSummaries || [])
            if (record.createdAt && record.createdAt.getTime() < Date.now() - 180 * 86400000) {
              try {
                await client.send(
                  new DeleteMemoryRecordCommand({
                    memoryId: memoryId(),
                    memoryRecordId: record.memoryRecordId!,
                  }),
                );
              } catch (error) {
                if (!missing(error)) throw error;
              }
            }
          nextToken = records.nextToken;
        } while (nextToken);
      }
      settingsCursor = settingsPage.LastEvaluatedKey;
    } while (settingsCursor);
  } finally {
    client.destroy();
  }
}
