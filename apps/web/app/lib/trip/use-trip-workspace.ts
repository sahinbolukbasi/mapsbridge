// ============================================================
// useTripWorkspace — single source of truth for the trip panel
// ============================================================

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Pin,
  TripDay,
  TripWorkspace,
  DrawerState,
  DrawerView,
  RouteSegment,
} from "./models";

const STORAGE_KEY = "mapsbridge.tripWorkspace";

// ── helpers ────────────────────────────────────────────────

const DAY_COLORS = [
  "#2563eb",
  "#10b981",
  "#8b5cf6",
  "#f97316",
  "#ec4899",
  "#06b6d4",
  "#eab308",
  "#ef4444",
  "#6366f1",
  "#14b8a6",
];

function defaultDay(dayIndex: number, label: string): TripDay {
  return { dayIndex, label, color: DAY_COLORS[dayIndex % DAY_COLORS.length], pins: [] };
}

function emptyWorkspace(title = "Yeni Gezi"): TripWorkspace {
  return {
    tripId: "trip_" + Date.now(),
    title,
    isPublic: false,
    groups: [
      { id: "genel", name: "Genel", color: "#6366f1", emoji: "📍", pinCount: 0 },
      { id: "kahve", name: "Kahve & Kafe", color: "#8b5cf6", emoji: "☕", pinCount: 0 },
      { id: "yemek", name: "Yemek & Restoran", color: "#f97316", emoji: "🍽️", pinCount: 0 },
      { id: "muze", name: "Müze & Tarih", color: "#3b82f6", emoji: "🏛️", pinCount: 0 },
    ],
    days: [defaultDay(0, "Tümü"), defaultDay(1, "1. Gün")],
    roadSegments: {},
    pins: [],
  };
}

// ── hook ───────────────────────────────────────────────────

export function useTripWorkspace() {
  const [workspace, setWorkspace] = useState<TripWorkspace>(() => {
    if (typeof window === "undefined") return emptyWorkspace();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TripWorkspace;
        // basic migration: ensure day 0 exists
        if (!parsed.days.find((d) => d.dayIndex === 0)) {
          parsed.days.unshift(defaultDay(0, "Tümü"));
        }
        return parsed;
      }
    } catch {}
    return emptyWorkspace();
  });

  // ── drawer state ──
  const [drawer, setDrawer] = useState<DrawerState>({
    isOpen: true,
    view: "day-list",
    activePin: null,
    activeDayIndex: null,
  });

  // ── persist ──
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    } catch {}
  }, [workspace]);

  // ── derived ──
  const currentDay = useMemo(
    () =>
      drawer.activeDayIndex == null
        ? null
        : (workspace.days.find((d) => d.dayIndex === drawer.activeDayIndex) ?? null),
    [workspace.days, drawer.activeDayIndex],
  );

  const pinsForActiveDay = useMemo(
    () =>
      drawer.activeDayIndex == null || drawer.activeDayIndex === 0
        ? workspace.pins
        : workspace.pins.filter((p) => p.dayIndex === drawer.activeDayIndex),
    [workspace.pins, drawer.activeDayIndex],
  );

  const allDaysExceptAll = useMemo(
    () => workspace.days.filter((d) => d.dayIndex > 0),
    [workspace.days],
  );

  // ── actions ──

  /** Open drawer to a specific view */
  const openDrawer = useCallback((view: DrawerView, pin?: Pin | null) => {
    setDrawer((prev) => ({
      ...prev,
      isOpen: true,
      view,
      activePin: pin ?? null,
    }));
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawer((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const toggleDrawer = useCallback(() => {
    setDrawer((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  /** Set which day is active (null = all days, 0 = Tümü) */
  const setActiveDay = useCallback((dayIndex: number | null) => {
    setDrawer((prev) => ({ ...prev, activeDayIndex: dayIndex ?? null }));
  }, []);

  // ── pin CRUD ──

  const addPin = useCallback((pin: Omit<Pin, "id" | "order">) => {
    setWorkspace((prev) => {
      const newPin: Pin = {
        ...pin,
        id: "pin_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        order: prev.pins.filter((p) => p.dayIndex === pin.dayIndex).length + 1,
      };
      const updatedPins = [...prev.pins, newPin];

      // Update the day's pins array too
      const updatedDays = prev.days.map((d) => {
        if (d.dayIndex === pin.dayIndex) {
          return { ...d, pins: [...d.pins, newPin] };
        }
        return d;
      });

      return { ...prev, pins: updatedPins, days: updatedDays };
    });
  }, []);

  const updatePin = useCallback((pinId: string, updates: Partial<Pin>) => {
    setWorkspace((prev) => {
      const oldPin = prev.pins.find((p) => p.id === pinId);
      if (!oldPin) return prev;

      const updatedPin = { ...oldPin, ...updates };
      const updatedPins = prev.pins.map((p) => (p.id === pinId ? updatedPin : p));

      // If day changed, move pin between days
      let updatedDays: typeof prev.days;
      if (updates.dayIndex !== undefined && updates.dayIndex !== oldPin.dayIndex) {
        updatedDays = prev.days.map((d) => ({
          ...d,
          pins: d.pins.filter((p) => p.id !== pinId),
        }));
        const targetDay = updatedDays.find((d) => d.dayIndex === updates.dayIndex!);
        if (targetDay) {
          targetDay.pins.push(updatedPin);
        }
      } else {
        updatedDays = prev.days.map((d) => ({
          ...d,
          pins: d.pins.map((p) => (p.id === pinId ? updatedPin : p)),
        }));
      }

      return { ...prev, pins: updatedPins, days: updatedDays };
    });
  }, []);

  const deletePin = useCallback((pinId: string) => {
    setWorkspace((prev) => ({
      ...prev,
      pins: prev.pins.filter((p) => p.id !== pinId),
      days: prev.days.map((d) => ({
        ...d,
        pins: d.pins.filter((p) => p.id !== pinId),
      })),
    }));
  }, []);

  /** Move pin order inside its day */
  const movePin = useCallback((pinId: string, direction: "up" | "down") => {
    setWorkspace((prev) => {
      const pin = prev.pins.find((p) => p.id === pinId);
      if (!pin) return prev;
      const dayPins = prev.pins
        .filter((p) => p.dayIndex === pin.dayIndex)
        .sort((a, b) => a.order - b.order);
      const idx = dayPins.findIndex((p) => p.id === pinId);
      if (idx === -1) return prev;
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === dayPins.length - 1) return prev;

      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      [dayPins[idx], dayPins[targetIdx]] = [dayPins[targetIdx], dayPins[idx]];
      dayPins.forEach((p, i) => (p.order = i + 1));

      const otherPins = prev.pins.filter((p) => p.dayIndex !== pin.dayIndex);
      return { ...prev, pins: [...otherPins, ...dayPins] };
    });
  }, []);

  // ── day CRUD ──

  const addDay = useCallback(() => {
    setWorkspace((prev) => {
      const nextIndex =
        prev.days.length > 0 ? Math.max(...prev.days.map((d) => d.dayIndex)) + 1 : 1;
      return {
        ...prev,
        days: [...prev.days, defaultDay(nextIndex, `${nextIndex}. Gün`)],
      };
    });
  }, []);

  const renameDay = useCallback((dayIndex: number, label: string) => {
    setWorkspace((prev) => ({
      ...prev,
      days: prev.days.map((d) => (d.dayIndex === dayIndex ? { ...d, label } : d)),
    }));
  }, []);

  // ── trip metadata ──

  const updateTrip = useCallback((updates: Partial<TripWorkspace>) => {
    setWorkspace((prev) => ({ ...prev, ...updates }));
  }, []);

  // ── groups ──

  const addGroup = useCallback((name: string, emoji = "📌", color?: string) => {
    setWorkspace((prev) => {
      const id = name.toLowerCase().replace(/\s+/g, "_");
      if (prev.groups.find((g) => g.id === id)) return prev;
      return {
        ...prev,
        groups: [...prev.groups, { id, name, emoji, color: color ?? "#6366f1", pinCount: 0 }],
      };
    });
  }, []);

  const deleteGroup = useCallback((groupId: string) => {
    setWorkspace((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.id !== groupId),
    }));
  }, []);

  // ── road segments (placeholder — real OSRM integration later) ──

  const setRoadSegments = useCallback((dayIndex: number, segments: RouteSegment[]) => {
    setWorkspace((prev) => ({
      ...prev,
      roadSegments: { ...prev.roadSegments, [dayIndex]: segments },
    }));
  }, []);

  // ── return ──

  return {
    workspace,
    drawer,
    currentDay,
    pinsForActiveDay,
    allDaysExceptAll,

    // actions
    openDrawer,
    closeDrawer,
    toggleDrawer,
    setActiveDay,

    addPin,
    updatePin,
    deletePin,
    movePin,

    addDay,
    renameDay,
    updateTrip,

    addGroup,
    deleteGroup,

    setRoadSegments,
  };
}
