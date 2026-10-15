import type {
  StructuredTripPlan,
  TripProfile,
  FeasibilityReport,
  FeasibilityIssue,
  DayBlock,
  DayPlan,
} from "./types";

function parseTimeToMinutes(timeStr: string): { start: number; end: number } | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const start = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  const end = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
  return { start, end };
}

function parseHHMM(timeStr: string): number | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/** Haversine distance in kilometres between two WGS-84 coordinates. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// §11.1 Rule: Meal gap (8+ hours without a food/cafe block)
// ---------------------------------------------------------------------------

interface ParsedBlock {
  block: DayBlock;
  start: number;
  end: number;
  blockIdx: number;
}

function checkMealGap(day: DayPlan, dayNum: number): FeasibilityIssue[] {
  const parsed: ParsedBlock[] = [];
  for (let i = 0; i < (day.blocks || []).length; i++) {
    const t = parseTimeToMinutes(day.blocks[i].time);
    if (t) parsed.push({ block: day.blocks[i], start: t.start, end: t.end, blockIdx: i });
  }
  if (parsed.length === 0) return [];

  parsed.sort((a, b) => a.start - b.start);

  const dayStart = parsed[0].start;
  const dayEnd = parsed[parsed.length - 1].end;

  if (dayEnd - dayStart < 480) return []; // Day span too short to worry

  const foodParsed = parsed.filter((p) => p.block.type === "cafe" || p.block.type === "restaurant");

  if (foodParsed.length === 0) {
    return [
      {
        severity: "warning",
        day: dayNum,
        code: "MEAL_GAP",
        message: `${dayNum}. günde hiç yemek/kafe durağı planlanmamış (gün süresi: ${((dayEnd - dayStart) / 60).toFixed(1)} saat).`,
        suggestedFix: "Öğle veya akşam yemeği için bir yemek durağı ekleyin.",
      },
    ];
  }

  // Gap from day start to first food block
  const gapToFirst = foodParsed[0].start - dayStart;
  if (gapToFirst >= 480) {
    return [
      {
        severity: "warning",
        day: dayNum,
        code: "MEAL_GAP",
        message: `${dayNum}. günde ilk yemek durağına kadar ${Math.floor(gapToFirst / 60)} saat geçiyor.`,
        suggestedFix: "Daha erken bir kahvaltı veya öğle yemeği durağı ekleyin.",
      },
    ];
  }

  // Gaps between consecutive food blocks
  for (let i = 0; i < foodParsed.length - 1; i++) {
    const gap = foodParsed[i + 1].start - foodParsed[i].end;
    if (gap >= 480) {
      return [
        {
          severity: "warning",
          day: dayNum,
          code: "MEAL_GAP",
          message: `${dayNum}. günde yemek blokları arasında ${Math.floor(gap / 60)} saat aralık var.`,
          suggestedFix: "Uzun aktivite aralarına öğün arası bir kafe veya öğle yemeği ekleyin.",
        },
      ];
    }
  }

  // Gap from last food block to end of day
  const gapFromLast = dayEnd - foodParsed[foodParsed.length - 1].end;
  if (gapFromLast >= 480) {
    return [
      {
        severity: "warning",
        day: dayNum,
        code: "MEAL_GAP",
        message: `${dayNum}. günde son yemek durağından sonra ${Math.floor(gapFromLast / 60)} saat aktivite daha planlanmış, akşam yemeği eksik.`,
        suggestedFix: "Günün sonuna bir akşam yemeği durağı ekleyin.",
      },
    ];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

export function validateTripPlanFeasibility(
  plan: StructuredTripPlan,
  profile?: TripProfile,
): FeasibilityReport {
  const issues: FeasibilityIssue[] = [];
  let totalMinutesPlanned = 0;
  let estimatedCostSum = 0;

  if (!plan || !Array.isArray(plan.days) || plan.days.length === 0) {
    return {
      isValid: false,
      score: 0,
      issues: [
        {
          severity: "error",
          code: "EXCESSIVE_DURATION",
          message: "Plan geçerli günler içermiyor.",
        },
      ],
      totalPlannedHours: 0,
      estimatedCostTotal: 0,
    };
  }

  const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  for (let dayIdx = 0; dayIdx < plan.days.length; dayIdx++) {
    const day = plan.days[dayIdx];
    const dayNum = dayIdx + 1;
    let dayTotalMinutes = 0;
    let previousEnd: number | null = null;
    let previousBlockWithCoords: DayBlock | null = null;
    let totalWalkingMeters = 0;
    const isRainy = /yağmur|yağış|fırtına|rain|storm|shower/iu.test(day.weather_note || "");

    // Determine day-of-week from date string for closed days check
    let dayOfWeek: string | null = null;
    if (day.date) {
      try {
        const d = new Date(day.date);
        if (!isNaN(d.getTime())) {
          dayOfWeek = WEEKDAYS[d.getUTCDay()];
        }
      } catch {
        // ignore invalid dates
      }
    }

    for (let blockIdx = 0; blockIdx < (day.blocks || []).length; blockIdx++) {
      const block: DayBlock = day.blocks[blockIdx];

      if (typeof block.est_cost === "number" && block.est_cost > 0) {
        estimatedCostSum += block.est_cost;
      }

      // §11.1 Walking budget accumulation
      if (block.transit?.mode === "walking" && block.transit.minutes > 0) {
        totalWalkingMeters += block.transit.minutes * 83; // ~5 km/h ≈ 83 m/min
      }

      const parsedTime = parseTimeToMinutes(block.time);
      if (!parsedTime) {
        issues.push({
          severity: "error",
          day: dayNum,
          blockIndex: blockIdx,
          code: "TIME_OVERLAP",
          message: `${block.name} için zaman biçimi ("${block.time}") geçersiz. "09:00-10:00" biçimi beklenir.`,
          suggestedFix: "Zaman dilimini HH:MM-HH:MM olarak düzenleyin.",
        });
        continue;
      }

      if (parsedTime.end <= parsedTime.start) {
        issues.push({
          severity: "error",
          day: dayNum,
          blockIndex: blockIdx,
          code: "TIME_OVERLAP",
          message: `${block.name} bloğunun bitiş saati başlangıç saatinden önce veya aynı.`,
          suggestedFix: "Bitiş saatini başlangıçtan sonraya ayarlayın.",
        });
      }

      const blockDuration = parsedTime.end - parsedTime.start;
      dayTotalMinutes += blockDuration;

      // Check overlap with previous block
      if (previousEnd !== null) {
        if (parsedTime.start < previousEnd) {
          issues.push({
            severity: "error",
            day: dayNum,
            blockIndex: blockIdx,
            code: "TIME_OVERLAP",
            message: `${dayNum}. gün: "${block.name}" bloğu önceki durakla zaman olarak çakışıyor.`,
            suggestedFix: "Saatleri çakışmayacak şekilde ileri kaydırın.",
          });
        } else if (block.transit && block.transit.minutes > 0) {
          const gap = parsedTime.start - previousEnd;
          if (gap < block.transit.minutes) {
            issues.push({
              severity: "warning",
              day: dayNum,
              blockIndex: blockIdx,
              code: "TRANSIT_INSUFFICIENT",
              message: `${dayNum}. gün: "${block.name}" için ${block.transit.minutes} dk ${block.transit.mode} süresi gerekiyor, ancak iki blok arası sadece ${gap} dk.`,
              suggestedFix: "İki blok arasına en az ulaşım süresi kadar boşluk bırakın.",
            });
          }
        }
      }

      previousEnd = parsedTime.end;

      // Weather alternative check
      if (isRainy && (block.type === "park" || block.type === "viewpoint")) {
        if (!block.alt || block.alt.trim().length < 5) {
          issues.push({
            severity: "warning",
            day: dayNum,
            blockIndex: blockIdx,
            code: "MISSING_WEATHER_ALT",
            message: `${dayNum}. gün yağışlı hava uyarısı var ancak açık hava noktası "${block.name}" için yağmur alternatifi belirtilmemiş.`,
            suggestedFix: "Yağmur durumu için yakın kapalı bir müze veya kafe alternatifi ekleyin.",
          });
        }
      }

      // §11.1 Last entry time rule (kapanıştan 30-60 dk önce)
      if (block.closingTime) {
        const closingMin = parseHHMM(block.closingTime);
        if (closingMin !== null) {
          const minutesBeforeClosing = closingMin - parsedTime.start;
          if (minutesBeforeClosing < 30) {
            issues.push({
              severity: "error",
              day: dayNum,
              blockIndex: blockIdx,
              code: "LAST_ENTRY_VIOLATION",
              message: `${dayNum}. gün: "${block.name}" ziyaret başlangıcı (${block.time.split(/[-–]/)[0].trim()}) kapanış saatine (${block.closingTime}) 30 dakikadan az kalmış.`,
              suggestedFix: "Ziyareti en az 30-60 dakika öne alın.",
            });
          } else if (minutesBeforeClosing < 60) {
            issues.push({
              severity: "warning",
              day: dayNum,
              blockIndex: blockIdx,
              code: "LAST_ENTRY_VIOLATION",
              message: `${dayNum}. gün: "${block.name}" ziyaret başlangıcı kapanış saatine (${block.closingTime}) 60 dakikadan az kalmışken başlıyor.`,
              suggestedFix: "Ziyareti 30-60 dakika öne almayı düşünün.",
            });
          }
        }
      }

      // §11.1 Minimum visit duration
      if (typeof block.minVisitMinutes === "number" && block.minVisitMinutes > 0) {
        if (blockDuration < block.minVisitMinutes) {
          issues.push({
            severity: "warning",
            day: dayNum,
            blockIndex: blockIdx,
            code: "MIN_VISIT_DURATION",
            message: `${dayNum}. gün: "${block.name}" için planlanan süre (${blockDuration} dk) minimum önerilen sürenin (${block.minVisitMinutes} dk) altında.`,
            suggestedFix: `Bu yer için en az ${block.minVisitMinutes} dakika ayırın.`,
          });
        }
      }

      // §11.1 Closed days check
      if (dayOfWeek && Array.isArray(block.closedDays) && block.closedDays.length > 0) {
        if (block.closedDays.includes(dayOfWeek)) {
          issues.push({
            severity: "error",
            day: dayNum,
            blockIndex: blockIdx,
            code: "CLOSED_DAY",
            message: `${dayNum}. gün: "${block.name}" ${dayOfWeek} günü kapalıdır.`,
            suggestedFix: "Bu durağı açık olduğu bir güne taşıyın veya alternatif bir yer ekleyin.",
          });
        }
      }

      // §11.1 Geographic coherence (haversine > 20 km without transit)
      if (
        typeof block.lat === "number" &&
        typeof block.lng === "number" &&
        previousBlockWithCoords !== null &&
        typeof previousBlockWithCoords.lat === "number" &&
        typeof previousBlockWithCoords.lng === "number"
      ) {
        const distKm = haversineKm(
          previousBlockWithCoords.lat,
          previousBlockWithCoords.lng,
          block.lat,
          block.lng,
        );
        if (distKm > 20) {
          issues.push({
            severity: "warning",
            day: dayNum,
            blockIndex: blockIdx,
            code: "GEO_INCOHERENCE",
            message: `${dayNum}. gün: "${previousBlockWithCoords.name}" ile "${block.name}" arasındaki mesafe yaklaşık ${distKm.toFixed(1)} km — aynı gün için çok uzak olabilir.`,
            suggestedFix:
              "Bu iki durağı farklı günlere ayırın veya aralarına ulaşım bloğu ekleyin.",
          });
        }
      }

      // Update previous block with coords for next iteration
      if (typeof block.lat === "number" && typeof block.lng === "number") {
        previousBlockWithCoords = block;
      }
    }

    // §11.1 Daily walking budget check (> 15 km = 15,000 m)
    if (totalWalkingMeters > 15000) {
      issues.push({
        severity: "warning",
        day: dayNum,
        code: "WALKING_BUDGET",
        message: `${dayNum}. günde tahmini yürüyüş mesafesi ${(totalWalkingMeters / 1000).toFixed(1)} km (önerilen limit: 15 km).`,
        suggestedFix: "Bazı yürüyüş transferlerini metro veya taksi ile değiştirin.",
      });
    }

    // §11.1 Meal gap check (8+ hours without food)
    const mealGapIssues = checkMealGap(day, dayNum);
    issues.push(...mealGapIssues);

    // Daily duration check (> 8.5 hours = 510 minutes)
    if (dayTotalMinutes > 510) {
      issues.push({
        severity: "warning",
        day: dayNum,
        code: "EXCESSIVE_DURATION",
        message: `${dayNum}. günün toplam planlanan süresi ${(dayTotalMinutes / 60).toFixed(1)} saat. Maksimum önerilen günlük yük 8.5 saattir.`,
        suggestedFix: "Bir veya iki durağı sonraki güne kaydırarak gün temposunu hafifletin.",
      });
    }

    totalMinutesPlanned += dayTotalMinutes;
  }

  // Budget checks
  if (profile?.budget?.total && profile.budget.total > 0) {
    if (estimatedCostSum > profile.budget.total) {
      issues.push({
        severity: "error",
        code: "BUDGET_EXCEEDED",
        message: `Toplam tahmini maliyet (${estimatedCostSum} ${profile.budget.currency || "USD"}) kullanıcının belirlediği bütçeyi (${profile.budget.total} ${profile.budget.currency || "USD"}) aşıyor.`,
        suggestedFix: "Pahalı aktiviteleri veya restoranları ekonomik alternatiflerle değiştirin.",
      });
    }
  }

  let errorCount = 0;
  let warningCount = 0;
  for (const issue of issues) {
    if (issue.severity === "error") errorCount++;
    else warningCount++;
  }

  const score = Math.max(
    0.0,
    Math.min(1.0, Math.round((1.0 - errorCount * 0.25 - warningCount * 0.08) * 100) / 100),
  );
  const isValid = errorCount === 0;

  return {
    isValid,
    score,
    issues,
    totalPlannedHours: Math.round((totalMinutesPlanned / 60) * 10) / 10,
    estimatedCostTotal: estimatedCostSum,
  };
}
