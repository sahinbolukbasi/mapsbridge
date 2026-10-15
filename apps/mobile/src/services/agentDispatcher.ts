export type SystemIntentAction =
  | "plan_itinerary"
  | "find_lodging"
  | "find_food"
  | "transit_directions"
  | "emergency_safety"
  | "check_wallet"
  | "share_location"
  | "general_chat";

export interface IntentDispatchResult {
  action: SystemIntentAction;
  targetCity?: string;
  recommendedSubAgents: string[];
  requiresConfirmation: boolean;
}

export class AgentDispatcher {
  /**
   * Analyzes user prompt in natural language and maps it to target autonomous sub-agents and tools.
   */
  public static detectIntent(prompt: string, currentCity?: string): IntentDispatchResult {
    const norm = (prompt || "").toLocaleLowerCase("tr");

    // Emergency intent (Highest Priority)
    if (/acil|yardım|hastane|polis|doktor|güvenlik|kayıp|pasaport|tehlike/iu.test(norm)) {
      return {
        action: "emergency_safety",
        targetCity: currentCity,
        recommendedSubAgents: ["emergency-agent"],
        requiresConfirmation: false,
      };
    }

    // Wallet / Balance check intent
    if (/kredi|bakiye|cüzdan|kaç kredim|kredi al/iu.test(norm)) {
      return {
        action: "check_wallet",
        recommendedSubAgents: ["billing-wallet-tool"],
        requiresConfirmation: false,
      };
    }

    // Ephemeral Location Share intent
    if (
      /konum\s+paylaş|harita\s+linki|link\s+oluştur|kod\s+üret|arkadaşıma\s+gönder/iu.test(norm)
    ) {
      return {
        action: "share_location",
        recommendedSubAgents: ["share-token-tool"],
        requiresConfirmation: true,
      };
    }

    // Lodging intent
    if (/otel|konakla|pansiyon|hostel|nerede kal|apart/iu.test(norm)) {
      return {
        action: "find_lodging",
        targetCity: currentCity,
        recommendedSubAgents: ["lodging-agent", "hotel-deal-agent"],
        requiresConfirmation: false,
      };
    }

    // Food & Dining intent
    if (/yemek|kahve|kafe|restoran|mutfak|lezzet|gurme|kahvaltı/iu.test(norm)) {
      return {
        action: "find_food",
        targetCity: currentCity,
        recommendedSubAgents: ["food-agent", "discovery-agent"],
        requiresConfirmation: false,
      };
    }

    // Transit & Direction intent
    if (/metro|otobüs|ulaşım|nasıl giderim|taksi|havalimanından/iu.test(norm)) {
      return {
        action: "transit_directions",
        targetCity: currentCity,
        recommendedSubAgents: ["city-transit-agent"],
        requiresConfirmation: false,
      };
    }

    // Full Route / Itinerary planning
    if (/rota|plan|günlük\s+gezi|tur|program|gezelim/iu.test(norm)) {
      return {
        action: "plan_itinerary",
        targetCity: currentCity,
        recommendedSubAgents: ["route-agent", "discovery-agent"],
        requiresConfirmation: false,
      };
    }

    return {
      action: "general_chat",
      targetCity: currentCity,
      recommendedSubAgents: ["context-agent"],
      requiresConfirmation: false,
    };
  }
}
