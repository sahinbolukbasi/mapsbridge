import { Directory, File, Paths } from "expo-file-system";
import { evictionPlan, shouldStore, type TileEntry } from "./tile-logic";
// Çevrimdışı karo önbelleği (K4, I12). Kurallar tile-logic.ts'te (OSM politikası: yalnız görülen
// karolar, üst sınır, TTL). WebView karoyu yükleyince görüntüyü (CORS'lu OSM karosu) base64 olarak
// RN'e iletir → burada saklanır; ağ yokken karo hatası olunca saklanan görüntü geri verilir.
// Ek ağ isteği yapılmaz. Sistem disk dolunca önbellek dizinini silebilir (Paths.cache).
export { TILE_CACHE } from "./tile-logic";
const dir = () => new Directory(Paths.cache, "map-tiles");
let ensured = false;
function ensureDir(): Directory {
  const d = dir();
  if (!ensured) {
    if (!d.exists) d.create({ intermediates: true });
    ensured = true;
  }
  return d;
}
const fileOf = (key: string) => new File(ensureDir(), `${key}.png`);
let writesSinceSweep = 0;
/** Görülen karoyu saklar (geçersiz/büyük ise yok sayar). Hata fırlatmaz. */
export function storeTile(key: string, base64: string): void {
  try {
    if (!shouldStore(key, base64.length)) return;
    const f = fileOf(key);
    if (f.exists) return;
    f.write(base64, { encoding: "base64" });
    if (++writesSinceSweep >= 50) {
      writesSinceSweep = 0;
      sweepTiles();
    }
  } catch {
    // Önbellek en iyi çaba; harita çalışmaya devam eder.
  }
}
/** Saklanan karo (data URI) ya da null. */
export async function readTile(key: string): Promise<string | null> {
  try {
    const f = fileOf(key);
    if (!f.exists) return null;
    return `data:image/png;base64,${await f.base64()}`;
  } catch {
    return null;
  }
}
/** TTL ve üst sınıra göre temizlik (açılışta ve her 50 yazımda). */
export function sweepTiles(now = Date.now()): number {
  try {
    const entries: TileEntry[] = [];
    for (const item of ensureDir().list()) {
      if (!(item instanceof File) || !item.name.endsWith(".png")) continue;
      entries.push({ key: item.name.slice(0, -4), savedAt: item.modificationTime ?? 0 });
    }
    const drop = evictionPlan(entries, now);
    for (const key of drop) fileOf(key).delete();
    return drop.length;
  } catch {
    return 0;
  }
}
