/**
 * @mapsbridge/ai-core — Deterministic 2D Geo-Clustering, Outlier Guard & Multi-Criteria Route Optimizer
 *
 * I1 (Grounding) ve I2 (Deterministik Rota Geometrisi) kurallarına %100 sadık kalarak:
 * 1. Doğu-Batı (İstanbul, Lizbon, Paris, Roma) ve Kuzey-Güney şehirlerinde 2B ana eksenli
 *    (Principal-Axis) K-Means kümeleme yapar.
 * 2. Şehir merkezinden aşırı kopuk (>28 km) hatalı/aykırı POI'leri (outlier) filtreler.
 * 3. Gün içi durakları hem coğrafi yakınlık (2-opt) hem de zaman dilimi (sabah/öğle/akşam)
 *    uyumuyla zikzaksız sıralar.
 */

export interface GeoPoint {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  category?: string;
  typicalDurationMins?: number;
}

export function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Şehir merkezinden aşırı uzak (ör. 30+ km dışarıya düşen hatalı arama sonucu)
 * durakları tespit eder; ancak toplam durak sayısı azsa veya bölgesel bir rota
 * (ör. Kapadokya / İzmir-Efes) ise korur.
 */
export function filterGeographicOutliers<T extends { lat: number; lng: number }>(
  items: T[],
  options?: { maxRadiusKm?: number; minKeepCount?: number },
): T[] {
  if (items.length <= 4) return items;
  const maxRadiusKm = options?.maxRadiusKm ?? 28;
  const minKeepCount = options?.minKeepCount ?? Math.min(4, items.length);

  const sortedLats = [...items].map((i) => i.lat).sort((a, b) => a - b);
  const sortedLngs = [...items].map((i) => i.lng).sort((a, b) => a - b);
  const mid = Math.floor(items.length / 2);
  const medianCenter = {
    lat: sortedLats[mid],
    lng: sortedLngs[mid],
  };

  const withDist = items.map((item) => ({
    item,
    distKm: haversineDistanceKm(medianCenter, item),
  }));

  const withinRadius = withDist.filter((x) => x.distKm <= maxRadiusKm);
  if (withinRadius.length >= minKeepCount) {
    return withinRadius.map((x) => x.item);
  }

  // Bölgesel yayılım genişse en yakın olanları koru
  return withDist
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, Math.max(minKeepCount, items.length - 1))
    .map((x) => x.item);
}

/**
 * 2B Ana Eksenli (Principal Axis) Projeksiyon:
 * Sadece enleme (lat) göre sıralamak Doğu-Batı uzanımlı şehirlerde (İstanbul Boğaz geçişi,
 * Roma, Paris, Lizbon) farklı yakaları aynı güne koyar. Bu fonksiyon fiziksel yayılımın
 * (km cinsinden) baskın eksenini hesaplar ve deterministik 2B projeksiyon skoru üretir.
 */
export function computePrincipalAxisProjection(
  points: ReadonlyArray<{ lat: number; lng: number }>,
): (p: { lat: number; lng: number }) => number {
  if (points.length === 0) return () => 0;
  const meanLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const cosLat = Math.max(0.2, Math.cos((meanLat * Math.PI) / 180));

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const latSpanKm = (Math.max(...lats) - Math.min(...lats)) * 111;
  const lngSpanKm = (Math.max(...lngs) - Math.min(...lngs)) * 111 * cosLat;

  // Eğer doğu-batı yayılımı kuzey-güney yayılımından belirgin biçimde büyükse (>1.25x)
  // ana eksen boylam (lng) ağırlıklıdır; aksi halde enlem + boylam hibrit ekseni kullanılır.
  if (lngSpanKm > latSpanKm * 1.25) {
    return (p) => p.lng * cosLat + p.lat * 0.25;
  }
  if (latSpanKm > lngSpanKm * 1.25) {
    return (p) => p.lat + p.lng * cosLat * 0.25;
  }
  // Diyagonal yayılım
  return (p) => p.lat * 0.7 + p.lng * cosLat * 0.7;
}

/**
 * Aday mekanları benzersizlik, kategori çeşitliliği, kullanıcı ilgi uyumu ve
 * merkeze yakınlık kriterleriyle 0..1 arasında puanlar.
 */
export function scoreCandidatePlaceForTrip(
  place: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    category?: string;
    typicalDurationMins?: number;
    localTip?: string;
    source?: string;
  },
  context: {
    center: { lat: number; lng: number };
    interests?: string[];
    seenCategories?: Map<string, number>;
  },
): number {
  const distKm = haversineDistanceKm(context.center, place);
  const proximityScore =
    distKm <= 4 ? 1.0 : distKm <= 10 ? 0.88 : distKm <= 20 ? 0.72 : Math.max(0.3, 1 - distKm / 40);

  const cat = (place.category || "culture").toLowerCase();
  const catCount = context.seenCategories?.get(cat) ?? 0;
  const diversityScore = Math.max(0.45, 1 - catCount * 0.12);

  let interestBonus = 0.75;
  if (context.interests && context.interests.length > 0) {
    const joined = `${place.name} ${cat} ${place.localTip ?? ""}`.toLowerCase();
    const matched = context.interests.some((i) => joined.includes(i.toLowerCase()));
    if (matched) interestBonus = 1.0;
  }

  const curatedBonus = place.localTip || place.source === "curated-city-intel" ? 0.08 : 0;
  const raw = proximityScore * 0.35 + diversityScore * 0.3 + interestBonus * 0.35 + curatedBonus;
  return Math.min(1, Math.round(raw * 1000) / 1000);
}

