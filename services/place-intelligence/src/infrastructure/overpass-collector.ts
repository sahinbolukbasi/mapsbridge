/**
 * Overpass API Collector — Free, legal OSM data
 *
 * Queries OpenStreetMap via the Overpass API for POIs in a given city.
 * No API key required. Rate limit: 2 concurrent requests, respectful usage.
 */

import type { NormalizedPlace, PlaceCategory, CityDiscoveryRequest } from "../domain/types";
import { categoryFromOsmTags, inferTiming } from "../application/normalizer";

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const REQUEST_TIMEOUT = 15_000;

const CATEGORY_QUERIES: Record<string, string> = {
  restaurant: '["amenity"="restaurant"]',
  cafe: '["amenity"="cafe"]',
  bar: '["amenity"="bar"]',
  nightlife: '["amenity"~"nightclub|pub"]',
  museum: '["tourism"="museum"]',
  gallery: '["tourism"="gallery"]',
  monument: '["historic"~"monument|memorial|castle|ruins"]',
  historical: '["historic"]',
  park: '["leisure"="park"]',
  garden: '["leisure"="garden"]',
  beach: '["natural"="beach"]',
  hotel: '["tourism"~"hotel|motel"]',
  hostel: '["tourism"="hostel"]',
  temple: '["amenity"="place_of_worship"]["religion"~"buddhist|hindu|shinto"]',
  mosque: '["amenity"="place_of_worship"]["religion"="muslim"]',
  church: '["amenity"="place_of_worship"]["religion"="christian"]',
  shop: '["shop"~"supermarket|convenience|mall"]',
  market: '["amenity"="marketplace"]',
  viewpoint: '["tourism"="viewpoint"]',
  landmark: '["tourism"~"attraction|viewpoint"]',
  attraction: '["tourism"="attraction"]',
  transport: '["railway"="station"]',
  pharmacy: '["amenity"="pharmacy"]',
  hospital: '["amenity"="hospital"]',
};

function buildOverpassQuery(
  lat: number,
  lng: number,
  radius: number,
  categories: PlaceCategory[],
): string {
  const filters = categories.map((c) => CATEGORY_QUERIES[c]).filter(Boolean);

  if (filters.length === 0) {
    filters.push('["tourism"]', '["amenity"="restaurant"]', '["amenity"="cafe"]', '["historic"]');
  }

  const nodeQueries = filters.map((f) => `  node${f}(around:${radius},${lat},${lng});`).join("\n");
  const wayQueries = filters.map((f) => `  way${f}(around:${radius},${lat},${lng});`).join("\n");

  return `[out:json][timeout:12];
(
${nodeQueries}
${wayQueries}
);
out center tags 200;`;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1&accept-language=en`;
  const response = await fetch(url, {
    headers: { "User-Agent": "MapsBridge/1.0 (travel-platform)" },
    signal: AbortSignal.timeout(5000),
  });
  const data = (await response.json()) as Array<{ lat: string; lon: string }>;
  if (!data[0]) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export async function collectFromOverpass(
  request: CityDiscoveryRequest,
): Promise<NormalizedPlace[]> {
  const center = await geocodeCity(request.city);
  if (!center) {
    console.warn(`[Overpass] Could not geocode city: ${request.city}`);
    return [];
  }

  const radius = request.radius || 15000;
  const categories = request.categories || [
    "restaurant",
    "cafe",
    "museum",
    "monument",
    "park",
    "attraction",
    "viewpoint",
  ];
  const query = buildOverpassQuery(center.lat, center.lng, radius, categories);

  const response = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!response.ok) {
    console.warn(`[Overpass] HTTP ${response.status}`);
    return [];
  }

  const result = (await response.json()) as { elements: OverpassElement[] };
  const now = new Date().toISOString();
  const maxResults = request.maxResults || 200;

  const places: NormalizedPlace[] = [];

  for (const el of result.elements) {
    if (places.length >= maxResults) break;

    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const tags = el.tags || {};
    const name = tags["name:en"] || tags.name;

    if (!lat || !lng || !name) continue;

    const category = categoryFromOsmTags(tags);
    const timing = inferTiming(category, name);

    places.push({
      id: `osm_${el.type}_${el.id}`,
      sourceId: `${el.type}/${el.id}`,
      source: "osm",
      name,
      nameLocal: tags.name !== name ? tags.name : undefined,
      lat,
      lng,
      address:
        [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]]
          .filter(Boolean)
          .join(", ") || undefined,
      city: request.city,
      country: request.country || tags["addr:country"] || "",
      category,
      subcategories: [tags.amenity, tags.tourism, tags.historic, tags.leisure, tags.shop].filter(
        Boolean,
      ) as string[],
      rating: undefined,
      reviewCount: undefined,
      phone: tags.phone || tags["contact:phone"],
      website: tags.website || tags["contact:website"],
      openingHours: parseOsmHours(tags.opening_hours),
      tags: Object.entries(tags)
        .filter(([k]) =>
          [
            "cuisine",
            "diet:vegetarian",
            "wheelchair",
            "internet_access",
            "outdoor_seating",
          ].includes(k),
        )
        .map(([k, v]) => `${k}=${v}`),
      typicalDurationMins: timing.typicalDurationMins,
      recommendedSlot: timing.recommendedSlot,
      description: tags.description || tags["description:en"],
      osmTags: tags,
      collectedAt: now,
      updatedAt: now,
      ttl: Math.floor(Date.now() / 1000) + 30 * 86400,
    });
  }

  return places;
}

function parseOsmHours(raw?: string): NormalizedPlace["openingHours"] {
  if (!raw || raw === "24/7") return undefined;
  return undefined;
}
