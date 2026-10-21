import type { AIRouteRequest } from "../domain/types.js";

export class AIOrchestrator {
  /**
   * Determine the credit cost of an incoming AI action:
   * - Clarification question / explanation: 0 credits (Free)
   * - General travel conversation: 1 credit
   * - Completed comprehensive itinerary / modification: 5 credits
   */
  public calculateCreditCost(action: "clarify" | "chat" | "generate_route"): number {
    switch (action) {
      case "clarify":
        return 0;
      case "chat":
        return 1;
      case "generate_route":
        return 5;
      default:
        return 1;
    }
  }

  /**
   * Validates if the route request has minimal necessary parameters.
   */
  public evaluateRequest(request: AIRouteRequest): {
    needsClarification: boolean;
    clarificationPrompt?: string;
  } {
    if (!request.destination && !request.prompt.trim()) {
      return {
        needsClarification: true,
        clarificationPrompt:
          "Nereye seyahat etmek istediğinizi ve kaç günlük bir plan düşündüğünüzü belirtir misiniz?",
      };
    }
    return { needsClarification: false };
  }
}
