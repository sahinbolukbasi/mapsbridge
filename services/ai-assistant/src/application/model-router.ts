/**
 * @mapsbridge/service-ai-assistant
 * Model Router (4 Katmanlı Model Yönlendirici)
 *
 * İstek karmaşıklığına göre en uygun AWS Bedrock modelini seçer.
 * Kredi maliyetleri @mapsbridge/contracts'tan alınır (tek kaynak).
 */
import { ACTION_CREDIT_COSTS } from "@mapsbridge/contracts";

export type ModelTier = "tier1" | "tier2" | "tier3" | "tier4";

export interface ModelTierConfig {
  tier: ModelTier;
  modelId: string;
  modelName: string;
  estimatedLatencyMs: number;
  creditCost: number;
  description: string;
}

export class ModelRouter {
  public static readonly TIER_CONFIGS: Record<ModelTier, ModelTierConfig> = {
    tier1: {
      tier: "tier1",
      modelId: "eu.amazon.nova-micro-v1:0",
      modelName: "Amazon Nova Micro",
      estimatedLatencyMs: 220,
      creditCost: ACTION_CREDIT_COSTS.ai_greeting,
      description: "Selamlama, çok kısa soru, genel niyet tespiti",
    },
    tier2: {
      tier: "tier2",
      modelId: "eu.amazon.nova-lite-v1:0",
      modelName: "Amazon Nova Lite",
      estimatedLatencyMs: 420,
      creditCost: ACTION_CREDIT_COSTS.ai_chat,
      description: "Standart seyahat sohbeti, tek şehir-1-3 günlük plan, restoran/konaklama önerileri",
    },
    tier3: {
      tier: "tier3",
      modelId: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
      modelName: "Claude Haiku 4.5",
      estimatedLatencyMs: 780,
      creditCost: ACTION_CREDIT_COSTS.ai_stay_dining,
      description: "4+ günlük plan, çok şehirli rota, kısıtlı veya özel talepler",
    },
    tier4: {
      tier: "tier4",
      modelId: "eu.anthropic.claude-3-5-sonnet-20241022-v2:0",
      modelName: "Claude 3.5 Sonnet",
      estimatedLatencyMs: 2400,
      creditCost: ACTION_CREDIT_COSTS.ai_deep_trip,
      description: "Yeniden planlama, tam optimizasyon, ayrıntılı çok kısıtlı program",
    },
  };

  /**
   * Evaluates request complexity to determine the optimal model tier.
   * Tier escalation logic: default → Tier2, escalate as complexity grows.
   */
  public static resolveTier(payload: {
    prompt: string;
    dayCount?: number;
    multiCity?: boolean;
    hasExistingRoute?: boolean;
    constraintsCount?: number;
    isReplanning?: boolean;
  }): ModelTierConfig {
    const norm = (payload.prompt || "").toLocaleLowerCase("tr");

    // ── Tier 1: Basit selamlama veya çok kısa tek-kelime niyet ──────────────
    const isGreeting = /^(merhaba|selam|günaydın|iyi günler|hey|hi|hello|nasılsın|ne haber)[!.,?]?$/iu.test(norm.trim());
    const isVeryShort = norm.trim().split(/\s+/).length <= 3 && !payload.dayCount && !payload.multiCity;
    if (isGreeting || isVeryShort) {
      return ModelRouter.TIER_CONFIGS.tier1;
    }

    // ── Tier 4: Yeniden planlama veya çok karmaşık optimizasyon ─────────────
    const isReplanning =
      payload.isReplanning ||
      /yeniden\s+planla|rotayı\s+değiştir|tam\s+program|ayrıntılı\s+rota|tüm\s+güzergah|komple\s+güncelle/iu.test(norm);
    if (isReplanning) {
      return ModelRouter.TIER_CONFIGS.tier4;
    }

    // ── Tier 3: Çok günlük veya çok şehirli karmaşık planlar ─────────────────
    const isComplex =
      payload.multiCity ||
      (payload.dayCount !== undefined && payload.dayCount >= 4) ||
      (payload.constraintsCount !== undefined && payload.constraintsCount >= 3);
    if (isComplex) {
      return ModelRouter.TIER_CONFIGS.tier3;
    }

    // ── Tier 3: Detay gerektiren kısıtlı talepler ────────────────────────────
    const hasSpecialConstraints =
      /vegan|helal|engelli|tekerlekli\s+sandalye|bebek|çocuklu|bütçe\s+kısıt|parasız/iu.test(norm);
    if (hasSpecialConstraints && payload.dayCount && payload.dayCount >= 2) {
      return ModelRouter.TIER_CONFIGS.tier3;
    }

    // ── Tier 2: Standart seyahat sohbeti (varsayılan) ────────────────────────
    // Restoran, konaklama, 1-3 günlük plan, ulaşım önerisi, genel seyahat
    return ModelRouter.TIER_CONFIGS.tier2;
  }

  /**
   * Returns a human-readable cost summary for the given tier.
   */
  public static describeCost(tier: ModelTier): string {
    const config = ModelRouter.TIER_CONFIGS[tier];
    if (config.creditCost === 0) return "Ücretsiz";
    if (config.creditCost < 1) return `${config.creditCost} kredi`;
    return `${config.creditCost} kredi`;
  }
}
