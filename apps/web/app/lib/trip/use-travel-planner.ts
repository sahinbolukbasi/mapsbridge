// ============================================================
// useTravelPlanner — Full state machine for Travel Day Planning
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Trip,
  TripDay,
  Pin,
  TransportMode,
  RouteGeometry,
  RouteOptimizationPreview,
  DEFAULT_CATEGORY_META,
  DAY_COLORS,
} from "./models";
import {
  routingService,
  optimizeRouteOrder,
  autoSplitPinsIntoDays,
  calculateDayTimeline,
  calculateDistanceKm,
} from "./routing-service";
import { routesApi, RouteEntity, RouteStop } from "../api-client";
import { getStoredSession } from "../cognito";

const STORAGE_KEY = "mapsbridge.travelPlanner.v5";

function routeEntityToTrip(entity: RouteEntity): Trip {
  const pins: Pin[] = (entity.stops || []).map((s, idx) => ({
    id: s.id || `pin-${idx}`,
    label: s.name,
    address: s.address || "",
    lat: s.lat,
    lng: s.lng,
    category: (s.category as any) || "genel",
    dayIndex: s.day || 1,
    order: idx + 1,
    group: "",
    visited: false,
    durationMinutes: s.suggestedDuration || 60,
    note: s.note,
    photos: s.photos || [],
  }));

  const dayNumbers = Array.from(new Set(pins.map((p) => p.dayIndex).filter(Boolean)));
  if (dayNumbers.length === 0) dayNumbers.push(1);

  const days: TripDay[] = dayNumbers
    .sort((a, b) => a - b)
    .map((d) => ({
      dayIndex: d,
      label: `${d}. Gün`,
      color: DAY_COLORS[(d - 1) % DAY_COLORS.length],
      subtitle: d === 1 ? "Keşif Başlangıcı" : `${d}. Gün Rotası`,
      pins: pins.filter((p) => p.dayIndex === d),
    }));

  return {
    id: entity.routeId,
    title: entity.name || "Yeni Seyahat Planım",
    destination: "",
    transportMode: "walking",
    isPublic: entity.isPublic ?? false,
    groups: [],
    days,
    pins,
  };
}

function tripToRouteStops(trip: Trip): RouteStop[] {
  return trip.pins.map((p) => ({
    id: p.id,
    name: p.label,
    lat: p.lat,
    lng: p.lng,
    category: p.category,
    address: p.address,
    day: p.dayIndex,
    note: p.note,
    photos: p.photos,
    suggestedDuration: p.durationMinutes,
  }));
}

function createInitialTrips(): Trip[] {
  return [
    {
      id: "trip-1",
      title: "Yeni Seyahat Planım",
      destination: "",
      transportMode: "walking",
      isPublic: false,
      groups: [],
      days: [
        { dayIndex: 1, label: "1. Gün", color: DAY_COLORS[0], subtitle: "Keşif Başlangıcı", pins: [] },
      ],
      pins: [],
    },
  ];
}

const GENERAL_STORAGE_KEY = "mapsbridge.generalPins.v5";

function createInitialGeneralPins(): Pin[] {
  return [];
}

export function useTravelPlanner() {
  const [trips, setTrips] = useState<Trip[]>(() => {
    if (typeof window === "undefined") return createInitialTrips();
    try {
      // Clean up legacy keys if they exist
      localStorage.removeItem("mapsbridge.travelPlanner");
      localStorage.removeItem("mapsbridge.generalPins");
      
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((t) => ({
            ...t,
            title: t.title === "İstanbul Keşfi" ? "Yeni Seyahat Planım" : t.title,
            destination: (t.destination === "İstanbul, Türkiye" || t.destination === "Destinasyon Belirlenmedi") ? "" : (t.destination || ""),
          }));
        }
      }
    } catch {}
    return createInitialTrips();
  });

  const [generalPins, setGeneralPins] = useState<Pin[]>(() => {
    if (typeof window === "undefined") return createInitialGeneralPins();
    try {
      const raw = localStorage.getItem(GENERAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return createInitialGeneralPins();
  });

  const [activeTripId, setActiveTripId] = useState<string>(() => trips[0]?.id || "trip-1");
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(1); // 1 = Day 1, null = All
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [transportMode, setTransportMode] = useState<TransportMode>("walking");
  const [activeRoadGeometry, setActiveRoadGeometry] = useState<RouteGeometry | null>(null);
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);
  const [optimizationPreview, setOptimizationPreview] = useState<RouteOptimizationPreview | null>(null);
  const [aiMessageToast, setAiMessageToast] = useState<string | null>(null);

  // Persist generalPins to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(GENERAL_STORAGE_KEY, JSON.stringify(generalPins));
      } catch {}
    }
  }, [generalPins]);

  // Active Trip reference
  const activeTrip = useMemo(() => {
    return trips.find((t) => t.id === activeTripId) || trips[0] || null;
  }, [trips, activeTripId]);

  // Sync transport mode from trip
  useEffect(() => {
    if (activeTrip?.transportMode) {
      setTransportMode(activeTrip.transportMode);
    }
  }, [activeTrip?.id]);

  // Persist trips to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && trips.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
      } catch {}
    }
  }, [trips]);

  // Load real server routes on initial load / login
  useEffect(() => {
    if (typeof window === "undefined") return;
    const session = getStoredSession();
    if (!session?.token) return;

    routesApi
      .list()
      .then((res) => {
        if (res?.routes && Array.isArray(res.routes)) {
          if (res.routes.length > 0) {
            const loadedTrips = res.routes.map(routeEntityToTrip);
            setTrips(loadedTrips);
            setActiveTripId(loadedTrips[0]?.id || "trip-1");
          } else {
            const initial = createInitialTrips();
            setTrips(initial);
            setActiveTripId(initial[0].id);
          }
        }
      })
      .catch((err) => console.warn("Failed to load routes from server:", err));
  }, []);

  // Debounced auto-sync of active trip to server
  const serverSyncTimerRef = useRef<any>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !activeTrip) return;
    const session = getStoredSession();
    if (!session?.token) return;

    if (serverSyncTimerRef.current) clearTimeout(serverSyncTimerRef.current);
    serverSyncTimerRef.current = setTimeout(async () => {
      try {
        const stops = tripToRouteStops(activeTrip);
        if (activeTrip.id.startsWith("trip-")) {
          const res = await routesApi.create({
            name: activeTrip.title || "Yeni Rota",
            stops,
            isPublic: activeTrip.isPublic,
          });
          if (res?.routeId) {
            setTrips((prev) =>
              prev.map((t) => (t.id === activeTrip.id ? { ...t, id: res.routeId } : t))
            );
            setActiveTripId(res.routeId);
          }
        } else {
          await routesApi.update(activeTrip.id, {
            name: activeTrip.title,
            stops,
            isPublic: activeTrip.isPublic,
          });
        }
      } catch (err) {
        console.warn("Server sync error:", err);
      }
    }, 1500);

    return () => {
      if (serverSyncTimerRef.current) clearTimeout(serverSyncTimerRef.current);
    };
  }, [activeTrip?.id, activeTrip?.title, activeTrip?.pins, activeTrip?.isPublic]);

  // Current Day
  const currentDay = useMemo(() => {
    if (!activeTrip || activeDayIndex === null || activeDayIndex === 0) return null;
    return activeTrip.days.find((d) => d.dayIndex === activeDayIndex) || null;
  }, [activeTrip, activeDayIndex]);

  // Pins for current view with timeline calculated
  const { pinsWithTime, daySummary } = useMemo(() => {
    if (!activeTrip) {
      return { pinsWithTime: [], daySummary: null };
    }

    if (activeDayIndex === null || activeDayIndex === 0) {
      // All pins
      const sorted = [...activeTrip.pins].sort((a, b) => {
        if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
        return a.order - b.order;
      });
      return {
        pinsWithTime: sorted,
        daySummary: {
          stopCount: sorted.length,
          totalDistanceKm: 0,
          totalTravelDurationMinutes: 0,
          totalVisitDurationMinutes: sorted.reduce((acc, p) => acc + (p.durationMinutes || 60), 0),
          totalDayDurationMinutes: 0,
          isHeavyDay: false,
        },
      };
    }

    const dayPins = activeTrip.pins
      .filter((p) => p.dayIndex === activeDayIndex)
      .sort((a, b) => a.order - b.order);

    const startTime = currentDay?.startTime || "09:00";
    const res = calculateDayTimeline(dayPins, startTime, transportMode);

    return {
      pinsWithTime: res.pinsWithTime,
      daySummary: res.summary,
    };
  }, [activeTrip, activeDayIndex, currentDay, transportMode]);

  // Debounced real road route calculation
  const routingDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (pinsWithTime.length < 2) {
      setActiveRoadGeometry(null);
      setOptimizationPreview(null);
      return;
    }

    if (routingDebounceRef.current) {
      clearTimeout(routingDebounceRef.current);
    }

    routingDebounceRef.current = setTimeout(async () => {
      setIsRoutingLoading(true);
      // Dinamik Rota Yeniden Oluşturma: Duraklar 'Gidildi' işaretlendikçe aktif rota
      // son ziyaret edilen duraktan başlayıp kalan tüm gidilmemiş durakları bağlayacak şekilde yeniden çizilir
      const unvisitedPins = pinsWithTime.filter((p) => !p.visited);
      const visitedPins = pinsWithTime.filter((p) => p.visited);
      let activeRoutePins = pinsWithTime;

      if (unvisitedPins.length === 0) {
        // Tüm duraklar tamamlandıysa rotanın tamamını göster
        activeRoutePins = pinsWithTime;
      } else if (visitedPins.length > 0 && unvisitedPins.length > 0) {
        // Son ziyaret edilen duraktan kalan duraklara doğru dinamik rota oluştur
        const lastVisited = visitedPins[visitedPins.length - 1];
        activeRoutePins = [lastVisited, ...unvisitedPins];
      } else {
        activeRoutePins = pinsWithTime;
      }

      if (activeRoutePins.length < 2) {
        setActiveRoadGeometry(null);
        setIsRoutingLoading(false);
        return;
      }

      const points: [number, number][] = activeRoutePins.map((p) => [p.lat, p.lng]);
      try {
        const geom = await routingService.getRoute(points, transportMode);
        setActiveRoadGeometry(geom);

        // Check if route optimization can offer savings (only in a specific day view)
        if (activeDayIndex !== null && activeDayIndex > 0 && pinsWithTime.length >= 3) {
          const opt = optimizeRouteOrder(pinsWithTime, transportMode);
          setOptimizationPreview(opt);
        } else {
          setOptimizationPreview(null);
        }
      } catch (err) {
        console.warn("Route calculation error:", err);
      } finally {
        setIsRoutingLoading(false);
      }
    }, 280);

    return () => {
      if (routingDebounceRef.current) clearTimeout(routingDebounceRef.current);
    };
  }, [pinsWithTime, transportMode, activeDayIndex]);

  // ── Trip Actions ─────────────────────────────────────────────

  const createTrip = useCallback((title: string, destination?: string) => {
    const newTripId = "trip-" + Date.now();
    const newTrip: Trip = {
      id: newTripId,
      title: title.trim() || "Yeni Seyahat",
      destination: destination?.trim(),
      transportMode: "walking",
      isPublic: false,
      groups: [],
      days: [
        { dayIndex: 1, label: "1. Gün", color: DAY_COLORS[0], subtitle: "Keşif Başlangıcı", pins: [] },
      ],
      pins: [],
    };
    setTrips((prev) => [...prev, newTrip]);
    setActiveTripId(newTripId);
    setActiveDayIndex(1);
    setSelectedPinId(null);
  }, []);

  const switchTrip = useCallback((tripId: string) => {
    setActiveTripId(tripId);
    setActiveDayIndex(1);
    setSelectedPinId(null);
    setOptimizationPreview(null);
  }, []);

  const deleteTrip = useCallback((tripId: string) => {
    if (!tripId.startsWith("trip-")) {
      routesApi.delete(tripId).catch((err) => console.warn("Delete trip server error:", err));
    }
    setTrips((prev) => {
      const remaining = prev.filter((t) => t.id !== tripId);
      if (remaining.length === 0) {
        const freshId = "trip-" + Date.now();
        setActiveTripId(freshId);
        setActiveDayIndex(1);
        setSelectedPinId(null);
        return [
          {
            id: freshId,
            title: "Yeni Seyahat Planım",
            transportMode: "walking",
            isPublic: false,
            groups: [],
            days: [{ dayIndex: 1, label: "1. Gün", color: DAY_COLORS[0], subtitle: "Keşif Başlangıcı", pins: [] }],
            pins: [],
          },
        ];
      }
      if (activeTripId === tripId) {
        setActiveTripId(remaining[0].id);
        setActiveDayIndex(1);
        setSelectedPinId(null);
      }
      return remaining;
    });
  }, [activeTripId]);

  const updateTripInfo = useCallback(
    (updates: Partial<Pick<Trip, "title" | "destination" | "startDate" | "endDate" | "theme" | "isPublic">>) => {
      setTrips((prev) =>
        prev.map((t) => (t.id === activeTripId ? { ...t, ...updates } : t))
      );
    },
    [activeTripId]
  );

  const changeTransportMode = useCallback(
    (mode: TransportMode) => {
      setTransportMode(mode);
      setTrips((prev) =>
        prev.map((t) => (t.id === activeTripId ? { ...t, transportMode: mode } : t))
      );
    },
    [activeTripId]
  );

  // ── Day Actions ──────────────────────────────────────────────

  const addDay = useCallback(() => {
    if (!activeTrip) return;
    const currentDays = activeTrip.days;
    const nextIndex =
      currentDays.length > 0 ? Math.max(...currentDays.map((d) => d.dayIndex)) + 1 : 1;
    const newDay: TripDay = {
      dayIndex: nextIndex,
      label: `${nextIndex}. Gün`,
      color: DAY_COLORS[(nextIndex - 1) % DAY_COLORS.length],
      subtitle: "Yeni Keşif Günü",
      startTime: "09:00",
      pins: [],
    };

    setTrips((prev) =>
      prev.map((t) =>
        t.id === activeTripId ? { ...t, days: [...t.days, newDay] } : t
      )
    );
    setActiveDayIndex(nextIndex);
  }, [activeTrip, activeTripId]);

  const removeDay = useCallback(
    (dayIndex: number) => {
      if (!activeTrip || activeTrip.days.length <= 1) return;

      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== activeTripId) return t;
          const updatedDays = t.days.filter((d) => d.dayIndex !== dayIndex);
          // Move deleted day's pins to Day 1
          const updatedPins = t.pins.map((p) =>
            p.dayIndex === dayIndex ? { ...p, dayIndex: 1 } : p
          );
          return { ...t, days: updatedDays, pins: updatedPins };
        })
      );

      if (activeDayIndex === dayIndex) {
        setActiveDayIndex(1);
      }
    },
    [activeTrip, activeTripId, activeDayIndex]
  );

  // ── Pin Actions ──────────────────────────────────────────────

  const addPin = useCallback(
    (newPinData: Omit<Pin, "id" | "order">) => {
      const pinId = "pin-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
      const targetDay = newPinData.dayIndex || activeDayIndex || 1;

      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== activeTripId) return t;
          const pinsInDay = t.pins.filter((p) => p.dayIndex === targetDay);
          const nextOrder = pinsInDay.length + 1;

          const completePin: Pin = {
            ...newPinData,
            id: pinId,
            tripId: t.id,
            dayIndex: targetDay,
            order: nextOrder,
            durationMinutes:
              newPinData.durationMinutes ||
              DEFAULT_CATEGORY_META[newPinData.category]?.defaultDuration ||
              60,
          };

          return { ...t, pins: [...t.pins, completePin] };
        })
      );

      setSelectedPinId(pinId);
    },
    [activeTripId, activeDayIndex]
  );

  const updatePin = useCallback(
    (pinId: string, updates: Partial<Pin>) => {
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== activeTripId) return t;
          return {
            ...t,
            pins: t.pins.map((p) => (p.id === pinId ? { ...p, ...updates } : p)),
          };
        })
      );
    },
    [activeTripId]
  );

  const deletePin = useCallback(
    (pinId: string) => {
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== activeTripId) return t;
          const pin = t.pins.find((p) => p.id === pinId);
          if (!pin) return t;

          const filteredPins = t.pins.filter((p) => p.id !== pinId);
          // Reindex order for that day
          const reordered = filteredPins.map((p) => {
            if (p.dayIndex === pin.dayIndex && p.order > pin.order) {
              return { ...p, order: p.order - 1 };
            }
            return p;
          });

          return { ...t, pins: reordered };
        })
      );

      if (selectedPinId === pinId) {
        setSelectedPinId(null);
      }
    },
    [activeTripId, selectedPinId]
  );

  const movePinOrder = useCallback(
    (pinId: string, direction: "up" | "down") => {
      if (!activeTrip) return;
      const targetPin = activeTrip.pins.find((p) => p.id === pinId);
      if (!targetPin) return;

      const dayPins = activeTrip.pins
        .filter((p) => p.dayIndex === targetPin.dayIndex)
        .sort((a, b) => a.order - b.order);

      const currentIndex = dayPins.findIndex((p) => p.id === pinId);
      if (
        (direction === "up" && currentIndex <= 0) ||
        (direction === "down" && currentIndex >= dayPins.length - 1)
      ) {
        return;
      }

      const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      const otherPin = dayPins[swapIndex];

      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== activeTripId) return t;
          return {
            ...t,
            pins: t.pins.map((p) => {
              if (p.id === targetPin.id) return { ...p, order: otherPin.order };
              if (p.id === otherPin.id) return { ...p, order: targetPin.order };
              return p;
            }),
          };
        })
      );
    },
    [activeTrip, activeTripId]
  );

  const movePinToDay = useCallback(
    (pinId: string, targetDayIndex: number) => {
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== activeTripId) return t;
          const targetDayPins = t.pins.filter((p) => p.dayIndex === targetDayIndex);
          const nextOrder = targetDayPins.length + 1;

          return {
            ...t,
            pins: t.pins.map((p) =>
              p.id === pinId ? { ...p, dayIndex: targetDayIndex, order: nextOrder } : p
            ),
          };
        })
      );
    },
    [activeTripId]
  );

  const togglePinVisited = useCallback(
    (pinId: string) => {
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== activeTripId) return t;
          return {
            ...t,
            pins: t.pins.map((p) => (p.id === pinId ? { ...p, visited: !p.visited } : p)),
          };
        })
      );
    },
    [activeTripId]
  );

  const markVisitedAndAdvance = useCallback(
    (pinId: string) => {
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== activeTripId) return t;
          return {
            ...t,
            pins: t.pins.map((p) => (p.id === pinId ? { ...p, visited: true } : p)),
          };
        })
      );

      // Auto advance to next unvisited pin
      const remainingUnvisited = pinsWithTime.filter((p) => !p.visited && p.id !== pinId);
      if (remainingUnvisited.length > 0) {
        setSelectedPinId(remainingUnvisited[0].id);
      }
    },
    [activeTripId, pinsWithTime]
  );

  // ── Two-Pin Distance Comparison ──────────────────────────────
  const [twoPinComparison, setTwoPinComparison] = useState<{
    pinA: Pin;
    pinB: Pin;
    distanceKm: number;
    durationMinutes: number;
    mode: TransportMode;
  } | null>(null);

  const [showVisitedOnMap, setShowVisitedOnMap] = useState<boolean>(false);

  const comparePins = useCallback(
    async (pinAId: string, pinBId: string) => {
      if (!activeTrip) return;
      const pA = activeTrip.pins.find((p) => p.id === pinAId);
      const pB = activeTrip.pins.find((p) => p.id === pinBId);
      if (!pA || !pB) return;

      try {
        const geom = await routingService.getRoute([[pA.lat, pA.lng], [pB.lat, pB.lng]], transportMode);
        setTwoPinComparison({
          pinA: pA,
          pinB: pB,
          distanceKm: parseFloat((geom.distanceMeters / 1000).toFixed(1)),
          durationMinutes: Math.max(1, Math.round(geom.durationSeconds / 60)),
          mode: transportMode,
        });
      } catch {
        const d = calculateDistanceKm(pA.lat, pA.lng, pB.lat, pB.lng);
        setTwoPinComparison({
          pinA: pA,
          pinB: pB,
          distanceKm: parseFloat(d.toFixed(1)),
          durationMinutes: Math.max(1, Math.round(d * 12)),
          mode: transportMode,
        });
      }
    },
    [activeTrip, transportMode]
  );

  const clearPinComparison = useCallback(() => {
    setTwoPinComparison(null);
  }, []);

  // ── Target Pins ("Şimdi Nereye Gidiyorum?") ─────────────────
  const activeUnvisitedPins = useMemo(() => {
    return pinsWithTime.filter((p) => !p.visited);
  }, [pinsWithTime]);

  const currentTargetPin = activeUnvisitedPins[0] || null;
  const nextTargetPin = activeUnvisitedPins[1] || null;

  const togglePinLock = useCallback(
    (pinId: string) => {
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== activeTripId) return t;
          return {
            ...t,
            pins: t.pins.map((p) => (p.id === pinId ? { ...p, isLocked: !p.isLocked } : p)),
          };
        })
      );
    },
    [activeTripId]
  );

  // ── Route Optimization ───────────────────────────────────────

  const applyOptimization = useCallback(() => {
    if (!optimizationPreview || !activeTrip) return;
    const { dayIndex, optimizedPinIds } = optimizationPreview;

    setTrips((prev) =>
      prev.map((t) => {
        if (t.id !== activeTripId) return t;
        const updated = t.pins.map((p) => {
          if (p.dayIndex === dayIndex) {
            const newOrder = optimizedPinIds.indexOf(p.id) + 1;
            if (newOrder > 0) return { ...p, order: newOrder };
          }
          return p;
        });
        return { ...t, pins: updated };
      })
    );

    setOptimizationPreview(null);
    setAiMessageToast("✅ Rota en verimli yol sırasına göre optimize edildi!");
    setTimeout(() => setAiMessageToast(null), 4000);
  }, [optimizationPreview, activeTrip, activeTripId]);

  const dismissOptimization = useCallback(() => {
    setOptimizationPreview(null);
  }, []);

  // ── Auto-Split into Days ─────────────────────────────────────

  const autoSplitCurrentTrip = useCallback(
    (targetDays: number = 3) => {
      if (!activeTrip || activeTrip.pins.length === 0) return;

      const { days: newDays } = autoSplitPinsIntoDays(activeTrip.pins, targetDays);
      const flattenedPins: Pin[] = [];
      const updatedTripDays: TripDay[] = newDays.map((d, idx) => {
        const color = DAY_COLORS[idx % DAY_COLORS.length];
        flattenedPins.push(...d.pins);
        return {
          dayIndex: d.dayIndex,
          label: d.label,
          color,
          subtitle: d.subtitle,
          startTime: "09:00",
          pins: d.pins,
        };
      });

      setTrips((prev) =>
        prev.map((t) =>
          t.id === activeTripId
            ? { ...t, days: updatedTripDays, pins: flattenedPins }
            : t
        )
      );

      setActiveDayIndex(1);
      setAiMessageToast(`✨ Seyahat coğrafi konumlara göre ${newDays.length} dengeli güne ayrıldı!`);
      setTimeout(() => setAiMessageToast(null), 4500);
    },
    [activeTrip, activeTripId]
  );

  // ── AI Command Runner (In-Panel AI) ──────────────────────────

  const executeAiCommand = useCallback(
    (promptText: string) => {
      const p = promptText.toLowerCase().trim();
      if (!activeTrip) return;

      if (p.includes("optimize") || p.includes("sırala") || p.includes("en kısa")) {
        const opt = optimizeRouteOrder(pinsWithTime, transportMode);
        if (opt) {
          setOptimizationPreview(opt);
          setAiMessageToast(`💡 Rota analizi: ${opt.savedDistanceKm} km (${opt.savedDurationMinutes} dk) tasarruf bulundu!`);
        } else {
          setAiMessageToast("✨ Mevcut rota sıralaması zaten oldukça verimli.");
        }
      } else if (p.includes("böl") || p.includes("günlere") || p.includes("dağıt")) {
        autoSplitCurrentTrip(3);
      } else if (p.includes("kahve") || p.includes("mola")) {
        // Add coffee break near the middle pin
        const middlePin = pinsWithTime[Math.floor(pinsWithTime.length / 2)] || pinsWithTime[0];
        if (middlePin) {
          addPin({
            label: "Özel Kahve & Dinlenme Molası",
            address: middlePin.address || "Güzergah Üzeri",
            lat: middlePin.lat + 0.0015,
            lng: middlePin.lng + 0.0015,
            category: "kahve",
            dayIndex: activeDayIndex || 1,
            group: "Kahve & Mola",
            visited: false,
            durationMinutes: 35,
            interestTag: "Kahve",
            note: "Öğleden sonra kahve ve enerji molası.",
          });
          setAiMessageToast("☕ Güzergahın ortasına 35 dakikalık kahve molası eklendi.");
        }
      } else if (p.includes("restoran") || p.includes("akşam") || p.includes("yemek")) {
        const lastPin = pinsWithTime[pinsWithTime.length - 1] || pinsWithTime[0];
        if (lastPin) {
          addPin({
            label: "Akşam Yemeği & Gastronomi",
            address: lastPin.address || "Şehir Merkezi",
            lat: lastPin.lat - 0.0012,
            lng: lastPin.lng + 0.002,
            category: "yemek",
            dayIndex: activeDayIndex || 1,
            group: "Gastronomi",
            visited: false,
            durationMinutes: 90,
            interestTag: "Gastronomi",
            note: "Günün yorgunluğunu atmak için lezzetli bir akşam yemeği.",
          });
          setAiMessageToast("🍽️ Günün son durağına akşam yemeği durağı eklendi.");
        }
      } else if (p.includes("fotoğraf") || p.includes("manzara") || p.includes("gün batımı")) {
        const pin = pinsWithTime[0];
        if (pin) {
          addPin({
            label: "Panoramik Gün Batımı Seyir Noktası",
            address: "Seyir Terası & Manzara",
            lat: pin.lat + 0.003,
            lng: pin.lng - 0.002,
            category: "fotograf",
            dayIndex: activeDayIndex || 1,
            group: "Fotoğraf & Manzara",
            visited: false,
            durationMinutes: 45,
            interestTag: "Fotoğrafçılık",
            note: "Altın saatlerde en iyi fotoğraf açıları.",
          });
          setAiMessageToast("📸 Gün batımı için fotoğraf seyir noktası eklendi.");
        }
      } else {
        setAiMessageToast("🤖 'Öğleden sonraya kahve ekle', 'Rotayı optimize et' veya 'Günlere böl' komutlarını deneyebilirsiniz.");
      }

      setTimeout(() => setAiMessageToast(null), 4500);
    },
    [activeTrip, pinsWithTime, transportMode, autoSplitCurrentTrip, addPin, activeDayIndex]
  );

  // ── General Pin Pool Actions ─────────────────────────────────

  const addPinToGeneral = useCallback(
    (pinData: Omit<Pin, "id" | "order">) => {
      const pinId = "pin-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
      const newPin: Pin = {
        ...pinData,
        id: pinId,
        dayIndex: 0,
        group: "Genel",
        order: generalPins.length + 1,
        durationMinutes: pinData.durationMinutes || 60,
      };
      setGeneralPins((prev) => [newPin, ...prev]);
      setSelectedPinId(pinId);
      return pinId;
    },
    [generalPins.length]
  );

  const addPinDirectlyToTrip = useCallback(
    (targetTripId: string, pinData: Omit<Pin, "id" | "order">, targetDayIndex = 1) => {
      const pinId = "pin-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== targetTripId) return t;
          const countInDay = t.pins.filter((p) => p.dayIndex === targetDayIndex).length;
          const newPin: Pin = {
            ...pinData,
            id: pinId,
            tripId: targetTripId,
            dayIndex: targetDayIndex,
            order: countInDay + 1,
            durationMinutes: pinData.durationMinutes || 60,
          };
          return { ...t, pins: [...t.pins, newPin] };
        })
      );
      setActiveTripId(targetTripId);
      setActiveDayIndex(targetDayIndex);
      setSelectedPinId(pinId);
      return pinId;
    },
    []
  );

  const importTrip = useCallback((trip: Trip) => {
    setTrips((prev) => {
      const exists = prev.some((t) => t.id === trip.id || t.title.toLowerCase() === trip.title.toLowerCase());
      if (exists) {
        return prev.map((t) => (t.id === trip.id || t.title.toLowerCase() === trip.title.toLowerCase() ? trip : t));
      }
      return [trip, ...prev];
    });
    setActiveTripId(trip.id);
    setActiveDayIndex(1);
    setSelectedPinId(null);
  }, []);

  const [customGroups, setCustomGroups] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("mapsbridge.customGroups") || localStorage.getItem("adreskopru.customTabs");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return ["Genel", "Kültür & Tarih", "Kafe & Gastronomi", "Doğa & Manzara", "Alışveriş"];
  });

  const addCustomGroup = useCallback((groupName: string) => {
    const trimmed = groupName.trim();
    if (!trimmed) return;
    setCustomGroups((prev) => {
      if (prev.includes(trimmed)) return prev;
      const updated = [...prev, trimmed];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("mapsbridge.customGroups", JSON.stringify(updated));
          localStorage.setItem("adreskopru.customTabs", JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  }, []);

  const assignPinToTrip = useCallback(
    (pinId: string, targetTripId: string, targetDayIndex: number) => {
      const pinFromGen = generalPins.find((p) => p.id === pinId);
      if (pinFromGen) {
        setGeneralPins((prev) => prev.filter((p) => p.id !== pinId));
        setTrips((prev) =>
          prev.map((t) => {
            if (t.id !== targetTripId) return t;
            const countInDay = t.pins.filter((p) => p.dayIndex === targetDayIndex).length;
            const moved: Pin = {
              ...pinFromGen,
              tripId: targetTripId,
              dayIndex: targetDayIndex,
              order: countInDay + 1,
            };
            return { ...t, pins: [...t.pins, moved] };
          })
        );
        setActiveTripId(targetTripId);
        setActiveDayIndex(targetDayIndex);
        setSelectedPinId(pinId);
        return;
      }

      // If already in a trip, move across trips/days
      setTrips((prev) => {
        let extracted: Pin | null = null;
        const stripped = prev.map((t) => {
          const found = t.pins.find((p) => p.id === pinId);
          if (found) {
            extracted = found;
            return { ...t, pins: t.pins.filter((p) => p.id !== pinId) };
          }
          return t;
        });
        if (!extracted) return prev;
        return stripped.map((t) => {
          if (t.id !== targetTripId) return t;
          const countInDay = t.pins.filter((p) => p.dayIndex === targetDayIndex).length;
          const moved: Pin = {
            ...extracted!,
            tripId: targetTripId,
            dayIndex: targetDayIndex,
            order: countInDay + 1,
          };
          return { ...t, pins: [...t.pins, moved] };
        });
      });
      setActiveTripId(targetTripId);
      setActiveDayIndex(targetDayIndex);
      setSelectedPinId(pinId);
    },
    [generalPins]
  );

  const movePinToGeneral = useCallback(
    (pinId: string) => {
      let extracted: Pin | null = null;
      setTrips((prev) =>
        prev.map((t) => {
          const found = t.pins.find((p) => p.id === pinId);
          if (found) {
            extracted = found;
            return { ...t, pins: t.pins.filter((p) => p.id !== pinId) };
          }
          return t;
        })
      );
      if (extracted) {
        const foundPin: Pin = extracted;
        const genPin: Pin = {
          ...foundPin,
          tripId: undefined,
          dayIndex: 0,
          group: "Genel",
          order: generalPins.length + 1,
        };
        setGeneralPins((prev) => [genPin, ...prev]);
        setSelectedPinId(pinId);
      }
    },
    [generalPins.length]
  );

  const allPins = useMemo(() => {
    const pinMap = new Map<string, Pin>();
    generalPins.forEach((p) => pinMap.set(p.id, p));
    trips.forEach((t) => {
      (t.pins || []).forEach((p) => pinMap.set(p.id, p));
      (t.days || []).forEach((d) => (d.pins || []).forEach((p) => pinMap.set(p.id, p)));
    });
    return Array.from(pinMap.values());
  }, [trips, generalPins]);

  const selectedPin = useMemo(() => {
    if (!selectedPinId) return null;
    return allPins.find((p) => p.id === selectedPinId) || null;
  }, [allPins, selectedPinId]);

  const updatePinAnywhere = useCallback((pinId: string, updates: Partial<Pin>) => {
    setGeneralPins((prev) =>
      prev.map((p) => (p.id === pinId ? { ...p, ...updates } : p))
    );
    setTrips((prev) =>
      prev.map((t) => ({
        ...t,
        pins: t.pins.map((p) => (p.id === pinId ? { ...p, ...updates } : p)),
      }))
    );
  }, []);

  const deletePinAnywhere = useCallback((pinId: string) => {
    setGeneralPins((prev) => prev.filter((p) => p.id !== pinId));
    setTrips((prev) =>
      prev.map((t) => ({
        ...t,
        pins: t.pins.filter((p) => p.id !== pinId),
      }))
    );
    if (selectedPinId === pinId) {
      setSelectedPinId(null);
    }
  }, [selectedPinId]);

  const togglePinVisitedAnywhere = useCallback((pinId: string) => {
    setGeneralPins((prev) =>
      prev.map((p) => (p.id === pinId ? { ...p, visited: !p.visited } : p))
    );
    setTrips((prev) =>
      prev.map((t) => ({
        ...t,
        pins: t.pins.map((p) => (p.id === pinId ? { ...p, visited: !p.visited } : p)),
      }))
    );
  }, []);

  return {
    trips,
    generalPins,
    allPins,
    selectedPin,
    activeTrip,
    activeTripId,
    activeDayIndex,
    selectedPinId,
    transportMode,
    currentDay,
    pinsWithTime,
    daySummary,
    activeRoadGeometry,
    isRoutingLoading,
    optimizationPreview,
    aiMessageToast,
    twoPinComparison,
    showVisitedOnMap,
    currentTargetPin,
    nextTargetPin,
    // Methods
    setActiveDayIndex,
    setSelectedPinId,
    createTrip,
    deleteTrip,
    switchTrip,
    updateTripInfo,
    changeTransportMode,
    addDay,
    removeDay,
    addPin,
    updatePin,
    deletePin,
    movePinOrder,
    movePinToDay,
    togglePinVisited,
    markVisitedAndAdvance,
    togglePinLock,
    applyOptimization,
    dismissOptimization,
    autoSplitCurrentTrip,
    executeAiCommand,
    comparePins,
    clearPinComparison,
    setShowVisitedOnMap,
    // General Pin methods
    addPinToGeneral,
    addPinDirectlyToTrip,
    assignPinToTrip,
    movePinToGeneral,
    updatePinAnywhere,
    deletePinAnywhere,
    togglePinVisitedAnywhere,
    importTrip,
    customGroups,
    addCustomGroup,
  };
}
