/**
 * Place Interactions Telemetry (§10)
 *
 * Tracks every meaningful user interaction with places — views, pins, popup opens,
 * AI asks, route additions, rejections, and removals. Rejection signals are the
 * most valuable for improving recommendation quality.
 *
 * DynamoDB PK/SK: USER#{userId} / PLACE_INT#{timestamp}#{interactionId}
 * TTL: 365 days (configurable via PLACE_INTERACTION_TTL_DAYS)
 */

export type PlaceActionType =
  | 'view'
  | 'pin'
  | 'popup_open'
  | 'ask_ai'
  | 'add'
  | 'reject'
  | 'remove'
  | 'reorder'
  | 'focus'
  | 'zoom_in'
  | 'note_added';

export interface PlaceInteraction {
  id: string;
  userId: string;
  threadId?: string;
  placeId: string;
  placeName?: string;
  action: PlaceActionType;
  context?: PlaceInteractionContext;
  dwellMs?: number;
  createdAt: string;
}

export interface PlaceInteractionContext {
  sourceScreen: 'chat' | 'map' | 'popup' | 'day_plan' | 'search';
  day?: number;
  zoomLevel?: number;
  previousAction?: PlaceActionType;
  rejectionReason?: string;
  reorderFrom?: number;
  reorderTo?: number;
}

export function createPlaceInteraction(
  userId: string,
  placeId: string,
  action: PlaceActionType,
  opts?: {
    threadId?: string;
    placeName?: string;
    context?: PlaceInteractionContext;
    dwellMs?: number;
  }
): PlaceInteraction {
  return {
    id: crypto.randomUUID(),
    userId,
    placeId,
    action,
    createdAt: new Date().toISOString(),
    ...opts,
  };
}

export function placeInteractionDynamoKey(userId: string, interaction: PlaceInteraction) {
  return {
    PK: `USER#${userId}`,
    SK: `PLACE_INT#${interaction.createdAt}#${interaction.id}`,
  };
}

const DEFAULT_TTL_DAYS = 365;

export function placeInteractionTTL(): number {
  const envDays = Number(process.env.PLACE_INTERACTION_TTL_DAYS);
  const days = Number.isFinite(envDays) && envDays > 0 ? envDays : DEFAULT_TTL_DAYS;
  return Math.floor(Date.now() / 1000) + days * 86400;
}

export interface PlaceInteractionBatch {
  interactions: PlaceInteraction[];
  sessionId?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  timestamp: string;
}

export function batchPlaceInteractions(
  interactions: PlaceInteraction[],
  sessionId?: string,
  deviceType?: 'mobile' | 'desktop' | 'tablet'
): PlaceInteractionBatch {
  return {
    interactions,
    sessionId,
    deviceType,
    timestamp: new Date().toISOString(),
  };
}
