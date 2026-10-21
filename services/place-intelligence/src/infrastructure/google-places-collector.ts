/**
 * Google Places API (New) Collector — Server-side
 *
 * Uses Google Places API (New) for the richest POI data available:
 * reviews, photos, opening hours, pricing. Requires API key.
 * Operates server-side to keep the API key secure.
 */

import type {
  NormalizedPlace,
  PlaceCategory,
  CityDiscoveryRequest,
  WeeklyHours,
  DayHours,
} from "../domain/types";
import { inferTiming } from "../application/normalizer";

const PLACES_BASE = "https://places.googleapis.com/v1/places:searchText";
const REQUEST_TIMEOUT = 10_000;

const CATEGORY_SEARCH_TERMS: Record<string, string> = {
  restaurant: "restaurants",
  cafe: "cafes and coffee shops",
  bar: "bars",
  nightlife: "nightclubs and nightlife",
  museum: "museums",
  gallery: "art galleries",
  monument: "monuments and memorials",
  historical: "historical sites",
  park: "parks",
  garden: "botanical gardens",
  beach: "beaches",
  hotel: "hotels",
  hostel: "hostels",
  temple: "temples and shrines",
  mosque: "mosques",
  church: "churches and cathedrals",
  shop: "shopping",
  market: "markets and bazaars",
  viewpoint: "scenic viewpoints",
  landmark: "landmarks",
  attraction: "tourist attractions",
};

interface GooglePlace {
  id: string;
  displayName?: { text: string; languageCode: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  regularOpeningHours?: {
    periods?: Array<{
      open: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
  };
  photos?: Array<{ name: string; widthPx: number; heightPx: number }>;
  editorialSummary?: { text: string };
  primaryType?: string;
}

function mapGoogleCategory(types: string[]): PlaceCategory {
  const t = types.join(" ");
  if (t.includes("restaurant") || t.includes("food")) return "restaurant";
  if (t.includes("cafe") || t.includes("coffee")) return "cafe";
  if (t.includes("bar")) return "bar";
  if (t.includes("night_club")) return "nightlife";
  if (t.includes("museum")) return "museum";
  if (t.includes("art_gallery")) return "gallery";
  if (t.includes("park") || t.includes("national_park")) return "park";
  if (t.includes("church") || t.includes("cathedral")) return "church";
  if (t.includes("mosque")) return "mosque";
  if (t.includes("hindu_temple") || t.includes("synagogue")) return "temple";
  if (t.includes("lodging") || t.includes("hotel")) return "hotel";
  if (t.includes("shopping") || t.includes("store")) return "shop";
  if (t.includes("tourist_attraction")) return "attraction";
  if (t.includes("point_of_interest")) return "landmark";
  return "other";
}

function mapPriceLevel(level?: string): NormalizedPlace["priceLevel"] {
  if (!level) return undefined;
  const map: Record<string, number> = {
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return (map[level] || undefined) as NormalizedPlace["priceLevel"];
}

function convertOpeningHours(
  periods?: GooglePlace["regularOpeningHours"],
): WeeklyHours | undefined {
  if (!periods?.periods) return undefined;
  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ] as const;
  const hours: WeeklyHours = {};
  for (const period of periods.periods) {
    const dayName = dayNames[period.open.day];
    if (!dayName || !period.close) continue;
    const entry: DayHours = {
      open: `${String(period.open.hour).padStart(2, "0")}:${String(period.open.minute).padStart(2, "0")}`,
      close: `${String(period.close.hour).padStart(2, "0")}:${String(period.close.minute).padStart(2, "0")}`,
    };
    (hours as Record<string, DayHours | undefined>)[dayName] = entry;
  }
  return Object.keys(hours).length > 0 ? hours : undefined;
}

export async function collectFromGoogle(request: CityDiscoveryRequest): Promise<NormalizedPlace[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn("[GooglePlaces] No API key configured");
    return [];
  }

  const categories = request.categories || [
    "restaurant",
    "cafe",
    "museum",
    "monument",
    "park",
    "attraction",
  ];
  const language = request.language || "en";
  const maxPerCategory = Math.min(Math.ceil((request.maxResults || 60) / categories.length), 20);

  const allPlaces: NormalizedPlace[] = [];
  const now = new Date().toISOString();

  for (const cat of categories) {
    const searchTerm = CATEGORY_SEARCH_TERMS[cat] || cat;
    const textQuery = `${searchTerm} in ${request.city}`;

    try {
      const response = await fetch(PLACES_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.priceLevel,places.nationalPhoneNumber,places.websiteUri,places.regularOpeningHours,places.photos,places.editorialSummary,places.primaryType",
        },
        body: JSON.stringify({
          textQuery,
          languageCode: language,
          maxResultCount: maxPerCategory,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        console.warn(`[GooglePlaces] HTTP ${response.status} for "${textQuery}"`);
        continue;
      }

      const data = (await response.json()) as { places?: GooglePlace[] };
      if (!data.places) continue;

      for (const p of data.places) {
        if (!p.location || !p.displayName?.text) continue;

        const category = mapGoogleCategory(p.types || []);
        const timing = inferTiming(category, p.displayName.text);

        allPlaces.push({
          id: `gp_${p.id}`,
          sourceId: p.id,
          source: "google",
          name: p.displayName.text,
          lat: p.location.latitude,
          lng: p.location.longitude,
          address: p.formattedAddress,
          city: request.city,
          country: request.country || "",
          category,
          subcategories: (p.types || []).slice(0, 5),
          rating: p.rating,
          reviewCount: p.userRatingCount,
          priceLevel: mapPriceLevel(p.priceLevel),
          phone: p.nationalPhoneNumber,
          website: p.websiteUri,
          openingHours: convertOpeningHours(p.regularOpeningHours),
          photos: (p.photos || []).slice(0, 3).map((photo) => ({
            url: `https://places.googleapis.com/v1/${photo.name}/media?key=${apiKey}&maxWidthPx=800`,
            width: photo.widthPx,
            height: photo.heightPx,
          })),
          tags: (p.types || []).filter((t) => !t.startsWith("point_of_interest")),
          typicalDurationMins: timing.typicalDurationMins,
          recommendedSlot: timing.recommendedSlot,
          description: p.editorialSummary?.text,
          collectedAt: now,
          updatedAt: now,
          ttl: Math.floor(Date.now() / 1000) + 30 * 86400,
        });
      }
    } catch (err: unknown) {
      console.warn(`[GooglePlaces] Error for "${cat}":`, (err as Error)?.message);
    }
  }

  return allPlaces;
}
