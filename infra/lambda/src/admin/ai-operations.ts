import { QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import {
  BedrockClient,
  CreateModelCustomizationJobCommand,
  ListModelCustomizationJobsCommand,
} from "@aws-sdk/client-bedrock";
import {
  AI_CONTROL_KEY,
  AI_RUNTIME_KEY,
  AI_EVENTS_KEY,
  defaultControl,
} from "../shared/ai-operations";
import { AdminError, bodyOf, commit, get, table, text, type Row } from "./management";
import {
  DEFAULT_PLACES_CONTROL,
  PLACES_CONTROL_KEY,
  parsePlacesControl,
  validatePlacesControlInput,
} from "../places-search/places-control";
import { getDynamoClient } from "../shared/dynamo";
import { ok, type ApiGatewayEvent } from "../shared/http";
const TRAINING_PARTITION = "AI#TRAINING_PENDING";
const AI_RELEASE_KEY = "SYSTEM#AI_RELEASE";
const QUALITY_THRESHOLDS = {
  schemaPassRate: 0.99,
  routeValidityRate: 0.95,
  sourceCoverageRate: 0.95,
  decisionSummarySafetyRate: 0.99,
  p95LatencyMs: 10000,
};

export async function aiOverview() {
  const [stored, runtime, result, placesRow] = await Promise.all([
    get(AI_CONTROL_KEY),
    get(AI_RUNTIME_KEY),
    getDynamoClient().send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "PK = :pk AND SK >= :since",
        ExpressionAttributeValues: marshall({
          ":pk": AI_EVENTS_KEY,
          ":since": new Date(Date.now() - 86400000).toISOString(),
        }),
        ScanIndexForward: false,
        Limit: 200,
        ConsistentRead: true,
      }),
    ),
    get(PLACES_CONTROL_KEY),
  ]);
  const events = (result.Items || []).map((item) => {
    const { PK: _PK, SK, expiresAt: _expiresAt, ...event } = unmarshall(item);
    return { id: SK, ...event };
  });
  const base = defaultControl();
  // Runtime environment is authoritative; the admin Lambda may have different model configuration.
  if (runtime) base.defaultModel = runtime.primaryModel;
  return ok({
    control: { ...base, ...stored, PK: undefined, SK: undefined },
    // Yer verisi kill switch'i (Increment 1.5); kayıt yoksa Google kapalı varsayılanı.
    places: {
      ...(placesRow ? parsePlacesControl(placesRow) : DEFAULT_PLACES_CONTROL),
      version: placesRow?.version || 0,
    },
    runtime,
    events,
    truncated: !!result.LastEvaluatedKey,
    observedAt: new Date().toISOString(),
  });
}
export async function updateAIControl(event: ApiGatewayEvent) {
  const body = bodyOf(event);
  const reason = text(body.reason, "İşlem gerekçesi");
  const [existing, runtime] = await Promise.all([get(AI_CONTROL_KEY), get(AI_RUNTIME_KEY)]);
  if (
    !runtime ||
    !Number.isFinite(Date.parse(runtime.observedAt)) ||
    Date.now() - Date.parse(runtime.observedAt) > 86400000
  )
    throw new AdminError(
      409,
      "AI çalışma ortamı bilgisi güncel değil. Önce bir AI isteğiyle çalışma ortamını doğrulayın.",
    );
  if (!Number.isInteger(body.version) || body.version !== (existing?.version || 0))
    throw new AdminError(409, "Ayarlar değişmiş. Yenileyip tekrar deneyin.");
  if (
    typeof body.enabled !== "boolean" ||
    typeof body.defaultModel !== "string" ||
    !Array.isArray(body.disabledModels) ||
    body.disabledModels.some(
      (id: unknown) => typeof id !== "string" || !runtime.models.includes(id),
    ) ||
    !runtime.models.includes(body.defaultModel)
  )
    throw new AdminError(400, "Geçerli model ve açma/kapama ayarları gerekli.");
  if (body.enabled && body.disabledModels.includes(body.defaultModel))
    throw new AdminError(400, "Varsayılan model kapalı olamaz. Önce başka bir model seçin.");
  // İsteğe bağlı yer verisi kill switch'i: AI ayarlarından ÖNCE doğrulanır (kısmi yazım yok).
  const places = body.places === undefined ? undefined : validatePlacesControlInput(body.places);
  if (places === null)
    throw new AdminError(400, "Yer servisi ayarları geçersiz (googleEnabled, limitler).");
  const next = await commit(
    event,
    {
      PK: AI_CONTROL_KEY,
      SK: "META",
      enabled: body.enabled,
      defaultModel: body.defaultModel,
      disabledModels: [...new Set(body.disabledModels)],
    },
    "ai_control_updated",
    reason,
    existing,
  );
  let placesOut: Row | undefined;
  if (places) {
    const existingPlaces = await get(PLACES_CONTROL_KEY);
    const saved = await commit(
      event,
      { PK: PLACES_CONTROL_KEY, SK: "META", ...places },
      "places_control_updated",
      reason,
      existingPlaces,
    );
    placesOut = { ...places, version: saved.version };
  }
  return ok({
    control: {
      enabled: next.enabled,
      defaultModel: next.defaultModel,
      disabledModels: next.disabledModels,
      version: next.version,
    },
    ...(placesOut ? { places: placesOut } : {}),
  });
}

function safeTrainingRecord(item: Row) {
  const { PK: _PK, SK, record, ...meta } = item;
  return {
    id: String(meta.id || ""),
    key: String(SK || ""),
    createdAt: meta.createdAt,
    expiresAt: meta.expiresAt,
    reviewed: record?.reviewed === true,
    privacyReview: record?.privacyReview || "required",
    consentScope: record?.consent?.scope || "unknown",
    source: record?.source || "unknown",
    metadata: record?.metadata || {},
    messages: Array.isArray(record?.messages)
      ? record.messages.map((message: unknown) => {
          const m = (message ?? {}) as { role?: unknown; content?: unknown };
          return {
            role: m.role === "assistant" ? "assistant" : "user",
            content: Array.isArray(m.content)
              ? m.content
                  .map((part: unknown) =>
                    String((part as { text?: unknown })?.text || "").slice(0, 12000),
                  )
                  .join("\n")
              : "",
          };
        })
      : [],
  };
}

export async function aiTrainingQueue() {
  const result = await getDynamoClient().send(
    new QueryCommand({
      TableName: table(),
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: marshall({ ":pk": TRAINING_PARTITION }),
      ScanIndexForward: false,
      Limit: 100,
      ConsistentRead: true,
    }),
  );
  const records = (result.Items || []).map((item) => safeTrainingRecord(unmarshall(item)));
  return ok({
    records,
    truncated: !!result.LastEvaluatedKey,
    policy: {
      automaticTraining: false,
      requiresHumanReview: true,
      retentionDays: 7,
      piiMaskedBeforeQueue: true,
    },
    observedAt: new Date().toISOString(),
  });
}

export async function reviewAITraining(event: ApiGatewayEvent) {
  const key = event.pathParameters?.id;
  const body = bodyOf(event);
  const action = body.action;
  const reason = text(body.reason, "Eğitim verisi inceleme kararı");
  if (!key || !["approve", "reject", "hold"].includes(action))
    throw new AdminError(400, "Geçerli bir kayıt ve karar gerekli.");
  const existing = await getDynamoClient().send(
    new QueryCommand({
      TableName: table(),
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: marshall({ ":pk": TRAINING_PARTITION, ":sk": key }),
      Limit: 1,
      ConsistentRead: true,
    }),
  );
  if (!existing.Items?.[0]) throw new AdminError(404, "Eğitim kaydı bulunamadı veya süresi doldu.");
  const current = unmarshall(existing.Items[0]);
  const reviewed = action !== "hold";
  const privacyReview =
    action === "approve" ? "approved" : action === "reject" ? "rejected" : "required";
  await getDynamoClient().send(
    new UpdateItemCommand({
      TableName: table(),
      Key: marshall({ PK: TRAINING_PARTITION, SK: key }),
      UpdateExpression:
        "SET #record.#reviewed = :reviewed, #record.#privacyReview = :privacyReview, #record.#review = :review",
      ExpressionAttributeNames: {
        "#record": "record",
        "#reviewed": "reviewed",
        "#privacyReview": "privacyReview",
        "#review": "adminReview",
      },
      ExpressionAttributeValues: marshall(
        {
          ":reviewed": reviewed,
          ":privacyReview": privacyReview,
          ":review": { action, reason: reason.slice(0, 500), reviewedAt: new Date().toISOString() },
        },
        { removeUndefinedValues: true },
      ),
      ConditionExpression: "attribute_exists(PK)",
    }),
  );
  await commit(
    event,
    { PK: TRAINING_PARTITION, SK: key, lastReview: { action, reason: reason.slice(0, 500) } },
    "ai_training_reviewed",
    reason,
    current,
    true,
  );
  return ok({ success: true, id: current.id, action });
}

function releaseMetrics(body: Row) {
  if (!body.metrics || typeof body.metrics !== "object" || Array.isArray(body.metrics)) {
    throw new AdminError(400, "Kalite ölçümleri gerekli.");
  }
  const metrics = Object.fromEntries(
    Object.keys(QUALITY_THRESHOLDS).map((key) => [key, Number(body.metrics[key])]),
  );
  if (
    Object.values(metrics).some((value) => !Number.isFinite(value) || value < 0) ||
    Object.entries(metrics).some(([key, value]) => key !== "p95LatencyMs" && value > 1)
  ) {
    throw new AdminError(400, "Kalite ölçümleri geçersiz.");
  }
  const passed =
    metrics.schemaPassRate >= QUALITY_THRESHOLDS.schemaPassRate &&
    metrics.routeValidityRate >= QUALITY_THRESHOLDS.routeValidityRate &&
    metrics.sourceCoverageRate >= QUALITY_THRESHOLDS.sourceCoverageRate &&
    metrics.decisionSummarySafetyRate >= QUALITY_THRESHOLDS.decisionSummarySafetyRate &&
    metrics.p95LatencyMs <= QUALITY_THRESHOLDS.p95LatencyMs;
  return { metrics, passed };
}

export async function aiReleaseOverview() {
  const release = await get(AI_RELEASE_KEY);
  return ok({
    release: release
      ? { ...release, PK: undefined, SK: undefined }
      : {
          version: 0,
          active: null,
          candidate: null,
          status: "not_started",
        },
    thresholds: QUALITY_THRESHOLDS,
    policy: {
      automaticPublish: false,
      rollbackSupported: true,
      runtimeModelMutation: false,
    },
    observedAt: new Date().toISOString(),
  });
}

export async function proposeAIRelease(event: ApiGatewayEvent) {
  const body = bodyOf(event);
  const reason = text(body.reason, "Release gerekçesi");
  const candidateModel = text(body.model, "Aday model", 300);
  const promptVersion = text(body.promptVersion, "Prompt sürümü", 100);
  const runtime = await get(AI_RUNTIME_KEY);
  if (!runtime?.models?.includes(candidateModel))
    throw new AdminError(400, "Aday model mevcut AI çalışma ortamında yapılandırılmamış.");
  const { metrics, passed } = releaseMetrics(body);
  const existing = await get(AI_RELEASE_KEY);
  const candidate = {
    id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    model: candidateModel,
    promptVersion,
    metrics,
    qualityGate: passed ? "passed" : "blocked",
    status: "candidate",
    proposedAt: new Date().toISOString(),
  };
  const next = await commit(
    event,
    {
      PK: AI_RELEASE_KEY,
      SK: "META",
      active: existing?.active || null,
      previousActive: existing?.previousActive || null,
      candidate,
      status: passed ? "ready_to_publish" : "blocked",
    },
    "ai_release_proposed",
    reason,
    existing,
  );
  return ok({
    release: { ...next, PK: undefined, SK: undefined },
    qualityGate: candidate.qualityGate,
  });
}

export async function publishAIRelease(event: ApiGatewayEvent) {
  const body = bodyOf(event);
  const reason = text(body.reason, "Release yayınlama gerekçesi");
  const existing = await get(AI_RELEASE_KEY);
  if (!existing?.candidate || existing.candidate.qualityGate !== "passed") {
    throw new AdminError(409, "Kalite kapısından geçmeyen aday yayınlanamaz.");
  }
  const next = await commit(
    event,
    {
      PK: AI_RELEASE_KEY,
      SK: "META",
      active: { ...existing.candidate, publishedAt: new Date().toISOString() },
      previousActive: existing.active || null,
      candidate: null,
      status: "published",
    },
    "ai_release_published",
    reason,
    existing,
  );
  return ok({ release: { ...next, PK: undefined, SK: undefined } });
}

export async function rollbackAIRelease(event: ApiGatewayEvent) {
  const body = bodyOf(event);
  const reason = text(body.reason, "Rollback gerekçesi");
  const existing = await get(AI_RELEASE_KEY);
  if (!existing?.previousActive)
    throw new AdminError(409, "Geri alınabilecek önceki release bulunamadı.");
  const next = await commit(
    event,
    {
      PK: AI_RELEASE_KEY,
      SK: "META",
      active: existing.previousActive,
      previousActive: null,
      candidate: null,
      status: "rolled_back",
    },
    "ai_release_rolled_back",
    reason,
    existing,
  );
  return ok({ release: { ...next, PK: undefined, SK: undefined } });
}

const trainingBucket = () => process.env.AI_TRAINING_BUCKET;
const bedrockRegion = () => process.env.BEDROCK_TRAINING_REGION || "us-east-1";
const bedrockRoleArn = () => process.env.BEDROCK_TRAINING_ROLE_ARN;

function titanLine(record: Row): string | null {
  const messages = (record?.messages || []) as Row[];
  const userMsg = messages.find((m) => m.role === "user");
  const asstMsg = messages.find((m) => m.role === "assistant");
  if (!userMsg || !asstMsg) return null;
  const userText = Array.isArray(userMsg.content)
    ? userMsg.content.map((c) => String(c?.text || "")).join("")
    : String(userMsg.content || "");
  const asstText = Array.isArray(asstMsg.content)
    ? asstMsg.content.map((c) => String(c?.text || "")).join("")
    : String(asstMsg.content || "");
  if (!userText.trim() || !asstText.trim()) return null;
  // Amazon Titan Text fine-tuning format
  return JSON.stringify({
    prompt: `Human: ${userText.slice(0, 2000)}\n\nAssistant:`,
    completion: ` ${asstText.slice(0, 12000)}`,
  });
}

export async function listFineTuneJobs() {
  const region = bedrockRegion();
  const bedrock = new BedrockClient({ region, maxAttempts: 2 });
  try {
    const result = await bedrock.send(new ListModelCustomizationJobsCommand({ maxResults: 20 }));
    const jobs = (result.modelCustomizationJobSummaries || []).map((j) => ({
      jobArn: j.jobArn,
      jobName: j.jobName,
      status: j.status,
      baseModelArn: j.baseModelArn,
      customModelArn: j.customModelArn,
      creationTime: j.creationTime?.toISOString(),
      lastModifiedTime: j.lastModifiedTime?.toISOString(),
      endTime: j.endTime?.toISOString(),
    }));
    return ok({ jobs, region, observedAt: new Date().toISOString() });
  } finally {
    bedrock.destroy();
  }
}

export async function triggerFineTune(event: ApiGatewayEvent) {
  const bucket = trainingBucket();
  if (!bucket)
    throw new AdminError(503, "AI eğitim kovası yapılandırılmamış (AI_TRAINING_BUCKET eksik).");
  const roleArn = bedrockRoleArn();
  if (!roleArn)
    throw new AdminError(
      503,
      "Bedrock eğitim IAM rolü yapılandırılmamış (BEDROCK_TRAINING_ROLE_ARN eksik).",
    );
  const body = bodyOf(event);
  const baseModel = text(body.baseModelId || "amazon.titan-text-express-v1", "Temel model", 200);
  const region = bedrockRegion();
  const s3 = new S3Client({ region, maxAttempts: 2 });
  const bedrock = new BedrockClient({ region, maxAttempts: 2 });
  try {
    // Collect approved records from S3 quarantine
    const listed = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: "quarantine/", MaxKeys: 500 }),
    );
    const keys = (listed.Contents || []).map((o) => o.Key).filter(Boolean) as string[];
    if (!keys.length)
      throw new AdminError(409, "Onaylanmış eğitim kaydı bulunamadı. Önce kayıtları onaylayın.");

    const lines: string[] = [];
    for (const key of keys) {
      try {
        const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const raw = await obj.Body?.transformToString();
        if (!raw) continue;
        const record = JSON.parse(raw.trim().split("\n")[0]);
        if (record?.privacyReview !== "approved") continue;
        const line = titanLine(record);
        if (line) lines.push(line);
      } catch {
        /* skip malformed records */
      }
    }
    if (lines.length < 2)
      throw new AdminError(
        409,
        `Titan eğitimi için en az 2 geçerli kayıt gerekli. Şu an: ${lines.length}`,
      );

    const jobName = `mapsbridge-finetune-${Date.now()}`;
    const trainKey = `fine-tuning/${jobName}/train.jsonl`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: trainKey,
        Body: lines.join("\n") + "\n",
        ContentType: "application/x-ndjson",
        ServerSideEncryption: "AES256",
      }),
    );

    const result = await bedrock.send(
      new CreateModelCustomizationJobCommand({
        jobName,
        customModelName: jobName,
        baseModelIdentifier: baseModel,
        customizationType: "FINE_TUNING",
        roleArn,
        trainingDataConfig: { s3Uri: `s3://${bucket}/${trainKey}` },
        outputDataConfig: { s3Uri: `s3://${bucket}/fine-tuning/${jobName}/output/` },
      }),
    );

    await commit(
      event,
      {
        PK: "SYSTEM#AI_FINETUNE",
        SK: jobName,
        jobArn: result.jobArn,
        baseModel,
        recordCount: lines.length,
        status: "submitted",
      },
      "ai_finetune_triggered",
      `Fine-tune başlatıldı: ${lines.length} kayıt`,
      undefined,
      true,
    );
    return ok({ jobArn: result.jobArn, jobName, recordCount: lines.length, trainKey, region });
  } finally {
    s3.destroy();
    bedrock.destroy();
  }
}
