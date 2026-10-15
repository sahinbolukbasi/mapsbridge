import { isStayAndTransitInfo } from "../supplement-validation";
import { StayAndTransitInfo } from "../types";
import { invokeBedrockJSON } from "../bedrock-client";

const TRANSIT_STAY_SYSTEM_PROMPT = `Sen Konaklama ve Ulaşım Uzmanı Ajanısın (Transit & Stay Sub-Agent).
Görevin: Kullanıcının seyahat edeceği şehir için nerede kalınmalı, otel ve Airbnb bölgeleri, havaalanı transferi ve şehir içi toplu taşıma (metro kartı, biletler) tavsiyeleri üretmek.

JSON formatı:
{
  "recommendedAreas": ["Bölge 1 (Açıklama)", "Bölge 2 (Açıklama)"],
  "stays": [
    {
      "name": "Otel / Bölge Adı",
      "type": "hotel" | "boutique" | "airbnb_area" | "hostel",
      "area": "Mahalle / Semt",
      "priceLevel": "$" | "$$" | "$$$" | "$$$$",
      "description": "Neden burada kalınmalı?",
      "pros": ["Merkezi konum", "Metroya 2 dk"]
    }
  ],
  "transitTips": [
    {
      "title": "Havalimanı Ulaşımı",
      "type": "airport_transfer",
      "description": "Ekspres tren veya servis detayları"
    }
  ],
  "cityCardRecommendation": "Şehir ulaşım kartı veya çoklu bilet tavsiyesi"
}
Canlı fiyat ve müsaitlik verin yok. Sayısal fiyat, kesin sefer süresi, güncel açılış saati veya rezervasyon garantisi verme. estimatedCost alanını üretme. Yalnızca geçerli JSON döndür.`;

export async function runTransitStayAgent(
  prompt: string,
  destination: string,
  timeoutMs = 4500,
): Promise<{ info: StayAndTransitInfo; source: "bedrock"; durationMs: number }> {
  const startTime = Date.now();

  const userQuery = `Hedef Şehir/Bölge: "${destination}". Kullanıcı Mesajı: "${prompt}". Konaklama bölgeleri, otel tipleri ve havalimanı/şehir içi ulaşım kartı tavsiyeleri hazırla.`;

  const bedrockRes = await invokeBedrockJSON<StayAndTransitInfo>(userQuery, {
    systemPrompt: TRANSIT_STAY_SYSTEM_PROMPT,
    temperature: 0.2,
    maxTokens: 1200,
    timeoutMs,
  });

  if (bedrockRes.success && isStayAndTransitInfo(bedrockRes.data)) {
    return {
      info: bedrockRes.data,
      source: "bedrock",
      durationMs: Date.now() - startTime,
    };
  }

  throw new Error("Ek seyahat bilgisi doğrulanamadı.");
}
