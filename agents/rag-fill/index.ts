/**
 * RAG Fill Agent — Lambda handler
 *
 * Generates authoritative travel briefings via Claude Haiku,
 * uploads to S3 (published/ prefix) and starts a Bedrock KB ingestion job.
 *
 * Env vars:
 *   SOURCE_BUCKET          — S3 bucket for KB documents
 *   KNOWLEDGE_BASE_ID      — Bedrock KB ID (e.g. MPC0NLWMXR)
 *   DATA_SOURCE_ID         — Bedrock data source ID (e.g. HGCTUZJ1YQ)
 *   BEDROCK_REGION         — AWS region for Bedrock (default eu-central-1)
 *   FILL_MODEL_ID          — Claude model ID for generation (default haiku cross-region)
 *   DRY_RUN                — "true" → generate but don't upload/ingest
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockAgentClient,
  StartIngestionJobCommand,
} from "@aws-sdk/client-bedrock-agent";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { DESTINATION_TOPICS, TTL_90_DAYS, type DestinationTopic } from "./destinations";

const REGION = process.env.BEDROCK_REGION || "eu-central-1";
const MODEL_ID =
  process.env.FILL_MODEL_ID ||
  "eu.anthropic.claude-haiku-4-5-20251001-v1:0";
const DRY_RUN = process.env.DRY_RUN === "true";

let bedrockRuntime: BedrockRuntimeClient | undefined;
let bedrockAgent: BedrockAgentClient | undefined;
let s3: S3Client | undefined;

function runtime() {
  bedrockRuntime ||= new BedrockRuntimeClient({ region: REGION });
  return bedrockRuntime;
}
function agent() {
  bedrockAgent ||= new BedrockAgentClient({ region: REGION });
  return bedrockAgent;
}
function s3Client() {
  s3 ||= new S3Client({ region: REGION });
  return s3;
}

// ─── Content generation ────────────────────────────────────────────────────

async function generateContent(topic: DestinationTopic): Promise<string> {
  const response = await runtime().send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 600,
        system: topic.systemPrompt,
        messages: [{ role: "user", content: topic.userPrompt }],
      }),
    }),
  );
  const parsed = JSON.parse(new TextDecoder().decode(response.body));
  const text: string = parsed?.content?.[0]?.text || "";
  if (!text.trim()) throw new Error(`Empty content for ${topic.id}`);
  return text.trim();
}

// ─── S3 document upload ─────────────────────────────────────────────────────

interface KBDocument {
  id: string;
  city: string;
  country: string;
  title: string;
  source_url: string;
  text: string;
  checked_at: string; // ISO date
  valid_until: number; // unix timestamp
  visibility: "public";
  approved: true;
  reviewer: string;
  rights: string;
}

async function documentExists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadDocument(bucket: string, doc: KBDocument): Promise<string> {
  const key = `published/${doc.id}.json`;
  if (DRY_RUN) {
    console.log(`[dry-run] Would upload: ${key}`);
    return key;
  }
  await s3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(doc, null, 2),
      ContentType: "application/json",
      Metadata: {
        "kb-city": doc.city,
        "kb-visibility": doc.visibility,
        "kb-approved": "true",
        "kb-valid-until": String(doc.valid_until),
      },
    }),
  );
  return key;
}

// ─── KB ingestion job ───────────────────────────────────────────────────────

async function startIngestion(kbId: string, dataSourceId: string): Promise<string> {
  if (DRY_RUN) {
    console.log(`[dry-run] Would start ingestion for KB ${kbId}`);
    return "dry-run-job";
  }
  const response = await agent().send(
    new StartIngestionJobCommand({
      knowledgeBaseId: kbId,
      dataSourceId,
      description: `rag-fill scheduled run ${new Date().toISOString()}`,
    }),
  );
  return response.ingestionJob?.ingestionJobId || "unknown";
}

// ─── Main handler ───────────────────────────────────────────────────────────

interface FillResult {
  generated: number;
  skipped: number;
  failed: string[];
  ingestionJobId?: string;
}

export async function handler(event?: { force?: boolean }): Promise<FillResult> {
  const bucket = process.env.SOURCE_BUCKET;
  const kbId = process.env.KNOWLEDGE_BASE_ID;
  const dataSourceId = process.env.DATA_SOURCE_ID;

  if (!bucket || !kbId || !dataSourceId) {
    throw new Error("Missing required env: SOURCE_BUCKET, KNOWLEDGE_BASE_ID, DATA_SOURCE_ID");
  }

  const now = Math.floor(Date.now() / 1000);
  const checkedAt = new Date().toISOString().slice(0, 10);
  const validUntil = now + TTL_90_DAYS;
  const force = event?.force === true;

  const result: FillResult = { generated: 0, skipped: 0, failed: [] };
  const uploadedKeys: string[] = [];

  for (const topic of DESTINATION_TOPICS) {
    const key = `published/${topic.id}.json`;
    try {
      if (!force && (await documentExists(bucket, key))) {
        console.log(`[skip] ${topic.id} — already exists`);
        result.skipped++;
        continue;
      }
      console.log(`[generate] ${topic.id}`);
      const text = await generateContent(topic);
      const doc: KBDocument = {
        id: topic.id,
        city: topic.city,
        country: topic.country,
        title: `${topic.city} — ${topic.topic}`,
        source_url: topic.sourceUrl,
        text,
        checked_at: checkedAt,
        valid_until: validUntil,
        visibility: "public",
        approved: true,
        reviewer: "rag-fill-agent-v1",
        rights: "Original travel summary generated from public destination information",
      };
      await uploadDocument(bucket, doc);
      uploadedKeys.push(key);
      result.generated++;
      // Small delay to avoid Bedrock throttling
      await new Promise((r) => setTimeout(r, 300));
    } catch (err: unknown) {
      console.error(`[error] ${topic.id}:`, err instanceof Error ? err.message : err);
      result.failed.push(topic.id);
    }
  }

  if (uploadedKeys.length > 0) {
    try {
      result.ingestionJobId = await startIngestion(kbId, dataSourceId);
      console.log(`[ingest] Started job ${result.ingestionJobId}`);
    } catch (err: unknown) {
      console.error("[ingest] Failed to start ingestion job:", err instanceof Error ? err.message : err);
    }
  }

  console.log(
    `[done] generated=${result.generated} skipped=${result.skipped} failed=${result.failed.length}`,
  );
  return result;
}

// ─── Force-refresh endpoint (triggered manually via Lambda console/CLI) ─────

export async function forceRefreshHandler(): Promise<FillResult> {
  return handler({ force: true });
}
