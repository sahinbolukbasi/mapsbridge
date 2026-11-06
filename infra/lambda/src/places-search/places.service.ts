// Yer verisi proxy'si: uygulama katmanı (Increment 1.5; bug 3, 4, 5; K2, K3). AWS SDK YOK:
// girdi doğrulama, sağlayıcı seçimi, normalizasyon, önbellek anahtarı/TTL ve akış burada; DynamoDB
// ve sağlayıcı çağrıları port olarak verilir (places.repo.ts, providers/*).
// I1: hiçbir alan uydurulmaz. Kaynakta olmayan alan çıktıya ANAHTAR olarak da yazılmaz (I10).
import { createHash } from "node:crypto";

export type PlacesOp = "search" | "reverse" | "detail" | "nearby";
export type ProviderId = "amazon" | "google";
export type PlacesLang = "tr" | "en";

/** Keşif kategorileri (beyaz liste). İstemci çipleri bu kimliklerle gelir. */
export const PLACE_CATEGORIES = [
  "museum",
  "food",
  "cafe",
  "park",
  "viewpoint",
  "shopping",
  "nightlife",
] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

/** Kategori → sağlayıcıya giden metin sorgusu (dil bağımsız, sağlayıcılar İngilizceyi anlar). */
export const CATEGORY_QUERY: Record<PlaceCategory, string> = {
  museum: "museum",
  food: "restaurant",
  cafe: "cafe",
  park: "park",
  viewpoint: "viewpoint",
  shopping: "shopping",
  nightlife: "bar",
};

export const LIMITS = {
  queryMax: 120,
  idMax: 300,
  radiusMaxM: 20000,
  radiusDefaultM: 5000,
  maxResults: 20,
  guestDailyDefault: 60,
} as const;

export type PlacesQuery =
  | { op: "search"; q: string; lang: PlacesLang; near?: [number, number]; category?: PlaceCategory }
  | { op: "reverse"; lat: number; lng: number; lang: PlacesLang }
  | { op: "detail"; id: string; provider: ProviderId; lang: PlacesLang; reviews: boolean }
  | {
      op: "nearby";
      lat: number;
      lng: number;
      radius: number;
      lang: PlacesLang;
      category?: PlaceCategory;
    };

export type PlaceReview = { author?: string; rating?: number; text?: string; time?: string };
/** Normalize yer. Opsiyonel alanlar yalnız kaynakta varsa bulunur. */
export type Place = {
  id: string;
  provider: ProviderId;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  category?: string;
  openingHours?: string[];
  phone?: string;
  website?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: PlaceReview[];
  attribution: string;
};

export const ATTRIBUTION: Record<ProviderId, string> = {
  amazon: "Amazon Location Service",
  google: "Google",
};

export type ValidationResult = { ok: true; query: PlacesQuery } | { ok: false; error: string };

const num = (v: string | undefined) => (v === undefined || v.trim() === "" ? NaN : Number(v));
const isLat = (n: number) => Number.isFinite(n) && n >= -90 && n <= 90;
const isLng = (n: number) => Number.isFinite(n) && n >= -180 && n <= 180;
/** Kontrol karakterlerini boşluğa çevirir (sağlayıcıya yalnız yazdırılabilir metin gider). */
const clean = (s: string) =>
  Array.from(s, (ch) => {
    const c = ch.charCodeAt(0);
    return c < 32 || c === 127 ? " " : ch;
  })
    .join("")
    .trim();

/** Sorgu parametrelerini doğrular. Kullanıcı girdisi sağlayıcıya yalnız buradan geçer. */
export function validatePlacesQuery(
  params: Record<string, string | undefined> | null | undefined,
): ValidationResult {
  const p = params || {};
  const lang: PlacesLang = p.lang === "en" ? "en" : "tr";
  const category = p.category ? PLACE_CATEGORIES.find((c) => c === p.category) : undefined;
  if (p.category && !category) return { ok: false, error: "Geçersiz kategori." };
  switch (p.action) {
    case "search": {
      const q = clean(p.q || "");
      if (!q) return { ok: false, error: "Arama metni gerekli." };
      if (q.length > LIMITS.queryMax) return { ok: false, error: "Arama metni çok uzun." };
      const lat = num(p.lat),
        lng = num(p.lng);
      const hasNear = p.lat !== undefined || p.lng !== undefined;
      if (hasNear && (!isLat(lat) || !isLng(lng))) return { ok: false, error: "Geçersiz konum." };
      return {
        ok: true,
        query: {
          op: "search",
          q,
          lang,
          ...(hasNear ? { near: [lat, lng] as [number, number] } : {}),
          ...(category ? { category } : {}),
        },
      };
    }
    case "reverse": {
      const lat = num(p.lat),
        lng = num(p.lng);
      if (!isLat(lat) || !isLng(lng)) return { ok: false, error: "Geçersiz konum." };
      return { ok: true, query: { op: "reverse", lat, lng, lang } };
    }
    case "detail": {
      const id = (p.id || "").trim();
      if (!id || id.length > LIMITS.idMax || !/^[A-Za-z0-9_\-.:=+/]+$/.test(id))
        return { ok: false, error: "Geçersiz yer kimliği." };
      const provider: ProviderId | null =
        p.provider === "google" ? "google" : p.provider === "amazon" ? "amazon" : null;
      if (!provider) return { ok: false, error: "Geçersiz sağlayıcı." };
      return {
        ok: true,
        query: { op: "detail", id, provider, lang, reviews: p.reviews === "1" },
      };
    }
    case "nearby": {
      const lat = num(p.lat),
        lng = num(p.lng);
      if (!isLat(lat) || !isLng(lng)) return { ok: false, error: "Geçersiz konum." };
      const radius = p.radius === undefined ? LIMITS.radiusDefaultM : num(p.radius);
      if (!Number.isFinite(radius) || radius < 50 || radius > LIMITS.radiusMaxM)
        return { ok: false, error: "Yarıçap 50 m ile 20 km arasında olmalı." };
      return {
        ok: true,
        query: {
          op: "nearby",
          lat,
          lng,
          radius: Math.round(radius),
          lang,
          ...(category ? { category } : {}),
        },
      };
    }
    default:
      return { ok: false, error: "Geçersiz işlem." };
  }
}

export {
  DEFAULT_PLACES_CONTROL,
  PLACES_CONTROL_KEY,
  parsePlacesControl,
  validatePlacesControlInput,
  type PlacesControl,
} from "./places-control";
import { DEFAULT_PLACES_CONTROL, type PlacesControl } from "./places-control";

/**
 * Sağlayıcı seçimi. reverse her zaman Amazon (Google Places reverse sunmaz). detail, yer
 * kimliğinin geldiği sağlayıcıya gider. search/nearby: Google yalnız kill switch açık + anahtar
 * yapılandırılmış + aylık bütçe kotası tanımlıysa; bütçe kontrolü çağrı anında atomik yapılır.
 */
export function preferredProvider(
  query: PlacesQuery,
  control: PlacesControl,
  googleConfigured: boolean,
): ProviderId {
  if (query.op === "reverse") return "amazon";
  if (query.op === "detail") return query.provider;
  return control.googleEnabled && googleConfigured && control.monthlyGoogleCalls > 0
    ? "google"
    : "amazon";
}

/** Önbellek anahtarı: sağlayıcı + op + normalize parametrelerin sha256'sı. */
export function cacheKey(provider: ProviderId, query: PlacesQuery): string {
  const canonical = JSON.stringify(
    Object.keys(query)
      .sort()
      .map((k) => [k, (query as Record<string, unknown>)[k]]),
  );
  const hash = createHash("sha256").update(canonical).digest("hex");
  return `PLACECACHE#${provider}#${hash}`;
}

const HOUR = 3600;
/**
 * TTL (epoch saniye). Google: tüm alanlar ≤24 saat (lat/lng sınırı 30 gün, ama satır diğer
 * alanları da taşıdığından 24 saat bağlar). Amazon (IntendedUse: Storage): 7 gün.
 */
export function cacheExpiresAt(provider: ProviderId, nowSeconds: number): number {
  return nowSeconds + (provider === "google" ? 24 * HOUR : 7 * 24 * HOUR);
}

/** `undefined`, boş metin, boş dizi ve NaN alanlarını siler (I10: kaynakta yoksa anahtar da yok). */
export function compactPlace(place: Place): Place {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(place)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (typeof v === "number" && !Number.isFinite(v)) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as Place;
}

/** Ad + geçerli koordinat yoksa yer atılır (uydurulmaz). */
export function isUsablePlace(p: Partial<Place>): p is Place {
  return (
    typeof p.id === "string" &&
    p.id.length > 0 &&
    typeof p.name === "string" &&
    p.name.trim().length > 0 &&
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    isLat(p.lat) &&
    isLng(p.lng)
  );
}

export class ProviderUnavailable extends Error {
  constructor(public readonly reason: string) {
    super(`PLACES_PROVIDER_UNAVAILABLE:${reason}`);
    this.name = "ProviderUnavailable";
  }
}

export interface PlacesProvider {
  id: ProviderId;
  run(query: PlacesQuery): Promise<Place[]>;
}

export interface PlacesRepo {
  getCache(key: string, nowSeconds: number): Promise<Place[] | null>;
  putCache(key: string, places: Place[], expiresAt: number): Promise<void>;
  /** Atomik günlük sayaç; limit aşılırsa false. */
  consumeDaily(subject: string, day: string, limit: number): Promise<boolean>;
  /** Atomik aylık Google bütçesi; limit aşılırsa false. */
  consumeGoogleBudget(month: string, limit: number): Promise<boolean>;
  readControl(): Promise<PlacesControl>;
}

export type PlacesResult =
  | { status: 200; body: { status: "ok"; provider: ProviderId; places: Place[]; cached: boolean } }
  | {
      status: 400 | 429 | 503;
      body: { status: "invalid" | "limited" | "unavailable"; error: string };
    };

export type PlacesDeps = {
  repo: PlacesRepo;
  providers: Partial<Record<ProviderId, PlacesProvider>>;
  googleConfigured: boolean;
  now?: () => Date;
};

const dayOf = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const monthOf = (d: Date) => d.toISOString().slice(0, 7).replace(/-/g, "");

/**
 * Akış: doğrula → kontrol → önbellek → kota → (Google bütçesi) → sağlayıcı → önbelleğe yaz.
 * `subject`: girişli kullanıcı için `user#<sub>`, misafir için `ip#<hash>`.
 */
export async function runPlaces(
  params: Record<string, string | undefined> | null | undefined,
  subject: { key: string; guest: boolean },
  deps: PlacesDeps,
): Promise<PlacesResult> {
  const v = validatePlacesQuery(params);
  if (!v.ok) return { status: 400, body: { status: "invalid", error: v.error } };
  const query = v.query;
  const now = (deps.now || (() => new Date()))();
  const nowSeconds = Math.floor(now.getTime() / 1000);
  let control: PlacesControl;
  try {
    control = await deps.repo.readControl();
  } catch {
    control = DEFAULT_PLACES_CONTROL;
  }
  const preferred = preferredProvider(query, control, deps.googleConfigured);
  const order: ProviderId[] =
    preferred === "google" && query.op !== "detail" ? ["google", "amazon"] : [preferred];

  for (const provider of order) {
    const key = cacheKey(provider, query);
    const hit = await deps.repo.getCache(key, nowSeconds).catch(() => null);
    if (hit) return { status: 200, body: { status: "ok", provider, places: hit, cached: true } };
  }

  const limit = subject.guest
    ? Math.min(control.userDailyLimit, LIMITS.guestDailyDefault)
    : control.userDailyLimit;
  const allowed = await deps.repo.consumeDaily(subject.key, dayOf(now), limit).catch(() => false);
  if (!allowed)
    return {
      status: 429,
      body: { status: "limited", error: "Günlük arama sınırına ulaşıldı. Yarın tekrar deneyin." },
    };

  let lastReason = "no_provider";
  for (const provider of order) {
    const impl = deps.providers[provider];
    if (!impl) continue;
    if (provider === "google") {
      // Kill switch: kapalıyken Google hiç çağrılmaz (Google kimlikli detay da).
      if (!control.googleEnabled || !deps.googleConfigured) {
        lastReason = "google_disabled";
        continue;
      }
      const budgetOk = await deps.repo
        .consumeGoogleBudget(monthOf(now), control.monthlyGoogleCalls)
        .catch(() => false);
      if (!budgetOk) {
        lastReason = "google_budget";
        continue;
      }
    }
    try {
      const raw = await impl.run(query);
      const places = raw.filter(isUsablePlace).map(compactPlace).slice(0, LIMITS.maxResults);
      await deps.repo
        .putCache(cacheKey(provider, query), places, cacheExpiresAt(provider, nowSeconds))
        .catch(() => undefined);
      return { status: 200, body: { status: "ok", provider, places, cached: false } };
    } catch (err) {
      lastReason = err instanceof ProviderUnavailable ? err.reason : "provider_error";
    }
  }
  console.warn(JSON.stringify({ msg: "places_unavailable", op: query.op, reason: lastReason }));
  return {
    status: 503,
    body: { status: "unavailable", error: "Yer servisi şu an yanıt vermiyor." },
  };
}
