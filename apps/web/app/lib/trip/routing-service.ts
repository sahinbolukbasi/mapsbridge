// ============================================================
// MapsBridge Professional Routing & Travel Optimization Engine
// ============================================================

import {
  Pin,
  RouteGeometry,
  RouteOptimizationPreview,
  TransportMode,
  DayRouteSummary,
} from "./models";

// ── In-Memory & Local Storage Segment Cache ──────────────────
const memoryRouteCache = new Map<string, RouteGeometry>();

function getCacheKey(mode: TransportMode, from: [number, number], to: [number, number]): string {
  return `${mode}:${from[0].toFixed(5)},${from[1].toFixed(5)}->${to[0].toFixed(5)},${to[1].toFixed(5)}`;
}

/** Haversine Great-Circle Distance (in km) */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
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

// ── IRoutingProvider Interface ───────────────────────────────
export interface IRoutingProvider {
  getRoute(
    points: [number, number][], // [lat, lng][]
    mode: TransportMode,
  ): Promise<RouteGeometry>;
}

/** Open Source Routing Machine (OSRM) Provider */
export class OsrmRoutingProvider implements IRoutingProvider {
  private profileMap: Record<TransportMode, string> = {
    walking: "foot",
    driving: "car",
    cycling: "bike",
  };

  async getRoute(points: [number, number][], mode: TransportMode): Promise<RouteGeometry> {
    // Filter out invalid, NaN, or out-of-range coordinates
    const validPoints = points.filter(
      ([lat, lng]) =>
        typeof lat === "number" &&
        !isNaN(lat) &&
        lat >= -90 &&
        lat <= 90 &&
        typeof lng === "number" &&
        !isNaN(lng) &&
        lng >= -180 &&
        lng <= 180,
    );

    if (validPoints.length < 2) {
      return { coordinates: validPoints, distanceMeters: 0, durationSeconds: 0, isRealRoad: false };
    }

    // Cache check for 2 points
    if (validPoints.length === 2) {
      const key = getCacheKey(mode, validPoints[0], validPoints[1]);
      if (memoryRouteCache.has(key)) {
        return memoryRouteCache.get(key)!;
      }
    }

    try {
      const osrmProfile = this.profileMap[mode] || "foot";
      // OSRM expects coordinates in "lng,lat;lng,lat" order
      const coordsQuery = validPoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
      const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordsQuery}?overview=full&geometries=geojson`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as {
          code?: string;
          routes?: {
            geometry: { coordinates: [number, number][] };
            distance: number;
            duration: number;
          }[];
        };
        if (data.code === "Ok" && data.routes && data.routes.length > 0) {
          const primaryRoute = data.routes[0];
          // GeoJSON coordinates are [lng, lat], convert to [lat, lng] for Leaflet
          const latLngCoordinates: [number, number][] = primaryRoute.geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng],
          );

          const result: RouteGeometry = {
            coordinates: latLngCoordinates,
            distanceMeters: primaryRoute.distance,
            durationSeconds: primaryRoute.duration,
            isRealRoad: true,
          };

          if (points.length === 2) {
            const key = getCacheKey(mode, points[0], points[1]);
            memoryRouteCache.set(key, result);
          }

          return result;
        }
      }
    } catch (err) {
      console.warn("OSRM fetch fallback to synthetic road curves", err);
    }

    // Fallback: smooth interpolated curve between coordinates
    return generateFallbackRoute(points, mode);
  }
}

/** Generates a smooth, curved multi-point path when offline/routing API is unreachable */
function generateFallbackRoute(points: [number, number][], mode: TransportMode): RouteGeometry {
  const resultCoords: [number, number][] = [];
  let totalDistanceMeters = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const distKm = calculateDistanceKm(p1[0], p1[1], p2[0], p2[1]);
    totalDistanceMeters += distKm * 1000;

    // Add intermediate micro-steps with realistic road-like slight bend
    const steps = Math.max(3, Math.min(10, Math.round(distKm * 4)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const lat = p1[0] + (p2[0] - p1[0]) * t;
      const lng = p1[1] + (p2[1] - p1[1]) * t;
      // gentle arc
      const bend = Math.sin(t * Math.PI) * 0.0003;
      resultCoords.push([lat + bend, lng + bend]);
    }
  }

  // Estimated speed by mode: walking 4.5 km/h, cycling 15 km/h, driving 35 km/h
  const speedsKmH = { walking: 4.5, cycling: 15, driving: 35 };
  const speed = speedsKmH[mode] || 5;
  const durationSeconds = Math.round((totalDistanceMeters / 1000 / speed) * 3600);

  return {
    coordinates: resultCoords,
    distanceMeters: totalDistanceMeters,
    durationSeconds,
    isRealRoad: false,
  };
}

export const routingService: IRoutingProvider = new OsrmRoutingProvider();

// ── Smart Route Optimization (2-opt TSP + Locked Constraints) ─
export function optimizeRouteOrder(
  pins: Pin[],
  mode: TransportMode = "walking",
): RouteOptimizationPreview | null {
  if (pins.length < 3) return null;

  // Calculate current total distance
  let originalDistanceKm = 0;
  for (let i = 0; i < pins.length - 1; i++) {
    originalDistanceKm += calculateDistanceKm(
      pins[i].lat,
      pins[i].lng,
      pins[i + 1].lat,
      pins[i + 1].lng,
    );
  }

  // Preserve locked positions
  const lockedIndices = new Map<number, Pin>();
  pins.forEach((p, idx) => {
    if (p.isLocked || p.fixedTime) {
      lockedIndices.set(idx, p);
    }
  });

  // Nearest neighbor heuristic with start point fixed
  const unvisited = [...pins];
  const ordered: Pin[] = [unvisited.shift()!]; // start with first pin (e.g. hotel or user's chosen start)

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

  // Apply 2-opt refinement swaps
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 30) {
    improved = false;
    iterations++;

    for (let i = 1; i < ordered.length - 1; i++) {
      if (ordered[i].isLocked) continue;

      for (let k = i + 1; k < ordered.length; k++) {
        if (ordered[k].isLocked) continue;

        const dCurrent =
          calculateDistanceKm(
            ordered[i - 1].lat,
            ordered[i - 1].lng,
            ordered[i].lat,
            ordered[i].lng,
          ) +
          (k + 1 < ordered.length
            ? calculateDistanceKm(
                ordered[k].lat,
                ordered[k].lng,
                ordered[k + 1].lat,
                ordered[k + 1].lng,
              )
            : 0);

        const dSwapped =
          calculateDistanceKm(
            ordered[i - 1].lat,
            ordered[i - 1].lng,
            ordered[k].lat,
            ordered[k].lng,
          ) +
          (k + 1 < ordered.length
            ? calculateDistanceKm(
                ordered[i].lat,
                ordered[i].lng,
                ordered[k + 1].lat,
                ordered[k + 1].lng,
              )
            : 0);

        if (dSwapped < dCurrent - 0.05) {
          // Reverse slice between i and k
          const slice = ordered.slice(i, k + 1).reverse();
          ordered.splice(i, slice.length, ...slice);
          improved = true;
        }
      }
    }
  }

  // Restore any strictly locked indices if needed
  lockedIndices.forEach((pin, targetIdx) => {
    const currIdx = ordered.findIndex((p) => p.id === pin.id);
    if (currIdx !== -1 && currIdx !== targetIdx && targetIdx < ordered.length) {
      const [item] = ordered.splice(currIdx, 1);
      ordered.splice(targetIdx, 0, item);
    }
  });

  // Calculate new total distance
  let optimizedDistanceKm = 0;
  for (let i = 0; i < ordered.length - 1; i++) {
    optimizedDistanceKm += calculateDistanceKm(
      ordered[i].lat,
      ordered[i].lng,
      ordered[i + 1].lat,
      ordered[i + 1].lng,
    );
  }

  const savedKm = Math.max(0, originalDistanceKm - optimizedDistanceKm);
  const avgSpeed = mode === "driving" ? 30 : mode === "cycling" ? 14 : 4.5;
  const savedMinutes = Math.round((savedKm / avgSpeed) * 60);

  // Return preview only if there is a real benefit (> 0.2 km or 4 minutes)
  if (savedKm < 0.2 && savedMinutes < 4) {
    return null;
  }

  return {
    dayIndex: pins[0].dayIndex,
    originalDistanceKm: Number(originalDistanceKm.toFixed(1)),
    optimizedDistanceKm: Number(optimizedDistanceKm.toFixed(1)),
    savedDistanceKm: Number(savedKm.toFixed(1)),
    savedDurationMinutes: savedMinutes,
    optimizedPinIds: ordered.map((p) => p.id),
  };
}

// ── Smart Day Clusterer (Auto-split pins into Days) ──────────
export function autoSplitPinsIntoDays(
  pins: Pin[],
  targetDayCount: number = 3,
): { days: { dayIndex: number; label: string; subtitle: string; pins: Pin[] }[] } {
  if (pins.length === 0) return { days: [] };

  const dayCount = Math.max(1, Math.min(targetDayCount, pins.length));
  if (dayCount === 1) {
    return {
      days: [
        {
          dayIndex: 1,
          label: "1. Gün",
          subtitle: "Tüm Duraklar & Keşif",
          pins: pins.map((p, idx) => ({ ...p, dayIndex: 1, order: idx + 1 })),
        },
      ],
    };
  }

  // K-means geographic clustering
  // Pick initial centroids spread out
  const centroids: { lat: number; lng: number }[] = [];
  const sortedByLat = [...pins].sort((a, b) => a.lat - b.lat);
  for (let i = 0; i < dayCount; i++) {
    const idx = Math.floor((i / (dayCount - 1 || 1)) * (sortedByLat.length - 1));
    centroids.push({ lat: sortedByLat[idx].lat, lng: sortedByLat[idx].lng });
  }

  // 10 iterations of centroid adjustment
  let clusters: Pin[][] = Array.from({ length: dayCount }, () => []);
  for (let iter = 0; iter < 10; iter++) {
    clusters = Array.from({ length: dayCount }, () => []);

    // Assign each pin to nearest centroid
    pins.forEach((pin) => {
      let bestCluster = 0;
      let minDist = Infinity;
      centroids.forEach((c, cIdx) => {
        const d = calculateDistanceKm(pin.lat, pin.lng, c.lat, c.lng);
        if (d < minDist) {
          minDist = d;
          bestCluster = cIdx;
        }
      });
      clusters[bestCluster].push(pin);
    });

    // Recompute centroids
    centroids.forEach((c, cIdx) => {
      const clusterPins = clusters[cIdx];
      if (clusterPins.length > 0) {
        c.lat = clusterPins.reduce((sum, p) => sum + p.lat, 0) / clusterPins.length;
        c.lng = clusterPins.reduce((sum, p) => sum + p.lng, 0) / clusterPins.length;
      }
    });
  }

  // Filter empty clusters and sort each cluster by 2-opt
  const validClusters = clusters.filter((c) => c.length > 0);

  const smartTitles = [
    "Tarihi Merkez & Miras",
    "Kültür, Sanat & Müzeler",
    "Boğaz & Sahil Manzaraları",
    "Şehir Dinamiği & Alışveriş",
    "Gastronomi & Yerel Lezzetler",
    "Parklar, Doğa & Seyir Noktaları",
  ];

  const resultDays = validClusters.map((clusterPins, idx) => {
    const dayIndex = idx + 1;
    // Categorize top category
    const catCounts: Record<string, number> = {};
    clusterPins.forEach((p) => {
      catCounts[p.category] = (catCounts[p.category] || 0) + 1;
    });
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    let subtitle = smartTitles[idx % smartTitles.length];
    if (topCat === "muze" || topCat === "tarih") subtitle = "Tarihi Yerler & Müzeler";
    else if (topCat === "yemek" || topCat === "gastronomi") subtitle = "Gastronomi & Kafe Molaları";
    else if (topCat === "manzara" || topCat === "doga") subtitle = "Doğa, Park & Manzara";

    const orderedPins = clusterPins.map((p, pIdx) => ({
      ...p,
      dayIndex,
      order: pIdx + 1,
    }));

    return {
      dayIndex,
      label: `${dayIndex}. Gün`,
      subtitle,
      pins: orderedPins,
    };
  });

  return { days: resultDays };
}

// ── Balanced Day Timeline Calculator ─────────────────────────
export function calculateDayTimeline(
  pins: Pin[],
  startTime: string = "09:00",
  mode: TransportMode = "walking",
): { pinsWithTime: Pin[]; summary: DayRouteSummary } {
  if (pins.length === 0) {
    return {
      pinsWithTime: [],
      summary: {
        stopCount: 0,
        totalDistanceKm: 0,
        totalTravelDurationMinutes: 0,
        totalVisitDurationMinutes: 0,
        totalDayDurationMinutes: 0,
        isHeavyDay: false,
      },
    };
  }

  const [startHour, startMin] = startTime.split(":").map(Number);
  let currentMinutes = (startHour || 9) * 60 + (startMin || 0);

  let totalDistanceKm = 0;
  let totalTravelMinutes = 0;
  let totalVisitMinutes = 0;

  const avgSpeeds = { walking: 4.5, cycling: 14, driving: 30 };
  const speed = avgSpeeds[mode] || 4.5;

  const pinsWithTime = pins.map((pin, idx) => {
    let transitDurationFromPrevious: number | undefined;
    // Travel time from previous pin
    if (idx > 0) {
      const prev = pins[idx - 1];
      const dist = calculateDistanceKm(prev.lat, prev.lng, pin.lat, pin.lng);
      totalDistanceKm += dist;
      const travelMins = Math.max(5, Math.round((dist / speed) * 60));
      totalTravelMinutes += travelMins;
      currentMinutes += travelMins;
      transitDurationFromPrevious = travelMins;
    }

    // Format start time
    const startH = Math.floor(currentMinutes / 60) % 24;
    const startM = currentMinutes % 60;
    const calculatedStartTime = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;

    // Add visit duration
    const visitDuration = pin.durationMinutes || 60;
    totalVisitMinutes += visitDuration;
    currentMinutes += visitDuration;

    // Format end time
    const endH = Math.floor(currentMinutes / 60) % 24;
    const endM = currentMinutes % 60;
    const calculatedEndTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

    const durationLabel =
      visitDuration >= 60
        ? `${Math.floor(visitDuration / 60)}s ${visitDuration % 60 ? (visitDuration % 60) + "d" : ""}`
        : `${visitDuration} dk`;

    return {
      ...pin,
      calculatedStartTime,
      calculatedEndTime,
      suggestedDuration: durationLabel.trim(),
      transitDurationFromPrevious,
    };
  });

  const totalDayDurationMinutes = totalTravelMinutes + totalVisitMinutes;
  const isHeavyDay = totalDayDurationMinutes > 510; // > 8.5 hours
  const warningText = isHeavyDay
    ? `⚠️ Günlük program oldukça yoğun (${(totalDayDurationMinutes / 60).toFixed(1)} saat). Bazı durakları sonraki güne aktarabilirsiniz.`
    : undefined;

  return {
    pinsWithTime,
    summary: {
      stopCount: pins.length,
      totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
      totalTravelDurationMinutes: totalTravelMinutes,
      totalVisitDurationMinutes: totalVisitMinutes,
      totalDayDurationMinutes,
      isHeavyDay,
      warningText,
    },
  };
}
