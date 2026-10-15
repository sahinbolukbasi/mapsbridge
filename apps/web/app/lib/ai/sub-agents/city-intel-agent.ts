import { invokeBedrockJSON } from "../bedrock-client";
import type { TripProfile } from "../types";

export interface SeasonalIntelligence {
  seasonNotes: string;
  clothingAdvice: string;
  culturalEtiquette: string[];
  eventsAndFestivals: string[];
}

export interface CityIntelAgentOutput {
  destination: string;
  intelligence: SeasonalIntelligence;
}

const CITY_INTEL_AGENT_SYSTEM_PROMPT = `Sen MapsBridge Seyahat Asistanı Şehir İstihbaratı ve Kültürel Notlar Uzmanı Ajanısın (City Intelligence Sub-Agent).
Görevin: Hedef şehir için mevsime göre giyim/hazırlık önerisi, bahşiş ve yerel görgü kuralları, kültürel ipuçları sunmak.

KURALLAR:
- Yerel bahşiş standartlarını net açıkla (örn. ABD'de %18-20, Japonya'da bahşiş verilmez).
- Mevsimlik hava ve giyim tavsiyesi ver.
- Yalnızca geçerli JSON döndür.

JSON formatı:
{
  "destination": "Şehir adı",
  "intelligence": {
    "seasonNotes": "Mevsimin genel seyahat havası",
    "clothingAdvice": "Nasıl giyinmeli? (Rahat yürüyüş ayakkabısı, katmanlı giyim vb.)",
    "culturalEtiquette": ["Bahşiş, metroda sağda durma kuralı vb."],
    "eventsAndFestivals": ["Yılın bu dönemindeki popüler açık hava etkinlikleri"]
  }
}`;

export async function runCityIntelAgent(
  destination: string,
  profile?: Partial<TripProfile>,
  timeoutMs = 4500,
): Promise<{ output: CityIntelAgentOutput; source: "bedrock"; durationMs: number }> {
  const startTime = Date.now();
  const dates = profile?.dates
    ? `${profile.dates.start || ""} - ${profile.dates.end || ""}`
    : "Mevcut seyahat dönemi";

  const userQuery = `Hedef Şehir: "${destination}". Seyahat Tarihleri: ${dates}. Kültürel görgü kuralları, giyim önerisi ve şehir istihbaratı hazırla.`;

  const bedrockRes = await invokeBedrockJSON<CityIntelAgentOutput>(userQuery, {
    systemPrompt: CITY_INTEL_AGENT_SYSTEM_PROMPT,
    temperature: 0.2,
    maxTokens: 1100,
    timeoutMs,
  });

  if (bedrockRes.success && bedrockRes.data && bedrockRes.data.intelligence) {
    return {
      output: {
        destination: bedrockRes.data.destination || destination,
        intelligence: bedrockRes.data.intelligence,
      },
      source: "bedrock",
      durationMs: Date.now() - startTime,
    };
  }

  throw new Error("Şehir istihbaratı oluşturulamadı.");
}
