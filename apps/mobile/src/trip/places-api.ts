// Yer verisi proxy istemcisi (web apps/web/app/lib/trip/places-api.ts ile aynı sözleşme; tipler,
// placesPath ve parsePlacesResponse birebir, parite testi apps/web/tests/mobile-parity.test.cjs).
// Sunucu: `GET /ai/chat?op=places` (infra/lambda/src/places-search). Tüm olgusal yer verisi buradan
// ya da kullanıcı kaydından gelir (I1): istemci hiçbir alanı tamamlamaz. Misafire açık; oturum
// varsa kullanıcı kotasıyla çalışır. LLM yok, kredi düşmez. Google anahtarı istemcide YOK (K2).
export type PlaceProvider = "amazon" | "google";
export type PlaceCategoryId =
  "museum" | "food" | "cafe" | "park" | "viewpoint" | "shopping" | "nightlife";
export const PLACE_CATEGORY_IDS: readonly PlaceCategoryId[] = [
  "museum",
  "food",
  "cafe",
  "park",
  "viewpoint",
  "shopping",
  "nightlife",
];
export type ApiPlaceReview = { author?: string; rating?: number; text?: string; time?: string };
export type ApiPlacePhoto = { url: string; attribution?: string; width?: number; height?: number };
/** Sunucunun normalize ettiği yer; opsiyonel alanlar yalnız kaynakta varsa gelir. */
export type ApiPlace = {
  id: string;
  provider: PlaceProvider;
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
  reviews?: ApiPlaceReview[];
  photos?: ApiPlacePhoto[];
  attribution: string;
};
export type PlacesOk = { provider: PlaceProvider; places: ApiPlace[] };
/** Arama/keşif zaman aşımı: sunucu sağlayıcı bütçesi 3,5 sn + önbellek/kota. */
export const PLACES_TIMEOUT_MS = 8000;
export type PlacesErrorKind = "unavailable" | "limited" | "invalid" | "network";
export class PlacesApiError extends Error {
  constructor(
    public readonly kind: PlacesErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "PlacesApiError";
  }
}
type Params = Record<string, string | number | boolean | undefined>;
/** `/ai/chat?op=places&action=…` yolu (değerler URL kodlanır; boş değerler atılır). */
export function placesPath(action: "search" | "reverse" | "detail" | "nearby", params: Params) {
  const qs = new URLSearchParams({ op: "places", action });
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || v === false) continue;
    qs.set(k, v === true ? "1" : String(v));
  }
  return `/ai/chat?${qs.toString()}`;
}
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
/** Yalnız http(s) adresli fotoğrafı korur; bozuk girdi atılır (alan tamamlanmaz, I1). */
function sanitizePhotos(value: unknown): ApiPlacePhoto[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const photos: ApiPlacePhoto[] = [];
  for (const p of value) {
    if (!isRecord(p) || typeof p.url !== "string" || !/^https?:\/\//.test(p.url)) continue;
    photos.push({
      url: p.url,
      ...(typeof p.attribution === "string" && p.attribution.trim() !== ""
        ? { attribution: p.attribution }
        : {}),
      ...(finite(p.width) ? { width: p.width } : {}),
      ...(finite(p.height) ? { height: p.height } : {}),
    });
  }
  return photos.length ? photos : undefined;
}
/** Yanıtı doğrular; şemaya uymayan yer atılır (alan tamamlanmaz). */
export function parsePlacesResponse(raw: unknown): PlacesOk {
  if (!isRecord(raw) || raw.status !== "ok" || !Array.isArray(raw.places))
    throw new PlacesApiError("unavailable", "Yer servisi beklenmeyen yanıt verdi.");
  const provider: PlaceProvider = raw.provider === "google" ? "google" : "amazon";
  const places = raw.places
    .filter(
      (p): p is ApiPlace =>
        isRecord(p) &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        p.name.trim() !== "" &&
        finite(p.lat) &&
        finite(p.lng) &&
        (p.provider === "amazon" || p.provider === "google") &&
        typeof p.attribution === "string",
    )
    .map((p) => {
      const photos = sanitizePhotos((p as Record<string, unknown>).photos);
      if (photos) return { ...p, photos };
      if ("photos" in p) {
        const { photos: _dropped, ...rest } = p as ApiPlace;
        return rest as ApiPlace;
      }
      return p;
    });
  return { provider, places };
}
/** HTTP durumundan hata türü (web toError ile aynı eşleme). */
export function errorKindOf(status: number): PlacesErrorKind {
  if (status === 429) return "limited";
  if (status === 400) return "invalid";
  if (status >= 500) return "unavailable";
  return "network";
}
// Ağ katmanı bağımlılığı (test edilebilirlik için enjekte edilir; App/ekran varsayılanı kullanır).
export type PlacesTransport = {
  base: string;
  token: () => Promise<string | undefined>;
  fetch: typeof fetch;
};
let transport: PlacesTransport | null = null;
/** services/api.ts tarafından (API_BASE + oturum belirteci) bir kez kurulur. */
export function configurePlaces(next: PlacesTransport): void {
  transport = next;
}
async function request(path: string): Promise<PlacesOk> {
  if (!transport) throw new PlacesApiError("network", "Yer servisi yapılandırılmadı.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLACES_TIMEOUT_MS);
  try {
    const token = await transport.token().catch(() => undefined);
    const res = await transport.fetch(`${transport.base}${path}`, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        isRecord(body) && typeof body.error === "string"
          ? body.error
          : "Yer servisine ulaşılamadı.";
      throw new PlacesApiError(errorKindOf(res.status), message);
    }
    return parsePlacesResponse(body);
  } catch (err) {
    if (err instanceof PlacesApiError) throw err;
    throw new PlacesApiError("network", "Yer servisine ulaşılamadı.");
  } finally {
    clearTimeout(timer);
  }
}
export type Lang = "tr" | "en";
export const placesApi = {
  search(q: string, opts: { near?: { lat: number; lng: number }; lang?: Lang } = {}) {
    return request(
      placesPath("search", {
        q: q.trim().slice(0, 120),
        lat: opts.near?.lat,
        lng: opts.near?.lng,
        lang: opts.lang,
      }),
    );
  },
  reverse(lat: number, lng: number, lang?: Lang) {
    return request(placesPath("reverse", { lat, lng, lang }));
  },
  detail(id: string, provider: PlaceProvider, opts: { reviews?: boolean; lang?: Lang } = {}) {
    return request(
      placesPath("detail", { id, provider, reviews: !!opts.reviews, lang: opts.lang }),
    );
  },
  nearby(
    lat: number,
    lng: number,
    opts: { radius?: number; category?: PlaceCategoryId; lang?: Lang } = {},
  ) {
    return request(
      placesPath("nearby", {
        lat,
        lng,
        radius: opts.radius,
        category: opts.category,
        lang: opts.lang,
      }),
    );
  },
};
