/**
 * City Discovery Service — Orchestrator
 *
 * Coordinates multi-source place collection, normalizes, deduplicates,
 * ranks, stores in DynamoDB, and optionally generates training data.
 */

import type {
  CityDiscoveryRequest,
  CityDiscoveryResult,
  NormalizedPlace,
  PlaceSource,
} from "../domain/types";
import { collectFromOverpass } from "../infrastructure/overpass-collector";
import { collectFromFoursquare } from "../infrastructure/foursquare-collector";
import { collectFromGoogle } from "../infrastructure/google-places-collector";
import { deduplicatePlaces, rankPlaces } from "./normalizer";

type Collector = (request: CityDiscoveryRequest) => Promise<NormalizedPlace[]>;

const SOURCE_COLLECTORS: Record<PlaceSource, Collector | null> = {
  osm: collectFromOverpass,
  foursquare: collectFromFoursquare,
  google: collectFromGoogle,
  amazon_location: null,
};

export async function discoverCity(request: CityDiscoveryRequest): Promise<CityDiscoveryResult> {
  const started = Date.now();
  const sources = request.sources || (["osm", "google", "foursquare"] as PlaceSource[]);
  const activeSources: PlaceSource[] = [];

  const collectors = sources
    .map((source) => {
      const collector = SOURCE_COLLECTORS[source];
      if (collector) activeSources.push(source);
      return collector;
    })
    .filter((c): c is Collector => c !== null);

  const results = await Promise.allSettled(collectors.map((collect) => collect(request)));

  const allPlaces: NormalizedPlace[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allPlaces.push(...result.value);
    } else {
      console.warn("[Discovery] Source failed:", result.reason?.message);
    }
  }

  const totalCollected = allPlaces.length;
  const deduplicated = deduplicatePlaces(allPlaces);
  const ranked = rankPlaces(deduplicated);
  const maxResults = request.maxResults || 200;

  return {
    city: request.city,
    places: ranked.slice(0, maxResults),
    sources: activeSources,
    totalCollected,
    deduplicated: totalCollected - deduplicated.length,
    collectedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
  };
}

export async function discoverCityByCategory(
  city: string,
  country: string,
  categories: CityDiscoveryRequest["categories"],
): Promise<CityDiscoveryResult> {
  return discoverCity({
    city,
    country,
    categories,
    maxResults: 100,
  });
}

export function filterByCategory(
  places: NormalizedPlace[],
  category: NormalizedPlace["category"],
): NormalizedPlace[] {
  return places.filter((p) => p.category === category);
}

export function filterByRadius(
  places: NormalizedPlace[],
  centerLat: number,
  centerLng: number,
  radiusKm: number,
): NormalizedPlace[] {
  return places.filter((p) => {
    const R = 6371;
    const dLat = ((p.lat - centerLat) * Math.PI) / 180;
    const dLng = ((p.lng - centerLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((centerLat * Math.PI) / 180) *
        Math.cos((p.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return dist <= radiusKm;
  });
}

export function placeSummaryForAgent(places: NormalizedPlace[]): string {
  if (places.length === 0) return "Henüz mekan verisi toplanmadı.";
  const byCategory = new Map<string, NormalizedPlace[]>();
  for (const p of places) {
    const list = byCategory.get(p.category) || [];
    list.push(p);
    byCategory.set(p.category, list);
  }
  const lines: string[] = [];
  for (const [cat, items] of byCategory) {
    const top3 = items.slice(0, 3).map((p) => {
      const parts = [p.name];
      if (p.rating) parts.push(`★${p.rating}`);
      if (p.priceLevel) parts.push("$".repeat(p.priceLevel));
      return parts.join(" ");
    });
    lines.push(`${cat} (${items.length}): ${top3.join(", ")}`);
  }
  return lines.join("\n");
}
