// Harita araması saf mantığı (Increment 1.6, bug 4): koordinat yapıştırma, son aramalar ve
// arama durum makinesi. Ağ ya da DOM yok; test edilebilir. I1: koordinat ayrıştırma yalnız
// kullanıcının yazdığını okur, yer adı uydurmaz.

/** "41.0, 28.97" / "41,0082 28,9784" / "41.0082;28.9784" → { lat, lng }; geçersizse null. */
export function parseCoordinates(text: string): { lat: number; lng: number } | null {
  const raw = text.trim();
  if (!raw || raw.length > 60) return null;
  // Ondalık ayırıcısı virgül olan biçim ("41,0082 28,9784"): iki sayı boşlukla ayrılır.
  const commaDecimal = raw.match(/^(-?\d{1,3},\d+)\s+(-?\d{1,3},\d+)$/);
  const parts = commaDecimal
    ? [commaDecimal[1].replace(",", "."), commaDecimal[2].replace(",", ".")]
    : raw.split(/\s*[,;]\s*|\s+/).filter(Boolean);
  if (parts.length !== 2) return null;
  if (!parts.every((p) => /^-?\d{1,3}(\.\d+)?$/.test(p))) return null;
  const [lat, lng] = parts.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export type RecentSearch = { label: string; address: string; lat: number; lng: number };
export const RECENT_SEARCH_MAX = 8;

const sameRecent = (a: RecentSearch, b: RecentSearch) =>
  a.label.trim().toLowerCase() === b.label.trim().toLowerCase() &&
  Math.abs(a.lat - b.lat) < 1e-5 &&
  Math.abs(a.lng - b.lng) < 1e-5;

/** En yeni başta; tekrarsız; en çok 8. */
export function pushRecent(list: readonly RecentSearch[], entry: RecentSearch): RecentSearch[] {
  return [entry, ...list.filter((r) => !sameRecent(r, entry))].slice(0, RECENT_SEARCH_MAX);
}

/** localStorage'dan okunan değeri doğrular (bozuk kayıt sessizce atılır). */
export function parseRecent(raw: string | null): RecentSearch[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (r): r is RecentSearch =>
          !!r &&
          typeof r === "object" &&
          typeof (r as RecentSearch).label === "string" &&
          typeof (r as RecentSearch).address === "string" &&
          Number.isFinite((r as RecentSearch).lat) &&
          Number.isFinite((r as RecentSearch).lng),
      )
      .slice(0, RECENT_SEARCH_MAX);
  } catch {
    return [];
  }
}

export type SearchStatus = "idle" | "loading" | "results" | "empty" | "error";
export type SearchState<T> = { status: SearchStatus; results: T[]; requestId: number };
export type SearchEvent<T> =
  | { type: "reset" }
  | { type: "start"; requestId: number }
  | { type: "success"; requestId: number; results: T[] }
  | { type: "failure"; requestId: number };

export const initialSearchState = <T>(): SearchState<T> => ({
  status: "idle",
  results: [],
  requestId: 0,
});

/**
 * Durum makinesi. Eski isteğin yanıtı (requestId eşleşmez) yok sayılır. Gerçek boş sonuç
 * `empty`, sağlayıcı/ağ hatası `error` olur: hata asla "Sonuç bulunamadı" diye gösterilmez.
 */
export function searchReducer<T>(state: SearchState<T>, event: SearchEvent<T>): SearchState<T> {
  switch (event.type) {
    case "reset":
      return { status: "idle", results: [], requestId: state.requestId + 1 };
    case "start":
      return { status: "loading", results: state.results, requestId: event.requestId };
    case "success":
      if (event.requestId !== state.requestId) return state;
      return {
        status: event.results.length > 0 ? "results" : "empty",
        results: event.results,
        requestId: state.requestId,
      };
    case "failure":
      if (event.requestId !== state.requestId) return state;
      return { status: "error", results: [], requestId: state.requestId };
  }
}
