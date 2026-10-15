/**
 * KB Ingest Lambda
 * Triggered by Step Functions with action=collect or action=ingest.
 * collect: scans DynamoDB for approved training data → uploads to S3 published/ prefix
 * ingest:  triggers Bedrock KB StartIngestionJob
 */

import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { BedrockAgentClient, StartIngestionJobCommand } from "@aws-sdk/client-bedrock-agent";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const TABLE = process.env.DYNAMODB_TABLE!;
const BUCKET = process.env.KB_RAW_BUCKET!;
const KB_ID = process.env.TRAVEL_KNOWLEDGE_BASE_ID;
const REGION = process.env.BEDROCK_REGION || "eu-central-1";

const dynamo = new DynamoDBClient({ region: REGION });
const s3 = new S3Client({ region: REGION });
const bedrock = new BedrockAgentClient({ region: REGION });

interface Event {
  action: "collect" | "ingest";
}

export async function handler(
  event: Event,
): Promise<{ status: string; uploaded?: number; jobId?: string }> {
  if (event.action === "collect") return collectAndUpload();
  if (event.action === "ingest") return triggerIngestion();
  throw new Error(`Unknown action: ${(event as any).action}`);
}

async function collectAndUpload(): Promise<{ status: string; uploaded: number }> {
  let uploaded = 0;

  // 1. Upload hand-curated data/travel/*.json files
  const dataDir = join(__dirname, "../../../../data/travel");
  if (existsSync(dataDir)) {
    for (const file of readdirSync(dataDir).filter((f) => f.endsWith(".json"))) {
      try {
        const raw = JSON.parse(readFileSync(join(dataDir, file), "utf8"));
        const items = Array.isArray(raw) ? raw : [raw];
        for (const item of items) {
          if (!item.approved || !item.text) continue;
          const docText = `Title: ${item.title || item.city || "Travel Info"}\nCity: ${item.city || ""}\nCountry: ${item.country || ""}\n\n${item.text}`;
          const key = `published/curated/${item.id || item.city || file.replace(".json", "")}.txt`;
          await s3.send(
            new PutObjectCommand({
              Bucket: BUCKET,
              Key: key,
              Body: docText,
              ContentType: "text/plain",
            }),
          );
          uploaded++;
        }
      } catch (err) {
        console.warn(`[kb-ingest] Failed to process ${file}:`, (err as Error).message);
      }
    }
  }

  // 2. Upload approved training data from DynamoDB
  let lastKey: Record<string, any> | undefined;
  do {
    const result = await dynamo.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "begins_with(PK, :prefix) AND privacyReview = :approved",
        ExpressionAttributeValues: {
          ":prefix": { S: "TRAINING#" },
          ":approved": { S: "approved" },
        },
        ExclusiveStartKey: lastKey,
        Limit: 100,
      }),
    );

    for (const raw of result.Items || []) {
      const item = unmarshall(raw) as any;
      if (!item.prompt || !item.summary) continue;
      const docText = [
        `Destination: ${item.destination || "unknown"}`,
        `Query: ${item.prompt}`,
        `Summary: ${item.summary}`,
        item.themes?.length ? `Themes: ${item.themes.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const key = `published/training/${item.PK.replace("TRAINING#", "")}/${item.requestId || item.SK}.txt`;
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: docText,
          ContentType: "text/plain",
        }),
      );
      uploaded++;
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  console.log(`[kb-ingest] Uploaded ${uploaded} documents to s3://${BUCKET}/published/`);
  return { status: "COLLECTED", uploaded };
}

async function triggerIngestion(): Promise<{ status: string; jobId?: string }> {
  if (!KB_ID) {
    console.warn("[kb-ingest] TRAVEL_KNOWLEDGE_BASE_ID not set; skipping Bedrock ingestion.");
    return { status: "SKIPPED_NO_KB_ID" };
  }

  // Find the data source by listing (assume exactly one S3 data source)
  // Use a known data source ID via env or fall back to a fixed trigger approach
  const dataSourceId = process.env.KB_DATA_SOURCE_ID;
  if (!dataSourceId) {
    console.warn("[kb-ingest] KB_DATA_SOURCE_ID not set; skipping Bedrock ingestion.");
    return { status: "SKIPPED_NO_DS_ID" };
  }

  const result = await bedrock.send(
    new StartIngestionJobCommand({
      knowledgeBaseId: KB_ID,
      dataSourceId,
      description: `Weekly KB refresh ${new Date().toISOString().slice(0, 10)}`,
    }),
  );

  const jobId = result.ingestionJob?.ingestionJobId;
  console.log(`[kb-ingest] Started Bedrock ingestion job ${jobId}`);
  return { status: "INGESTION_STARTED", jobId };
}
