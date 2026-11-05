import type { PlaceCategory } from "../../features/trip-planner/map-styles";
export type TransportMode = "walking" | "driving" | "cycling";

export type DrawerView =
  "day-list" | "pin-detail" | "pin-create" | "trip-settings" | "group-manage";

export interface DrawerState {
  isOpen: boolean;
  view: DrawerView;
  activePin: Pin | null;
  activeDayIndex: number | null;
}

export type PinCategory =
  | "tarih"
  | "muze"
  | "yemek"
  | "kahve"
  | "alisveris"
  | "aktivite"
  | "manzara"
  | "eglence"
  | "konaklama"
  | "otel"
  | "doga"
  | "genel"
  | "fotograf"
  | "kultur"
  | "gastronomi"
  | "gezilecek"
  | "turistik"
  | "spor"
  | "gezi";

export type InterestTag =
  | "Fotoğrafçılık"
  | "Mimari"
  | "Gastronomi"
  | "Tarih"
  | "Sanat"
  | "Kahve"
  | "Doğa & Hiking"
  | "Kitap & Kültür"
  | "Teknoloji"
  | "Gece Hayatı";

export interface Pin {
  /** Only the Google place ID is persisted; provider content is fetched for display. */
  googlePlaceId?: string;
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  category: PinCategory;
  note?: string;
  photo?: string;
  photos?: string[];
  /** Trip ID this pin belongs to */
  tripId?: string;
  /** Day number (1 = Day 1, 2 = Day 2, 0 = unassigned) */
  dayIndex: number;
  /** Order inside the day (1, 2, 3...) */
  order: number;
  /** Category / Group string for filtering */
  group: string;
  /** Visited status */
  visited: boolean;
  /** Estimated stay duration in minutes (e.g. 60, 90, 120) */
  durationMinutes?: number;
  /** Locked / fixed start time (e.g. "10:00") */
  fixedTime?: string;
  /** If locked, route optimization will not change its position */
  isLocked?: boolean;
  /** Personal interest tag */
  interestTag?: InterestTag | string;
  /** Calculated start time on the day's timeline (e.g. "09:00") */
  calculatedStartTime?: string;
  /** Calculated end time on the day's timeline (e.g. "10:30") */
  calculatedEndTime?: string;
  /** Suggested duration label (e.g. "1s 30d") */
  suggestedDuration?: string;
  /** Estimated transit duration from previous pin in minutes */
  transitDurationFromPrevious?: number;
  date?: string;
}

export interface DayRouteSummary {
  stopCount: number;
  totalDistanceKm: number;
  totalTravelDurationMinutes: number;
  totalVisitDurationMinutes: number;
  totalDayDurationMinutes: number;
  isHeavyDay: boolean; // > 8.5 hours
  warningText?: string;
}

export interface TripDay {
  dayIndex: number;
  label: string;
  color: string;
  subtitle?: string;
  startTime?: string; // default "09:00"
  pins: Pin[];
  summary?: DayRouteSummary;
}

export interface TripGroup {
  id: string;
  name: string;
  color: string;
  emoji: string;
  pinCount: number;
}

export interface RouteGeometry {
  coordinates: [number, number][]; // [lat, lng][]
  distanceMeters: number;
  durationSeconds: number;
  isRealRoad: boolean;
  /** Ardışık nokta çiftleri için OSRM bacakları (yalnız isRealRoad; yedek rotada yok, I1/I2). */
  legs?: RouteLeg[];
}

export interface RouteLeg {
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteSegment {
  fromPinId: string;
  toPinId: string;
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
}

export interface RouteOptimizationPreview {
  dayIndex: number;
  originalDistanceKm: number;
  optimizedDistanceKm: number;
  savedDistanceKm: number;
  savedDurationMinutes: number;
  optimizedPinIds: string[];
}

export interface TripWorkspace {
  tripId: string;
  title: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  theme?: string;
  isPublic: boolean;
  days: TripDay[];
  groups: TripGroup[];
  roadSegments?: Record<number, unknown[]>;
  pins: Pin[];
}

export interface Trip {
  id: string;
  title: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  theme?: string;
  transportMode: TransportMode;
  isPublic: boolean;
  days: TripDay[];
  groups: TripGroup[];
  pins: Pin[];
  createdAt?: string;
  updatedAt?: string;
  hotel?: { name: string; address?: string };
}

export interface TravelWorkspaceState {
  trips: Trip[];
  activeTripId: string;
  activeDayIndex: number | null; // null or 0 = All Days, 1 = Day 1...
  selectedPinId: string | null;
  transportMode: TransportMode;
  isOptimizing: boolean;
  optimizationPreview: RouteOptimizationPreview | null;
}

export const DEFAULT_CATEGORY_META: Record<
  PinCategory,
  { emoji: string; label: string; color: string; defaultDuration: number }
> = {
  tarih: { emoji: "🏛️", label: "Tarihi Yer", color: "#3b82f6", defaultDuration: 90 },
  muze: { emoji: "🎨", label: "Müze", color: "#8b5cf6", defaultDuration: 120 },
  yemek: { emoji: "🍽️", label: "Yemek & Restoran", color: "#f97316", defaultDuration: 75 },
  kahve: { emoji: "☕", label: "Kahve & Mola", color: "#b45309", defaultDuration: 35 },
  alisveris: { emoji: "🛍️", label: "Alışveriş", color: "#ec4899", defaultDuration: 60 },
  aktivite: { emoji: "🎡", label: "Aktivite", color: "#06b6d4", defaultDuration: 90 },
  manzara: { emoji: "🏔️", label: "Manzara & Seyir", color: "#10b981", defaultDuration: 45 },
  eglence: { emoji: "🎭", label: "Eğlence", color: "#a855f7", defaultDuration: 90 },
  konaklama: { emoji: "🏨", label: "Konaklama", color: "#64748b", defaultDuration: 30 },
  doga: { emoji: "🌳", label: "Doğa & Park", color: "#16a34a", defaultDuration: 60 },
  fotograf: { emoji: "📸", label: "Fotoğraf Noktası", color: "#eab308", defaultDuration: 40 },
  kultur: { emoji: "🎻", label: "Kültür & Sanat", color: "#6366f1", defaultDuration: 90 },
  gastronomi: { emoji: "🍝", label: "Gastronomi", color: "#ea580c", defaultDuration: 80 },
  otel: { emoji: "🏨", label: "Otel & Konaklama", color: "#06b6d4", defaultDuration: 30 },
  gezilecek: { emoji: "👀", label: "Gezilecek Yer", color: "#2563eb", defaultDuration: 60 },
  turistik: { emoji: "🏛️", label: "Turistik Nokta", color: "#3b82f6", defaultDuration: 60 },
  spor: { emoji: "🏃", label: "Spor & Macera", color: "#10b981", defaultDuration: 75 },
  gezi: { emoji: "🧭", label: "Gezi & Seyahat", color: "#06b6d4", defaultDuration: 90 },
  genel: { emoji: "📍", label: "Genel Durak", color: "#2563eb", defaultDuration: 45 },
};

export const DAY_COLORS = [
  "#2563eb", // Day 1 - Mavi
  "#10b981", // Day 2 - Zümrüt Yeşili
  "#8b5cf6", // Day 3 - Mor
  "#f97316", // Day 4 - Turuncu
  "#ec4899", // Day 5 - Pembe
  "#06b6d4", // Day 6 - Camgöbeği
  "#eab308", // Day 7 - Amber
  "#6366f1", // Day 8 - İndigo
];

/** Harita masasında kayıtlı adres (C7: maps/maps-client.tsx'ten taşındı; storage biçimi aynı). */
export interface SavedAddress {
  day?: number;
  suggestedDuration?: string;
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  group?: string; // Gezi Rotası veya Grup adı
  category?: PlaceCategory; // Kategori
  visited?: boolean; // Gidildi mi?
  order?: number;
  note?: string; // Detaylı not & ipucu
  date?: string; // Planlanan veya ziyaret tarihi
  photo?: string; // Durak / Mekan Fotoğrafı (URL veya Base64)
}
