// Apple/Google Haritalar'da yol tarifi (K4; bağımlılık yok, Linking.openURL). Saf URL üreticileri
// (test: apps/web/tests/mobile/deep-links.test.cjs). Koordinat yalnız durak kaydından (I1).
export type TravelMode = "walking" | "driving" | "transit";
export type LatLng = { lat: number; lng: number };
const coord = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
const APPLE_FLAG: Record<TravelMode, string> = { walking: "w", driving: "d", transit: "r" };
/** Apple Haritalar (iOS): tek varış ya da sıralı duraklar (son durak varış). */
export function appleMapsUrl(
  stops: readonly LatLng[],
  mode: TravelMode = "walking",
): string | null {
  const valid = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  if (!valid.length) return null;
  const dest = valid[valid.length - 1];
  const from = valid.length > 1 ? `&saddr=${coord(valid[0])}` : "";
  return `https://maps.apple.com/?daddr=${coord(dest)}${from}&dirflg=${APPLE_FLAG[mode]}`;
}
/** Google Haritalar (her iki platform): ara duraklar waypoints ile (en çok 9, Google sınırı). */
export function googleMapsUrl(
  stops: readonly LatLng[],
  mode: TravelMode = "walking",
): string | null {
  const valid = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  if (!valid.length) return null;
  const dest = valid[valid.length - 1];
  const params = [`api=1`, `destination=${coord(dest)}`, `travelmode=${mode}`];
  if (valid.length > 1) {
    params.push(`origin=${coord(valid[0])}`);
    const mid = valid.slice(1, -1).slice(0, 9);
    if (mid.length) params.push(`waypoints=${encodeURIComponent(mid.map(coord).join("|"))}`);
  }
  return `https://www.google.com/maps/dir/?${params.join("&")}`;
}
