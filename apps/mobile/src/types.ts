// Tek IA (design §5.3, karar S10): web mobil alt menüsüyle aynı 5 öğe, aynı sıra ve etiket.
export type MobileTab = "plan" | "ai" | "community" | "messages" | "profile" | "login";

/** Oturumsuz: Planla · Asistan · Topluluk · Giriş. */
export const GUEST_TABS: readonly MobileTab[] = ["plan", "ai", "community", "login"];
/** Oturumlu: Planla · Asistan · Topluluk · Mesajlar · Profil. */
export const MEMBER_TABS: readonly MobileTab[] = ["plan", "ai", "community", "messages", "profile"];
/** Sekmelerin üstüne itilen ekranlar (navigation/tab-stack.ts). */
export type MobileStackScreen = "map";

export type PlatformMode = "ios" | "android";

export interface TripStop {
  id: string;
  name: string;
  category: string;
  time: string;
  duration: string;
  address: string;
  lat: number;
  lng: number;
  visited?: boolean;
  notes?: string;
  photoUrl?: string;
  rating?: number;
  walkTimeFromPrev?: string;
  distanceFromPrev?: string;
}

export interface RouteCardData {
  id: string;
  code?: string;
  title: string;
  city: string;
  author: string;
  authorHandle?: string;
  authorAvatar?: string;
  verified?: boolean;
  stopsCount: number;
  distanceKm?: string;
  duration: string;
  likes: number;
  rating: number;
  reviewsCount?: number;
  coverImage?: string;
  tags?: string[];
  description?: string;
  stops?: TripStop[];
}
