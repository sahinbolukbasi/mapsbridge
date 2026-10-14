import type { Trip, TripPhase } from "./domain";

/**
 * Deterministic phase transition rules.
 * The assistant reads current phase to decide behaviour (Bölüm 8).
 * Transitions are logged; they are never inferred silently by the model.
 */

interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

const VALID_TRANSITIONS: Record<TripPhase, TripPhase[]> = {
  orient:     ["constrain", "draft"],   // shortcut to draft if enough info
  constrain:  ["draft"],
  draft:      ["refine", "prepare"],
  refine:     ["draft", "prepare"],    // re-draft allowed after major edits
  prepare:    ["in_trip"],
  in_trip:    ["post_trip"],
  post_trip:  [],
};

export function canTransition(from: TripPhase, to: TripPhase): TransitionResult {
  const allowed = VALID_TRANSITIONS[from]?.includes(to) ?? false;
  return allowed
    ? { allowed: true }
    : { allowed: false, reason: `${from} → ${to} is not a valid transition` };
}

/** How many questions the assistant may ask before producing the first plan. */
export function questionBudgetForPhase(phase: TripPhase): number {
  if (phase === "orient" || phase === "constrain") return 3;
  return 0;
}

/**
 * Derive the next phase automatically based on trip state.
 * Called after mutations to suggest (not force) transitions.
 */
export function suggestNextPhase(trip: Trip): TripPhase | null {
  const { phase } = trip.conversationState;

  if (phase === "orient" && trip.duration.days > 0) return "constrain";
  if (phase === "constrain" && trip.days.length > 0 && totalStops(trip) >= 2) return "draft";
  if (phase === "draft" && totalStops(trip) > 0 && trip.dates) return "refine";
  return null;
}

/** Proactive trigger: plan is too dense for the chosen tempo */
export function isPlanOverloaded(trip: Trip): boolean {
  const maxByTempo: Record<string, number> = {
    relaxed: 4,
    moderate: 6,
    fast: 8,
  };
  const max = maxByTempo[trip.tempo] ?? 6;
  return trip.days.some(d => d.stops.length > max);
}

/** Proactive trigger: geo spread too wide for a single day */
export function hasDayGeographyIssue(trip: Trip): boolean {
  return trip.days.some(d => (d.geoBoundingBoxKm ?? 0) > 10);
}

// ── Private ───────────────────────────────────────────────────────────────────

function totalStops(trip: Trip): number {
  return trip.days.reduce((n, d) => n + d.stops.length, 0);
}
