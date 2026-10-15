/**
 * FinOps & Cost Allocation Tags for AWS Bedrock Multi-Agent System
 * Conforms to Bedrock AgentCore Architecture Section 10 & 13.
 */

export type AgentRole =
  | "concierge"
  | "planner"
  | "food"
  | "sports"
  | "lodging"
  | "transit"
  | "discovery"
  | "emergency"
  | "feasibility";

export interface FinOpsTags {
  "mapsbridge:service": "travel-ai";
  "mapsbridge:agent-role": AgentRole;
  "mapsbridge:model-tier": "haiku" | "sonnet" | "titan-embed";
  "mapsbridge:environment": string;
  "mapsbridge:cost-center": "customer-planning";
}

export function getCostAllocationTags(
  agentRole: AgentRole,
  modelTier: "haiku" | "sonnet" | "titan-embed" = "haiku",
  environment = process.env.NODE_ENV || "production",
): FinOpsTags {
  return {
    "mapsbridge:service": "travel-ai",
    "mapsbridge:agent-role": agentRole,
    "mapsbridge:model-tier": modelTier,
    "mapsbridge:environment": environment,
    "mapsbridge:cost-center": "customer-planning",
  };
}

export interface AgentMetricEvent {
  agentRole: AgentRole;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  success: boolean;
}

/** Legacy simulation helper. Production uses exact model/region rate cards in ai-finops.ts. */
export function estimateBedrockTokenCost(
  _modelTier: "haiku" | "sonnet",
  inputTokens: number,
  outputTokens: number,
  rates?: { inputUsdPerMillion: number; outputUsdPerMillion: number },
): number | null {
  if (
    !rates ||
    ![inputTokens, outputTokens].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    ![rates.inputUsdPerMillion, rates.outputUsdPerMillion].every(
      (n) => Number.isFinite(n) && n >= 0,
    )
  )
    return null;
  return (
    Math.round(
      ((inputTokens * rates.inputUsdPerMillion + outputTokens * rates.outputUsdPerMillion) / 1e6) *
        1e9,
    ) / 1e9
  );
}
