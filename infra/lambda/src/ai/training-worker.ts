import { QueryCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { getDynamoClient } from "../shared/dynamo";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  TRAINING_PARTITION,
  type TrainingJob,
} from "../../../../apps/web/server/ai/training-outbox";

export function trainingMetric(name: string, value: number, unit = "Count") {
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: "MapsBridge/Training",
            Dimensions: [["Service"]],
            Metrics: [{ Name: name, Unit: unit }],
          },
        ],
      },
      Service: "training-worker",
      [name]: value,
    }),
  );
}

/** Scheduled bounded batches. Retrying a job overwrites the same object, never duplicates it. */
export async function handler(_event: unknown, context?: { getRemainingTimeInMillis(): number }) {
  const table = process.env.DYNAMODB_TABLE,
    bucket = process.env.AI_TRAINING_BUCKET;
  if (!table || !bucket) throw new Error("TRAINING_WORKER_NOT_CONFIGURED");
  const db = getDynamoClient({ maxAttempts: 2 }),
    s3 = new S3Client({ maxAttempts: 2 });
  let exported = 0,
    failed = 0;
  try {
    const page = await db.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: marshall({ ":pk": TRAINING_PARTITION }),
        Limit: 25,
        ConsistentRead: true,
      }),
    );
    for (const item of page.Items || []) {
      if (context && context.getRemainingTimeInMillis() < 10000) break;
      const job = unmarshall(item) as TrainingJob;
      try {
        if (job.expiresAt <= Date.now() / 1000) {
          await db.send(
            new DeleteItemCommand({ TableName: table, Key: marshall({ PK: job.PK, SK: job.SK }) }),
          );
          continue;
        }
        if (job.record?.privacyReview !== "approved") continue;
        if (job.expiresAt > Date.now() / 1000) {
          if (
            !/^[a-f0-9]{64}$/.test(job.id) ||
            job.record?.reviewed !== false ||
            job.record?.consent?.scope !== "current_turn"
          )
            throw new Error("INVALID_TRAINING_JOB");
          await s3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: `quarantine/${job.id}.jsonl`,
              Body: JSON.stringify(job.record) + "\n",
              ContentType: "application/x-ndjson",
              ServerSideEncryption: "AES256",
            }),
            { abortSignal: AbortSignal.timeout(5000) },
          );
          exported++;
        }
        await db.send(
          new DeleteItemCommand({ TableName: table, Key: marshall({ PK: job.PK, SK: job.SK }) }),
        );
      } catch {
        // Retain the durable row for the next scheduled run. Never log conversation content.
        failed++;
      }
    }
    const oldest = page.Items?.[0] ? unmarshall(page.Items[0]).createdAt : undefined;
    trainingMetric(
      "OldestPendingAgeSeconds",
      oldest ? Math.max(0, (Date.now() - Date.parse(oldest)) / 1000) : 0,
      "Seconds",
    );
    trainingMetric("Exported", exported);
    trainingMetric("Failed", failed);
    trainingMetric("Heartbeat", 1);
    if (failed) throw new Error("TRAINING_EXPORT_INCOMPLETE");
    return { exported, hasMore: Boolean(page.LastEvaluatedKey) };
  } finally {
    db.destroy();
    s3.destroy();
  }
}
