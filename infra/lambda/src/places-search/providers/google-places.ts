// Google Places API (New) adaptörü. Anahtar yalnız backend'de (Secrets Manager,
// GOOGLE_PLACES_SECRET_ID); env yoksa sağlayıcı kapalı. X-Goog-FieldMask en dar alan kümesiyle;
// `reviews` yalnız açıkça istenince (reviews=1). İçerik eğitim/RAG/kalıcı DB'ye girmez (K3).
import {
  ATTRIBUTION,
  CATEGORY_QUERY,
  LIMITS,
  ProviderUnavailable,
  type Place,
  type PlacePhoto,
  type PlaceReview,
  type PlacesProvider,
  type PlacesQuery,
} from "../places.service";

export const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
].join(",");
export const DETAIL_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "primaryType",
  "regularOpeningHours",
  "nationalPhoneNumber",
  "websiteUri",
  "rating",
  "userRatingCount",
  "photos",
].join(",");

/** Ayrıntıda çözülen en çok fotoğraf (Places Photo SKU maliyeti sınırlı tutulur). */
export const MAX_DETAIL_PHOTOS = 3;
/** Photo media isteğinde istenen en büyük genişlik (px). */
const PHOTO_MAX_WIDTH = 800;

const BASE = "https://places.googleapis.com/v1";

export const googleConfigured = () => !!process.env.GOOGLE_PLACES_SECRET_ID;

let keyCache: { at: number; value: string } | null = null;
async function apiKey(): Promise<string> {
  const id = process.env.GOOGLE_PLACES_SECRET_ID;
  if (!id) throw new ProviderUnavailable("google_not_configured");
  if (keyCache && Date.now() - keyCache.at < 10 * 60_000) return keyCache.value;
  const { SecretsManagerClient, GetSecretValueCommand } =
    await import("@aws-sdk/client-secrets-manager");
  const sm = new SecretsManagerClient({ region: process.env.AWS_REGION || "eu-central-1" });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: id }), {
    abortSignal: AbortSignal.timeout(1500),
  });
  const value = (res.SecretString || "").trim();
  if (!value) throw new ProviderUnavailable("google_key_empty");
  keyCache = { at: Date.now(), value };
  return value;
}

type GooglePhoto = {
  name?: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: Array<{ displayName?: string }>;
};
type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: Array<{
    rating?: number;
    text?: { text?: string };
    relativePublishTimeDescription?: string;
    authorAttribution?: { displayName?: string };
  }>;
  photos?: GooglePhoto[];
};

/**
 * Fotoğraf çözücü: Google photo `name`'ini medya URL'sine dönüştürür. Yalnız ayrıntı açılışında
 * ve sınırlı sayıda çağrılır (SKU maliyeti); arama/yakın aramada verilmez (photos atılır).
 */
export type PhotoResolver = (name: string) => Promise<string | null>;

/** Google fotoğraflarını sınırlı sayıda (≤MAX_DETAIL_PHOTOS) çözer; URL alınamazsa atlanır (I1). */
async function resolvePhotos(
  photos: GooglePhoto[] | undefined,
  resolve: PhotoResolver,
): Promise<PlacePhoto[]> {
  const out: PlacePhoto[] = [];
  for (const ph of (photos || []).slice(0, MAX_DETAIL_PHOTOS)) {
    if (!ph.name) continue;
    const url = await resolve(ph.name).catch(() => null);
    if (!url) continue;
    const attribution = ph.authorAttributions?.find((a) => a.displayName)?.displayName;
    out.push({
      url,
      ...(attribution ? { attribution } : {}),
      ...(typeof ph.widthPx === "number" ? { width: ph.widthPx } : {}),
      ...(typeof ph.heightPx === "number" ? { height: ph.heightPx } : {}),
    });
  }
  return out;
}

export function fromGoogle(p: GooglePlace): Partial<Place> {
  const reviews: PlaceReview[] | undefined = p.reviews
    ?.slice(0, 5)
    .map((r) => ({
      author: r.authorAttribution?.displayName,
      rating: r.rating,
      text: r.text?.text,
      time: r.relativePublishTimeDescription,
    }))
    .map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)))
    .filter((r) => Object.keys(r).length > 0);
  return {
    id: p.id,
    provider: "google",
    name: p.displayName?.text,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    address: p.formattedAddress,
    category: p.primaryType,
    openingHours: p.regularOpeningHours?.weekdayDescriptions,
    phone: p.nationalPhoneNumber,
    website: p.websiteUri,
    rating: p.rating,
    userRatingCount: p.userRatingCount,
    reviews: reviews && reviews.length ? reviews : undefined,
    attribution: ATTRIBUTION.google,
  };
}

/**
 * Places Photo (New) medya adresi: `GET {BASE}/{photo.name}/media?maxWidthPx=…&skipHttpRedirect=true`
 * JSON `{ photoUri }` döndürür. Yalnız ayrıntı açılışında çağrılır. Hata/boşsa null (uydurma yok).
 */
const resolvePhotoUrl: PhotoResolver = async (name) => {
  const key = await apiKey();
  let res: Response;
  try {
    res = await fetch(
      `${BASE}/${name}/media?maxWidthPx=${PHOTO_MAX_WIDTH}&skipHttpRedirect=true`,
      {
        method: "GET",
        headers: { "X-Goog-Api-Key": key },
        signal: AbortSignal.timeout(3500),
      },
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { photoUri?: string } | null;
  const uri = body?.photoUri;
  return typeof uri === "string" && /^https:\/\//.test(uri) ? uri : null;
};

async function call(url: string, init: RequestInit, mask: string): Promise<unknown> {
  const key = await apiKey();
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": mask,
      },
      signal: AbortSignal.timeout(3500),
    });
  } catch {
    throw new ProviderUnavailable("google_network");
  }
  if (res.status === 403 || res.status === 401) throw new ProviderUnavailable("google_denied");
  if (!res.ok) throw new ProviderUnavailable(`google_http_${res.status}`);
  return res.json();
}

export const googlePlaces: PlacesProvider = {
  id: "google",
  async run(query: PlacesQuery): Promise<Place[]> {
    if (query.op === "reverse") throw new ProviderUnavailable("google_no_reverse");
    if (query.op === "detail") {
      const mask = query.reviews ? `${DETAIL_FIELD_MASK},reviews` : DETAIL_FIELD_MASK;
      const body = (await call(
        `${BASE}/places/${encodeURIComponent(query.id)}?languageCode=${query.lang}`,
        { method: "GET" },
        mask,
      )) as GooglePlace;
      const place = fromGoogle(body) as Place;
      // Fotoğraf URL'leri yalnız ayrıntı açılışında, sınırlı sayıda çözülür (SKU maliyeti).
      const photos = await resolvePhotos(body.photos, resolvePhotoUrl);
      if (photos.length) place.photos = photos;
      return [place];
    }
    if (query.op === "nearby" && !query.category) {
      const body = (await call(
        `${BASE}/places:searchNearby`,
        {
          method: "POST",
          body: JSON.stringify({
            languageCode: query.lang,
            maxResultCount: LIMITS.maxResults,
            locationRestriction: {
              circle: {
                center: { latitude: query.lat, longitude: query.lng },
                radius: query.radius,
              },
            },
          }),
        },
        SEARCH_FIELD_MASK,
      )) as { places?: GooglePlace[] };
      return (body.places || []).map((p) => fromGoogle(p) as Place);
    }
    const textQuery =
      query.op === "search"
        ? query.category
          ? `${CATEGORY_QUERY[query.category]} ${query.q}`
          : query.q
        : CATEGORY_QUERY[query.category!];
    const center =
      query.op === "search"
        ? query.near && { latitude: query.near[0], longitude: query.near[1] }
        : { latitude: query.lat, longitude: query.lng };
    const radius = query.op === "nearby" ? query.radius : LIMITS.radiusDefaultM;
    const body = (await call(
      `${BASE}/places:searchText`,
      {
        method: "POST",
        body: JSON.stringify({
          textQuery,
          languageCode: query.lang,
          pageSize: LIMITS.maxResults,
          ...(center ? { locationBias: { circle: { center, radius } } } : {}),
        }),
      },
      SEARCH_FIELD_MASK,
    )) as { places?: GooglePlace[] };
    return (body.places || []).map((p) => fromGoogle(p) as Place);
  },
};
