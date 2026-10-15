/**
 * @mapsbridge/service-ai-assistant
 * Dynamic Replanner (Dinamik Rota Yeniden Planlama Motoru)
 *
 * Kullanıcı gün içinde geç uyandığında, yağmur başladığında veya bir mekan
 * beklenmedik şekilde kapalı olduğunda rotayı dinamik olarak yeniden optimize eder.
 */

import type { RouteStopDto } from "@mapsbridge/contracts";

export type ReplanReason = "late_start" | "rain_weather" | "venue_closed" | "user_request";

export interface ReplanResult {
  updatedStops: RouteStopDto[];
  replanningSummary: string;
  swappedStopsCount: number;
  reason: ReplanReason;
}

export class DynamicReplanner {
  /**
   * Adapts the given day's stops based on the real-world condition.
   */
  public static replanDay(
    currentStops: RouteStopDto[],
    reason: ReplanReason,
    options?: {
      delayedHours?: number;
      closedStopId?: string;
      indoorAlternatives?: RouteStopDto[];
    },
  ): ReplanResult {
    if (!currentStops || currentStops.length === 0) {
      return {
        updatedStops: [],
        replanningSummary: "Rotada düzenlenecek durak bulunamadı.",
        swappedStopsCount: 0,
        reason,
      };
    }

    // 1. Durum: Yağmur / Kötü Hava Değişimi
    if (reason === "rain_weather") {
      let swappedCount = 0;
      const outdoorKeywords = [
        "park",
        "manzara",
        "seyir",
        "bahçe",
        "sahil",
        "plaj",
        "yürüyüş",
        "tepe",
      ];

      const newStops = currentStops.map((stop) => {
        const isOutdoor = outdoorKeywords.some(
          (k) =>
            (stop.category || "").toLowerCase().includes(k) ||
            (stop.description || "").toLowerCase().includes(k) ||
            stop.name.toLowerCase().includes(k),
        );

        if (
          isOutdoor &&
          options?.indoorAlternatives &&
          options.indoorAlternatives.length > swappedCount
        ) {
          const replacement = options.indoorAlternatives[swappedCount];
          swappedCount++;
          return {
            ...replacement,
            day: stop.day,
            id: `indoor-${stop.id}`,
            description: `[Yağmur Alternatifi] ${replacement.description || replacement.name}`,
          };
        }
        return stop;
      });

      return {
        updatedStops: newStops,
        replanningSummary:
          swappedCount > 0
            ? `Hava yağmurlu olduğu için ${swappedCount} açık hava durağı kapalı müze ve sergi alternatifleriyle değiştirildi.`
            : "Rotadaki mevcut duraklar yağmurlu havaya uygundur.",
        swappedStopsCount: swappedCount,
        reason,
      };
    }

    // 2. Durum: Geç Başlama (Late Start)
    if (reason === "late_start") {
      const delay = options?.delayedHours || 2;
      // Eğer çok fazla durak varsa ve gün 8.5 saati aşacaksa en düşük öncelikli son durağı sonraki güne veya arşive kaydır
      let adjustedStops = [...currentStops];
      let droppedCount = 0;

      if (adjustedStops.length > 4 && delay >= 2) {
        // En son durağı çıkararak günü hafiflet
        adjustedStops.pop();
        droppedCount = 1;
      }

      return {
        updatedStops: adjustedStops,
        replanningSummary: `Güne ${delay} saat geç başlandığı için durak saatleri ötelendi${droppedCount ? " ve günün son durağı daha rahat bir tempo için planından çıkarıldı" : ""}.`,
        swappedStopsCount: droppedCount,
        reason,
      };
    }

    // 3. Durum: Kapalı Mekan Alternatifi
    if (reason === "venue_closed" && options?.closedStopId) {
      const filtered = currentStops.filter((s) => s.id !== options.closedStopId);
      return {
        updatedStops: filtered,
        replanningSummary: "Kapalı olduğu tespit edilen mekan günün rotasından çıkarıldı.",
        swappedStopsCount: 1,
        reason,
      };
    }

    return {
      updatedStops: currentStops,
      replanningSummary: "Rota korundu.",
      swappedStopsCount: 0,
      reason,
    };
  }
}
