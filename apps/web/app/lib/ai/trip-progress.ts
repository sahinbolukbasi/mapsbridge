/**
 * Trip Progress — §11.11
 *
 * Activates when the trip start date is today or in the past.
 * Generates time-sensitive alerts (last entry, checkout, reservation
 * reminders) and can auto-rebuild a day's schedule after a disruption.
 */

import type { TripState } from "./trip-state";
import type { StructuredTripPlan, DayBlock } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TripProgressContext {
  currentLocation?: { lat: number; lng: number };
  /** ISO timestamp of current moment */
  currentTime: string;
  /** 1-indexed day of trip */
  currentDayIndex: number;
  weatherNote?: string;
  completedPlaceIds: Set<string>;
  /** Minutes of transport delay to account for */
  delayMinutes?: number;
}

export interface ProgressAlert {
  type:
    | "reservation_reminder"
    | "last_entry_warning"
    | "checkout_reminder"
    | "transport_last_run"
    | "disruption";
  placeId?: string;
  message: string;
  /** Minutes until deadline */
  urgencyMinutes: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Parse "HH:MM" → minutes since midnight. Returns NaN on failure. */
function hmToMinutes(hm: string): number {
  const parts = hm.trim().split(":");
  if (parts.length < 2) return NaN;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return NaN;
  return h * 60 + m;
}

/**
 * Parse a block time string ("09:00-10:30") and return start/end in minutes.
 * Returns null when the format is unrecognised.
 */
function parseBlockTime(timeStr: string): { start: number; end: number } | null {
  const match = timeStr.trim().match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/);
  if (!match) return null;
  const start = hmToMinutes(match[1]);
  const end = hmToMinutes(match[2]);
  if (isNaN(start) || isNaN(end)) return null;
  return { start, end };
}

/** Minutes since midnight from an ISO timestamp string. */
function isoToMinutesSinceMidnight(iso: string): number {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return NaN;
  return d.getHours() * 60 + d.getMinutes();
}

function nowISO(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// isTripInProgress
// ---------------------------------------------------------------------------

/**
 * Returns true when the trip's start date is today or in the past.
 * Uses `now` if provided, otherwise the current wall clock.
 */
export function isTripInProgress(tripState: TripState, now?: Date): boolean {
  const startStr = tripState.dates?.start;
  if (!startStr) return false;

  const startDate = new Date(startStr);
  if (isNaN(startDate.getTime())) return false;

  // Normalise to start-of-day UTC for comparison
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

  const reference = now ?? new Date();
  const referenceDay = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());

  return referenceDay >= startDay;
}

// ---------------------------------------------------------------------------
// computeProgressAlerts
// ---------------------------------------------------------------------------

/**
 * Inspects the plan for time-sensitive events that need to surface as alerts.
 *
 * Checks (in order of priority):
 *  - Hotel checkout reminder (60 min before noon)
 *  - Last transit run of the day (approaching last transit block)
 *  - Museum / activity last-entry (60 min before block end for museums)
 *  - Restaurant reservation reminder (120 min before dinner block)
 *  - Disruption alert when delayMinutes > 0
 */
export function computeProgressAlerts(
  plan: StructuredTripPlan,
  ctx: TripProgressContext,
): ProgressAlert[] {
  const alerts: ProgressAlert[] = [];
  const createdAt = nowISO();

  // Find the day that matches ctx.currentDayIndex (1-indexed)
  const dayPlan = plan.days[ctx.currentDayIndex - 1];
  if (!dayPlan) return alerts;

  const currentMinutes = isoToMinutesSinceMidnight(ctx.currentTime);
  if (isNaN(currentMinutes)) return alerts;

  // Disruption alert
  if (ctx.delayMinutes && ctx.delayMinutes > 0) {
    alerts.push({
      type: "disruption",
      message: `Ulaşımda ${ctx.delayMinutes} dakikalık gecikme tespit edildi. Günün geri kalanı yeniden planlanıyor.`,
      urgencyMinutes: 0,
      createdAt,
    });
  }

  for (const block of dayPlan.blocks) {
    // Skip completed blocks
    if (ctx.completedPlaceIds.has(block.place_id)) continue;

    const parsed = parseBlockTime(block.time);
    if (!parsed) continue;

    const minutesUntilStart = parsed.start - currentMinutes;
    const minutesUntilEnd = parsed.end - currentMinutes;

    // Already past this block
    if (minutesUntilEnd < 0) continue;

    // Hotel checkout: warn 60 min before noon (12:00 = 720)
    if (block.type === "hotel") {
      const checkoutMinutes = 12 * 60; // noon default
      const untilCheckout = checkoutMinutes - currentMinutes;
      if (untilCheckout > 0 && untilCheckout <= 90) {
        alerts.push({
          type: "checkout_reminder",
          placeId: block.place_id,
          message: `${block.name} için çıkış saati yaklaşıyor. Saat 12:00'ye ${Math.round(untilCheckout)} dakika kaldı.`,
          urgencyMinutes: Math.round(untilCheckout),
          createdAt,
        });
      }
    }

    // Last-entry warning for museums/activities: 60 min before block end
    if (block.type === "museum" || block.type === "activity") {
      if (minutesUntilEnd > 0 && minutesUntilEnd <= 60) {
        alerts.push({
          type: "last_entry_warning",
          placeId: block.place_id,
          message: `${block.name} için son giriş saatine ${Math.round(minutesUntilEnd)} dakika kaldı.`,
          urgencyMinutes: Math.round(minutesUntilEnd),
          createdAt,
        });
      }
    }

    // Reservation reminder for restaurants: 120 min before start
    if (block.type === "restaurant") {
      if (minutesUntilStart > 0 && minutesUntilStart <= 120) {
        alerts.push({
          type: "reservation_reminder",
          placeId: block.place_id,
          message: `${block.name} için rezervasyon saatinize ${Math.round(minutesUntilStart)} dakika kaldı.`,
          urgencyMinutes: Math.round(minutesUntilStart),
          createdAt,
        });
      }
    }

    // Transport last-run: transit block starting within 20 min
    if (block.type === "transit") {
      if (minutesUntilStart > 0 && minutesUntilStart <= 20) {
        alerts.push({
          type: "transport_last_run",
          placeId: block.place_id,
          message: `${block.name} — son sefer veya transfer ${Math.round(minutesUntilStart)} dakika içinde.`,
          urgencyMinutes: Math.round(minutesUntilStart),
          createdAt,
        });
      }
    }
  }

  // Sort by urgency ascending
  alerts.sort((a, b) => a.urgencyMinutes - b.urgencyMinutes);

  return alerts;
}

// ---------------------------------------------------------------------------
// rebuildDayAfterDisruption  §11.11.3
// ---------------------------------------------------------------------------

/**
 * Rebuilds remaining day blocks after a delay by:
 *  1. Removing completed blocks
 *  2. Shifting all remaining block start/end times forward by disruptionMinutes
 *  3. Dropping blocks that would now exceed 22:00 end time
 */
export function rebuildDayAfterDisruption(
  day: DayBlock[],
  disruptionMinutes: number,
  completedIds: Set<string>,
): DayBlock[] {
  const LATEST_END = 22 * 60; // 22:00

  const remaining = day.filter((b) => !completedIds.has(b.place_id));

  return remaining
    .map((block): DayBlock | null => {
      const parsed = parseBlockTime(block.time);
      if (!parsed) return block; // can't shift, keep as-is

      const newStart = parsed.start + disruptionMinutes;
      const newEnd = parsed.end + disruptionMinutes;

      if (newEnd > LATEST_END) return null; // drop block — too late

      const fmtHour = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      };

      return {
        ...block,
        time: `${fmtHour(newStart)}-${fmtHour(newEnd)}`,
      };
    })
    .filter((b): b is DayBlock => b !== null);
}

// ---------------------------------------------------------------------------
// buildProgressPromptSnippet
// ---------------------------------------------------------------------------

/**
 * Builds a short system-prompt injection describing the current trip
 * progress state and any active alerts.
 */
export function buildProgressPromptSnippet(
  ctx: TripProgressContext,
  alerts: ProgressAlert[],
): string {
  const lines: string[] = ["=== TRIP IN PROGRESS ==="];

  lines.push(`Şu an: ${ctx.currentTime} (Gün ${ctx.currentDayIndex})`);

  if (ctx.weatherNote) {
    lines.push(`Hava: ${ctx.weatherNote}`);
  }

  if (ctx.currentLocation) {
    lines.push(
      `Konum: ${ctx.currentLocation.lat.toFixed(4)}, ${ctx.currentLocation.lng.toFixed(4)}`,
    );
  }

  if (ctx.completedPlaceIds.size > 0) {
    lines.push(`Tamamlanan duraklar: ${ctx.completedPlaceIds.size}`);
  }

  if (ctx.delayMinutes && ctx.delayMinutes > 0) {
    lines.push(`Gecikme: +${ctx.delayMinutes} dakika`);
  }

  if (alerts.length > 0) {
    lines.push("Aktif uyarılar:");
    for (const alert of alerts) {
      lines.push(`  [${alert.type.toUpperCase()}] ${alert.message}`);
    }
  }

  lines.push("=== END TRIP IN PROGRESS ===");
  return lines.join("\n");
}
