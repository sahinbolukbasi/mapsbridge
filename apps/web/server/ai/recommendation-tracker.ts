import type { MultiAgentResponse } from "../../app/lib/ai/types";
import type { ConversationFlowSnapshot } from "../../app/lib/ai/types";

export const ANALYTICS_PARTITION = "ANALYTICS#AI";

/**
 * Builds a DynamoDB item tracking what a user asked about and how the AI responded.
 * Written alongside the main response; used for blog topic discovery and
 * affiliate performance analysis. TTL = 180 days.
 *
 * Nothing identifying is stored — userId is hashed, no prompt text, no PII.
 */
export function createInteractionEvent(
  input: {
    userId: string;
    requestId: string;
    conversationId?: string;
    destination?: string;
    result: MultiAgentResponse;
    conversationFlow?: ConversationFlowSnapshot;
  },
  now = Date.now(),
) {
  const { result } = input;
  if (!result.responseMode || result.responseMode === "clarify") return undefined;

  const day = new Date(now).toISOString().slice(0, 10);
  const affiliateTypes = (result.affiliateCards || [])
    .map((c) => c.type)
    .filter((v, i, a) => a.indexOf(v) === i);

  return {
    PK: ANALYTICS_PARTITION,
    SK: `${day}#${input.requestId}`,
    createdAt: new Date(now).toISOString(),
    expiresAt: Math.floor(now / 1000) + 180 * 86400,
    responseMode: result.responseMode,
    destination: input.destination || result.tripContext?.destination || undefined,
    retrievalStatus: result.retrievalStatus || "disabled",
    citedSources: (result.sources || [])
      .map((s) => s.id)
      .filter(Boolean)
      .slice(0, 10),
    affiliateTypes,
    flowTopic: input.conversationFlow?.activeTopic || "none",
    flowStage: input.conversationFlow?.stage || "none",
    hasRoute: !!result.route,
    agentCount: result.agentsInvolved?.length || 0,
  };
}

export type InteractionEvent = NonNullable<ReturnType<typeof createInteractionEvent>>;
