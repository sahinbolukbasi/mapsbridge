import { GeoPlacesClient, GeocodeCommand, SearchTextCommand } from "@aws-sdk/client-geo-places";
import { normalizeText, type TripContext } from "./planning";
import { validatePlaceResearch } from "./evidence-validator";
import {
  selectCuratedPlacesForTrip,
  type CuratedPlaceIntel,
} from "../../../../../packages/ai-core/src/curated-city-intelligence";
import {
  filterGeographicOutliers,
  haversineDistanceKm,
} from "../../../../../packages/ai-core/src/route-optimizer";

function emitResearchTimeoutMetric(): void {
  if (process.env.AI_FINOPS_METRICS_ENABLED !== "true") return;
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: "MapsBridge/TravelAI",
            Dimensions: [["Environment"]],
            Metrics: [{ Name: "Timeouts", Unit: "Count" }],
          },
        ],
      },
      Environment: process.env.ENVIRONMENT || "local",
      Timeouts: 1,
    }),
  );
}
export interface ResearchedPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  category: string;
  checkedAt: string;
  typicalDurationMins?: number;
  recommendedSlot?: "morning" | "afternoon" | "evening";
}
export interface PlaceResearch {
  status: "available" | "empty" | "unavailable";
  places: ResearchedPlace[];
  provider: "Amazon Location";
  checkedAt: string;
}
let client: GeoPlacesClient | undefined;

export function inferPlaceTiming(
  category: string,
  name: string,
): { typicalDurationMins: number; recommendedSlot: "morning" | "afternoon" | "evening" } {
  const c = (category || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (
    c.includes("view") ||
    c.includes("manzara") ||
    c.includes("sunset") ||
    c.includes("bar") ||
    c.includes("pub") ||
    c.includes("night") ||
    n.includes("terrace") ||
    n.includes("rooftop") ||
    n.includes("seyir") ||
    n.includes("kordon") ||
    n.includes("sahil") ||
    n.includes("tower") ||
    n.includes("kulesi") ||
    n.includes("çeşmesi") ||
    n.includes("trevi") ||
    n.includes("eyfel") ||
    n.includes("eiffel")
  ) {
    return { typicalDurationMins: 65, recommendedSlot: "evening" };
  }
  if (
    c.includes("palace") ||
    c.includes("saray") ||
    c.includes("ancient") ||
    c.includes("antik") ||
    c.includes("cathedral") ||
    c.includes("bazilika") ||
    c.includes("cami") ||
    c.includes("mosque") ||
    n.includes("sarayı") ||
    n.includes("ayasofya") ||
    n.includes("colosseo") ||
    n.includes("kolezyum") ||
    n.includes("sagrada") ||
    n.includes("louvre")
  ) {
    return { typicalDurationMins: 100, recommendedSlot: "morning" };
  }
  if (
    c.includes("museum") ||
    c.includes("müze") ||
    c.includes("gallery") ||
    n.includes("museum") ||
    n.includes("müzesi")
  ) {
    return { typicalDurationMins: 105, recommendedSlot: "morning" };
  }
  if (
    c.includes("cafe") ||
    c.includes("coffee") ||
    c.includes("kahve") ||
    c.includes("bakery") ||
    c.includes("fırın") ||
    n.includes("cafe") ||
    n.includes("kahve")
  ) {
    return { typicalDurationMins: 45, recommendedSlot: "morning" };
  }
  if (
    c.includes("restaurant") ||
    c.includes("food") ||
    c.includes("yemek") ||
    c.includes("lezzet") ||
    c.includes("restoran") ||
    c.includes("market") ||
    c.includes("çarşı") ||
    n.includes("restaurant") ||
    n.includes("lokanta") ||
    n.includes("sofrası") ||
    n.includes("trattoria") ||
    n.includes("tapas")
  ) {
    return { typicalDurationMins: 75, recommendedSlot: "afternoon" };
  }
  if (
    c.includes("park") ||
    c.includes("garden") ||
    c.includes("bahçe") ||
    c.includes("nature") ||
    c.includes("doğa")
  ) {
    return { typicalDurationMins: 65, recommendedSlot: "morning" };
  }
  return { typicalDurationMins: 65, recommendedSlot: "afternoon" };
}

function curatedToResearchedPlace(item: CuratedPlaceIntel, checkedAt: string): ResearchedPlace {
  return {
    id: item.id,
    name: item.name,
    lat: item.lat,
    lng: item.lng,
    address: item.address,
    category: item.category,
    checkedAt,
    typicalDurationMins: item.typicalDurationMins,
    recommendedSlot: item.bestTimeSlot,
  };
}

/**
 * Canlı Amazon Location sonuçlarını doğrulanmış küratörlü şehir istihbaratı ile
 * birleştirir (150m yakınlık tekilleştirmesi + 28km aykırı değer filtresi).
 */
export function enrichPlaceResearchWithCuratedIntel(
  research: PlaceResearch,
  context: TripContext,
): PlaceResearch {
  if (!context.destination) return research;
  const curated = selectCuratedPlacesForTrip(context.destination, {
    days: context.days,
    interests: context.interests,
  });
  if (curated.length === 0) return research;

  const checkedAt = research.checkedAt || new Date().toISOString();
  const merged: ResearchedPlace[] = [...research.places];

  for (const c of curated) {
    const duplicate = merged.some(
      (existing) =>
        existing.id === c.id ||
        existing.name.toLowerCase() === c.name.toLowerCase() ||
        haversineDistanceKm(existing, c) < 0.15,
    );
    if (!duplicate) {
      merged.push(curatedToResearchedPlace(c, checkedAt));
    }
  }

  const cleaned = filterGeographicOutliers(merged, {
    maxRadiusKm: 28,
    minKeepCount: Math.max(4, (context.days || 2) * 2),
  });

  return {
    status: cleaned.length > 0 ? "available" : research.status,
    places: cleaned.slice(0, 30),
    provider: "Amazon Location",
    checkedAt,
  };
}

export async function researchPlaces(
  context: TripContext,
  queries: string[],
): Promise<PlaceResearch> {
  if (
    process.env.PLACE_RESEARCH_ENABLED !== "true" ||
    !context.destination ||
    !process.env.AGENTCORE_GATEWAY_URL
  ) {
    return researchPlacesDirect(context, queries);
  }
  try {
    const { callPlaceResearchTool } = await import("./agentcore-gateway");
    const result = await callPlaceResearchTool(
      context.destination,
      normalizePlaceQueries(queries, context),
    );
    if (!isPlaceResearch(result)) throw new Error("INVALID_PLACE_RESEARCH");
    return result;
  } catch (error: unknown) {
    // Do not bypass Gateway authorization/policy failures with a direct AWS call.
    const errName = error instanceof Error ? error.name : "Error";
    if (["TimeoutError", "AbortError"].includes(errName)) emitResearchTimeoutMetric();
    // Teşhis: ad + kısa mesaj (≤120; istem/kişisel veri içermez — hedef ve sorgular loglanmaz).
    const errMsg = error instanceof Error ? (error.message || "").slice(0, 120) : "";
    console.warn("GatewayPlaceResearchUnavailable", errMsg ? `${errName}: ${errMsg}` : errName);
    return {
      status: "unavailable",
      places: [],
      provider: "Amazon Location",
      checkedAt: new Date().toISOString(),
    };
  }
}

export function isPlaceResearch(value: unknown): value is PlaceResearch {
  return validatePlaceResearch(value);
}

export async function researchPlacesDirect(
  context: TripContext,
  queries: string[],
): Promise<PlaceResearch> {
  const checkedAt = new Date().toISOString();
  const empty: PlaceResearch = {
    status: "unavailable",
    places: [],
    provider: "Amazon Location",
    checkedAt,
  };
  if (process.env.PLACE_RESEARCH_ENABLED === "false" || !context.destination) return empty;
  if (process.env.PLACE_RESEARCH_ENABLED !== "true") {
    const curatedFallback = enrichPlaceResearchWithCuratedIntel(empty, context);
    return curatedFallback.places.length > 0 ? curatedFallback : empty;
  }
  client ||= new GeoPlacesClient({
    region: process.env.AWS_REGION || "eu-central-1",
    maxAttempts: 1,
  });
  try {
    const geo = await client.send(
      new GeocodeCommand({ QueryText: context.destination, MaxResults: 1, IntendedUse: "Storage" }),
      { abortSignal: AbortSignal.timeout(2500) },
    );
    const center = geo.ResultItems?.[0]?.Position;
    if (!center || center.length !== 2) return { ...empty, status: "empty" };
    const searches = normalizePlaceQueries(queries, context);
    const results = await Promise.allSettled(
      searches.map((QueryText) =>
        client!.send(
          new SearchTextCommand({
            QueryText: QueryText.slice(0, 150),
            Filter: { Circle: { Center: center, Radius: 20000 } },
            MaxResults: 12,
            IntendedUse: "Storage",
            Language: "en",
          }),
          { abortSignal: AbortSignal.timeout(3500) },
        ),
      ),
    );
    const places = new Map<string, ResearchedPlace>();
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const item of result.value.ResultItems || []) {
        if (
          item.PlaceType !== "PointOfInterest" ||
          !item.PlaceId ||
          !item.Title ||
          !item.Position ||
          item.Position.length !== 2
        )
          continue;
        const [lng, lat] = item.Position;
        if (
          !Number.isFinite(lat) ||
          Math.abs(lat) > 90 ||
          !Number.isFinite(lng) ||
          Math.abs(lng) > 180
        )
          continue;
        const category = item.Categories?.[0]?.Name || "Gezi";
        const timing = inferPlaceTiming(category, item.Title);
        places.set(item.PlaceId, {
          id: item.PlaceId,
          name: item.Title,
          lat,
          lng,
          address: item.Address?.Label || "",
          category,
          checkedAt,
          typicalDurationMins: timing.typicalDurationMins,
          recommendedSlot: timing.recommendedSlot,
        });
      }
    }
    // Canlı GeoPlaces sonuçlarını aykırı değer filtresinden geçir ve eğer sonuç sayısı
    // yetersizse doğrulanmış küratörlü şehir istihbaratı ile zenginleştir.
    let finalPlaces = filterGeographicOutliers([...places.values()], {
      maxRadiusKm: 28,
      minKeepCount: Math.min(places.size, Math.max(4, (context.days || 2) * 2)),
    });
    if (finalPlaces.length > 0 && finalPlaces.length < Math.max(8, (context.days || 2) * 3)) {
      const enriched = enrichPlaceResearchWithCuratedIntel(
        { ...empty, status: "available", places: finalPlaces },
        context,
      );
      finalPlaces = enriched.places;
    }
    return {
      ...empty,
      status: finalPlaces.length
        ? "available"
        : results.some((r) => r.status === "fulfilled")
          ? "empty"
          : "unavailable",
      places: finalPlaces.slice(0, 30),
    };
  } catch (error: unknown) {
    const errName = error instanceof Error ? error.name : "Error";
    if (["TimeoutError", "AbortError"].includes(errName)) emitResearchTimeoutMetric();
    console.warn("Place research unavailable", errName);
    const curatedFallback = enrichPlaceResearchWithCuratedIntel(empty, context);
    if (curatedFallback.places.length > 0) return curatedFallback;
    return empty;
  }
}

/** SearchText expects place names/categories, not an LLM's prose search request. */
export function normalizePlaceQueries(queries: string[], context: TripContext): string[] {
  const source = queries.length ? queries : context.interests;
  const output: string[] = [];
  for (const query of source) {
    const value = normalizeText(query);
    let term = query.trim();
    if (/kahve|kafe|coffee|cafe|bakery|firin/u.test(value)) term = "coffee shop";
    else if (/muze|museum|galeri|sanat|art/u.test(value)) term = "museum";
    else if (/tarih|historic|ancient|ruins|antik|saray|palace|kale/u.test(value))
      term = "historical monument";
    else if (/acik hava|doga|park|garden|outdoor|vadi|selale|plaj|sahil/u.test(value))
      term = "park";
    else if (/yemek|restoran|lezzet|restaurant|food|gastronomi|lokanta|meze|tapas/u.test(value))
      term = "restaurant";
    else if (/carsi|pazar|market|bazaar|alisveris|shopping/u.test(value))
      term = "market";
    else if (/manzara|viewpoint|scenic|seyir|gun batimi|sunset/u.test(value))
      term = "tourist attraction";
    else if (/turist|rotasi|itinerary|landmarks/u.test(value) || value.split(/\s+/u).length > 5)
      term = "tourist attraction";
    if (term && !output.includes(term)) output.push(term.slice(0, 150));
  }
  if (output.length < 2 && !output.includes("tourist attraction"))
    output.push("tourist attraction");
  if (output.length < 3 && !output.includes("restaurant"))
    output.push("restaurant");
  return output.slice(0, 3);
}
