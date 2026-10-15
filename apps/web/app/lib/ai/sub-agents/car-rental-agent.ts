import { invokeBedrockJSON } from "../bedrock-client";
import type { TripProfile } from "../types";

export interface CarRentalAdvice {
  isCarRecommendedInCity: boolean;
  cityDrivingVerdict: string;
  parkingOverview: string;
  tollRoadsAndPasses: string;
  recommendedScenarios: string[];
  tipsForRenters: string[];
}

export interface CarRentalAgentOutput {
  destination: string;
  advice: CarRentalAdvice;
}

const CAR_RENTAL_AGENT_SYSTEM_PROMPT = `Sen MapsBridge Seyahat Asistanı Araç Kiralama ve Şehir Sürüşü Uzmanı Ajanısın (Car Rental & Driving Sub-Agent).
Görevin: Hedef şehirde araç kiralamanın mantıklı olup olmadığını dürüstçe değerlendirmek, otopark, trafik ve ücretli geçiş (toll) ipuçları vermek.

KURALLAR:
- New York, Paris, Roma, Londra gibi yoğun metropollerde şehir içinde araç kiralamayı ÖNERME; otopark maliyetini ve trafiği açıkla.
- Aracın yalnızca şehir dışı günübirlik kaçışlar (örn. Upstate New York, Toskana) için mantıklı olduğunu belirt.
- Canlı kiralama ücreti uydurma.
- Yalnızca geçerli JSON döndür.

JSON formatı:
{
  "destination": "Şehir adı",
  "advice": {
    "isCarRecommendedInCity": false,
    "cityDrivingVerdict": "Şehir içi sürüş tavsiyesi ve gerekçesi",
    "parkingOverview": "Otopark bulma zorluğu ve ortalama park durumu",
    "tollRoadsAndPasses": "Köprü, tünel veya paralı yol geçiş sistemleri (örn. E-ZPass)",
    "recommendedScenarios": ["Hangi durumda araç kiralanmalı?"],
    "tipsForRenters": ["Uluslararası ehliyet, sigorta, yaş sınırı ipuçları"]
  }
}`;

export async function runCarRentalAgent(
  destination: string,
  profile?: Partial<TripProfile>,
  timeoutMs = 4500,
): Promise<{ output: CarRentalAgentOutput; source: "bedrock"; durationMs: number }> {
  const startTime = Date.now();

  const userQuery = `Hedef Şehir: "${destination}". Bu şehirde araç kiralamak mantıklı mı? Otopark, ücretli köprü/tünel ve kiralama tavsiyeleri hazırla.`;

  const bedrockRes = await invokeBedrockJSON<CarRentalAgentOutput>(userQuery, {
    systemPrompt: CAR_RENTAL_AGENT_SYSTEM_PROMPT,
    temperature: 0.2,
    maxTokens: 1100,
    timeoutMs,
  });

  if (bedrockRes.success && bedrockRes.data && bedrockRes.data.advice) {
    return {
      output: {
        destination: bedrockRes.data.destination || destination,
        advice: bedrockRes.data.advice,
      },
      source: "bedrock",
      durationMs: Date.now() - startTime,
    };
  }

  throw new Error("Araç kiralama uzmanı tavsiyesi oluşturulamadı.");
}
