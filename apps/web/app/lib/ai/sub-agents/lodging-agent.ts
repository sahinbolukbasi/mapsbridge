import { invokeBedrockJSON } from "../bedrock-client";
import type { TripProfile } from "../types";

export interface LodgingOption {
  name: string;
  type: "hotel" | "boutique" | "apartment" | "hostel" | "resort";
  neighborhood: string;
  safetyScore: "high" | "moderate";
  priceLevel: "$" | "$$" | "$$$" | "$$$$";
  description: string;
  suitability: string;
  pros: string[];
}

export interface LodgingAgentOutput {
  destination: string;
  recommendedNeighborhoods: Array<{
    name: string;
    character: string;
    idealFor: string;
  }>;
  stays: LodgingOption[];
  bookingAdvice: string[];
}

const LODGING_AGENT_SYSTEM_PROMPT = `Sen MapsBridge Seyahat Asistanı Konaklama Uzmanı Ajanısın (Lodging Sub-Agent).
Görevin: Hedef şehir için mahalle karakteri, güvenlik seviyesi, ulaşım kolaylığı ve kullanıcı bütçesine göre otel/bölge tavsiyeleri üretmek.

ÖNEMLİ KURALLAR:
- Çocuklu veya aileli seyahatte sakin, merkezi ve güvenli mahalleleri ön plana çıkar.
- Airbnb scraping yapma; genel mahalle ve bölge karakteri ver.
- Canlı anlık fiyat uydurma; $, $$, $$$, $$$$ seviyelerini ve tahmini aralıkları kullan.
- Yalnızca geçerli JSON döndür.

JSON formatı:
{
  "destination": "Şehir adı",
  "recommendedNeighborhoods": [
    {
      "name": "Mahalle / Semt Adı",
      "character": "Mahallenin genel atmosferi (tarihi, bohem, lüks vb.)",
      "idealFor": "Kimin için ideal? (İlk kez gelenler, aileler, gurmeler vb.)"
    }
  ],
  "stays": [
    {
      "name": "Otel / Konaklama Tipi Önerisi",
      "type": "hotel" | "boutique" | "apartment" | "hostel" | "resort",
      "neighborhood": "Mahalle",
      "safetyScore": "high" | "moderate",
      "priceLevel": "$" | "$$" | "$$$" | "$$$$",
      "description": "Neden burası uygun?",
      "suitability": "Kullanıcının seyahat tarzına uygunluk gerekçesi",
      "pros": ["Metroya yakın", "Sessiz sokak"]
    }
  ],
  "bookingAdvice": ["Erken rezervasyon uyarısı, şehir vergisi vb."]
}`;

export async function runLodgingAgent(
  destination: string,
  profile?: Partial<TripProfile>,
  timeoutMs = 4500,
): Promise<{ output: LodgingAgentOutput; source: "bedrock"; durationMs: number }> {
  const startTime = Date.now();
  const lodgingTypes = profile?.lodging_type?.join(", ") || "hotel, boutique";
  const travelers = profile?.travelers
    ? `${profile.travelers.adults || 1} yetişkin, ${profile.travelers.children || 0} çocuk`
    : "Standart seyahat grubu";
  const budget = profile?.budget?.level || "mid";
  const pace = profile?.pace || "moderate";

  const userQuery = `Hedef Şehir: "${destination}".
Konaklama Tipleri: ${lodgingTypes}.
Gezginler: ${travelers}.
Bütçe Düzeyi: ${budget}.
Seyahat Temposu: ${pace}.
Bu profile en uygun mahalleleri ve 2-4 konaklama tavsiyesini hazırla.`;

  const bedrockRes = await invokeBedrockJSON<LodgingAgentOutput>(userQuery, {
    systemPrompt: LODGING_AGENT_SYSTEM_PROMPT,
    temperature: 0.2,
    maxTokens: 1300,
    timeoutMs,
  });

  if (
    bedrockRes.success &&
    bedrockRes.data &&
    Array.isArray(bedrockRes.data.recommendedNeighborhoods)
  ) {
    return {
      output: {
        destination: bedrockRes.data.destination || destination,
        recommendedNeighborhoods: bedrockRes.data.recommendedNeighborhoods,
        stays: Array.isArray(bedrockRes.data.stays) ? bedrockRes.data.stays : [],
        bookingAdvice: Array.isArray(bedrockRes.data.bookingAdvice)
          ? bedrockRes.data.bookingAdvice
          : [],
      },
      source: "bedrock",
      durationMs: Date.now() - startTime,
    };
  }

  throw new Error("Konaklama uzmanı tavsiyesi oluşturulamadı.");
}
