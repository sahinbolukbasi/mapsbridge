// Haritada tıklanan nokta / pin ayrıntısı için "yakında ne var" saf eşleyicisi (FEAT-002, U1/U2).
// Aday veri yer proxy'sinden gelir (placesApi.nearby, S1 — LLM yok, gerçek veri). Burada yalnız
// deterministik dönüşüm + mesafeye göre sıralama vardır (I2); hiçbir alan uydurulmaz (I1/I10).
// Sıralama yalnız mesafe/kaliteye göredir — affiliate/sponsor etkisi yoktur (I8).
import type { ApiPlace, PlacesOk } from "./places-api";
import { haversineMeters } from "./discovery-rank";

/** Tek bir yakın yerin görüntülenmeye hazır, yalnız gerçek alanları taşıyan hali. */
export type NearbyItem = {
  id: string;
  name: string;
  provider: ApiPlace["provider"];
  lat: number;
  lng: number;
  /** Kaynakta varsa kategori/adres; yoksa alan hiç konmaz (I10). */
  category?: string;
  address?: string;
  /** Kaynakta varsa puan/değerlendirme sayısı (yakın aramada genelde yok; I10). */
  rating?: number;
  userRatingCount?: number;
  distanceMeters: number;
  attribution: string;
};

export type MapNearbyOptions = {
  /** Döndürülecek en fazla öğe (varsayılan 8). */
  limit?: number;
  /** Origin'in kendisini (≤ bu yarıçap) elemek için eşik, metre (varsayılan 25 m). */
  originRadiusMeters?: number;
};

const DEFAULT_LIMIT = 8;
const DEFAULT_ORIGIN_RADIUS_M = 25;

const text = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

/**
 * Proxy yanıtını origin'e göre mesafe artan sıralı, kapalı (limit) yakın yer listesine çevirir.
 * Deterministik (I2): eşit mesafede sağlayıcı+id'ye göre kararlı sıra. Origin'in kendisi (çok
 * yakın aynı yer) elenir. Yalnız kaynakta olan alanlar taşınır (I1/I10). Para kazanma yüzeyi
 * sıralamaya girmez (I8): yalnız mesafeye bakılır.
 */
export function mapNearby(
  res: PlacesOk,
  origin: { lat: number; lng: number },
  opts: MapNearbyOptions = {},
): NearbyItem[] {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const originRadius = opts.originRadiusMeters ?? DEFAULT_ORIGIN_RADIUS_M;
  const items: NearbyItem[] = [];
  for (const p of res.places) {
    const distanceMeters = Math.round(haversineMeters(origin, p));
    if (distanceMeters <= originRadius) continue; // origin'in kendisi
    const item: NearbyItem = {
      id: p.id,
      name: p.name,
      provider: p.provider,
      lat: p.lat,
      lng: p.lng,
      distanceMeters,
      attribution: p.attribution,
    };
    const category = text(p.category);
    if (category) item.category = category;
    const address = text(p.address);
    if (address) item.address = address;
    if (typeof p.rating === "number" && Number.isFinite(p.rating) && p.rating >= 0 && p.rating <= 5) {
      item.rating = p.rating;
      if (typeof p.userRatingCount === "number" && Number.isFinite(p.userRatingCount))
        item.userRatingCount = Math.round(p.userRatingCount);
    }
    items.push(item);
  }
  items.sort((a, b) =>
    a.distanceMeters !== b.distanceMeters
      ? a.distanceMeters - b.distanceMeters
      : `${a.provider}:${a.id}` < `${b.provider}:${b.id}`
        ? -1
        : `${a.provider}:${a.id}` > `${b.provider}:${b.id}`
          ? 1
          : 0,
  );
  return items.slice(0, Math.max(0, limit));
}

/** Ters geocoding/arama yanıtının ilk yeri (tıklanan noktada "ne var"); yoksa null (uydurma yok). */
export function reverseLabel(res: PlacesOk): ApiPlace | null {
  return res.places[0] ?? null;
}
