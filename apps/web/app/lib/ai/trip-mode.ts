import type { StructuredTripPlan, DayBlock } from "./types";

export interface OnTripAlert {
  type: "upcoming_block" | "weather_warning" | "transit_advice" | "emergency_notice";
  title: string;
  message: string;
  suggestedAction?: string;
  block?: DayBlock;
}

export function parseMinutesFromMidnight(timeStr: string): number {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function getCurrentAndNextBlock(
  plan: StructuredTripPlan,
  dayDate: string,
  currentTimeStr: string,
): { currentBlock?: DayBlock; nextBlock?: DayBlock } {
  if (!plan || !Array.isArray(plan.days)) return {};

  const targetDay = plan.days.find((d) => d.date === dayDate) || plan.days[0];
  if (!targetDay || !Array.isArray(targetDay.blocks) || targetDay.blocks.length === 0) {
    return {};
  }

  const currentMinutes = parseMinutesFromMidnight(currentTimeStr);
  let currentBlock: DayBlock | undefined;
  let nextBlock: DayBlock | undefined;

  for (let i = 0; i < targetDay.blocks.length; i++) {
    const block = targetDay.blocks[i];
    const match = block.time.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
    if (!match) continue;

    const startMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    const endMinutes = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);

    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      currentBlock = block;
      nextBlock = targetDay.blocks[i + 1];
      break;
    } else if (currentMinutes < startMinutes && !nextBlock) {
      nextBlock = block;
      break;
    }
  }

  return { currentBlock, nextBlock };
}

export function evaluateWeatherAlertTrigger(weatherNote: string): OnTripAlert | null {
  if (!weatherNote) return null;

  const isSevere = /fırtına|şiddetli yağış|kar fırtınası|dolu|storm|blizzard|heavy rain/iu.test(
    weatherNote,
  );
  const isRainy = /yağmur|yağış|rain|shower/iu.test(weatherNote);

  if (isSevere) {
    return {
      type: "weather_warning",
      title: "⚠️ Şiddetli Hava Koşulu Uyarısı",
      message: `Bölgede ${weatherNote} bekleniyor. Açık hava duraklarını erteleyip kapalı mekanlara veya müzeye geçmeniz önerilir.`,
      suggestedAction: "En yakın metro istasyonuna veya kapalı alana sığının.",
    };
  }

  if (isRainy) {
    return {
      type: "weather_warning",
      title: "🌧️ Yağış Uyarısı",
      message: `Hava durumu: ${weatherNote}. Gün içindeki açık hava durakları için alternatif planları inceleyin.`,
      suggestedAction: "Şemsiyenizi veya yağmurluğunuzu yanınıza almayı unutmayın.",
    };
  }

  return null;
}

export function generateOnTripUpdate(
  plan: StructuredTripPlan,
  dayDate: string,
  currentTimeStr: string,
  userLocation?: { lat: number; lng: number },
): OnTripAlert[] {
  const alerts: OnTripAlert[] = [];
  const { currentBlock, nextBlock } = getCurrentAndNextBlock(plan, dayDate, currentTimeStr);

  const targetDay = plan?.days?.find((d) => d.date === dayDate) || plan?.days?.[0];
  if (targetDay?.weather_note) {
    const weatherAlert = evaluateWeatherAlertTrigger(targetDay.weather_note);
    if (weatherAlert) alerts.push(weatherAlert);
  }

  if (currentBlock) {
    alerts.push({
      type: "upcoming_block",
      title: `📍 Şu Anda: ${currentBlock.name}`,
      message: `${currentBlock.time} saatleri arasındasınız. ${currentBlock.why}`,
      block: currentBlock,
    });
  }

  if (nextBlock) {
    const transitInfo = nextBlock.transit
      ? `(${nextBlock.transit.minutes} dk ${nextBlock.transit.mode})`
      : "";
    alerts.push({
      type: "upcoming_block",
      title: `⏳ Sıradaki Durak: ${nextBlock.name}`,
      message: `Planlanan saat: ${nextBlock.time} ${transitInfo}.`,
      suggestedAction:
        nextBlock.transit?.mode === "subway" ? "Metroya doğru yönelin." : "Yürüyüşe başlayın.",
      block: nextBlock,
    });
  }

  return alerts;
}
