// Rota sırası optimizasyonu (karar S19, I2): apps/web/app/lib/trip/routing-service.ts
// optimizeRouteOrder'ın kopyası (en yakın komşu + 2-opt, kuş uçuşu mesafe). Yalnızca istemcide,
// deterministik ve ÜCRETSİZ: sunucu `route_optimize` ucu çağrılmaz, kredi ayrılmaz/düşülmez.
// Eşitliği apps/web/tests/mobile-parity.test.cjs doğrular. Saf modül (React Native yok).
export type OptimizableStop = {
  id: string;
  lat: number;
  lng: number;
  isLocked?: boolean;
  fixedTime?: string;
};
export type TransportMode = "walking" | "driving" | "cycling";
export type OptimizationPreview = {
  originalDistanceKm: number;
  optimizedDistanceKm: number;
  savedDistanceKm: number;
  savedDurationMinutes: number;
  optimizedStopIds: string[];
};
/** Haversine büyük çember mesafesi (km). */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function pathKm(stops: readonly OptimizableStop[]): number {
  let total = 0;
  for (let i = 0; i < stops.length - 1; i++)
    total += calculateDistanceKm(stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng);
  return total;
}
/**
 * Yeni sıra önizlemesi ya da null (3'ten az durak ya da anlamlı kazanç yok: < 0,2 km ve < 4 dk).
 * İlk durak sabittir; kilitli/sabit saatli duraklar yerinde kalır (web ile aynı kural).
 */
export function optimizeStopOrder(
  stops: readonly OptimizableStop[],
  mode: TransportMode = "walking",
): OptimizationPreview | null {
  if (stops.length < 3) return null;
  const originalDistanceKm = pathKm(stops);
  const lockedIndices = new Map<number, OptimizableStop>();
  stops.forEach((p, idx) => {
    if (p.isLocked || p.fixedTime) lockedIndices.set(idx, p);
  });
  const unvisited = [...stops];
  const ordered: OptimizableStop[] = [unvisited.shift()!];
  while (unvisited.length > 0) {
    const current = ordered[ordered.length - 1];
    let nearestIdx = 0;
    let minD = Infinity;
    for (let j = 0; j < unvisited.length; j++) {
      const d = calculateDistanceKm(current.lat, current.lng, unvisited[j].lat, unvisited[j].lng);
      if (d < minD) {
        minD = d;
        nearestIdx = j;
      }
    }
    ordered.push(unvisited.splice(nearestIdx, 1)[0]);
  }
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 30) {
    improved = false;
    iterations++;
    for (let i = 1; i < ordered.length - 1; i++) {
      if (ordered[i].isLocked) continue;
      for (let k = i + 1; k < ordered.length; k++) {
        if (ordered[k].isLocked) continue;
        const next = k + 1 < ordered.length ? ordered[k + 1] : null;
        const dCurrent =
          calculateDistanceKm(
            ordered[i - 1].lat,
            ordered[i - 1].lng,
            ordered[i].lat,
            ordered[i].lng,
          ) + (next ? calculateDistanceKm(ordered[k].lat, ordered[k].lng, next.lat, next.lng) : 0);
        const dSwapped =
          calculateDistanceKm(
            ordered[i - 1].lat,
            ordered[i - 1].lng,
            ordered[k].lat,
            ordered[k].lng,
          ) + (next ? calculateDistanceKm(ordered[i].lat, ordered[i].lng, next.lat, next.lng) : 0);
        if (dSwapped < dCurrent - 0.05) {
          const slice = ordered.slice(i, k + 1).reverse();
          ordered.splice(i, slice.length, ...slice);
          improved = true;
        }
      }
    }
  }
  lockedIndices.forEach((stop, targetIdx) => {
    const currIdx = ordered.findIndex((p) => p.id === stop.id);
    if (currIdx !== -1 && currIdx !== targetIdx && targetIdx < ordered.length) {
      const [item] = ordered.splice(currIdx, 1);
      ordered.splice(targetIdx, 0, item);
    }
  });
  const optimizedDistanceKm = pathKm(ordered);
  const savedKm = Math.max(0, originalDistanceKm - optimizedDistanceKm);
  const avgSpeed = mode === "driving" ? 30 : mode === "cycling" ? 14 : 4.5;
  const savedMinutes = Math.round((savedKm / avgSpeed) * 60);
  if (savedKm < 0.2 && savedMinutes < 4) return null;
  return {
    originalDistanceKm: Number(originalDistanceKm.toFixed(1)),
    optimizedDistanceKm: Number(optimizedDistanceKm.toFixed(1)),
    savedDistanceKm: Number(savedKm.toFixed(1)),
    savedDurationMinutes: savedMinutes,
    optimizedStopIds: ordered.map((p) => p.id),
  };
}
