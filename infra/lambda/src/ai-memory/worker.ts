import { processMemoryJob, sweepMemoryJobs } from "../../../../apps/web/server/ai/memory-worker";

interface DynamoStreamEvent {
  Records?: Array<{
    eventName?: string;
    dynamodb?: {
      Keys?: {
        PK?: { S?: string };
        SK?: { S?: string };
      };
      SequenceNumber?: string;
    };
  }>;
}

export async function handler(event: DynamoStreamEvent) {
  if (!event.Records) {
    await sweepMemoryJobs();
    return;
  }
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];
  for (const record of event.Records) {
    if (record.eventName !== "INSERT" || !record.dynamodb?.Keys) continue;
    try {
      await processMemoryJob(record.dynamodb.Keys.PK?.S ?? "", record.dynamodb.Keys.SK?.S ?? "");
    } catch (error: unknown) {
      console.warn("MemoryJobFailed", (error as { name?: string })?.name || "Error");
      batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber ?? "" });
    }
  }
  return { batchItemFailures };
}
