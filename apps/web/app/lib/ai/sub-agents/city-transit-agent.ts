import { invokeBedrockJSON } from '../bedrock-client';
import type { TripProfile } from '../types';

export interface TransitCardGuide {
  cardName: string;
  isContactlessAvailable: boolean;
  weeklyFareCap?: string;
  bestOptionForTourists: string;
  keyLines: Array<{ line: string; usefulFor: string }>;
  safetyTips: string[];
}

export interface CityTransitAgentOutput {
  destination: string;
  guide: TransitCardGuide;
}

const CITY_TRANSIT_AGENT_SYSTEM_PROMPT = `Sen MapsBridge Seyahat Asistanı Şehir İçi Ulaşım ve Toplu Taşıma Uzmanı Ajanısın (City Transit Sub-Agent).
Görevin: Hedef şehrin metro, otobüs, tramvay veya vapur ağı için turist odaklı en pratik biletleme yöntemini, temassız ödeme (OMNY, Oyster vb.) ve faydalı hatları açıklamak.

KURALLAR:
- Resmî bilet sistemlerini (örn. New York OMNY, Londra Oyster, İstanbulkart) doğru anlat.
- Gece sefer saatleri ve güvenlik ipuçlarını belirt.
- Canlı sefer tarifesi uydurma.
- Yalnızca geçerli JSON döndür.

JSON formatı:
{
  "destination": "Şehir adı",
  "guide": {
    "cardName": "Bilet / Kart Sistemi Adı (örn. OMNY / MetroCard)",
    "isContactlessAvailable": true,
    "weeklyFareCap": "Haftalık tavan ücret / çoklu biniş avantajı",
    "bestOptionForTourists": "Turistler için en pratik yöntem (örn. Kendi temassız kredi kartını turnikeye dokundurmak)",
    "keyLines": [
      { "line": "Hat Adı / Rengi", "usefulFor": "Hangi turistik noktalara gider?" }
    ],
    "safetyTips": ["Gece metro kullanımı, aktarma kuralları vb."]
  }
}`;

export async function runCityTransitAgent(
  destination: string,
  profile?: Partial<TripProfile>,
  timeoutMs = 4500
): Promise<{ output: CityTransitAgentOutput; source: 'bedrock'; durationMs: number }> {
  const startTime = Date.now();

  const userQuery = `Hedef Şehir: "${destination}". Bu şehirde metro ve toplu taşıma nasıl kullanılır? Turistler için en pratik biletleme ve önemli hatlar rehberi hazırla.`;

  const bedrockRes = await invokeBedrockJSON<CityTransitAgentOutput>(userQuery, {
    systemPrompt: CITY_TRANSIT_AGENT_SYSTEM_PROMPT,
    temperature: 0.2,
    maxTokens: 1200,
    timeoutMs,
  });

  if (bedrockRes.success && bedrockRes.data && bedrockRes.data.guide) {
    return {
      output: {
        destination: bedrockRes.data.destination || destination,
        guide: bedrockRes.data.guide,
      },
      source: 'bedrock',
      durationMs: Date.now() - startTime,
    };
  }

  throw new Error('Şehir içi ulaşım rehberi oluşturulamadı.');
}
