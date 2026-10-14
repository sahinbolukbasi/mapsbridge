import type { Trip, RouteStop, Coordinate } from "@mapsbridge/contracts";

export interface TemporarySharePayload {
  shareCode: string;
  tripId?: string;
  coordinate: Coordinate;
  durationHours: number;
  expiresAt: number;
  creatorSub: string;
}

export interface RouteFilterOptions {
  ownerId?: string;
  isPublic?: boolean;
  city?: string;
  limit?: number;
}
