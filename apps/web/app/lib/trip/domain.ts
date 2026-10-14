/**
 * Trip domain model — the single source of truth for a trip.
 * The AI chat mutates this object via TripMutation; the UI renders it.
 * No model prose is stored here; only tool-sourced, provenance-tracked data.
 *
 * Lives alongside the legacy Pin/WorkspaceStore model behind NEXT_PUBLIC_NEW_TRIP_ENGINE flag.
 */

export type TripStatus = "draft" | "ready" | "in_progress" | "completed";
export type TravelMode = "walking" | "transit" | "driving" | "cycling" | "ferry";
export type Confidence = "high" | "medium" | "low" | "unverified";
export type TempoPreference = "relaxed" | "moderate" | "fast";

// ── Place reference ────────────────────────────────────────────────────────────

/** Every stop must come from a tool result. Bare IDs are not allowed. */
export interface PlaceRef {
  id: string;          // "overture:place/abc" | "fsq:abc" | "google:ChIJ..." — prefix required
  source: "overture" | "foursquare" | "google_places" | "manual";
  name: string;
  lat: number;
  lng: number;
  confidence: Confidence;
  retrievedAt: string; // ISO 8601
}

// ── Stop ──────────────────────────────────────────────────────────────────────

export interface StopDuration {
  p50Minutes: number;   // typical visitor
  p90Minutes?: number;  // slow visitor / queue included
  source: "category_default" | "poi_specific" | "user_feedback";
}

export interface TripStop {
  id: string;          // nanoid, immutable
  placeRef: PlaceRef;
  day: number;         // 1-indexed
  order: number;       // within-day order, set by scheduler
  startTime?: string;  // "HH:MM" — set by scheduler
  duration: StopDuration;
  travelFromPrevious?: {
    mode: TravelMode;
    minutes: number;
    distanceKm?: number;
    source: "gtfs" | "valhalla" | "motis" | "google_routes" | "estimate";
  };
  /** Personalized one-liner. Model-generated; not a tool result, not in plan data. */
  why: string;
  category?: string;   // overture taxonomy.primary
  openingHours?: {
    closedDays: string[];  // ["monday"]
    lastEntry?: string;    // "HH:MM" — differs from closing time
    peakHours?: string[];  // ["10:00-12:00", "14:00-16:00"]
    source: string;
    retrievedAt: string;
  };
  bookingRequired?: boolean;
  leadTimeDays?: number;
  reservationUrl?: string;
  affiliateOfferIds?: string[];
  confidence: Confidence;
}

// ── Day ───────────────────────────────────────────────────────────────────────

export interface TripDay {
  day: number;
  date?: string;              // ISO date — set if user gave dates
  theme?: string;             // "Antik Merkez", set by scheduler or AI
  stops: TripStop[];
  totalDurationMinutes?: number;
  totalDistanceKm?: number;
  /** Geo spread of all stops in km. Exceeding ~8km/day triggers a coherence warning. */
  geoBoundingBoxKm?: number;
}

// ── Budget & Booking ──────────────────────────────────────────────────────────

export interface TripBudgetDef {
  level: "budget" | "mid" | "luxury" | "unspecified";
  currency?: string;
  totalEstimate?: number;
  byCategory?: Record<string, number>;
}

export interface TripBooking {
  id: string;
  type: "flight" | "accommodation" | "activity" | "car_rental" | "esim" | "insurance";
  name: string;
  affiliateLink: string;
  priceAmount?: number;
  priceCurrency?: string;
  retrievedAt: string;
  expiresAt?: string;
  isBookable: boolean;     // false when price is expired or indicative-only
  source: string;
  attribution?: string;   // displayed to user, required for affiliate transparency
}

// ── Conversation state (drives assistant behaviour) ──────────────────────────

export type TripPhase =
  | "orient"      // destination known, constraints unknown
  | "constrain"   // dates/travelers/tempo clarifying
  | "draft"       // first plan produced
  | "refine"      // edit loop
  | "prepare"     // pre-trip checklist
  | "in_trip"     // user is travelling
  | "post_trip";  // feedback collection

export interface TripConversationState {
  phase: TripPhase;
  /** Max 3 before first plan. Decremented on each question. */
  questionBudgetRemaining: number;
  /** Surfaced assumptions the user can override: "Sakin tempo varsaydım" */
  visibleAssumptions: string[];
  lastUserMessageAt: string; // ISO 8601
}

// ── Trip root ─────────────────────────────────────────────────────────────────

export interface TripDestination {
  name: string;
  countryCode: string; // ISO 3166-1 alpha-2
  lat: number;
  lng: number;
}

export interface TripDates {
  start: string;   // ISO date
  end: string;     // ISO date
  flexible: boolean;
}

export interface TripTravelers {
  adults: number;
  children?: number;
  pets?: boolean;
}

export interface Trip {
  id: string;
  userId: string;
  status: TripStatus;
  destination: TripDestination;
  dates?: TripDates;
  duration: { days: number };
  travelers: TripTravelers;
  tempo: TempoPreference;
  budget: TripBudgetDef;
  interests: string[];
  constraints?: string[];   // "wheelchair" | "stroller" | "no_stairs" | "no_crowds"
  days: TripDay[];
  bookings: TripBooking[];
  conversationState: TripConversationState;
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;         // optimistic locking — increment on every mutation
    schemaVersion: "1.0";
    destinationBriefId?: string; // link to DestinationBrief used
  };
}

// ── Mutation set ──────────────────────────────────────────────────────────────
// The only way to change a Trip. Every mutation is logged with a source.

export type TripMutation =
  | { type: "addStop";       payload: { placeRef: PlaceRef; day: number; insertAfter?: string } }
  | { type: "removeStop";    payload: { stopId: string } }
  | { type: "moveStop";      payload: { stopId: string; toDay: number; toOrder: number } }
  | { type: "replaceStop";   payload: { stopId: string; newPlaceRef: PlaceRef } }
  | { type: "setDates";      payload: TripDates }
  | { type: "setTempo";      payload: { tempo: TempoPreference } }
  | { type: "setTheme";      payload: { day: number; theme: string } }
  | { type: "attachBooking"; payload: { booking: TripBooking } }
  | { type: "removeBooking"; payload: { bookingId: string } }
  | { type: "advancePhase";  payload: { to: TripPhase; assumption?: string } };

export interface TripMutationEvent {
  tripId: string;
  mutation: TripMutation;
  source: "user_direct" | "assistant_tool" | "scheduler_reorder";
  at: string; // ISO 8601
}

// ── Validation helpers ────────────────────────────────────────────────────────

export function isValidPlaceRef(v: unknown): v is PlaceRef {
  if (!v || typeof v !== "object") return false;
  const p = v as PlaceRef;
  return (
    typeof p.id === "string" && /^(overture|fsq|google|manual):/.test(p.id) &&
    typeof p.name === "string" && p.name.trim().length > 0 &&
    Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 &&
    Number.isFinite(p.lng) && Math.abs(p.lng) <= 180 &&
    typeof p.retrievedAt === "string"
  );
}

export function countSourcelessStops(trip: Trip): number {
  return trip.days
    .flatMap(d => d.stops)
    .filter(s => !isValidPlaceRef(s.placeRef))
    .length;
}
