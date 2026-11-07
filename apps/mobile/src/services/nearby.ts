import * as Location from "expo-location";
import { placesApi, type PlaceCategoryId } from "../trip/places-api";
// "Yakınımda" (K4): konum YALNIZ uygulama açıkken (when-in-use) ve izin PermissionPrompt ile
// alındıktan sonra okunur. Konum sunucuya yalnız yer proxy'si sorgusunun parametresi olarak gider
// (/ai/chat?op=places&action=nearby), saklanmaz. Hata fırlatmaz: konum yoksa null.
export type Position = { lat: number; lng: number };
const POSITION_TIMEOUT_MS = 10_000;
export async function currentPosition(): Promise<Position | null> {
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 }).catch(() => null);
    if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), POSITION_TIMEOUT_MS)),
    ]);
    return fix ? { lat: fix.coords.latitude, lng: fix.coords.longitude } : null;
  } catch {
    return null;
  }
}
/** Konumun çevresindeki yerler (yer proxy'si; LLM yok, kredi düşmez). */
export function nearbyPlaces(pos: Position, category?: PlaceCategoryId) {
  return placesApi.nearby(pos.lat, pos.lng, { radius: 1200, category, lang: "tr" });
}
