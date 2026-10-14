import { Trip, Coordinate, RouteStop } from "@mapsbridge/contracts";
import type { TemporarySharePayload } from "../domain/types.js";

export class TripService {
  /**
   * Generates a temporary location share code with DynamoDB TTL expiration.
   */
  public createShareToken(
    creatorSub: string,
    lat: number,
    lng: number,
    hours: number,
    tripId?: string
  ): TemporarySharePayload {
    const validHours = Math.max(1, Math.min(hours, 72));
    const coordinate = new Coordinate(lat, lng);
    const expiresAt = Math.floor(Date.now() / 1000) + validHours * 3600;
    
    // Generate clean 6-character alphanumeric share code
    const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    return {
      shareCode,
      tripId,
      coordinate,
      durationHours: validHours,
      expiresAt,
      creatorSub,
    };
  }
}
