// Planlayıcı pin modeli: web apps/web/app/lib/trip/models.ts'teki PinCategory birebir ve Pin'in
// pin-popup / discovery-rank'in okuduğu alt kümesi (parite testi PinCategory listesini karşılaştırır).
// Mobil durak kaydı (tripStore TripStop) bu modele stopToPin ile çevrilir; alan uydurulmaz (I1).
import type { TripStop } from "../services/tripStore";
export type PinCategory =
  | "tarih"
  | "muze"
  | "yemek"
  | "kahve"
  | "alisveris"
  | "aktivite"
  | "manzara"
  | "eglence"
  | "konaklama"
  | "otel"
  | "doga"
  | "genel"
  | "fotograf"
  | "kultur"
  | "gastronomi"
  | "gezilecek"
  | "turistik"
  | "spor"
  | "gezi";
export interface Pin {
  googlePlaceId?: string;
  placeId?: string;
  placeProvider?: "amazon" | "google";
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  category: PinCategory;
  note?: string;
  /** Gün numarası (1 = 1. gün, 0 = günsüz / Kaydedilenler). */
  dayIndex: number;
  visited: boolean;
}
/** Kategori adı (yer proxy'si ya da kullanıcı metni) → pin kategorisi; bilinmeyen "genel". */
const RULES: ReadonlyArray<[RegExp, PinCategory]> = [
  [/müze|muze|museum|galeri|gallery/i, "muze"],
  [/kahve|cafe|kafe|coffee|bakery|fırın/i, "kahve"],
  [/yeme|yemek|food|restoran|restaurant|lezzet|gastro/i, "yemek"],
  [/tarih|histor|landmark|anıt|anit|cami|mosque|kilise|church|saray|palace|kale|castle/i, "tarih"],
  [/manzara|view|seyir|panorama/i, "manzara"],
  [/alışveriş|alisveris|çarşı|carsi|pazar|market|shop/i, "alisveris"],
  [/park|doğa|doga|nature|garden|bahçe/i, "doga"],
  [/gece|night|bar|club|eğlence|eglence/i, "eglence"],
  [/otel|hotel|konaklama|hostel/i, "konaklama"],
];
export function pinCategoryOf(text: string | undefined): PinCategory {
  const value = text ?? "";
  for (const [re, cat] of RULES) if (re.test(value)) return cat;
  return "genel";
}
/** Durak → Pin (popup/keşif için). `day` 0 ise Kaydedilenler'dedir. */
export function stopToPin(stop: TripStop, day: number): Pin {
  return {
    id: stop.id,
    label: stop.name,
    address: stop.address,
    lat: stop.lat,
    lng: stop.lng,
    category: pinCategoryOf(stop.category),
    note: stop.notes,
    dayIndex: day,
    visited: !!stop.visited,
    ...(stop.placeId ? { placeId: stop.placeId } : {}),
    ...(stop.placeProvider ? { placeProvider: stop.placeProvider } : {}),
  };
}
