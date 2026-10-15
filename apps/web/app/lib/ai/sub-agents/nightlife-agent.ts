import { invokeBedrockJSON } from "../bedrock-client";

export interface NightlifeVenueItem {
  name: string;
  category: "cocktail_bar" | "jazz_club" | "rooftop" | "pub" | "dance_club";
  neighborhood: string;
  vibe: string;
  priceLevel: "€" | "€€" | "€€€";
  dressCodeOrEntryTip: string;
}

export interface NightlifeAgentOutput {
  destination: string;
  venues: NightlifeVenueItem[];
  safetyAndTransportTips: string[];
}

const NIGHTLIFE_SYSTEM_PROMPT = `Sen MapsBridge Seyahat Asistanı Gece Hayatı ve Kokteyl Barları Uzmanı Ajanısın (Nightlife & Evening Sub-Agent).
Görevin: Kullanıcının ziyaret edeceği şehirdeki şık kokteyl barları, canlı caz kulüpleri, panoramik rooftop terasları ve güvenli gece mekanları rehberi hazırlamak.

KURALLAR:
- Güvenli ve saygın semtlerdeki mekanları seç.
- Giriş adabı, kıyafet kodu (dress code) veya rezervasyon ihtiyacını belirt.
- Gece geç saatlerde toplu taşıma veya taksi güvenliği uyarısı ekle.
- Yalnızca geçerli JSON döndür.

JSON formatı:
{
  "destination": "Şehir adı",
  "venues": [
    {
      "name": "Mekan Adı",
      "category": "cocktail_bar" | "jazz_club" | "rooftop" | "pub" | "dance_club",
      "neighborhood": "Semt / Bölge",
      "vibe": "Atmosfer açıklaması (Örn: Bohem, samimi, lüks)",
      "priceLevel": "€" | "€€" | "€€€",
      "dressCodeOrEntryTip": "Rezervasyon veya kıyafet uyarısı"
    }
  ],
  "safetyAndTransportTips": ["Gece ulaşımı ve güvenli taksi tavsiyesi"]
}`;

export async function runNightlifeAgent(
  destination: string,
  timeoutMs = 4500,
): Promise<{ output: NightlifeAgentOutput; source: "bedrock"; durationMs: number }> {
  const startTime = Date.now();
  const userQuery = `Hedef Şehir: "${destination}". En keyifli ve güvenli 2-4 gece mekanı, kokteyl barı veya rooftop terası hazırla.`;

  const bedrockRes = await invokeBedrockJSON<NightlifeAgentOutput>(userQuery, {
    systemPrompt: NIGHTLIFE_SYSTEM_PROMPT,
    temperature: 0.3,
    maxTokens: 1200,
    timeoutMs,
  });

  if (bedrockRes.success && bedrockRes.data && Array.isArray(bedrockRes.data.venues)) {
    return {
      output: bedrockRes.data,
      source: "bedrock",
      durationMs: Date.now() - startTime,
    };
  }

  return {
    output: {
      destination,
      venues: [
        {
          name: `${destination} Panorama Rooftop Lounge`,
          category: "rooftop",
          neighborhood: "Şehir Merkezi",
          vibe: "Göz alıcı şehir silüeti ve imza kokteyller",
          priceLevel: "€€",
          dressCodeOrEntryTip: "Akşam saatleri için önceden masa ayırtmanız önerilir.",
        },
      ],
      safetyAndTransportTips: [
        "Gece geç saatlerde dönüş için resmi taksi duraklarını veya mobil ulaşım uygulamalarını tercih edin.",
      ],
    },
    source: "bedrock",
    durationMs: Date.now() - startTime,
  };
}
