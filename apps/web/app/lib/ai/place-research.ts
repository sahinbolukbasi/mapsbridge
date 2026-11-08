import { GeoPlacesClient, GeocodeCommand, SearchTextCommand } from "@aws-sdk/client-geo-places";
import { normalizeText, type TripContext } from "./planning";
import { validatePlaceResearch } from "./evidence-validator";

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
    c.includes("museum") ||
    c.includes("müze") ||
    c.includes("gallery") ||
    c.includes("palace") ||
    c.includes("saray") ||
    n.includes("museum") ||
    n.includes("sarayı")
  ) {
    return { typicalDurationMins: 120, recommendedSlot: "morning" };
  }
  if (
    c.includes("cafe") ||
    c.includes("coffee") ||
    c.includes("kahve") ||
    c.includes("bakery") ||
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
    n.includes("restaurant") ||
    n.includes("lokanta")
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
    return { typicalDurationMins: 60, recommendedSlot: "morning" };
  }
  if (
    c.includes("view") ||
    c.includes("manzara") ||
    c.includes("sunset") ||
    c.includes("bar") ||
    c.includes("pub") ||
    n.includes("terrace") ||
    n.includes("rooftop")
  ) {
    return { typicalDurationMins: 60, recommendedSlot: "evening" };
  }
  return { typicalDurationMins: 60, recommendedSlot: "afternoon" };
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
  if (process.env.PLACE_RESEARCH_ENABLED !== "true" || !context.destination) return empty;
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
    return {
      ...empty,
      status: places.size
        ? "available"
        : results.some((r) => r.status === "fulfilled")
          ? "empty"
          : "unavailable",
      places: [...places.values()].slice(0, 30),
    };
  } catch (error: unknown) {
    const errName = error instanceof Error ? error.name : "Error";
    if (["TimeoutError", "AbortError"].includes(errName)) emitResearchTimeoutMetric();
    console.warn("Place research unavailable", errName);
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
    if (/kahve|kafe|coffee|cafe/u.test(value)) term = "coffee shop";
    else if (/muze|museum/u.test(value)) term = "museum";
    else if (/tarih|historic|ancient|ruins/u.test(value)) term = "historical monument";
    else if (/acik hava|doga|park|garden|outdoor/u.test(value)) term = "park";
    else if (/yemek|restoran|lezzet|restaurant|food/u.test(value)) term = "restaurant";
    else if (/manzara|viewpoint|scenic/u.test(value)) term = "tourist attraction";
    else if (/turist|rotasi|itinerary|landmarks/u.test(value) || value.split(/\s+/u).length > 5)
      term = "tourist attraction";
    if (term && !output.includes(term)) output.push(term.slice(0, 150));
  }
  if (output.length < 2 && !output.includes("tourist attraction"))
    output.push("tourist attraction");
  return output.slice(0, 3);
}
