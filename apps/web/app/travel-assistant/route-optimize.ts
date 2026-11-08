// Oturumlu asistan rota optimizasyonu (FEAT-004, B4). Planlayıcının KULLANDIĞI aynı
// deterministik istemci 2-opt'u (routing-service.optimizeRouteOrder) yeniden kullanır —
// algoritma BURADA kopyalanmaz (karar S19, I2). Gün gün çalışır: her günün durakları kendi
// içinde yeniden sıralanır, günler arası taşıma yapılmaz. Kredi yok, sunucu çağrısı yok.
import type { RouteStop, UnifiedRoutePlan } from "../lib/ai/types";
import type { Pin, PinCategory } from "../lib/trip/models";
import { optimizeRouteOrder } from "../lib/trip/routing-service";

/** RouteStop'u optimize edici için minimal Pin'e çevirir (yalnız konum + kimlik kullanılır). */
function stopToPin(stop: RouteStop, order: number): Pin {
  return {
    id: stop.id,
    label: stop.name,
    address: stop.address ?? "",
    lat: stop.lat,
    lng: stop.lng,
    category: (stop.category as PinCategory) || "aktivite",
    dayIndex: stop.day,
    order,
    group: "",
    visited: false,
  };
}

export interface AssistantOptimizeResult {
  route: UnifiedRoutePlan;
  /** Toplam kısalan mesafe (km, bir ondalık). */
  savedDistanceKm: number;
}

/**
 * Rotayı gün gün deterministik 2-opt ile yeniden sıralar. Herhangi bir günde iyileşme varsa
 * yeni sıralı rota + toplam tasarruf döner; hiçbir günde iyileşme yoksa null (zaten optimal).
 * Durak verisi (ad, açıklama, koordinat) aynen korunur; yalnızca sıra değişir.
 */
export function optimizeAssistantRoute(route: UnifiedRoutePlan): AssistantOptimizeResult | null {
  const dayCount = Math.max(1, route.estimatedDays);
  let totalSaved = 0;
  let changed = false;
  const reordered: RouteStop[] = [];

  for (let day = 1; day <= dayCount; day++) {
    const dayStops = route.stops.filter((s) => s.day === day);
    if (dayStops.length < 3) {
      reordered.push(...dayStops);
      continue;
    }
    const pins = dayStops.map((s, i) => stopToPin(s, i + 1));
    const preview = optimizeRouteOrder(pins, "walking");
    if (!preview) {
      reordered.push(...dayStops);
      continue;
    }
    const byId = new Map(dayStops.map((s) => [s.id, s]));
    const ordered = preview.optimizedPinIds
      .map((id) => byId.get(id))
      .filter((s): s is RouteStop => Boolean(s));
    // Güvenlik: beklenmedik eksik kimlik olursa özgün sıraya düş.
    if (ordered.length !== dayStops.length) {
      reordered.push(...dayStops);
      continue;
    }
    changed = true;
    totalSaved += preview.savedDistanceKm;
    reordered.push(...ordered);
  }

  if (!changed) return null;

  // distanceToNextKm artık eski sıraya ait; yanlış veri göstermemek için düşür (I1).
  const stops = reordered.map((s) => {
    if (s.distanceToNextKm === undefined) return s;
    const { distanceToNextKm: _drop, ...rest } = s;
    return rest;
  });

  return {
    route: { ...route, stops },
    savedDistanceKm: Number(totalSaved.toFixed(1)),
  };
}
