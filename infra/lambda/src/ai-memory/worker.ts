import { processMemoryJob, sweepMemoryJobs } from "../../../../apps/web/server/ai/memory-worker";
import { PLACE_CACHE_PREFIXES } from "../places-search/google-content";

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
    // K3: yer önbelleği / kota kayıtları hafızaya işlenmez.
    const pk = record.dynamodb.Keys.PK?.S ?? "";
    if (PLACE_CACHE_PREFIXES.some((p) => pk.startsWith(p)) || pk.startsWith("PLACES_QUOTA#"))
      continue;
    try {
      await processMemoryJob(record.dynamodb.Keys.PK?.S ?? "", record.dynamodb.Keys.SK?.S ?? "");
    } catch (error: unknown) {
      console.warn("MemoryJobFailed", (error as { name?: string })?.name || "Error");
      batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber ?? "" });
    }
  }
  return { batchItemFailures };
}
