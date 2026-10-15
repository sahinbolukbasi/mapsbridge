import { createHash, randomUUID } from "node:crypto";

export interface RawUserFeedback {
  userId?: string;
  userEmail?: string;
  userIp?: string;
  city: string;
  category: "cafe" | "food" | "lodging" | "parks_sports" | "transit" | "culture" | "route_overall";
  placeName?: string;
  action: "liked" | "disliked" | "kept_in_plan" | "removed_from_plan" | "completed_trip";
  rating?: number;
  timestamp?: number;
}

export interface AnonymousFeedbackSignal {
  signal_id: string;
  city: string;
  category: "cafe" | "food" | "lodging" | "parks_sports" | "transit" | "culture" | "route_overall";
  place_name?: string;
  action: "liked" | "disliked" | "kept_in_plan" | "removed_from_plan" | "completed_trip";
  rating?: number;
  coarse_week: string;
}

export function getCoarseWeek(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function anonymizeFeedbackSignal(raw: RawUserFeedback): AnonymousFeedbackSignal {
  // Enforce zero PII: userId, email, and IP are completely stripped
  const salt = "mapsbridge-global-learning-salt";
  const signal_id = createHash("sha256")
    .update(
      `${raw.city}:${raw.placeName || ""}:${raw.action}:${Date.now()}:${randomUUID()}:${salt}`,
    )
    .digest("hex")
    .slice(0, 32);

  const coarseDate = raw.timestamp ? new Date(raw.timestamp) : new Date();

  return {
    signal_id,
    city: raw.city.trim(),
    category: raw.category,
    ...(raw.placeName && raw.placeName.trim() ? { place_name: raw.placeName.trim() } : {}),
    action: raw.action,
    ...(typeof raw.rating === "number" && raw.rating >= 1 && raw.rating <= 5
      ? { rating: Math.round(raw.rating) }
      : {}),
    coarse_week: getCoarseWeek(coarseDate),
  };
}

export interface AggregatedCommunityTip {
  city: string;
  category: string;
  placeName: string;
  netScore: number;
  positiveCount: number;
  negativeCount: number;
  recommendationNote: string;
}

export function aggregateFeedbackSignals(
  signals: AnonymousFeedbackSignal[],
): AggregatedCommunityTip[] {
  const placeMap: Map<string, { city: string; category: string; pos: number; neg: number }> =
    new Map();

  for (const s of signals) {
    if (!s.place_name) continue;
    const key = `${s.city}:${s.place_name}`;
    const curr = placeMap.get(key) || { city: s.city, category: s.category, pos: 0, neg: 0 };

    if (
      s.action === "liked" ||
      s.action === "kept_in_plan" ||
      s.action === "completed_trip" ||
      (s.rating && s.rating >= 4)
    ) {
      curr.pos++;
    } else if (
      s.action === "disliked" ||
      s.action === "removed_from_plan" ||
      (s.rating && s.rating <= 2)
    ) {
      curr.neg++;
    }
    placeMap.set(key, curr);
  }

  const results: AggregatedCommunityTip[] = [];
  for (const [key, val] of placeMap.entries()) {
    const [, placeName] = key.split(":");
    const net = val.pos - val.neg;
    if (val.pos + val.neg > 0) {
      results.push({
        city: val.city,
        category: val.category,
        placeName,
        netScore: net,
        positiveCount: val.pos,
        negativeCount: val.neg,
        recommendationNote: `${val.city} gezginlerinin %${Math.round((val.pos / (val.pos + val.neg)) * 100)} kadarı bu mekanı planında korudu veya olumlu puanladı.`,
      });
    }
  }

  return results.sort((a, b) => b.netScore - a.netScore);
}

// ── Trip-level feedback signals (Faz B) ──────────────────────────────────────
// Collected at stop-level and post-trip. Stored anonymously, never PII.

export type TripStopFeedbackAction =
  | "kept" // stop stayed in the plan after user review
  | "removed" // user explicitly removed it
  | "completed" // user actually visited it
  | "skipped" // user skipped during trip
  | "liked" // explicit thumbs up
  | "disliked"; // explicit thumbs down

export interface TripStopFeedbackSignal {
  tripId: string; // anonymized trip ID
  destinationId: string; // "istanbul" | "barcelona" | "paris"
  stopName: string;
  category?: string;
  action: TripStopFeedbackAction;
  /** Day in the trip (1-indexed) — helps detect fatigue patterns */
  tripDay: number;
  coarseWeek: string;
}

export interface PostTripSummarySignal {
  tripId: string;
  destinationId: string;
  /** What the user said was the best part (free text, max 120 chars) */
  bestMoment?: string;
  overallSatisfaction?: 1 | 2 | 3 | 4 | 5;
  coarseWeek: string;
}

export function buildTripStopFeedbackSignal(
  raw: Omit<TripStopFeedbackSignal, "coarseWeek">,
): TripStopFeedbackSignal {
  return { ...raw, coarseWeek: getCoarseWeek() };
}

export function buildPostTripSignal(
  raw: Omit<PostTripSummarySignal, "coarseWeek"> & { bestMoment?: string },
): PostTripSummarySignal {
  return {
    ...raw,
    // Trim bestMoment to 120 chars to avoid storing verbose PII-leaking text
    bestMoment: raw.bestMoment?.trim().slice(0, 120),
    coarseWeek: getCoarseWeek(),
  };
}
