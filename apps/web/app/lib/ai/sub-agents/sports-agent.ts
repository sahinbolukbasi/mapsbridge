import { invokeBedrockJSON } from '../bedrock-client';
import type { TripProfile } from '../types';

export interface SportsActivity {
  title: string;
  type: 'running' | 'walking' | 'cycling' | 'rowing' | 'court' | 'outdoor_gym';
  location: string;
  distanceOrDuration: string;
  difficulty: 'easy' | 'moderate' | 'challenging';
  highlight: string;
}

export interface SportsAgentOutput {
  destination: string;
  activities: SportsActivity[];
  generalSportsTips: string[];
}

const SPORTS_AGENT_SYSTEM_PROMPT = `Sen MapsBridge Seyahat Asistanı Spor ve Açık Hava Aktiviteleri Uzmanı Ajanısın (Sports & Outdoors Sub-Agent).
Görevin: Hedef şehir için koşu rotaları, yürüyüş parkurları, bisiklet yolları, açık hava spor sahaları ve su sporları (kürek, yüzme) rehberi hazırlamak.

KURALLAR:
- Kullanıcının temposuna ve tercihlerine (koşu, yürüyüş, bisiklet) odaklan.
- Gerçek ve bilinen park ve rotaları seç (örn. Central Park Reservoir, Hudson River Greenway).
- Fiyat uydurma; park ve açık hava koşusu genelde ücretsizdir.
- Yalnızca geçerli JSON döndür.

JSON formatı:
{
  "destination": "Şehir adı",
  "activities": [
    {
      "title": "Aktivite / Parkur Adı",
      "type": "running" | "walking" | "cycling" | "rowing" | "court" | "outdoor_gym",
      "location": "Park / Mahalle",
      "distanceOrDuration": "Örn. 5 km veya 1 saat",
      "difficulty": "easy" | "moderate" | "challenging",
      "highlight": "Neden tercih edilmeli? (Manzara, zemin, güvenlik)"
    }
  ],
  "generalSportsTips": ["Sabah koşusu güvenliği, bisiklet kiralama sistemi vb."]
}`;

export async function runSportsAgent(
  destination: string,
  profile?: Partial<TripProfile>,
  timeoutMs = 4500
): Promise<{ output: SportsAgentOutput; source: 'bedrock'; durationMs: number }> {
  const startTime = Date.now();
  const sportsInterests = profile?.interests?.sports?.join(', ') || 'koşu, yürüyüş';
  const pace = profile?.pace || 'moderate';

  const userQuery = `Hedef Şehir: "${destination}".
Spor ve Açık Hava İlgileri: ${sportsInterests}.
Tempo: ${pace}.
Bu profile en uygun 2-4 açık hava spor rotası ve pratik ipuçları hazırla.`;

  const bedrockRes = await invokeBedrockJSON<SportsAgentOutput>(userQuery, {
    systemPrompt: SPORTS_AGENT_SYSTEM_PROMPT,
    temperature: 0.2,
    maxTokens: 1100,
    timeoutMs,
  });

  if (bedrockRes.success && bedrockRes.data && Array.isArray(bedrockRes.data.activities)) {
    return {
      output: {
        destination: bedrockRes.data.destination || destination,
        activities: bedrockRes.data.activities,
        generalSportsTips: Array.isArray(bedrockRes.data.generalSportsTips) ? bedrockRes.data.generalSportsTips : [],
      },
      source: 'bedrock',
      durationMs: Date.now() - startTime,
    };
  }

  throw new Error('Spor uzmanı tavsiyesi oluşturulamadı.');
}
