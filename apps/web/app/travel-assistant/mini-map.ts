// Oturumlu asistan mini harita türetici (FEAT-004, B4). Rota duraklarının GERÇEK lat/lng
// değerlerini deterministik eşdikdörtgen (equirectangular) izdüşümle sabit bir viewBox'a
// oturtur (I2: geometri algoritmik, LLM değil). Koordinat uydurmaz; <2 geçerli koordinat
// varsa null döner (I1: olmayan harita üretilmez). Saf fonksiyon — React/DOM/ağ yok.
import type { RouteStop, UnifiedRoutePlan } from "../lib/ai/types";

/** viewBox birimleri (sabit; preserveAspectRatio ile ölçeklenir). */
const WIDTH = 320;
const HEIGHT = 180;
const PAD = 18;

export interface MiniMapPoint {
  x: number;
  y: number;
  day: number;
}

export interface MiniMapModel {
  viewBox: string;
  /** Durakları sırayla birleştiren SVG path ("M x y L x y …"). */
  path: string;
  points: MiniMapPoint[];
  /** Başlık parçaları (gerçek rotadan; uydurma yok). Lokalize başlığı sunum katmanı kurar. */
  title: string;
  dayCount: number;
  stopCount: number;
}

function validStops(route: UnifiedRoutePlan): RouteStop[] {
  return route.stops.filter(
    (s) =>
      Number.isFinite(s.lat) &&
      Math.abs(s.lat) <= 90 &&
      Number.isFinite(s.lng) &&
      Math.abs(s.lng) <= 180,
  );
}

/** Bir değeri [min,max] aralığından [0,1]'e ölçekler; aralık sıfırsa ortalar. */
function norm(v: number, min: number, max: number): number {
  const span = max - min;
  return span === 0 ? 0.5 : (v - min) / span;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Rotanın gerçek duraklarından statik mini harita modeli türetir. Enlem/boylamı
 * eşdikdörtgen izdüşümle (cos(ortalama enlem) ile boylam düzeltmesi) viewBox'a oturtur;
 * aynı girdi → aynı çıktı. Geçerli koordinat 2'den azsa null (harita uydurulmaz).
 */
export function routeMiniMap(route: UnifiedRoutePlan): MiniMapModel | null {
  const stops = validStops(route);
  if (stops.length < 2) return null;

  const lats = stops.map((s) => s.lat);
  const lngs = stops.map((s) => s.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Boylamı ortalama enlemin kosinüsüyle düzelt (Mercator değil, basit eşdikdörtgen; I2).
  const meanLat = (minLat + maxLat) / 2;
  const lngScale = Math.max(0.01, Math.cos((meanLat * Math.PI) / 180));

  const innerW = WIDTH - PAD * 2;
  const innerH = HEIGHT - PAD * 2;

  const points: MiniMapPoint[] = stops.map((s) => {
    const nx = norm(s.lng * lngScale, minLng * lngScale, maxLng * lngScale);
    // Enlem yukarı artar; ekranda y aşağı artar → ters çevir.
    const ny = 1 - norm(s.lat, minLat, maxLat);
    return {
      x: round(PAD + nx * innerW),
      y: round(PAD + ny * innerH),
      day: s.day,
    };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  const dayCount = Math.max(1, route.estimatedDays);

  return {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    path,
    points,
    title: route.title,
    dayCount,
    stopCount: stops.length,
  };
}
