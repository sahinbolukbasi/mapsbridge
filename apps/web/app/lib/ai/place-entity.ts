/**
 * PlaceEntity — §8 Shared place data model
 *
 * Single canonical shape used by both chat (assistant message cards)
 * and map (pin popups). Eliminates the dual-shape problem where chat
 * and map maintained incompatible representations of the same place.
 */

// ---------------------------------------------------------------------------
// Core type
// ---------------------------------------------------------------------------

export interface PlaceEntity {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  category: string;

  // Opening info
  openingHours?: { day: string; open: string; close: string }[];
  /** §11.1 — minutes before closing when last entry is allowed */
  lastEntryMinutesBefore?: number;
  /** e.g. ["Monday"] */
  closedDays?: string[];
  typicalDurationMin: number;

  priceLevel?: 1 | 2 | 3 | 4;
  estimatedCostEur?: number;

  // Reservation
  reservationRequired: "none" | "recommended" | "required" | "far_advance";
  reservationUrl?: string;

  // Reviews
  rating?: number;
  reviewCount?: number;
  /** Synthesized, not raw text (copyright-safe) */
  reviewSummary?: string;

  // KB metadata
  sourceUrl?: string;
  fetchedAt?: string;
  ttlDays: number;
  /** 0-1 confidence from KB fetch */
  confidenceScore?: number;

  // Itinerary state — per-thread, not global
  status?: "suggested" | "accepted" | "rejected" | "removed";
  dayIndex?: number;
  pinned?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the cached data for this entity is stale.
 * A missing fetchedAt is always considered stale.
 */
export function isPlaceStale(entity: PlaceEntity): boolean {
  if (!entity.fetchedAt) return true;
  const fetchedMs = new Date(entity.fetchedAt).getTime();
  if (isNaN(fetchedMs)) return true;
  const ttlMs = entity.ttlDays * 24 * 60 * 60 * 1000;
  return Date.now() > fetchedMs + ttlMs;
}

/**
 * Produces a compact single-line text snippet suitable for insertion
 * into an AI system prompt. Never contains raw review text.
 */
export function placeEntityToPromptSnippet(entity: PlaceEntity): string {
  const parts: string[] = [`${entity.name} (${entity.category})`];

  if (entity.typicalDurationMin) {
    parts.push(`~${entity.typicalDurationMin}dk`);
  }
  if (entity.estimatedCostEur != null) {
    parts.push(`~€${entity.estimatedCostEur}`);
  }
  if (entity.reservationRequired !== "none") {
    parts.push(`rezervasyon: ${entity.reservationRequired}`);
  }
  if (entity.rating != null) {
    parts.push(`★${entity.rating.toFixed(1)}`);
  }
  if (entity.closedDays && entity.closedDays.length > 0) {
    parts.push(`kapalı: ${entity.closedDays.join(", ")}`);
  }
  if (entity.lastEntryMinutesBefore != null) {
    parts.push(`son giriş kapanmadan ${entity.lastEntryMinutesBefore}dk önce`);
  }
  if (entity.status && entity.status !== "suggested") {
    parts.push(`durum: ${entity.status}`);
  }

  return parts.join(" | ");
}

/**
 * Creates a fully-formed PlaceEntity from a minimal set of required fields,
 * filling in sensible defaults for everything else.
 */
export function buildMinimalPlaceEntity(
  partial: Partial<PlaceEntity> & {
    id: string;
    name: string;
    lat: number;
    lng: number;
    category: string;
  },
): PlaceEntity {
  return {
    typicalDurationMin: 60,
    reservationRequired: "none",
    ttlDays: 30,
    ...partial,
  };
}
