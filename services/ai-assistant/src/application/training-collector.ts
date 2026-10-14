import { maskPII } from "../domain/guardrails.js";

export interface TrainingDialogueEntry {
  groupId: string;
  source: "live_curated" | "synthetic_reviewed";
  reviewed: boolean;
  containsPersonalData: boolean;
  system: string;
  messages: Array<{
    role: "user" | "assistant";
    content: Array<{ text: string }>;
  }>;
  metadata: {
    destination?: string;
    agentsInvolved: string[];
    qualityScore: number;
    tokensEstimated: number;
    timestamp: number;
  };
}

export class TrainingDataCollector {
  private static buffer: TrainingDialogueEntry[] = [];

  /**
   * Processes an interaction turn, masks any residual PII, and formats it for Nova/Bedrock fine-tuning JSONL.
   */
  public static collectTurn(
    userPrompt: string,
    assistantReply: string,
    metadata: {
      destination?: string;
      agentsInvolved: string[];
      isGrounded?: boolean;
    }
  ): TrainingDialogueEntry | null {
    // 1. Guard against empty or ultra-short turns
    if (!userPrompt || userPrompt.length < 5 || !assistantReply || assistantReply.length < 15) {
      return null;
    }

    // 2. Strict PII check & masking
    const piiMaskResult = maskPII(userPrompt);
    const cleanUserPrompt = piiMaskResult.maskedText;
    const cleanReply = maskPII(assistantReply).maskedText;

    // 3. Quality evaluation
    const qualityScore = metadata.isGrounded !== false ? 0.95 : 0.8;
    const estimatedTokens = Math.round((cleanUserPrompt.length + cleanReply.length) / 4);

    const entry: TrainingDialogueEntry = {
      groupId: `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      source: "live_curated",
      reviewed: false,
      containsPersonalData: false,
      system: "Sen MapsBridge uzman seyahat danışmanısın. Yalnızca seyahat rotaları, konaklama, yerel lezzetler ve şehir keşfi konularında doğru ve güvenilir rehberlik sağlarsın.",
      messages: [
        {
          role: "user",
          content: [{ text: cleanUserPrompt }],
        },
        {
          role: "assistant",
          content: [{ text: cleanReply }],
        },
      ],
      metadata: {
        destination: metadata.destination,
        agentsInvolved: metadata.agentsInvolved,
        qualityScore,
        tokensEstimated: estimatedTokens,
        timestamp: Date.now(),
      },
    };

    TrainingDataCollector.buffer.push(entry);

    // Keep buffer capped in memory
    if (TrainingDataCollector.buffer.length > 500) {
      TrainingDataCollector.buffer.shift();
    }

    return entry;
  }

  public static getBufferedEntries(): TrainingDialogueEntry[] {
    return [...TrainingDataCollector.buffer];
  }

  public static exportToJsonl(): string {
    return TrainingDataCollector.buffer.map((entry) => JSON.stringify(entry)).join("\n");
  }
}
