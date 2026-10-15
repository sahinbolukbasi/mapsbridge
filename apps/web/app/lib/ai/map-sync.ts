/**
 * Map ↔ AI Synchronization (§8)
 *
 * Event-based sync between map and chat. Both read/write the same TripState.
 * No polling — events propagate changes instantly.
 */

import type { TripState, TripStateEvent } from "./trip-state";

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type MapSyncEventType =
  | "place.focused"
  | "place.added"
  | "place.removed"
  | "place.rejected"
  | "route.reordered"
  | "day.split"
  | "day.merged"
  | "note.added"
  | "note.updated"
  | "optimization.proposed"
  | "optimization.accepted"
  | "optimization.rejected";

export interface MapSyncEvent {
  type: MapSyncEventType;
  source: "chat" | "map" | "system";
  payload: Record<string, unknown>;
  timestamp: string;
}

export function createSyncEvent(
  type: MapSyncEventType,
  source: "chat" | "map" | "system",
  payload: Record<string, unknown>,
): MapSyncEvent {
  return { type, source, payload, timestamp: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Place Notes (§8.5)
// ---------------------------------------------------------------------------

export interface PlaceNote {
  id: string;
  threadId: string;
  placeId: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DayNote {
  id: string;
  threadId: string;
  dayIndex: number;
  body: string;
  createdAt: string;
  updatedAt?: string;
}

export function createPlaceNote(threadId: string, placeId: string, body: string): PlaceNote {
  return {
    id: crypto.randomUUID(),
    threadId,
    placeId,
    body: body.slice(0, 2000),
    createdAt: new Date().toISOString(),
  };
}

export function createDayNote(threadId: string, dayIndex: number, body: string): DayNote {
  return {
    id: crypto.randomUUID(),
    threadId,
    dayIndex,
    body: body.slice(0, 2000),
    createdAt: new Date().toISOString(),
  };
}

export function placeNoteDynamoKey(threadId: string, noteId: string) {
  return { PK: `THREAD#${threadId}`, SK: `PLACE_NOTE#${noteId}` };
}

export function dayNoteDynamoKey(threadId: string, noteId: string) {
  return { PK: `THREAD#${threadId}`, SK: `DAY_NOTE#${noteId}` };
}

// ---------------------------------------------------------------------------
// Route Optimization Comparison (§8.6)
// ---------------------------------------------------------------------------

export interface OptimizationProposal {
  id: string;
  threadId: string;
  currentPlan: OptimizationPlanSummary;
  proposedPlan: OptimizationPlanSummary;
  improvements: string[];
  warnings: string[];
  pinnedStopIds: string[];
  createdAt: string;
}

export interface OptimizationPlanSummary {
  totalStops: number;
  totalWalkingMinutes: number;
  totalDistanceKm: number;
  daysUsed: number;
  stopsPerDay: number[];
}

export function createOptimizationProposal(
  threadId: string,
  current: OptimizationPlanSummary,
  proposed: OptimizationPlanSummary,
  improvements: string[],
  warnings: string[],
  pinnedStopIds: string[],
): OptimizationProposal {
  return {
    id: crypto.randomUUID(),
    threadId,
    currentPlan: current,
    proposedPlan: proposed,
    improvements,
    warnings,
    pinnedStopIds,
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Select-to-add (§8.2 — no bulk add)
// ---------------------------------------------------------------------------

export interface PlaceSelection {
  placeId: string;
  name: string;
  selected: boolean;
  targetDay?: number;
  targetTimeSlot?: "morning" | "afternoon" | "evening" | "night";
}

export interface SelectToAddRequest {
  threadId: string;
  selections: PlaceSelection[];
  source: "chat" | "map";
}

export function validateSelectToAdd(request: SelectToAddRequest): string | null {
  if (!request.selections.length) return "En az bir mekan seçmelisin.";
  const selected = request.selections.filter((s) => s.selected);
  if (!selected.length) return "Hiçbir mekan seçilmedi.";
  if (selected.length > 10) return "Tek seferde en fazla 10 mekan eklenebilir.";
  return null;
}

// ---------------------------------------------------------------------------
// Shared Place Card Entity (§8.1 + §8.3)
// ---------------------------------------------------------------------------

export interface PlaceCardEntity {
  placeId: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address?: string;
  openingHours?: string;
  priceLevel?: "$" | "$$" | "$$$" | "$$$$";
  rating?: number;
  reviewSummary?: {
    positiveThemes: string[];
    negativeThemes: string[];
    busyHours?: string;
    practicalTips: string[];
  };
  photoUrl?: string;
  kbEntityId?: string;
  lastUpdated?: string;
}
