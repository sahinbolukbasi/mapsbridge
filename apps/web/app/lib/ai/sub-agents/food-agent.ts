import { invokeBedrockJSON } from "../bedrock-client";
import type { TripProfile } from "../types";

export interface FoodRecommendation {
  name: string;
  category: "specialty_coffee" | "local_cuisine" | "burger" | "michelin" | "bakery" | "casual";
  area: string;
  priceLevel: "$" | "$$" | "$$$" | "$$$$";
  highlight: string;
  dietaryNotes: string[];
}

export interface FoodAgentOutput {
  destination: string;
  recommendations: FoodRecommendation[];
  culinaryTips: string[];
}

const FOOD_AGENT_SYSTEM_PROMPT = `Sen MapsBridge Seyahat Asistanı Gastronomi ve Yemek Uzmanı Ajanısın (Food & Dining Sub-Agent).
Görevin: Hedef şehir için kullanıcının özel zevklerine (nitelikli kahve, gurme burger, yerel lezzetler, michelin) ve katı kısıtlarına (ör. balık yok, glütensiz, vegan) uygun, doğrulanmış mekan tavsiyeleri üretmek.

KULLANICI KISITLARI KESİNDİR:
- Kullanıcı balık / deniz ürünü istemiyorsa suşi, balık lokantası veya deniz ürünü barı ASLA önerme.
- Fiyat uydurma; $, $$, $$$, $$$$ seviyelerini kullan.
- Yalnızca JSON döndür.

JSON formatı:
{
  "destination": "Şehir adı",
  "recommendations": [
    {
      "name": "Mekan Adı",
      "category": "specialty_coffee" | "local_cuisine" | "burger" | "michelin" | "bakery" | "casual",
      "area": "Semt / Mahalle",
      "priceLevel": "$" | "$$" | "$$$" | "$$$$",
      "highlight": "Neden burası özel? (Kahve çekirdeği, özel tabak vb.)",
      "dietaryNotes": ["Deniz ürünü içermez", "Vejetaryen dostu"]
    }
  ],
  "culinaryTips": ["Bahşiş kültürü veya rezervasyon ipuçları"]
}`;

export async function runFoodAgent(
  destination: string,
  profile?: Partial<TripProfile>,
  timeoutMs = 4500,
): Promise<{ output: FoodAgentOutput; source: "bedrock"; durationMs: number }> {
  const startTime = Date.now();
  const interests = profile?.interests?.food?.join(", ") || "yerel lezzetler, nitelikli kahve";
  const constraints = profile?.constraints?.join(", ") || "yok";
  const budget = profile?.budget?.level || "mid";

  const userQuery = `Hedef Şehir: "${destination}".
İlgi Alanları: ${interests}.
Kısıtlar (DİKKATLE UY): ${constraints}.
Bütçe Düzeyi: ${budget}.
Bu kriterlere uygun en iyi 3-5 mekan ve gastronomi ipuçları hazırla.`;

  const bedrockRes = await invokeBedrockJSON<FoodAgentOutput>(userQuery, {
    systemPrompt: FOOD_AGENT_SYSTEM_PROMPT,
    temperature: 0.2,
    maxTokens: 1200,
    timeoutMs,
  });

  if (bedrockRes.success && bedrockRes.data && Array.isArray(bedrockRes.data.recommendations)) {
    // Deterministic constraint filter on output
    const cleanOutput: FoodAgentOutput = {
      destination: bedrockRes.data.destination || destination,
      culinaryTips: Array.isArray(bedrockRes.data.culinaryTips) ? bedrockRes.data.culinaryTips : [],
      recommendations: bedrockRes.data.recommendations.filter((r) => {
        if (!r.name || !r.highlight) return false;
        if (/balık|deniz\s*ürün/iu.test(constraints)) {
          if (
            /balık|seafood|sushi|fish|oyster|istakoz|karides/iu.test(r.name + " " + r.highlight)
          ) {
            return false;
          }
        }
        return true;
      }),
    };

    return {
      output: cleanOutput,
      source: "bedrock",
      durationMs: Date.now() - startTime,
    };
  }

  throw new Error("Yemek uzmanı tavsiyesi oluşturulamadı.");
}
