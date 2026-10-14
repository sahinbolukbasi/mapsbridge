import { processMemoryJob, sweepMemoryJobs } from '../../../../apps/web/server/ai/memory-worker';
export async function handler(event: any) {
  if (!event.Records) { await sweepMemoryJobs(); return; }
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];
  for (const record of event.Records) {
    if (record.eventName !== 'INSERT' || !record.dynamodb?.Keys) continue;
    try { await processMemoryJob(record.dynamodb.Keys.PK.S, record.dynamodb.Keys.SK.S); }
    catch (error: any) {
      console.warn('MemoryJobFailed', error?.name || 'Error');
      batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
    }
  }
  return { batchItemFailures };
}
