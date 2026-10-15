import { createHash } from "node:crypto";
import { maskPII } from "../../../../services/ai-assistant/src/domain/guardrails";
import type { MultiAgentResponse } from "../../app/lib/ai/types";

export const TRAINING_PARTITION = "AI#TRAINING_PENDING";
export const TRAINING_CONSENT_VERSION = "turn-review-v1";

/** Only this explicitly donated turn is collected, never memory, history or coordinates. */
export function createTrainingJob(
  input: {
    consent: boolean;
    userId: string;
    requestId: string;
    conversationId?: string;
    prompt: string;
    result: MultiAgentResponse;
  },
  now = Date.now(),
) {
  if (
    process.env.AI_TRAINING_COLLECTION_ENABLED !== "true" ||
    input.consent !== true ||
    input.result.modelUsed === "guardrail" ||
    !input.prompt.trim() ||
    !input.result.orchestratorSummary.trim()
  )
    return undefined;
  const id = createHash("sha256")
    .update(JSON.stringify([input.userId, input.requestId]))
    .digest("hex");
  const groupId = createHash("sha256")
    .update(JSON.stringify([input.userId, input.conversationId || input.requestId]))
    .digest("hex");
  return {
    PK: TRAINING_PARTITION,
    SK: `${new Date(now).toISOString()}#${id}`,
    id,
    createdAt: new Date(now).toISOString(),
    expiresAt: Math.floor(now / 1000) + 7 * 86400,
    record: {
      groupId,
      source: "live_curated",
      reviewed: false,
      containsPersonalData: true,
      privacyReview: "required",
      consent: {
        version: TRAINING_CONSENT_VERSION,
        scope: "current_turn",
        grantedAt: new Date(now).toISOString(),
      },
      system: "Sen MapsBridge seyahat danışmanısın.",
      messages: [
        { role: "user", content: [{ text: maskPII(input.prompt).maskedText.slice(0, 2000) }] },
        {
          role: "assistant",
          content: [{ text: maskPII(input.result.orchestratorSummary).maskedText.slice(0, 12000) }],
        },
      ],
      metadata: {
        model: input.result.modelUsed || "unknown",
        promptVersion: input.result.promptVersion || "unknown",
        responseMode: input.result.responseMode || "chat",
        retrievalStatus: input.result.retrievalStatus || "disabled",
      },
    },
  };
}

export type TrainingJob = NonNullable<ReturnType<typeof createTrainingJob>>;
