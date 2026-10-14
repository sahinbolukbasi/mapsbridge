import { invokeBedrockJSON } from '../bedrock-client';
import type { TripProfile } from '../types';

export interface AirportGuide {
  code: string;
  name: string;
  distanceToCenter: string;
  bestTransferMode: string;
  estimatedTransferMinutes: number;
  tips: string[];
}

export interface FlightAgentOutput {
  destination: string;
  airports: AirportGuide[];
  generalFlightTips: string[];
}

const FLIGHT_AGENT_SYSTEM_PROMPT = `Sen MapsBridge Seyahat Asistanı Uçuş ve Havalimanı Uzmanı Ajanısın (Flight & Airport Sub-Agent).
Görevin: Hedef şehrin ana havalimanları, merkeze en pratik ulaşım yöntemleri, aktarma ve bagaj ipuçları sunmak.

KURALLAR:
- Canlı anlık bilet fiyatı veya boş koltuk uydurma.
- Havalimanı kodları (JFK, EWR, LGA, IST, SAW vb.) ve sabit transfer yöntemlerine (AirTrain, ekspres otobüs vb.) odaklan.
- Yalnızca geçerli JSON döndür.

JSON formatı:
{
  "destination": "Şehir adı",
  "airports": [
    {
      "code": "IATA Kodu (örn. JFK)",
      "name": "Havalimanı Adı",
      "distanceToCenter": "Merkeze yaklaşık mesafe",
      "bestTransferMode": "En pratik ulaşım (örn. AirTrain + E metrosu)",
      "estimatedTransferMinutes": 50,
      "tips": ["Pasaport sırası, terminal içi yönlendirme ipucu"]
    }
  ],
  "generalFlightTips": ["Erken gelme süresi, bagaj kuralları vb."]
}`;

export async function runFlightAgent(
  destination: string,
  profile?: Partial<TripProfile>,
  timeoutMs = 4500
): Promise<{ output: FlightAgentOutput; source: 'bedrock'; durationMs: number }> {
  const startTime = Date.now();
  const travelers = profile?.travelers ? `${profile.travelers.adults || 1} yetişkin, ${profile.travelers.children || 0} çocuk` : 'Standart seyahat';

  const userQuery = `Hedef Şehir: "${destination}". Gezginler: ${travelers}. Şehrin ana havalimanları ve şehre transfer rehberi hazırla.`;

  const bedrockRes = await invokeBedrockJSON<FlightAgentOutput>(userQuery, {
    systemPrompt: FLIGHT_AGENT_SYSTEM_PROMPT,
    temperature: 0.2,
    maxTokens: 1100,
    timeoutMs,
  });

  if (bedrockRes.success && bedrockRes.data && Array.isArray(bedrockRes.data.airports)) {
    return {
      output: {
        destination: bedrockRes.data.destination || destination,
        airports: bedrockRes.data.airports,
        generalFlightTips: Array.isArray(bedrockRes.data.generalFlightTips) ? bedrockRes.data.generalFlightTips : [],
      },
      source: 'bedrock',
      durationMs: Date.now() - startTime,
    };
  }

  throw new Error('Uçuş ve havalimanı rehberi oluşturulamadı.');
}
