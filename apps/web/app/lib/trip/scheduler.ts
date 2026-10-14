import type { Trip, TripDay, TripStop, TempoPreference } from "./domain";

/**
 * Deterministic stop ordering and time assignment.
 * The model never decides order; this module does, based on:
 * - Opening hours (avoid arriving before open or after last entry)
 * - Travel time between stops (travelFromPrevious.minutes)
 * - Visit duration (p50 or p90 based on tempo)
 * - Day start time by tempo
 * - Meal break slots
 *
 * Faz A: simplified version using linear scheduling.
 * Faz B: will integrate MOTIS/Valhalla travel matrix.
 */

interface ScheduleOptions {
  tempo: TempoPreference;
  /** Day start time in minutes from midnight. Default by tempo. */
  dayStartMinutes?: number;
}

const DAY_START_BY_TEMPO: Record<TempoPreference, number> = {
  relaxed: 9 * 60,    // 09:00
  moderate: 9 * 60,   // 09:00
  fast: 8 * 60,       // 08:00
};

const MEAL_BREAK_MINUTES = 60;
const TRANSFER_BUFFER_MINUTES = 10; // minimum extra buffer between stops

/**
 * Assign startTime to every stop in a day.
 * Returns a new TripDay with startTime fields populated.
 */
export function scheduleDay(day: TripDay, opts: ScheduleOptions): TripDay {
  const startMinutes = opts.dayStartMinutes ?? DAY_START_BY_TEMPO[opts.tempo];
  let cursor = startMinutes;

  const stops: TripStop[] = [];

  for (let i = 0; i < day.stops.length; i++) {
    const stop = day.stops[i];

    // Travel time from previous stop
    const travel = stop.travelFromPrevious?.minutes ?? 0;
    const buffer = i > 0 ? TRANSFER_BUFFER_MINUTES : 0;
    cursor += travel + buffer;

    // Respect opening hours: push cursor if arriving before open
    if (stop.openingHours) {
      // Simplified: no opening time in Faz A data — skip constraint
    }

    const assignedStart = minutesToTime(cursor);

    // Visit duration
    const duration = opts.tempo === "relaxed"
      ? (stop.duration.p90Minutes ?? stop.duration.p50Minutes)
      : stop.duration.p50Minutes;

    stops.push({ ...stop, order: i, startTime: assignedStart });
    cursor += duration;

    // Insert lunch break if crossing noon on stops 2-4 range
    if (cursor >= 12 * 60 && cursor < 13 * 60 && i < day.stops.length - 1) {
      cursor += MEAL_BREAK_MINUTES;
    }
  }

  const totalDurationMinutes = cursor - startMinutes;

  return { ...day, stops, totalDurationMinutes };
}

/** Schedule all days of a trip. */
export function scheduleTrip(trip: Trip): Trip {
  const days = trip.days.map(d => scheduleDay(d, { tempo: trip.tempo }));

  // Compute geo bounding box per day (placeholder — real impl needs haversine)
  const daysWithGeo = days.map(d => ({
    ...d,
    geoBoundingBoxKm: estimateGeoBoundingBox(d.stops),
  }));

  return { ...trip, days: daysWithGeo };
}

/** Warn when a day is too dense for the chosen tempo. Returns stop IDs to cut. */
export function suggestCuts(day: TripDay, tempo: TempoPreference): string[] {
  const maxStops: Record<TempoPreference, number> = {
    relaxed: 4,
    moderate: 6,
    fast: 8,
  };
  const max = maxStops[tempo];
  if (day.stops.length <= max) return [];
  // Return the last N stops as candidates (tail of the day)
  return day.stops.slice(max).map(s => s.id);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Rough estimate: sqrt of sum of squared lat/lng differences × 111km/deg */
function estimateGeoBoundingBox(stops: TripStop[]): number {
  if (stops.length < 2) return 0;
  const lats = stops.map(s => s.placeRef.lat);
  const lngs = stops.map(s => s.placeRef.lng);
  const dLat = (Math.max(...lats) - Math.min(...lats)) * 111;
  const dLng = (Math.max(...lngs) - Math.min(...lngs)) * 85; // ~85km/deg at mid-latitudes
  return Math.sqrt(dLat ** 2 + dLng ** 2);
}
