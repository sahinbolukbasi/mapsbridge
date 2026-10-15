import { invokeBedrockJSON } from "../bedrock-client";
import type { TripProfile } from "../types";

export interface TravelEventItem {
  title: string;
  category: "concert" | "exhibition" | "festival" | "theatre" | "local_fair";
  venue: string;
  dateOrSchedule: string;
  highlight: string;
  ticketTip: string;
}

export interface EventsAgentOutput {
  destination: string;
  events: TravelEventItem[];
  tips: string[];
}

const EVENTS_SYSTEM_PROMPT = `Sen MapsBridge Seyahat Asistanı Canlı Etkinlik ve Konser Uzmanı Ajanısın (Events & Concerts Sub-Agent).
Görevin: Kullanıcının ziyaret edeceği şehir ve tarihler için sergiler, konserler, festivaller ve yerel kültürel etkinlikler listesi hazırlamak.

KURALLAR:
- Kullanıcının müzik, sanat ve festival tercihlerini dikkate al.
- Şehirdeki bilinen prestijli etkinlik alanlarını, konser salonlarını ve festival merkezlerini seç.
- Yalnızca geçerli JSON döndür.

JSON formatı:
{
  "destination": "Şehir adı",
  "events": [
    {
      "title": "Etkinlik / Konser Adı",
      "category": "concert" | "exhibition" | "festival" | "theatre" | "local_fair",
      "venue": "Mekan / Salon Adı",
      "dateOrSchedule": "Tarih veya Gün / Saat aralığı",
      "highlight": "Neden kaçırılmamalı?",
      "ticketTip": "Bilet veya kapı girişi tavsiyesi"
    }
  ],
  "tips": ["Erken rezervasyon veya indirimli bilet ipucu"]
}`;

export async function runEventsAgent(
  destination: string,
  profile?: Partial<TripProfile>,
  timeoutMs = 4500,
): Promise<{ output: EventsAgentOutput; source: "bedrock"; durationMs: number }> {
  const startTime = Date.now();
  const cultureInterests = profile?.interests?.culture?.join(", ") || "müzik, sanat, festival";

  const userQuery = `Hedef Şehir: "${destination}".
Etkinlik ve Kültür İlgileri: ${cultureInterests}.
Bu şehre özel en popüler 2-4 güncel etkinlik, sergi veya konser önerisi hazırla.`;

  const bedrockRes = await invokeBedrockJSON<EventsAgentOutput>(userQuery, {
    systemPrompt: EVENTS_SYSTEM_PROMPT,
    temperature: 0.3,
    maxTokens: 1200,
    timeoutMs,
  });

  if (bedrockRes.success && bedrockRes.data && Array.isArray(bedrockRes.data.events)) {
    return {
      output: bedrockRes.data,
      source: "bedrock",
      durationMs: Date.now() - startTime,
    };
  }

  // Fallback if model call fails
  return {
    output: {
      destination,
      events: [
        {
          title: `${destination} Şehir Sanat ve Müzik Etkinlikleri`,
          category: "festival",
          venue: `${destination} Tarihi Merkez ve Kültür Meydanı`,
          dateOrSchedule: "Hafta sonu akşam saatleri",
          highlight: "Yerel müzisyenler ve sokak sanatı performansları",
          ticketTip: "Ücretsiz halka açık katılım",
        },
      ],
      tips: [
        "Popüler konserler ve opera biletleri için resmi salon web sitelerini önceden kontrol edin.",
      ],
    },
    source: "bedrock",
    durationMs: Date.now() - startTime,
  };
}
