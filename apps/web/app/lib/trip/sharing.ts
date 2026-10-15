/**
 * Trip plan sharing — public snapshot model.
 *
 * INVARIANTS:
 *  - `buildShareableTrip()` strips all PII before returning.
 *  - `shareToken` is a deterministic content hash (not userId-derived).
 *  - Comments are flat (no nested threading); max 280 chars each.
 *  - A shared trip snapshot is immutable — edits create a new version.
 */

import { createHash } from "node:crypto";
import type { Trip, TripDay, TripStop } from "../trip/domain";

// ── Shareable snapshot ────────────────────────────────────────────────────────

export interface ShareableStop {
  id: string;
  name: string;
  category?: string;
  day: number;
  order: number;
  lat: number;
  lng: number;
  notes?: string;
}

export interface ShareableDay {
  day: number;
  theme?: string;
  stops: ShareableStop[];
}

export interface ShareableTrip {
  shareToken: string; // content-hash, stable for same trip content
  title: string;
  destination: string;
  durationDays: number;
  days: ShareableDay[];
  sharedAt: string; // ISO-8601
  /** Semantic version — bumped when content changes */
  version: number;
}

/** Strips PII and builds a public snapshot of a Trip. */
export function buildShareableTrip(trip: Trip): ShareableTrip {
  const days: ShareableDay[] = trip.days.map((d: TripDay) => ({
    day: d.day,
    ...(d.theme ? { theme: d.theme } : {}),
    stops: d.stops.map((s: TripStop, i: number) => ({
      id: s.id,
      name: s.placeRef.name,
      ...(s.category ? { category: s.category } : {}),
      day: d.day,
      order: i,
      lat: s.placeRef.lat,
      lng: s.placeRef.lng,
      ...(s.why ? { notes: s.why.slice(0, 120) } : {}),
    })),
  }));

  const contentPayload = JSON.stringify({
    destination: trip.destination,
    days: days.map((d) => d.stops.map((s) => s.id).join(",")),
  });
  const shareToken = createHash("sha256").update(contentPayload).digest("hex").slice(0, 12);

  return {
    shareToken,
    title: `${trip.destination.name} Gezisi`,
    destination: trip.destination.name,
    durationDays: trip.days.length,
    days,
    sharedAt: new Date().toISOString(),
    version: 1,
  };
}

/** Returns the canonical share URL for a trip. */
export function buildShareUrl(shareToken: string, baseUrl: string): string {
  const url = new URL(`/plan/shared/${shareToken}`, baseUrl);
  return url.toString();
}

// ── Comments ──────────────────────────────────────────────────────────────────

export type CommentReaction = "helpful" | "been_there" | "disagree";

export interface TripComment {
  id: string;
  shareToken: string;
  /** Anonymized display name — never email or real name. */
  displayName: string;
  text: string; // max 280 chars
  reactions: Record<CommentReaction, number>;
  createdAt: string; // ISO-8601
  /** If the comment is about a specific stop. */
  stopId?: string;
}

export function sanitizeCommentText(text: string): string {
  return text.trim().slice(0, 280);
}

export function buildComment(opts: {
  shareToken: string;
  displayName: string;
  text: string;
  stopId?: string;
}): TripComment {
  return {
    id: createHash("sha256")
      .update(`${opts.shareToken}:${opts.displayName}:${Date.now()}`)
      .digest("hex")
      .slice(0, 16),
    shareToken: opts.shareToken,
    displayName: opts.displayName.trim().slice(0, 40),
    text: sanitizeCommentText(opts.text),
    reactions: { helpful: 0, been_there: 0, disagree: 0 },
    createdAt: new Date().toISOString(),
    ...(opts.stopId ? { stopId: opts.stopId } : {}),
  };
}
