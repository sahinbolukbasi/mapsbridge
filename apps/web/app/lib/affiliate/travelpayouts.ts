/**
 * Travelpayouts affiliate deep link builder.
 *
 * Marker: 585085  (set at build time via NEXT_PUBLIC_TP_MARKER; env overrides compile-time default)
 * Products: Aviasales (flights), HotelLook (hotels), RentalCars (car rental), insurance widget.
 *
 * RULE: Never surface a price from these links — we build deep links to the search results
 * pages so the user sees live prices on the provider's site. Only `price` is set when the
 * caller passes in a previously fetched price with a TTL.
 */

import type { AffiliateCard, AffiliatePrice } from "./types";

const TP_MARKER =
  typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_TP_MARKER ?? "585085") : "585085";

function tpId(): string {
  return `tp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function appendMarker(base: string): string {
  const url = new URL(base);
  url.searchParams.set("marker", TP_MARKER);
  return url.toString();
}

// ── IATA helper ──────────────────────────────────────────────────────────────

const CITY_TO_IATA: Record<string, string> = {
  istanbul: "IST",
  barcelona: "BCN",
  paris: "CDG",
  london: "LHR",
  rome: "FCO",
  madrid: "MAD",
  amsterdam: "AMS",
  berlin: "BER",
  lisbon: "LIS",
  athens: "ATH",
};

function toIata(city: string): string | undefined {
  return CITY_TO_IATA[city.toLowerCase().replace(/\s+/g, "")];
}

/** Zero-pad to 2 digits. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format Date as Aviasales DDMM route segment. */
function toAviasalesDDMM(date: Date): string {
  return `${pad2(date.getDate())}${pad2(date.getMonth() + 1)}`;
}

// ── Flight card ──────────────────────────────────────────────────────────────

export interface FlightCardOptions {
  destination: string;
  origin?: string;
  departDate?: Date;
  adults?: number;
  price?: AffiliatePrice;
}

export function buildFlightCard(opts: FlightCardOptions): AffiliateCard {
  const destIata = toIata(opts.destination);
  const originIata = opts.origin ? toIata(opts.origin) : undefined;

  let href: string;
  if (destIata && originIata && opts.departDate) {
    const ddmm = toAviasalesDDMM(opts.departDate);
    href = appendMarker(
      `https://www.aviasales.com/search/${originIata}${ddmm}${destIata}${opts.adults ?? 1}`,
    );
  } else if (destIata) {
    href = appendMarker(`https://www.aviasales.com/search/${destIata}`);
  } else {
    href = appendMarker("https://www.aviasales.com/");
  }

  return {
    id: tpId(),
    type: "flight",
    provider: "travelpayouts_aviasales",
    title: `${opts.destination} Uçuş Arama`,
    href,
    attribution: "Aviasales aracılığıyla",
    cta: "Uçuş Fiyatlarını Gör",
    ...(opts.price ? { price: opts.price } : {}),
    destination: opts.destination,
    createdAt: new Date().toISOString(),
  };
}

// ── Hotel card ───────────────────────────────────────────────────────────────

export interface HotelCardOptions {
  destination: string;
  checkIn?: Date;
  checkOut?: Date;
  adults?: number;
  price?: AffiliatePrice;
}

export function buildHotelCard(opts: HotelCardOptions): AffiliateCard {
  const url = new URL("https://www.hotellook.com/hotels");
  url.searchParams.set("destination", opts.destination);
  url.searchParams.set("adults", String(opts.adults ?? 2));
  url.searchParams.set("currency", "usd");
  if (opts.checkIn) url.searchParams.set("checkIn", opts.checkIn.toISOString().slice(0, 10));
  if (opts.checkOut) url.searchParams.set("checkOut", opts.checkOut.toISOString().slice(0, 10));
  url.searchParams.set("marker", TP_MARKER);

  return {
    id: tpId(),
    type: "hotel",
    provider: "travelpayouts_hotellook",
    title: `${opts.destination} Otel Arama`,
    href: url.toString(),
    attribution: "HotelLook aracılığıyla",
    cta: "Otel Fiyatlarını Gör",
    ...(opts.price ? { price: opts.price } : {}),
    destination: opts.destination,
    createdAt: new Date().toISOString(),
  };
}

// ── Car rental card ──────────────────────────────────────────────────────────

export interface CarRentalCardOptions {
  destination: string;
  pickupDate?: Date;
  dropoffDate?: Date;
  price?: AffiliatePrice;
}

export function buildCarRentalCard(opts: CarRentalCardOptions): AffiliateCard {
  // Travelpayouts RentalCars affiliate link (promo_id 4132 = car rental vertical)
  const url = new URL("https://c.travelpayouts.com/click");
  url.searchParams.set("shmarker", TP_MARKER);
  url.searchParams.set("promo_id", "4132");
  url.searchParams.set("source", "mapsbridge");
  if (opts.pickupDate) url.searchParams.set("pickup", opts.pickupDate.toISOString().slice(0, 10));
  if (opts.dropoffDate)
    url.searchParams.set("dropoff", opts.dropoffDate.toISOString().slice(0, 10));

  return {
    id: tpId(),
    type: "car",
    provider: "travelpayouts_rental",
    title: `${opts.destination} Araç Kiralama`,
    href: url.toString(),
    attribution: "Travelpayouts ortağı aracılığıyla",
    cta: "Araç Fiyatlarını Karşılaştır",
    ...(opts.price ? { price: opts.price } : {}),
    destination: opts.destination,
    createdAt: new Date().toISOString(),
  };
}

// ── Travel insurance card ────────────────────────────────────────────────────

export interface InsuranceCardOptions {
  destination: string;
  departDate?: Date;
  returnDate?: Date;
  price?: AffiliatePrice;
}

export function buildInsuranceCard(opts: InsuranceCardOptions): AffiliateCard {
  // Travelpayouts insurance vertical (promo_id 4133)
  const url = new URL("https://c.travelpayouts.com/click");
  url.searchParams.set("shmarker", TP_MARKER);
  url.searchParams.set("promo_id", "4133");
  url.searchParams.set("source", "mapsbridge");
  if (opts.departDate) url.searchParams.set("from", opts.departDate.toISOString().slice(0, 10));
  if (opts.returnDate) url.searchParams.set("to", opts.returnDate.toISOString().slice(0, 10));

  return {
    id: tpId(),
    type: "insurance",
    provider: "travelpayouts_insurance",
    title: "Seyahat Sigortası",
    href: url.toString(),
    attribution: "Travelpayouts ortağı aracılığıyla",
    cta: "Sigorta Fiyatlarını Gör",
    ...(opts.price ? { price: opts.price } : {}),
    destination: opts.destination,
    createdAt: new Date().toISOString(),
  };
}

// ── Bundle: all cards for a trip ─────────────────────────────────────────────

export interface TripAffiliateBundle {
  flight: AffiliateCard;
  hotel: AffiliateCard;
  carRental: AffiliateCard;
  insurance: AffiliateCard;
}

export function buildTripAffiliateBundle(opts: {
  destination: string;
  origin?: string;
  checkIn?: Date;
  checkOut?: Date;
  adults?: number;
}): TripAffiliateBundle {
  return {
    flight: buildFlightCard({
      destination: opts.destination,
      origin: opts.origin,
      departDate: opts.checkIn,
      adults: opts.adults,
    }),
    hotel: buildHotelCard({
      destination: opts.destination,
      checkIn: opts.checkIn,
      checkOut: opts.checkOut,
      adults: opts.adults,
    }),
    carRental: buildCarRentalCard({
      destination: opts.destination,
      pickupDate: opts.checkIn,
      dropoffDate: opts.checkOut,
    }),
    insurance: buildInsuranceCard({
      destination: opts.destination,
      departDate: opts.checkIn,
      returnDate: opts.checkOut,
    }),
  };
}
