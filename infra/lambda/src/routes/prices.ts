// Travelpayouts Fiyat Uçları (R6 — routes/index.ts'ten ayrıldı)
// -------------------------------------------------------------
// Uçuş/otel/popüler rota fiyatları — ayrı bir bounded context (affiliate fiyat verisi).
// routes/index.ts "kova" god-file'ından çıkarıldı; davranış BİREBİR korundu.
// Router kayıtları (GET /prices/*) hâlâ routes/index.ts'te; burası yalnız handler'lar.
//
// Not: Bu fiyat verisi I8 (affiliate sıralamayı etkilemez) kapsamında — yalnız veri döndürür,
// rota önerisi sıralamasına karışmaz.

import type { ApiGatewayEvent } from "../shared/http";
import {
  extractBearerToken,
  unauthorized,
  badRequest,
  ok,
  jsonResponse,
  serverError,
} from "../shared/http";
import { verifiedUserId } from "../shared/auth";

export async function handleGetFlightPrices(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();
  const q = event.queryStringParameters || {};
  const origin = (q.origin || "IST").toUpperCase().slice(0, 3);
  const destination = (q.destination || "").toUpperCase().slice(0, 3);
  if (!destination) return badRequest("destination parametresi gerekli (IATA kodu, örn: BCN)");
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination))
    return badRequest("Geçersiz IATA kodu.");
  try {
    const { getCheapestFlights } = await import("../shared/travelpayouts");
    const prices = await getCheapestFlights({
      origin,
      destination,
      currency: q.currency || "usd",
      departDate: q.departDate,
      returnDate: q.returnDate,
    });
    return ok({ origin, destination, prices, currency: q.currency || "usd", source: "travelpayouts_cache" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "TP_RATE_LIMIT") return jsonResponse(429, { error: "Fiyat servisi meşgul, lütfen tekrar deneyin." });
    console.error("[TP Flights]", msg);
    return serverError("Uçuş fiyatları alınamadı.");
  }
}

export async function handleGetHotelPrices(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();
  const q = event.queryStringParameters || {};
  const location = (q.location || q.destination || "").trim();
  if (!location) return badRequest("location parametresi gerekli (şehir adı)");
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 86400000);
  const checkIn = q.checkIn || today.toISOString().slice(0, 10);
  const checkOut = q.checkOut || nextWeek.toISOString().slice(0, 10);
  try {
    const { getHotelPrices } = await import("../shared/travelpayouts");
    const hotels = await getHotelPrices({
      location,
      checkIn,
      checkOut,
      adultsCount: q.adults ? parseInt(q.adults, 10) : 2,
      currency: q.currency || "usd",
      limit: 10,
    });
    return ok({ location, checkIn, checkOut, hotels, currency: q.currency || "usd", source: "hotellook_cache" });
  } catch (err: unknown) {
    console.error("[TP Hotels]", err instanceof Error ? err.message : String(err));
    return serverError("Otel fiyatları alınamadı.");
  }
}

export async function handleGetPopularRoutes(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();
  const q = event.queryStringParameters || {};
  const origin = (q.origin || "IST").toUpperCase().slice(0, 3);
  if (!/^[A-Z]{3}$/.test(origin)) return badRequest("Geçersiz IATA kodu.");
  try {
    const { getPopularDestinations } = await import("../shared/travelpayouts");
    const destinations = await getPopularDestinations({
      origin,
      currency: q.currency || "usd",
      limit: 10,
    });
    return ok({ origin, destinations, currency: q.currency || "usd", source: "travelpayouts_popular" });
  } catch (err: unknown) {
    console.error("[TP Popular]", err instanceof Error ? err.message : String(err));
    return serverError("Popüler rotalar alınamadı.");
  }
}
