/**
 * Travelpayouts Data API client — server-side price fetcher.
 * Token loaded once from Secrets Manager and cached for Lambda lifetime.
 * Docs: https://travelpayouts.github.io/slate/
 */

let cachedToken: string | undefined;

async function getApiToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const raw = process.env.TP_API_TOKEN;
  if (!raw) throw new Error("TP_API_TOKEN not configured");

  if (raw.startsWith("secret://")) {
    const secretId = "/" + raw.slice("secret:/".length);
    const { SecretsManagerClient, GetSecretValueCommand } = await import(
      "@aws-sdk/client-secrets-manager"
    );
    const sm = new SecretsManagerClient({ region: process.env.AWS_REGION || "eu-central-1" });
    const res = await sm.send(new GetSecretValueCommand({ SecretId: secretId }));
    sm.destroy();
    cachedToken = (res.SecretString ?? "").trim();
  } else {
    cachedToken = raw.trim();
  }

  if (!cachedToken) throw new Error("TP_API_TOKEN empty");
  return cachedToken;
}

const BASE = "https://api.travelpayouts.com";
const MARKER = process.env.NEXT_PUBLIC_TP_MARKER || "585085";

// ── Cached flight prices ─────────────────────────────────────────────────────

export interface CheapFlightPrice {
  origin: string;
  destination: string;
  price: number;
  airline: string;
  flight_number: number;
  departure_at: string;
  return_at: string;
  transfers: number;
  duration: number;
  link: string;
}

/**
 * Cheapest prices for a given origin → destination from cache.
 * Returns up to 10 options sorted by price.
 */
export async function getCheapestFlights(params: {
  origin: string;
  destination: string;
  currency?: string;
  departDate?: string;
  returnDate?: string;
}): Promise<CheapFlightPrice[]> {
  const token = await getApiToken();
  const url = new URL(`${BASE}/v2/prices/cheap`);
  url.searchParams.set("origin", params.origin.toUpperCase());
  url.searchParams.set("destination", params.destination.toUpperCase());
  url.searchParams.set("currency", params.currency || "usd");
  if (params.departDate) url.searchParams.set("depart_date", params.departDate);
  if (params.returnDate) url.searchParams.set("return_date", params.returnDate);
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), {
    headers: { "x-access-token": token },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("TP_RATE_LIMIT");
    throw new Error(`TP_FLIGHTS_ERROR_${res.status}`);
  }

  const data = (await res.json()) as { success: boolean; data: Record<string, any> };
  if (!data.success || !data.data) return [];

  return Object.values(data.data)
    .flatMap((dest: any) => Object.values(dest))
    .map((item: any) => ({
      origin: params.origin.toUpperCase(),
      destination: params.destination.toUpperCase(),
      price: item.price,
      airline: item.airline,
      flight_number: item.flight_number,
      departure_at: item.departure_at,
      return_at: item.return_at,
      transfers: item.transfers,
      duration: item.duration,
      link: `https://www.aviasales.com${item.link}&marker=${MARKER}`,
    }))
    .sort((a, b) => a.price - b.price)
    .slice(0, 10);
}

// ── Calendar of cheapest prices ─────────────────────────────────────────────

export interface CalendarPrice {
  date: string;
  value: number;
  found_at: string;
}

/**
 * Cheapest price for each departure day in a given month.
 */
export async function getCalendarPrices(params: {
  origin: string;
  destination: string;
  month: string; // YYYY-MM
  currency?: string;
}): Promise<CalendarPrice[]> {
  const token = await getApiToken();
  const url = new URL(`${BASE}/v2/prices/month-matrix`);
  url.searchParams.set("origin", params.origin.toUpperCase());
  url.searchParams.set("destination", params.destination.toUpperCase());
  url.searchParams.set("month", params.month);
  url.searchParams.set("currency", params.currency || "usd");
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), {
    headers: { "x-access-token": token },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as { success: boolean; data: CalendarPrice[] };
  return data.success ? data.data : [];
}

// ── Popular directions ───────────────────────────────────────────────────────

export interface PopularDestination {
  destination: string;
  origin: string;
  price: number;
  transfers: number;
  airline: string;
  departure_at: string;
}

/**
 * Most popular directions from an origin city (last 48 hours of searches).
 */
export async function getPopularDestinations(params: {
  origin: string;
  currency?: string;
  limit?: number;
}): Promise<PopularDestination[]> {
  const token = await getApiToken();
  const url = new URL(`${BASE}/v2/prices/popular-routes`);
  url.searchParams.set("origin", params.origin.toUpperCase());
  url.searchParams.set("currency", params.currency || "usd");
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), {
    headers: { "x-access-token": token },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as { success: boolean; data: any[] };
  if (!data.success || !Array.isArray(data.data)) return [];

  return data.data.slice(0, params.limit || 10).map((item: any) => ({
    destination: item.destination,
    origin: item.origin,
    price: item.price,
    transfers: item.transfers,
    airline: item.airline,
    departure_at: item.departure_at,
  }));
}

// ── Hotel prices via Hotellook ───────────────────────────────────────────────

export interface HotelPrice {
  hotelId: number;
  hotelName: string;
  stars: number;
  priceFrom: number;
  currency: string;
  checkIn: string;
  checkOut: string;
  hotelUrl: string;
}

/**
 * Cheapest hotel prices for a destination (Hotellook cache).
 */
export async function getHotelPrices(params: {
  location: string;
  checkIn: string;
  checkOut: string;
  adultsCount?: number;
  currency?: string;
  limit?: number;
}): Promise<HotelPrice[]> {
  const token = await getApiToken();
  const url = new URL("https://engine.hotellook.com/api/v2/cache.json");
  url.searchParams.set("location", params.location);
  url.searchParams.set("checkIn", params.checkIn);
  url.searchParams.set("checkOut", params.checkOut);
  url.searchParams.set("adultsCount", String(params.adultsCount || 2));
  url.searchParams.set("currency", params.currency || "usd");
  url.searchParams.set("limit", String(params.limit || 10));
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as Array<{
    id: number;
    name: string;
    stars: number;
    priceFrom: number;
    currency: string;
    url: string;
  }>;

  if (!Array.isArray(data)) return [];

  return data.map((h) => ({
    hotelId: h.id,
    hotelName: h.name,
    stars: h.stars,
    priceFrom: h.priceFrom,
    currency: h.currency || params.currency || "usd",
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    hotelUrl: `${h.url}?marker=${MARKER}`,
  }));
}
