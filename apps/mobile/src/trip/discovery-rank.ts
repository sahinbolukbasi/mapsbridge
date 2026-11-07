// apps/web/app/lib/trip/discovery-rank.ts ile aynı saf mantık (birebir kopya)
// (parite testi: apps/web/tests/mobile-parity.test.cjs).
// Mekan keşfi sıralaması (Increment 1.8, bug 5; I1, I2, I8). Aday havuzu yer proxy'sinden gelir
// (S1, LLM yok); sıra bu dosyadaki DETERMİNİSTİK skordur (S2), LLM çıktısı değil.
//   skor = interestMatch·w + distanceScore·w + quality·w − repetitionPenalty
// Ağırlık adları/mesafe bozunumu services/ai-assistant/src/application/scoring-engine.ts
// calculatePlaceScore ile aynıdır (interestMatch 0.3, distanceScore 0.1; 0–5000 m doğrusal,
// taban 0.1). Kalite yalnız kaynakta puan varsa katkı verir; yoksa 0, ceza yok, uydurma yok.
// I8: affiliate*/commission*/sponsored* alanları girdiden atılır, skora girmez.
// Hedef: packages/ai-core'a taşınır (architecture-truth.md §4).
import type { ApiPlace, PlaceCategoryId } from "./places-api";
import type { PinCategory } from "./models";

export const DISCOVERY_WEIGHTS = {
  interestMatch: 0.3,
  distanceScore: 0.1,
  quality: 0.05,
} as const;
/** Aynı yerin zaten rotada olması ve aynı kategori yığılması cezaları. */
export const REPETITION = {
  existingPlace: 1,
  sameCategoryEach: 0.04,
  sameCategoryMax: 0.12,
  duplicateRadiusM: 60,
} as const;

/** Keşif kategorisi ↔ planlayıcı pin kategorileri (yığılma cezası için). */
export const CATEGORY_PIN_GROUP: Record<PlaceCategoryId, readonly PinCategory[]> = {
  museum: ["muze", "tarih", "kultur"],
  food: ["yemek", "gastronomi"],
  cafe: ["kahve"],
  park: ["doga", "gezi"],
  viewpoint: ["manzara", "fotograf"],
  shopping: ["alisveris"],
  nightlife: ["eglence"],
};
/** Keşif kategorisinden yeni pinin kategorisi (kullanıcı sonradan değiştirebilir). */
export const PIN_CATEGORY_OF: Record<PlaceCategoryId, PinCategory> = {
  museum: "muze",
  food: "yemek",
  cafe: "kahve",
  park: "doga",
  viewpoint: "manzara",
  shopping: "alisveris",
  nightlife: "eglence",
};

export type DiscoveryCandidate = ApiPlace & {
  /** Adayı getiren keşif sorgusunun kategorisi (ilgi eşleşmesi buradan). */
  queriedCategory?: PlaceCategoryId;
  [extra: string]: unknown;
};
export type ExistingPin = {
  id: string;
  lat: number;
  lng: number;
  category: PinCategory;
  placeId?: string;
  googlePlaceId?: string;
};
export type RankOptions = {
  interests: readonly PlaceCategoryId[];
  anchor: { lat: number; lng: number };
  /** Tüm gezideki ve Kaydedilenler'deki pinler (aynı yer tekrar önerilmez). */
  existingPins: readonly ExistingPin[];
  /** Aktif günün pinleri (kategori yığılması). */
  dayPins: readonly ExistingPin[];
};
export type ScoreComponents = {
  interestMatch: number;
  distanceScore: number;
  /** Kaynakta puan yoksa null (katkı 0). */
  quality: number | null;
  repetitionPenalty: number;
};
export type Reason =
  | { key: "interest"; category: PlaceCategoryId }
  | { key: "distance"; meters: number }
  | { key: "rating"; rating: number; count?: number }
  | { key: "alreadyPlanned" }
  | { key: "sameCategory"; count: number };
export type RankedCandidate = {
  place: ApiPlace;
  category?: PlaceCategoryId;
  score: number;
  distanceMeters: number;
  components: ScoreComponents;
  reasons: Reason[];
};

const R = 6371000;
export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** scoring-engine calculatePlaceScore ile aynı bozunum: 0 m → 1, 5000 m+ → 0.1 taban. */
export const distanceScoreOf = (meters: number) => Math.max(0.1, Math.min(1, 1 - meters / 5000));

/** Yalnız kaynakta puan varsa: (puan/5) × güven(değerlendirme sayısı). Yoksa null. */
export function qualityOf(place: ApiPlace): number | null {
  if (typeof place.rating !== "number" || !Number.isFinite(place.rating)) return null;
  if (place.rating < 0 || place.rating > 5) return null;
  const count = typeof place.userRatingCount === "number" ? Math.max(0, place.userRatingCount) : 0;
  const confidence = Math.min(1, Math.log10(count + 1) / 3);
  return (place.rating / 5) * confidence;
}

const MONETIZATION_KEY = /^(affiliate|commission|sponsor|partner|booking)/i;
/** I8: para kazanma alanları atılır; yalnız ApiPlace alanları kalır. */
export function stripMonetization(c: DiscoveryCandidate): ApiPlace {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c)) {
    if (MONETIZATION_KEY.test(k) || k === "queriedCategory") continue;
    out[k] = v;
  }
  return out as ApiPlace;
}

const round = (n: number) => Math.round(n * 10000) / 10000;

/** Deterministik sıralama: skor azalan, eşitlikte id artan. Aynı girdi → aynı sıra. */
export function rankCandidates(
  pool: readonly DiscoveryCandidate[],
  opts: RankOptions,
): RankedCandidate[] {
  const seen = new Set<string>();
  const ranked: RankedCandidate[] = [];
  for (const raw of pool) {
    const key = `${raw.provider}:${raw.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const place = stripMonetization(raw);
    const category = raw.queriedCategory;
    const distanceMeters = Math.round(haversineMeters(opts.anchor, place));
    const interestMatch = category && opts.interests.includes(category) ? 1 : 0;
    const distanceScore = distanceScoreOf(distanceMeters);
    const quality = qualityOf(place);
    const already = opts.existingPins.some(
      (p) =>
        (p.placeId && p.placeId === place.id) ||
        (p.googlePlaceId && p.googlePlaceId === place.id) ||
        haversineMeters(p, place) <= REPETITION.duplicateRadiusM,
    );
    const sameCategory = category
      ? opts.dayPins.filter((p) => CATEGORY_PIN_GROUP[category].includes(p.category)).length
      : 0;
    const repetitionPenalty =
      (already ? REPETITION.existingPlace : 0) +
      Math.min(REPETITION.sameCategoryMax, sameCategory * REPETITION.sameCategoryEach);
    const score = round(
      interestMatch * DISCOVERY_WEIGHTS.interestMatch +
        distanceScore * DISCOVERY_WEIGHTS.distanceScore +
        (quality ?? 0) * DISCOVERY_WEIGHTS.quality -
        repetitionPenalty,
    );
    const reasons: Reason[] = [];
    if (interestMatch && category) reasons.push({ key: "interest", category });
    reasons.push({ key: "distance", meters: distanceMeters });
    if (quality !== null && typeof place.rating === "number")
      reasons.push({
        key: "rating",
        rating: place.rating,
        ...(typeof place.userRatingCount === "number" ? { count: place.userRatingCount } : {}),
      });
    if (already) reasons.push({ key: "alreadyPlanned" });
    if (sameCategory > 0) reasons.push({ key: "sameCategory", count: sameCategory });
    ranked.push({
      place,
      ...(category ? { category } : {}),
      score,
      distanceMeters,
      components: {
        interestMatch,
        distanceScore: round(distanceScore),
        quality,
        repetitionPenalty,
      },
      reasons,
    });
  }
  return ranked.sort((a, b) =>
    b.score !== a.score
      ? b.score - a.score
      : a.place.id < b.place.id
        ? -1
        : a.place.id > b.place.id
          ? 1
          : 0,
  );
}

/** Noktaların ağırlık merkezi; boşsa null (uydurma merkez yok). */
export function centroid(points: readonly { lat: number; lng: number }[]) {
  const pts = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (pts.length === 0) return null;
  return {
    lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
    lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
  };
}
