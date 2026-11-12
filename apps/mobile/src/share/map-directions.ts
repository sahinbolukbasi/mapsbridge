// Harita sağlayıcı yol tarifi derin bağlantıları (D3). Saf, istemci tarafı (I12 çevrimdışı: ağ
// turu yok). Koordinatlar gerçek pin kaydından gelir (I1). Origin verilirse "buradan" rota,
// verilmezse yalnız varış noktası (geolocation reddedilince zarif düşüş). Üç sağlayıcı:
// Apple, Google, Yandex — kullanıcı seçer, varsayılan işletim sistemine göre.

export type MapProvider = "apple" | "google" | "yandex";
export type LatLng = { lat: number; lng: number };

/** Sağlayıcı üstverisi: id + i18n etiket anahtarı (UI sırası bu dizidir). */
export const PROVIDERS: ReadonlyArray<{ id: MapProvider; labelKey: string; fallback: string }> = [
  { id: "google", labelKey: "p.provider.google", fallback: "Google Haritalar" },
  { id: "yandex", labelKey: "p.provider.yandex", fallback: "Yandex Haritalar" },
  { id: "apple", labelKey: "p.provider.apple", fallback: "Apple Haritalar" },
];

/** "lat,lng" (6 ondalık); URL bileşeni olarak güvenli kodlanır. */
function pair(p: LatLng): string {
  return encodeURIComponent(`${Number(p.lat).toFixed(6)},${Number(p.lng).toFixed(6)}`);
}

/**
 * Seçilen sağlayıcıda varış (ve varsa başlangıç) için yol tarifi URL'si üretir.
 * Origin yoksa yalnız-varış bağlantısı döner (geo reddedildi/zaman aşımı).
 */
export function buildDirections({
  dest,
  origin,
  provider,
}: {
  dest: LatLng;
  origin?: LatLng | null;
  provider: MapProvider;
}): string {
  const to = pair(dest);
  const from = origin ? pair(origin) : null;
  switch (provider) {
    case "apple":
      // Apple Haritalar: sürüş (dirflg=d). saddr yalnız origin varsa.
      return from
        ? `https://maps.apple.com/?saddr=${from}&daddr=${to}&dirflg=d`
        : `https://maps.apple.com/?daddr=${to}&dirflg=d`;
    case "google":
      // Google Haritalar yol tarifi API'si.
      return from
        ? `https://www.google.com/maps/dir/?api=1&origin=${from}&destination=${to}`
        : `https://www.google.com/maps/dir/?api=1&destination=${to}`;
    case "yandex":
      // Yandex: rtext=<from>~<to>; origin yoksa `from` boş (rtext=~<to>).
      return `https://yandex.com/maps/?rtext=${from ?? ""}~${to}&rtt=auto`;
  }
}

/**
 * İşletim sistemine uygun varsayılan sağlayıcı: iOS/macOS → Apple, diğerleri → Google.
 * `ua` olarak `navigator.userAgent` ya da `navigator.platform` verilir.
 */
export function defaultProvider(ua: string | null | undefined): MapProvider {
  const s = (ua ?? "").toLowerCase();
  if (/iphone|ipad|ipod|mac/.test(s)) return "apple";
  return "google";
}
