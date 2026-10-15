export interface CostEvent {
  kind: string;
  status: string;
  responseMode?: string;
  estimatedModelCostUsd?: number | null;
  pricingStatus?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheWriteInputTokens?: number;
}
/** Model rows count spend; request rows only provide completed-plan unit economics. */
export function summarizeAICost(events: CostEvent[]) {
  const models = events.filter((e) => e.kind === "model");
  const priced = (e: CostEvent) =>
    e.pricingStatus === "priced" &&
    typeof e.estimatedModelCostUsd === "number" &&
    Number.isFinite(e.estimatedModelCostUsd) &&
    e.estimatedModelCostUsd >= 0;
  const plans = events.filter(
    (e) => e.kind === "request" && e.status === "succeeded" && e.responseMode === "route",
  );
  const pricedPlans = plans.filter(priced);
  const token = (n?: number) => (Number.isSafeInteger(n) && n! >= 0 ? n! : 0);
  return {
    modelCalls: models.length,
    unpricedCalls: models.filter((e) => !priced(e)).length,
    knownModelCostUsd: models.filter(priced).reduce((sum, e) => sum + e.estimatedModelCostUsd!, 0),
    inputTokens: models.reduce((sum, e) => sum + token(e.inputTokens), 0),
    outputTokens: models.reduce((sum, e) => sum + token(e.outputTokens), 0),
    cachedTokens: models.reduce(
      (sum, e) => sum + token(e.cacheReadInputTokens) + token(e.cacheWriteInputTokens),
      0,
    ),
    completedPlans: plans.length,
    pricedPlans: pricedPlans.length,
    averagePlanModelCostUsd: pricedPlans.length
      ? pricedPlans.reduce((sum, e) => sum + e.estimatedModelCostUsd!, 0) / pricedPlans.length
      : null,
  };
}
