import { AgentMetricEvent, AgentRole } from './finops';

export interface PlanCostBreakdown {
  totalCostUsd: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  agentBreakdown: Partial<
    Record<
      AgentRole,
      {
        invocations: number;
        costUsd: number;
        tokens: number;
        avgDurationMs: number;
      }
    >
  >;
  isWithinTargetRange: boolean;
  targetBudgetUsd: number;
}

export interface FinOpsAggregateSummary {
  totalInvocations: number;
  successfulInvocations: number;
  failedInvocations: number;
  errorRatePercentage: number;
  totalCostUsd: number;
  averageCostPerPlanUsd: number | null;
  latency: {
    p50Ms: number;
    p95Ms: number;
    avgMs: number;
  };
  topCostDriverAgent: AgentRole | 'none';
}

export function calculateCompletedPlanCost(
  events: AgentMetricEvent[],
  targetBudgetUsd = 0.15
): PlanCostBreakdown {
  let totalCostUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  const agentBreakdown: Partial<
    Record<
      AgentRole,
      {
        invocations: number;
        costUsd: number;
        tokens: number;
        totalDuration: number;
        avgDurationMs: number;
      }
    >
  > = {};

  for (const ev of events) {
    totalCostUsd += ev.estimatedCostUsd;
    inputTokens += ev.inputTokens;
    outputTokens += ev.outputTokens;

    const existing = agentBreakdown[ev.agentRole] || {
      invocations: 0,
      costUsd: 0,
      tokens: 0,
      totalDuration: 0,
      avgDurationMs: 0,
    };

    existing.invocations += 1;
    existing.costUsd += ev.estimatedCostUsd;
    existing.tokens += ev.inputTokens + ev.outputTokens;
    existing.totalDuration += ev.durationMs;
    existing.avgDurationMs = Math.round(existing.totalDuration / existing.invocations);

    agentBreakdown[ev.agentRole] = existing;
  }

  // Round summary metrics
  totalCostUsd = Math.round(totalCostUsd * 100000) / 100000;

  return {
    totalCostUsd,
    totalTokens: inputTokens + outputTokens,
    inputTokens,
    outputTokens,
    agentBreakdown,
    isWithinTargetRange: totalCostUsd <= targetBudgetUsd,
    targetBudgetUsd,
  };
}

export function aggregateFinOpsMetrics(
  events: AgentMetricEvent[],
  estimatedCompletedPlans = 0
): FinOpsAggregateSummary {
  if (events.length === 0) {
    return {
      totalInvocations: 0,
      successfulInvocations: 0,
      failedInvocations: 0,
      errorRatePercentage: 0,
      totalCostUsd: 0,
      averageCostPerPlanUsd: null,
      latency: { p50Ms: 0, p95Ms: 0, avgMs: 0 },
      topCostDriverAgent: 'none',
    };
  }

  let totalCostUsd = 0;
  let successfulInvocations = 0;
  let failedInvocations = 0;
  const durations: number[] = [];
  const costByAgent: Partial<Record<AgentRole, number>> = {};

  for (const ev of events) {
    totalCostUsd += ev.estimatedCostUsd;
    durations.push(ev.durationMs);
    if (ev.success) {
      successfulInvocations++;
    } else {
      failedInvocations++;
    }
    costByAgent[ev.agentRole] = (costByAgent[ev.agentRole] || 0) + ev.estimatedCostUsd;
  }

  durations.sort((a, b) => a - b);
  const p50Index = Math.floor(durations.length * 0.5);
  const p95Index = Math.min(durations.length - 1, Math.floor(durations.length * 0.95));
  const avgMs = Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length);

  let topCostDriverAgent: AgentRole | 'none' = 'none';
  let maxAgentCost = -1;
  for (const [role, cost] of Object.entries(costByAgent) as [AgentRole, number][]) {
    if (cost > maxAgentCost) {
      maxAgentCost = cost;
      topCostDriverAgent = role;
    }
  }

  const roundedTotalCost = Math.round(totalCostUsd * 100000) / 100000;
  const plans = Number.isSafeInteger(estimatedCompletedPlans) && estimatedCompletedPlans > 0 ? estimatedCompletedPlans : 0;

  return {
    totalInvocations: events.length,
    successfulInvocations,
    failedInvocations,
    errorRatePercentage: Math.round((failedInvocations / events.length) * 1000) / 10,
    totalCostUsd: roundedTotalCost,
    averageCostPerPlanUsd: plans ? Math.round((roundedTotalCost / plans) * 100000) / 100000 : null,
    latency: {
      p50Ms: durations[p50Index],
      p95Ms: durations[p95Index],
      avgMs,
    },
    topCostDriverAgent,
  };
}
