import { AsyncLocalStorage } from "node:async_hooks";

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheWriteInputTokens?: number;
  cacheDetails?: Array<{ ttl?: string; inputTokens?: number }>;
}
export interface ModelRate {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  cacheReadUsdPerMillion?: number;
  cacheWriteUsdPerMillion?: number;
  verifiedAt: string;
  source: string;
}
export interface ModelCost {
  estimatedModelCostUsd: number | null;
  pricingStatus: "priced" | "unconfigured" | "invalid" | "stale" | "usage_unknown";
}
const count = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0;

/** Exact model ID + invocation region: never guess pricing from a model family name. */
export function estimateModelCost(
  model: string,
  usage?: TokenUsage,
  env = process.env,
  now = Date.now(),
): ModelCost {
  const unknown = (pricingStatus: ModelCost["pricingStatus"]): ModelCost => ({
    estimatedModelCostUsd: null,
    pricingStatus,
  });
  if (!usage || !count(usage.inputTokens) || !count(usage.outputTokens))
    return unknown("usage_unknown");
  for (const n of [usage.cacheReadInputTokens, usage.cacheWriteInputTokens])
    if (n !== undefined && !count(n)) return unknown("usage_unknown");
  if (!env.AI_MODEL_RATES_JSON) return unknown("unconfigured");
  try {
    const card = JSON.parse(env.AI_MODEL_RATES_JSON);
    const rates: ModelRate | undefined = card[`${env.AWS_REGION || "eu-central-1"}|${model}`];
    if (!rates) return unknown("unconfigured");
    const checked = Date.parse(rates.verifiedAt);
    if (!Number.isFinite(checked) || checked > now || !/^https:\/\//.test(rates.source))
      return unknown("invalid");
    if (now - checked > 30 * 86400000) return unknown("stale");
    // Only 5-minute cache writes are supported by this rate-card schema.
    if (usage.cacheDetails?.some((d) => d.ttl !== "5m" && (d.inputTokens || 0) > 0))
      return unknown("unconfigured");
    const entries = [
      [usage.inputTokens, rates.inputUsdPerMillion],
      [usage.outputTokens, rates.outputUsdPerMillion],
      [usage.cacheReadInputTokens || 0, rates.cacheReadUsdPerMillion],
      [usage.cacheWriteInputTokens || 0, rates.cacheWriteUsdPerMillion],
    ];
    if (
      entries.some(
        ([tokens, rate], i) =>
          (i < 2 || tokens! > 0) &&
          (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0),
      )
    )
      return unknown("invalid");
    const cost = entries.reduce((sum, [tokens, rate]) => sum + (tokens! * (rate || 0)) / 1e6, 0);
    return { estimatedModelCostUsd: Math.round(cost * 1e9) / 1e9, pricingStatus: "priced" };
  } catch {
    return unknown("invalid");
  }
}

interface RequestMeter {
  active: boolean;
  calls: number;
  reservedOutput: number;
  knownCost: number;
  unpriced: number;
}
const requests = new AsyncLocalStorage<RequestMeter>();
export function activateAIRequestMeter() {
  const meter = requests.getStore();
  if (meter) meter.active = true;
}
export function requestCostSummary() {
  const meter = requests.getStore();
  return {
    estimatedModelCostUsd: meter && meter.unpriced === 0 ? meter.knownCost : null,
    pricingStatus: meter && meter.unpriced === 0 ? "priced" : "usage_unknown",
  };
}
function limit(name: string, fallback: number, ceiling: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > ceiling)
    throw new Error("INVALID_AI_FINOPS_LIMIT");
  return value;
}

/** Conservative UTF-8 estimate used before a provider call; provider usage remains authoritative. */
export function estimateInputTokens(inputBytes: number): number {
  if (!Number.isSafeInteger(inputBytes) || inputBytes < 0) return Number.POSITIVE_INFINITY;
  return Math.ceil(inputBytes / 3);
}

/** Conservative work limits; not a USD billing cap. Attempts are never refunded. */
export function reserveModelWork(maxTokens: number, inputBytes: number): void {
  const perCall = limit("AI_MAX_OUTPUT_TOKENS", 4200, 16000);
  const inputLimit = limit("AI_MAX_INPUT_BYTES", 65536, 262144);
  const estimatedInputTokens = estimateInputTokens(inputBytes);
  const inputTokenLimit = limit("AI_MAX_INPUT_TOKENS", 12000, 32000);
  if (
    !Number.isSafeInteger(maxTokens) ||
    maxTokens < 1 ||
    maxTokens > perCall ||
    !Number.isSafeInteger(inputBytes) ||
    inputBytes > inputLimit ||
    inputBytes < 0 ||
    estimatedInputTokens > inputTokenLimit
  ) {
    throw new Error("AI_MODEL_WORK_LIMIT");
  }
  const meter = requests.getStore();
  if (!meter) return;
  const maxCalls = limit("AI_MAX_MODEL_CALLS_PER_REQUEST", 6, 10);
  const outputLimit = limit("AI_MAX_REQUEST_OUTPUT_TOKENS", 14000, 32000);
  if (meter.calls >= maxCalls || meter.reservedOutput + maxTokens > outputLimit)
    throw new Error("AI_REQUEST_WORK_LIMIT");
  meter.calls++;
  meter.reservedOutput += maxTokens;
}

export function emitFinOps(metrics: Record<string, number>, role?: "intake" | "answer") {
  if (process.env.AI_FINOPS_METRICS_ENABLED !== "true") return;
  const Environment = process.env.ENVIRONMENT || "local";
  const values = Object.fromEntries(
    Object.entries(metrics).filter(([, v]) => Number.isFinite(v) && v >= 0),
  );
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: "MapsBridge/TravelAI",
            Dimensions: [role ? ["Environment", "Role"] : ["Environment"]],
            Metrics: Object.keys(values).map((Name) => ({
              Name,
              Unit: Name.endsWith("Ms") ? "Milliseconds" : Name.endsWith("Usd") ? "None" : "Count",
            })),
          },
        ],
      },
      Environment,
      ...(role ? { Role: role } : {}),
      ...values,
    }),
  );
}

export function recordModelUsage(
  model: string,
  role: "intake" | "answer",
  usage: TokenUsage | undefined,
  success: boolean,
  durationMs: number,
  invoked = true,
  timedOut = false,
): ModelCost {
  const cost = invoked
    ? estimateModelCost(model, usage)
    : { estimatedModelCostUsd: 0, pricingStatus: "priced" as const };
  const meter = requests.getStore();
  if (meter && invoked) {
    meter.knownCost += cost.estimatedModelCostUsd || 0;
    if (cost.estimatedModelCostUsd === null) meter.unpriced++;
  }
  emitFinOps(
    {
      ModelCalls: invoked ? 1 : 0,
      ModelFailures: success ? 0 : 1,
      ModelLatencyMs: durationMs,
      Timeouts: timedOut ? 1 : 0,
      InputTokens: count(usage?.inputTokens) ? usage!.inputTokens! : 0,
      OutputTokens: count(usage?.outputTokens) ? usage!.outputTokens! : 0,
      CacheReadTokens: count(usage?.cacheReadInputTokens) ? usage!.cacheReadInputTokens! : 0,
      CacheWriteTokens: count(usage?.cacheWriteInputTokens) ? usage!.cacheWriteInputTokens! : 0,
      UnpricedModelCalls: cost.estimatedModelCostUsd === null ? 1 : 0,
      ...(cost.estimatedModelCostUsd !== null
        ? { EstimatedModelCostUsd: cost.estimatedModelCostUsd }
        : {}),
    },
    role,
  );
  return cost;
}

export async function withAIRequestMeter<T extends { statusCode: number; body: string }>(
  work: () => Promise<T>,
): Promise<T> {
  const meter: RequestMeter = {
    active: false,
    calls: 0,
    reservedOutput: 0,
    knownCost: 0,
    unpriced: 0,
  };
  return requests.run(meter, async () => {
    const started = Date.now();
    let response: T | undefined;
    try {
      response = await work();
      return response;
    } finally {
      if (meter.active) {
        let body: unknown;
        try {
          body = response && JSON.parse(response.body);
        } catch {
          /* Unknown response is not a completed plan. */
        }
        const parsed = body as { success?: boolean; responseMode?: string } | null | undefined;
        const completed = response?.statusCode === 200 && parsed?.success === true;
        const plan = completed && parsed?.responseMode === "route";
        emitFinOps({
          Requests: 1,
          RequestFailures: completed ? 0 : 1,
          CompletedPlans: plan ? 1 : 0,
          RequestLatencyMs: Date.now() - started,
          UnpricedRequests: meter.unpriced ? 1 : 0,
          ...(meter.unpriced === 0
            ? {
                RequestModelCostUsd: meter.knownCost,
                ...(plan ? { PlanCostUsd: meter.knownCost } : {}),
              }
            : {}),
        });
      }
    }
  });
}
