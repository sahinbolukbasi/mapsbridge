/**
 * Place Intelligence Domain — Canonical Types
 *
 * Single normalized schema for place data from any source
 * (Overpass/OSM, Google Places, Foursquare, Amazon Location).
 */

export type PlaceSource = "osm" | "google" | "foursquare" | "amazon_location";
export type PlaceCategory =
  | "restaurant"
  | "cafe"
  | "bar"
  | "nightlife"
  | "museum"
  | "gallery"
  | "monument"
  | "historical"
  | "park"
  | "garden"
  | "beach"
  | "nature"
  | "hotel"
  | "hostel"
  | "lodge"
  | "shop"
  | "market"
  | "mall"
  | "temple"
  | "mosque"
  | "church"
  | "viewpoint"
  | "landmark"
  | "attraction"
  | "transport"
  | "pharmacy"
  | "hospital"
  | "other";

export interface NormalizedPlace {
  id: string;
  sourceId: string;
  source: PlaceSource;
  name: string;
  nameLocal?: string;
  lat: number;
  lng: number;
  address?: string;
  city: string;
  country: string;
  category: PlaceCategory;
  subcategories: string[];
  rating?: number;
  reviewCount?: number;
  priceLevel?: 1 | 2 | 3 | 4;
  phone?: string;
  website?: string;
  openingHours?: WeeklyHours;
  photos?: PlacePhoto[];
  tags: string[];
  typicalDurationMins: number;
  recommendedSlot: "morning" | "afternoon" | "evening" | "any";
  description?: string;
  osmTags?: Record<string, string>;
  collectedAt: string;
  updatedAt: string;
  ttl: number;
}

export interface PlacePhoto {
  url: string;
  attribution?: string;
  width?: number;
  height?: number;
}

export interface WeeklyHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
}

export interface DayHours {
  open: string;
  close: string;
}

export interface CityDiscoveryRequest {
  city: string;
  country?: string;
  categories?: PlaceCategory[];
  radius?: number;
  maxResults?: number;
  sources?: PlaceSource[];
  language?: string;
}

export interface CityDiscoveryResult {
  city: string;
  places: NormalizedPlace[];
  sources: PlaceSource[];
  totalCollected: number;
  deduplicated: number;
  collectedAt: string;
  durationMs: number;
}

export interface TrainingDocument {
  id: string;
  city: string;
  category: string;
  content: string;
  metadata: {
    placeCount: number;
    sources: PlaceSource[];
    generatedAt: string;
    language: string;
  };
}
