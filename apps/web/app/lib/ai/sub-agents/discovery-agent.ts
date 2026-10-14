import { isLocalDiscoveryInfo } from "../supplement-validation";
import { LocalDiscoveryInfo } from "../types";
import { invokeBedrockJSON } from "../bedrock-client";

const DISCOVERY_SYSTEM_PROMPT = `Sen Yerel Keşif ve Gastronomi Ajanısın (Local Discovery Sub-Agent).
Görevin: Kullanıcının ziyaret edeceği şehir için turist tuzaklarından uzak, otantik yerel lezzetler, gizli köşeler (hidden gems), seyir noktaları ve kültürel görgü kuralları üretmek.

JSON formatı:
{
  "specialties": ["Yöresel Yemek 1 (İçerik/Açıklama)", "Yöresel Yemek 2", "İçecek / Tatlı"],
  "gems": [
    {
      "name": "Mekan / Köşe Adı",
      "category": "food" | "cafe" | "viewpoint" | "shopping" | "hidden_spot",
      "description": "Neden özel?",
      "highlight": "Denemeniz gereken özel detay",
      "addressOrArea": "Semt / Cadde"
    }
  ],
  "cultureTips": [
    "Bahşiş ve restoran adabı kuralı",
    "Yerel yaşam ve siesta / açılış saatleri kuralı"
  ]
}
Canlı fiyat ve müsaitlik verin yok. Sayısal fiyat, kesin sefer süresi, güncel açılış saati veya rezervasyon garantisi verme. estimatedCost alanını üretme. Yalnızca geçerli JSON döndür.`;

export async function runDiscoveryAgent(
  prompt: string,
  destination: string,
  timeoutMs = 4500
): Promise<{ info: LocalDiscoveryInfo; source: "bedrock"; durationMs: number }> {
  const startTime = Date.now();

  const userQuery = `Hedef: "${destination}". İstek: "${prompt}". Yerel mutfak spesiyalleri, gizli köşeler ve kültürel ipuçları hazırla.`;

  const bedrockRes = await invokeBedrockJSON<LocalDiscoveryInfo>(userQuery, {
    systemPrompt: DISCOVERY_SYSTEM_PROMPT,
    temperature: 0.3,
    maxTokens: 1200,
    timeoutMs,
  });

  if (bedrockRes.success && isLocalDiscoveryInfo(bedrockRes.data)) {
    return {
      info: bedrockRes.data,
      source: "bedrock",
      durationMs: Date.now() - startTime,
    };
  }

  throw new Error('Ek seyahat bilgisi doğrulanamadı.');
}
