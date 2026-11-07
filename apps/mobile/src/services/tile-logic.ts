// Çevrimdışı karo önbelleği saf kuralları (K4, I12; test: apps/web/tests/mobile/tile-cache.test.cjs).
// OSM karo kullanım politikasına uygun sınır (operations.osmfoundation.org/policies/tiles):
// - YALNIZ kullanıcının gördüğü karolar saklanır (WebView'in zaten indirdiği görüntü; ek istek yok);
//   önceden indirme / toplu indirme YOK.
// - Üst sınır: MAX_TILES karo ve MAX_ZOOM'a kadar; aşınca en eski görülenler silinir.
// - TTL: TTL_DAYS günden eski karo silinir (sunucunun önbellek süresine yakın tutulur).
// Rota/durak/koordinat önbelleği (tripStore) bundan bağımsızdır ve korunur.
export const TILE_CACHE = { maxTiles: 600, maxZoom: 17, minZoom: 3, ttlDays: 14 } as const;
export type TileKey = string;
export type TileEntry = { key: TileKey; savedAt: number };
const KEY = /^(\d{1,2})-(\d{1,6})-(\d{1,6})$/;
/** z/x/y → "z-x-y" (dosya adı güvenli); geçersizse null. */
export function tileKey(z: number, x: number, y: number): TileKey | null {
  if (![z, x, y].every((n) => Number.isInteger(n) && n >= 0)) return null;
  if (z < TILE_CACHE.minZoom || z > 20) return null;
  const max = 2 ** z;
  if (x >= max || y >= max) return null;
  return `${z}-${x}-${y}`;
}
export function parseTileKey(key: string): { z: number; x: number; y: number } | null {
  const m = KEY.exec(key);
  if (!m) return null;
  const [z, x, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return tileKey(z, x, y) === key ? { z, x, y } : null;
}
/** Bu karo saklanır mı: geçerli anahtar, yakınlık sınırı ve boyut (≤ 200 KB base64). */
export function shouldStore(key: string, base64Length: number): boolean {
  const t = parseTileKey(key);
  return !!t && t.z <= TILE_CACHE.maxZoom && base64Length > 0 && base64Length <= 200_000;
}
/** Silinecek anahtarlar: süresi geçenler + üst sınırı aşan en eskiler. Saf, deterministik. */
export function evictionPlan(entries: readonly TileEntry[], now: number): TileKey[] {
  const ttl = TILE_CACHE.ttlDays * 86_400_000;
  const expired = entries.filter((e) => now - e.savedAt > ttl).map((e) => e.key);
  const fresh = entries
    .filter((e) => now - e.savedAt <= ttl)
    .sort((a, b) => b.savedAt - a.savedAt || (a.key < b.key ? -1 : 1));
  const overflow = fresh.slice(TILE_CACHE.maxTiles).map((e) => e.key);
  return [...expired, ...overflow];
}
