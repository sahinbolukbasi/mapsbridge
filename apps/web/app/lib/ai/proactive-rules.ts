/**
 * Proactive rule engine — deterministic triggers (Bölüm 4.3).
 * Every alert is rule-based with a logged reason, never model-inferred.
 * Called after plan generation; results injected into system prompt as `proactiveAlerts`.
 */

import type { Trip, TripStop, TempoPreference } from "../trip/domain";
import type { DestinationBrief } from "../destination/types";

export type AlertSeverity = "error" | "warning" | "info";

export type AlertCode =
  | "PLAN_OVERLOADED"
  | "GEO_INCOHERENT"
  | "CLOSED_DAY_CONFLICT"
  | "LAST_ENTRY_RISK"
  | "RESERVATION_REQUIRED"
  | "BUDGET_EXCEEDED"
  | "FATIGUE_CURVE_VIOLATION"
  | "PEAK_HOUR_CONFLICT"
  | "SEASONAL_CLOSURE";

export interface ProactiveAlert {
  code: AlertCode;
  severity: AlertSeverity;
  /** Human-readable message injected into system prompt (Turkish). */
  message: string;
  /** Which stop or day triggered this — for model to reference. */
  context?: { day?: number; stopId?: string; stopName?: string };
  triggeredBy: string; // rule name for audit log
}

interface RuleInput {
  trip: Trip;
  brief?: DestinationBrief | null;
  /** User's travel date (ISO date string), if known */
  travelDate?: string;
  /** Estimated total budget spent so far in EUR equivalent */
  estimatedSpend?: number;
}

/** Run all proactive rules and return alerts sorted by severity. */
export function checkProactiveAlerts(input: RuleInput): ProactiveAlert[] {
  const alerts: ProactiveAlert[] = [];

  alerts.push(...ruleOverload(input.trip));
  alerts.push(...ruleGeoCohérence(input.trip));

  if (input.brief) {
    alerts.push(...ruleClosedDayConflicts(input.trip, input.brief, input.travelDate));
    alerts.push(...ruleReservationRequired(input.trip, input.brief));
    alerts.push(...ruleSeasonalClosure(input.trip, input.brief, input.travelDate));
  }

  alerts.push(...ruleFatigueCurve(input.trip));

  return alerts.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity));
}

// ── Rules ─────────────────────────────────────────────────────────────────────

function ruleOverload(trip: Trip): ProactiveAlert[] {
  const maxByTempo: Record<TempoPreference, number> = {
    relaxed: 4,
    moderate: 6,
    fast: 8,
  };
  const max = maxByTempo[trip.tempo];
  const alerts: ProactiveAlert[] = [];

  for (const day of trip.days) {
    if (day.stops.length > max) {
      alerts.push({
        code: "PLAN_OVERLOADED",
        severity: "warning",
        message: `${day.day}. gün ${day.stops.length} durak var — ${trip.tempo} tempo için en fazla ${max} durak önerilir. En az ${day.stops.length - max} durağı çıkar veya farklı bir güne taşı.`,
        context: { day: day.day },
        triggeredBy: "ruleOverload",
      });
    }
  }
  return alerts;
}

function ruleGeoCohérence(trip: Trip): ProactiveAlert[] {
  const alerts: ProactiveAlert[] = [];
  for (const day of trip.days) {
    const spread = day.geoBoundingBoxKm ?? estimateSpread(day.stops);
    if (spread > 12) {
      alerts.push({
        code: "GEO_INCOHERENT",
        severity: "warning",
        message: `${day.day}. günde duraklar arasındaki mesafe ~${Math.round(spread)} km — bu gün çok fazla seyahat gerektirir. Duraklardan birini başka bir güne taşımayı düşün.`,
        context: { day: day.day },
        triggeredBy: "ruleGeoCohérence",
      });
    }
  }
  return alerts;
}

function ruleClosedDayConflicts(
  trip: Trip,
  brief: DestinationBrief,
  travelDate?: string,
): ProactiveAlert[] {
  const alerts: ProactiveAlert[] = [];
  const timingRules = brief.timingRules?.value ?? [];

  for (const day of trip.days) {
    // Derive day-of-week if we know the start date
    const dayName = getDayName(travelDate, day.day);

    for (const stop of day.stops) {
      // Check stop opening hours from stop data
      if (stop.openingHours?.closedDays?.length) {
        const closedDays = stop.openingHours.closedDays;
        if (dayName && closedDays.some((cd) => cd.toLowerCase() === dayName.toLowerCase())) {
          alerts.push({
            code: "CLOSED_DAY_CONFLICT",
            severity: "error",
            message: `${stop.placeRef.name} — ${day.day}. günde kapalı (kapalı gün: ${closedDays.join(", ")}). Bu durağı başka bir güne taşı ya da çıkar.`,
            context: { day: day.day, stopId: stop.id, stopName: stop.placeRef.name },
            triggeredBy: "ruleClosedDayConflicts:stopHours",
          });
        }
      }

      // Cross-reference with destination brief timing rules
      for (const rule of timingRules) {
        if (
          rule.type === "closed_day" &&
          rule.severity === "blocks_visit" &&
          stop.placeRef.name.toLowerCase().includes(rule.subject.toLowerCase().slice(0, 8))
        ) {
          alerts.push({
            code: "CLOSED_DAY_CONFLICT",
            severity: "error",
            message: `${stop.placeRef.name} için uyarı: ${rule.rule}`,
            context: { day: day.day, stopId: stop.id, stopName: stop.placeRef.name },
            triggeredBy: "ruleClosedDayConflicts:brief",
          });
        }
      }
    }
  }
  return alerts;
}

function ruleReservationRequired(trip: Trip, brief: DestinationBrief): ProactiveAlert[] {
  const alerts: ProactiveAlert[] = [];
  const highDemand = brief.reservationNorms?.value?.highDemandVenues ?? [];

  for (const day of trip.days) {
    for (const stop of day.stops) {
      const match = highDemand.find((v) =>
        stop.placeRef.name.toLowerCase().includes(v.name.toLowerCase().slice(0, 10)),
      );
      if (match) {
        alerts.push({
          code: "RESERVATION_REQUIRED",
          severity: "warning",
          message: `${stop.placeRef.name} için rezervasyon gerekiyor — en az ${match.leadTimeDays} gün önceden yap. ${match.method}`,
          context: { day: day.day, stopId: stop.id, stopName: stop.placeRef.name },
          triggeredBy: "ruleReservationRequired",
        });
      }

      if (stop.bookingRequired && !stop.reservationUrl) {
        alerts.push({
          code: "RESERVATION_REQUIRED",
          severity: "warning",
          message: `${stop.placeRef.name} için önceden rezervasyon gerektiği belirtildi ancak link yok — gitmeden önce kontrol et.`,
          context: { day: day.day, stopId: stop.id, stopName: stop.placeRef.name },
          triggeredBy: "ruleReservationRequired:noUrl",
        });
      }
    }
  }
  return alerts;
}

function ruleSeasonalClosure(
  trip: Trip,
  brief: DestinationBrief,
  travelDate?: string,
): ProactiveAlert[] {
  if (!travelDate) return [];
  const alerts: ProactiveAlert[] = [];
  const month = new Date(travelDate).getMonth() + 1;
  const seasonNote = brief.seasonality?.value?.byMonth?.[String(month)];

  if (seasonNote && (seasonNote.includes("kapalı") || seasonNote.includes("tatil"))) {
    alerts.push({
      code: "SEASONAL_CLOSURE",
      severity: "info",
      message: `${brief.name} — ${month}. ay notu: ${seasonNote}`,
      triggeredBy: "ruleSeasonalClosure",
    });
  }
  return alerts;
}

/** Uçuş günü hafif, ayrılış günü esnek, art arda 2 ağır gün koyma */
function ruleFatigueCurve(trip: Trip): ProactiveAlert[] {
  const alerts: ProactiveAlert[] = [];
  const days = trip.days;
  const last = days.length;

  // Ayrılış günü çok dolu?
  const lastDay = days.find((d) => d.day === last);
  if (lastDay && lastDay.stops.length > 3) {
    alerts.push({
      code: "FATIGUE_CURVE_VIOLATION",
      severity: "info",
      message: `Son gün (${last}. gün) ${lastDay.stops.length} durağa sahip — ayrılış günleri genelde esnek tutulur. Bir durağı önceki güne taşımayı düşün.`,
      context: { day: last },
      triggeredBy: "ruleFatigueCurve:lastDay",
    });
  }

  // Arka arkaya iki ağır gün?
  for (let i = 0; i < days.length - 1; i++) {
    const a = days[i];
    const b = days[i + 1];
    const heavyA = a.stops.length >= 5;
    const heavyB = b.stops.length >= 5;
    if (heavyA && heavyB) {
      alerts.push({
        code: "FATIGUE_CURVE_VIOLATION",
        severity: "info",
        message: `${a.day}. ve ${b.day}. günler arka arkaya yoğun. Bunlardan biri daha hafif olmalı.`,
        context: { day: a.day },
        triggeredBy: "ruleFatigueCurve:consecutiveHeavy",
      });
      break; // one alert is enough
    }
  }

  return alerts;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function severityOrder(s: AlertSeverity): number {
  return s === "error" ? 0 : s === "warning" ? 1 : 2;
}

function estimateSpread(stops: TripStop[]): number {
  if (stops.length < 2) return 0;
  const lats = stops.map((s) => s.placeRef.lat);
  const lngs = stops.map((s) => s.placeRef.lng);
  const dLat = (Math.max(...lats) - Math.min(...lats)) * 111;
  const dLng = (Math.max(...lngs) - Math.min(...lngs)) * 85;
  return Math.sqrt(dLat ** 2 + dLng ** 2);
}

const TR_DAY_NAMES: Record<number, string> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

function getDayName(travelDate: string | undefined, tripDay: number): string | null {
  if (!travelDate) return null;
  const start = new Date(travelDate);
  start.setDate(start.getDate() + tripDay - 1);
  return TR_DAY_NAMES[start.getDay()] ?? null;
}

/** Format alerts as a compact string for system prompt injection. */
export function formatAlertsForPrompt(alerts: ProactiveAlert[]): string {
  if (alerts.length === 0) return "";
  const lines = alerts.map((a) => {
    const icon = a.severity === "error" ? "⛔" : a.severity === "warning" ? "⚠️" : "ℹ️";
    return `${icon} ${a.message}`;
  });
  return `\nPROAKTİF UYARILAR (sohbete doğal olarak ekle):\n${lines.join("\n")}`;
}
