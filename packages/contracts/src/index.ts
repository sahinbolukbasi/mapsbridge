/**
 * @mapsbridge/contracts
 * Frontend ve Backend arasında paylaşılan temel veri sözleşmeleri ve tip tanımları.
 */

// ─── 0. Domain Constants & Enums ───────────────────────────────────────────

// ─── Kredi Maliyetleri (Tek Kaynak - Tüm Platformlar Bu Değerleri Kullanır) ──
export const BILLING_COST = {
  ROUTE: 5 as const,
  CHAT: 1 as const,
  CLARIFY: 0 as const,
  WELCOME_CREDITS: 5 as const,
} as const;

export type AICreditAction = "ai_deep_trip" | "ai_stay_dining" | "ai_chat" | "route_optimize" | "ai_greeting";

export const ACTION_CREDIT_COSTS: Record<AICreditAction, number> = {
  ai_greeting: 0,       // Selamlama, çok kısa sorular (Tier1 - Nova Micro)
  ai_chat: 0.5,         // Standart seyahat sohbeti (Tier2 - Nova Lite)
  ai_stay_dining: 2,    // Otel, konaklama, gastronomi analizi (Tier3 - Haiku)
  ai_deep_trip: 5,      // Çok günlü detaylı plan / yeniden planlama (Tier4 - Sonnet)
  route_optimize: 1,    // OSRM rota optimizasyonu
} as const;

export function getActionCreditCost(action: AICreditAction): number {
  return ACTION_CREDIT_COSTS[action] ?? 1;
}

export interface SubscriptionPlanDef {
  id: string;
  name: string;
  tagline: string;
  badge?: string;
  monthlyPriceTry: number;
  yearlyPriceTry: number;
  monthlyCredits: number;
  highlight?: boolean;
  color: string;
  maxRoutes: number; // Infinity for paid plans
}

export const SUBSCRIPTION_PLAN_DEFS: SubscriptionPlanDef[] = [
  { id: "free", name: "Gezgin (Free)", tagline: "Harita masasını keşfetmek ve temel seyahat planları için", monthlyPriceTry: 0, yearlyPriceTry: 0, monthlyCredits: 5, color: "#64748b", maxRoutes: 3 },
  { id: "explorer", name: "Kaşif (Explorer)", tagline: "Sık seyahat edenler ve gezi rotası oluşturanlar için ideal", monthlyPriceTry: 199, yearlyPriceTry: 159, monthlyCredits: 100, color: "#2563eb", maxRoutes: Infinity },
  { id: "pro", name: "Pro Kaşif (Pro Traveler)", tagline: "Sınırsız AI rota planlama gücü", badge: "EN POPÜLER", monthlyPriceTry: 499, yearlyPriceTry: 399, monthlyCredits: 500, highlight: true, color: "#10b981", maxRoutes: Infinity },
  { id: "agency", name: "Tur Lideri & Grup Paketi", tagline: "Rehberler ve seyahat toplulukları için kurumsal güç", monthlyPriceTry: 1499, yearlyPriceTry: 1199, monthlyCredits: 2500, color: "#8b5cf6", maxRoutes: Infinity },
];

export interface CreditPackageDef {
  id: string;
  title: string;
  credits: number;
  priceTry: number;
  unitPriceTry: number;
  popular?: boolean;
  description: string;
}

export const CREDIT_PACKAGE_DEFS: CreditPackageDef[] = [
  { id: "pack-starter", title: "Hızlı Başlangıç", credits: 50, priceTry: 89, unitPriceTry: 1.78, description: "5-10 kapsamlı AI seyahat planı ve harita analizi için." },
  { id: "pack-popular", title: "Popüler Gezgin", credits: 300, priceTry: 299, unitPriceTry: 0.99, popular: true, description: "Düzenli gezginler için en avantajlı ve çok tercih edilen paket." },
  { id: "pack-master", title: "Usta Kaşif", credits: 1000, priceTry: 749, unitPriceTry: 0.74, description: "Geniş rota kütüphanesi oluşturan kaşifler ve grup liderleri için." },
  { id: "pack-pro", title: "Stratejik Kaşif", credits: 3000, priceTry: 1899, unitPriceTry: 0.63, description: "Acentalar, içerik üreticileri ve profesyonel tur rehberleri için dev paket." },
];

export const SUBSCRIPTION_TIERS = {
  FREE: "free",
  EXPLORER: "explorer",
  PRO: "pro",
  AGENCY: "agency",
} as const;

export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[keyof typeof SUBSCRIPTION_TIERS];

export const USER_ROLES = {
  ADMIN: "admin",
  MODERATOR: "moderator",
  SUPPORT: "support",
  USER: "user",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const DYNAMO_PREFIX = {
  USER: "USER#",
  ROUTE: "ROUTE#",
  SHARE: "SHARE#",
  LINK: "LINK#",
  THREAD: "THREAD#",
  CHAT: "CHAT#",
  PROFILE: "PROFILE#",
  BILLING: "BILLING#",
  SYSTEM: "SYSTEM#",
} as const;

// ─── 1. Identity & Auth Contracts ──────────────────────────────────────────

export interface VerifiedUser {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  role?: "admin" | "moderator" | "support" | "user";
  isSuspended?: boolean;
}

export interface UserProfileDto {
  username: string;
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
  publishedAt?: string;
  isPublic: boolean;
}

// ─── 2. Trip & Desk Contracts ──────────────────────────────────────────────

export interface CoordinateDto {
  lat: number;
  lng: number;
}

export interface RouteStopDto {
  id: string;
  name: string;
  lat: number;
  lng: number;
  day: number;
  description?: string;
  suggestedDuration?: string;
  category?: string;
  address?: string;
  timeSlot?: "morning" | "afternoon" | "evening" | "night";
  estimatedMinutes?: number;
  distanceToNextKm?: number;
}

export interface UnifiedRoutePlanDto {
  title: string;
  summary: string;
  estimatedDays: number;
  theme: string;
  destination: string;
  stops: RouteStopDto[];
}

export interface ShareLocationDto {
  code: string;
  lat: number;
  lng: number;
  address?: string;
  title?: string;
  note?: string;
  expiresAt: number;
  revoked?: boolean;
}

// ─── 3. AI Assistant Contracts ─────────────────────────────────────────────

export type AIResponseMode = "clarify" | "chat" | "route";

export interface AIClarificationDto {
  isUnderspecified: boolean;
  message: string;
  guidingQuestions?: string[];
  quickOptions?: Array<{ label: string; prompt: string }> | string[];
}

export interface StructuredPlaceCardDto {
  id: string;
  name: string;
  category: "culture" | "view" | "landmark" | "nature" | "food" | "cafe" | "general";
  lat: number;
  lng: number;
  description: string;
  suggestedDurationMinutes: number;
  recommendedTimeSlot?: "morning" | "lunch" | "afternoon" | "evening" | "night";
  rating?: number;
  address?: string;
  photoUrl?: string;
}

export interface StructuredRestaurantCardDto {
  id: string;
  name: string;
  cuisine: string;
  priceLevel: "budget" | "mid" | "fine_dining";
  address: string;
  specialtyDish?: string;
  isMichelinOrAwarded?: boolean;
  lat: number;
  lng: number;
  openingHours?: string;
}

export interface StructuredEventCardDto {
  id: string;
  title: string;
  category: "concert" | "exhibition" | "festival" | "theatre" | "sports";
  venue: string;
  startDate: string;
  ticketUrl?: string;
  priceEstimate?: string;
}

export interface StructuredTransitCardDto {
  recommendedMode: "walk" | "metro" | "taxi" | "bus" | "train";
  durationMinutes: number;
  estimatedCost: string;
  transitSteps: string[];
}

export interface AIAssistantActionDto {
  type: "ADD_PINS_TO_DAY" | "SWITCH_TO_RAIN_ALTERNATIVE" | "OPTIMIZE_ROUTE_ORDER" | "REPLAN_SCHEDULE";
  payload: Record<string, any>;
}

export interface StructuredAIResponseDto {
  message: string;
  intent: "chat" | "clarify" | "create_trip" | "modify_day" | "find_places" | "find_transit" | "replan";
  places?: StructuredPlaceCardDto[];
  restaurants?: StructuredRestaurantCardDto[];
  events?: StructuredEventCardDto[];
  transport?: StructuredTransitCardDto;
  actions?: AIAssistantActionDto[];
  followUpQuestions?: string[];
  quickReplies?: Array<{ label: string; prompt: string }>;
}

export interface AIAssistantResponseDto {
  success: boolean;
  responseMode: AIResponseMode;
  orchestratorSummary: string;
  route?: UnifiedRoutePlanDto;
  clarification?: AIClarificationDto;
  structured?: StructuredAIResponseDto;
  cost: 0 | 1 | 5;
  modelUsed?: string;
  preferences?: Record<string, unknown>;
  billing?: {
    cost: number;
    credits: number;
  };
}

export interface UserTravelProfileDto {
  userId: string;
  updatedAt: string;
  preferredCuisines: string[];
  dietaryRestrictions: string[];
  preferredTravelPace: "relaxed" | "balanced" | "intensive";
  walkingToleranceMeters: number;
  mobilityPreferences: string[];
  interests: Record<string, number>;
  dislikedActivityTypes: string[];
  preferredBudgetLevel: "budget" | "standard" | "premium" | "luxury";
  favoritePlaces: string[];
  personalizationEnabled: boolean;
}

// ─── 4. Billing & Wallet Contracts ─────────────────────────────────────────

export interface WalletDto {
  credits: number;
  welcomeClaimed: boolean;
  tier?: "explorer" | "pro" | "agency" | "free";
  status?: string;
}

export interface ProductCatalogItemDto {
  id: string;
  mode: "subscription" | "credit_pack";
  credits: number;
  amount: number; // Kuruş cinsinden (örn: 19900 = 199 TL)
  priceId?: string;
  available?: boolean;
}

// ─── 5. Messaging Contracts ────────────────────────────────────────────────

export interface ChatMessageDto {
  id: string;
  threadId: string;
  senderSub: string;
  senderName: string;
  text: string;
  routeEmbed?: UnifiedRoutePlanDto;
  locationPin?: CoordinateDto;
  createdAt: string;
}

export interface ThreadDto {
  id: string;
  title: string;
  tripId?: string;
  participants: string[];
  createdAt: string;
  updatedAt?: string;
}

// ─── 6. Community & Marketplace Contracts ─────────────────────────────────

export interface TravelGuideDto {
  id: string;
  authorId: string;
  authorUsername: string;
  title: string;
  description: string;
  destination: string;
  category: string;
  price: number;
  currency: string;
  stopsCount: number;
  durationLabel: string;
  coverImageUrl?: string;
  likesCount: number;
  salesCount: number;
  rating: number;
  reviewCount: number;
  status: "draft" | "published" | "archived" | "suspended";
  publishedAt: number;
}

export interface TravelArticleDto {
  id: string;
  title: string;
  slug: string;
  content: string;
  author: string;
  category: string;
  status: "draft" | "published" | "archived";
  publishedAt?: number;
}

export interface CommunityPostDto {
  id: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar?: string;
  content: string;
  category: string;
  image?: string;
  tags: string[];
  likesCount: number;
  likedByMe?: boolean;
  viewsCount: number;
  savesCount: number;
  createdAt: string;
}

export interface GroupTripDto {
  id: string;
  organizerUsername: string;
  organizerName: string;
  organizerAvatar?: string;
  organizerRole?: string;
  title: string;
  destination: string;
  dates: string;
  capacity: number;
  pricePerPerson: number;
  meetingPoint: string;
  style: string;
  description: string;
  createdAt: string;
}

export interface TravelBuddyDto {
  id: string;
  name: string;
  username: string;
  avatar: string;
  targetDestination: string;
  travelDates: string;
  travelStyle: string;
  interests: string[];
  bio: string;
  matchScore: number;
  matchReason: string;
}

// ─── 7. Domain Models & DDD Aggregates ──────────────────────────────────────
export * from "./domain/exceptions";
export * from "./domain/wallet";
export * from "./domain/trip";
export * from "./domain/subscription";
export * from "./domain/community";

