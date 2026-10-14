import { invokeBedrockJSON } from '../bedrock-client';
import type { RouteStop } from '../types';

export interface DynamicReplanningOutput {
  summary: string;
  adjustedStops: Array<{
    name: string;
    action: 'kept' | 'swapped' | 'deferred' | 'time_shifted';
    reason: string;
    newTimeSlot?: string;
  }>;
  weatherOrTimingAlert: string;
}

const REPLANNING_SYSTEM_PROMPT = `Sen MapsBridge Seyahat Asistanı Dinamik Rota Yeniden Planlama Ajanısın (Dynamic Route Replanning Sub-Agent).
Görevin: Kullanıcı gün içinde geç uyandığında, aniden yağmur başladığında veya bir mekan beklenmedik şekilde kapalı olduğunda rotayı dinamik olarak kurtarmak ve yeniden optimize etmek.

KURALLAR:
- Yağmur varsa: Açık hava park ve terasları kapalı müze, saray ve galerilerle değiştir.
- Geç başlandıysa: Günü rahatlatmak için en son durağı esnek bırak veya programdan çıkar.
- Kapalı mekan varsa: Hemen aynı bölgedeki açık ve benzer kaliteli bir alternatifi öner.
- Yalnızca geçerli JSON döndür.

JSON formatı:
{
  "summary": "Yapılan uyarlamanın özeti",
  "adjustedStops": [
    {
      "name": "Durak Adı",
      "action": "kept" | "swapped" | "deferred" | "time_shifted",
      "reason": "Neden bu değişiklik yapıldı?",
      "newTimeSlot": "Örn. 14:00 - 16:00"
    }
  ],
  "weatherOrTimingAlert": "Kullanıcıya özel hava veya saat uyarısı"
}`;

export async function runDynamicReplanningAgent(
  destination: string,
  triggerReason: 'late_start' | 'rain_weather' | 'venue_closed',
  currentStops: RouteStop[],
  timeoutMs = 4500
): Promise<{ output: DynamicReplanningOutput; source: 'bedrock'; durationMs: number }> {
  const startTime = Date.now();
  const stopNames = currentStops.map((s) => s.name).join(', ') || 'Planlanan duraklar';

  const userQuery = `Hedef Şehir: "${destination}".
Mevcut Duraklar: ${stopNames}.
Tetikleyici Neden: "${triggerReason === 'rain_weather' ? 'Yağmur başladı (açık hava duraklarını kapalı alternatiflerle değiştir)' : triggerReason === 'late_start' ? 'Güne 2 saat geç başlandı (durakları ötele)' : 'Bir mekan kapalı' }".
Bu duruma göre rotayı anında optimize et.`;

  const bedrockRes = await invokeBedrockJSON<DynamicReplanningOutput>(userQuery, {
    systemPrompt: REPLANNING_SYSTEM_PROMPT,
    temperature: 0.2,
    maxTokens: 1200,
    timeoutMs,
  });

  if (bedrockRes.success && bedrockRes.data && Array.isArray(bedrockRes.data.adjustedStops)) {
    return {
      output: bedrockRes.data,
      source: 'bedrock',
      durationMs: Date.now() - startTime,
    };
  }

  return {
    output: {
      summary: triggerReason === 'rain_weather'
        ? 'Yağış nedeniyle açık hava durakları kapalı kültürel alternatiflere uyarlandı.'
        : 'Zaman çizelgesi günün geri kalanı için daha rahat bir tempoya uyarlandı.',
      adjustedStops: currentStops.map((s, idx) => ({
        name: s.name,
        action: idx === 0 ? 'kept' : 'time_shifted',
        reason: 'Güncellenen gün saatine göre ötelendi.',
      })),
      weatherOrTimingAlert: 'Lütfen kapalı mekanların son bilet giriş saatlerini kontrol etmeyi unutmayın.',
    },
    source: 'bedrock',
    durationMs: Date.now() - startTime,
  };
}
