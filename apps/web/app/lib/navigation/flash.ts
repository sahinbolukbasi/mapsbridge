// Sayfa geçişini aşan tek seferlik geri bildirim (Increment 2.8): örn. asistan rotayı kaydedip
// /maps/'e geçerken başarı toast'ı hedef sayfada gösterilir. sessionStorage yalnız bu sekmede;
// okunduğu anda silinir. Yalnız bilinen anahtarlar (serbest metin taşınmaz).
export type FlashKey = "routeSaved" | "routeOnDevice";
const STORAGE_KEY = "mapsbridge.flash";
const KEYS: readonly FlashKey[] = ["routeSaved", "routeOnDevice"];
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
function store(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
export function setFlash(key: FlashKey, storage: StorageLike | null = store()): void {
  try {
    storage?.setItem(STORAGE_KEY, key);
  } catch {
    // depolama kapalı: geri bildirim atlanır, akış sürer
  }
}
export function takeFlash(storage: StorageLike | null = store()): FlashKey | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY) ?? null;
    storage?.removeItem(STORAGE_KEY);
    return KEYS.includes(raw as FlashKey) ? (raw as FlashKey) : null;
  } catch {
    return null;
  }
}
