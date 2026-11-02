/**
 * MapsBridge Places Domain — Lambda handler
 *
 * Routes:
 *   POST /places/discover          — Discover places in a city (multi-source)
 *   GET  /places/city/{city}       — Get cached places for a city
 *   GET  /places/city/{city}/meta  — Get discovery metadata
 *   POST /places/training/generate — Generate LLM training docs from collected data
 *   GET  /places/training/{city}   — Get training documents for a city
 *
 * Admin-only endpoints (require admin role):
 *   POST /places/batch-discover    — Batch discover multiple cities
 */

import type {
  PlaceCategory,
  PlaceSource,
} from "../../../../services/place-intelligence/src/domain/types";
import { verifiedUserId, getVerifiedUser } from "../shared/auth";
import type { ApiGatewayEvent } from "../shared/http";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  serverError,
  extractBearerToken,
  parseBody,
} from "../shared/http";
import { Router } from "../shared/router";

const router = new Router();

router.add("POST /places/discover", handleDiscover);
router.add("GET /places/city/{city}", handleGetPlaces);
router.add("GET /places/city/{city}/meta", handleGetMeta);
router.add("POST /places/training/generate", handleGenerateTraining);
router.add("GET /places/training/{city}", handleGetTraining);
router.add("POST /places/batch-discover", handleBatchDiscover);

export const handler = async (event: ApiGatewayEvent) => {
  try {
    if (event.requestContext.http.path === "/health" && event.requestContext.http.method === "GET")
      return ok({ status: "ok", service: "places", timestamp: new Date().toISOString() });
    return await router.dispatch(event);
  } catch (err) {
    console.error("[Places] Error:", err);
    return serverError();
  }
};

async function requireAuth(event: ApiGatewayEvent): Promise<string | null> {
  const token = extractBearerToken(event);
  if (!token) return null;
  return verifiedUserId(token);
}

async function requireAdmin(event: ApiGatewayEvent): Promise<boolean> {
  const token = extractBearerToken(event);
  if (!token) return false;
  const user = await getVerifiedUser(token);
  return user?.isAdmin === true;
}

// ─── Discover Places in a City ───────────────────────────────────────────
async function handleDiscover(event: ApiGatewayEvent) {
  const userId = await requireAuth(event);
  if (!userId) return unauthorized();

  const body = parseBody<{
    city?: string;
    country?: string;
    categories?: string[];
    sources?: string[];
    maxResults?: number;
    generateTraining?: boolean;
  }>(event);

  if (!body?.city) return badRequest("Şehir adı zorunludur.");
  if (body.city.length > 100) return badRequest("Şehir adı çok uzun.");
  // Reject URL schemes and injection chars before city reaches external collector URLs
  // eslint-disable-next-line no-control-regex
  if (/[<>"{}|\\^`\x00-\x1f]|https?:\/\//i.test(body.city))
    return badRequest("Şehir adı geçersiz karakter içeriyor.");
  if (
    body.country &&
    // eslint-disable-next-line no-control-regex
    (body.country.length > 60 || /[<>"{}|\\^`\x00-\x1f]|https?:\/\//i.test(body.country))
  )
    return badRequest("Ülke adı geçersiz.");

  const { discoverCity } =
    await import("../../../../services/place-intelligence/src/application/discovery-service");
  const { storePlaces, storeDiscoveryMeta } =
    await import("../../../../services/place-intelligence/src/infrastructure/place-store");

  const result = await discoverCity({
    city: body.city,
    country: body.country,
    categories: body.categories as PlaceCategory[],
    sources: body.sources as PlaceSource[],
    maxResults: Math.min(body.maxResults || 200, 500),
  });

  await Promise.all([storePlaces(result.places), storeDiscoveryMeta(result)]);

  if (body.generateTraining) {
    const { generateCityGuide } =
      await import("../../../../services/place-intelligence/src/application/training-generator");
    const { storeTrainingDocuments } =
      await import("../../../../services/place-intelligence/src/infrastructure/place-store");

    const docsTR = generateCityGuide(body.city, result.places, "tr");
    const docsEN = generateCityGuide(body.city, result.places, "en");
    await storeTrainingDocuments([...docsTR, ...docsEN]);
  }

  console.log(
    JSON.stringify({
      metric: "PlaceDiscovery",
      city: body.city,
      sources: result.sources,
      total: result.totalCollected,
      deduplicated: result.deduplicated,
      final: result.places.length,
      durationMs: result.durationMs,
    }),
  );

  return created({
    city: result.city,
    placeCount: result.places.length,
    sources: result.sources,
    totalCollected: result.totalCollected,
    deduplicated: result.deduplicated,
    durationMs: result.durationMs,
    places: result.places.slice(0, 50).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      rating: p.rating,
      lat: p.lat,
      lng: p.lng,
      address: p.address,
      typicalDurationMins: p.typicalDurationMins,
      recommendedSlot: p.recommendedSlot,
    })),
  });
}

// ─── Get Cached Places ───────────────────────────────────────────────────
async function handleGetPlaces(event: ApiGatewayEvent) {
  const userId = await requireAuth(event);
  if (!userId) return unauthorized();

  const city = event.pathParameters?.city;
  if (!city) return badRequest("Şehir parametresi gerekli.");

  const category = event.queryStringParameters?.category;
  const limit = Math.min(Number(event.queryStringParameters?.limit) || 100, 500);

  const { getPlacesForCity } =
    await import("../../../../services/place-intelligence/src/infrastructure/place-store");

  const places = await getPlacesForCity(decodeURIComponent(city), category, limit);
  return ok({ city, places, count: places.length });
}

// ─── Get Discovery Metadata ─────────────────────────────────────────────
async function handleGetMeta(event: ApiGatewayEvent) {
  const userId = await requireAuth(event);
  if (!userId) return unauthorized();

  const city = event.pathParameters?.city;
  if (!city) return badRequest("Şehir parametresi gerekli.");

  const { getDiscoveryMeta } =
    await import("../../../../services/place-intelligence/src/infrastructure/place-store");

  const meta = await getDiscoveryMeta(decodeURIComponent(city));
  if (!meta) return ok({ city, discovered: false });
  return ok({ city, discovered: true, ...meta });
}

// ─── Generate Training Documents ─────────────────────────────────────────
async function handleGenerateTraining(event: ApiGatewayEvent) {
  if (!(await requireAdmin(event))) return forbidden("Yönetici yetkisi gerekli.");

  const body = parseBody<{
    city?: string;
    language?: "tr" | "en";
  }>(event);

  if (!body?.city) return badRequest("Şehir adı zorunludur.");

  const { getPlacesForCity } =
    await import("../../../../services/place-intelligence/src/infrastructure/place-store");
  const { generateCityGuide } =
    await import("../../../../services/place-intelligence/src/application/training-generator");
  const { storeTrainingDocuments } =
    await import("../../../../services/place-intelligence/src/infrastructure/place-store");

  const places = await getPlacesForCity(body.city, undefined, 500);
  if (places.length === 0)
    return badRequest("Bu şehir için henüz mekan verisi yok. Önce /places/discover çalıştırın.");

  const language = body.language || "tr";
  const docs = generateCityGuide(body.city, places, language);
  await storeTrainingDocuments(docs);

  return created({
    city: body.city,
    language,
    documentsGenerated: docs.length,
    categories: docs.map((d) => d.category),
  });
}

// ─── Get Training Documents ──────────────────────────────────────────────
async function handleGetTraining(event: ApiGatewayEvent) {
  if (!(await requireAdmin(event))) return forbidden("Yönetici yetkisi gerekli.");

  const city = event.pathParameters?.city;
  if (!city) return badRequest("Şehir parametresi gerekli.");

  const language = event.queryStringParameters?.language || "tr";

  const { getTrainingDocuments } =
    await import("../../../../services/place-intelligence/src/infrastructure/place-store");

  const docs = await getTrainingDocuments(decodeURIComponent(city), language);
  return ok({ city, language, documents: docs });
}

// ─── Batch Discover (Admin) ──────────────────────────────────────────────
async function handleBatchDiscover(event: ApiGatewayEvent) {
  if (!(await requireAdmin(event))) return forbidden("Yönetici yetkisi gerekli.");

  const body = parseBody<{
    cities?: Array<{ city: string; country?: string }>;
    generateTraining?: boolean;
  }>(event);

  if (!body?.cities?.length) return badRequest("En az bir şehir gerekli.");
  if (body.cities.length > 10) return badRequest("Tek seferde en fazla 10 şehir.");
  // eslint-disable-next-line no-control-regex
  const CITY_INVALID = /[<>"{}|\\^`\x00-\x1f]|https?:\/\//i;
  for (const entry of body.cities) {
    if (!entry.city || entry.city.length > 100 || CITY_INVALID.test(entry.city))
      return badRequest(`Geçersiz şehir adı: ${entry.city?.slice(0, 20)}`);
    if (entry.country && (entry.country.length > 60 || CITY_INVALID.test(entry.country)))
      return badRequest(`Geçersiz ülke adı: ${entry.country?.slice(0, 20)}`);
  }

  const { discoverCity } =
    await import("../../../../services/place-intelligence/src/application/discovery-service");
  const { storePlaces, storeDiscoveryMeta, storeTrainingDocuments } =
    await import("../../../../services/place-intelligence/src/infrastructure/place-store");
  const { generateCityGuide } =
    await import("../../../../services/place-intelligence/src/application/training-generator");

  const results = [];

  for (const entry of body.cities) {
    try {
      const result = await discoverCity({
        city: entry.city,
        country: entry.country,
        maxResults: 200,
      });

      await Promise.all([storePlaces(result.places), storeDiscoveryMeta(result)]);

      if (body.generateTraining && result.places.length > 0) {
        const docsTR = generateCityGuide(entry.city, result.places, "tr");
        const docsEN = generateCityGuide(entry.city, result.places, "en");
        await storeTrainingDocuments([...docsTR, ...docsEN]);
      }

      results.push({
        city: entry.city,
        status: "success",
        placeCount: result.places.length,
        sources: result.sources,
      });
    } catch (err: unknown) {
      results.push({
        city: entry.city,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return ok({ results });
}
