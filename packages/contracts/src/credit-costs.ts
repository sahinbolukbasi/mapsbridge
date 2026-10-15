/**
 * @mapsbridge/contracts — Credit Costs (Single Source of Truth)
 *
 * All credit costs for AI actions and model tiers are defined here.
 * Both web and backend services MUST import from this file.
 *
 * Backend model-router values are the canonical source:
 *   tier1 (greeting)  = 0    | tier2 (standard chat) = 0.5
 *   tier3 (complex)   = 2    | tier4 (deep/replan)   = 5
 */

// ─── Action-based credit costs (used by web billing UI) ──────────────────────

export type AICreditAction = "ai_deep_trip" | "ai_stay_dining" | "ai_chat" | "route_optimize";

/**
 * Credit cost per AI action.
 * These align with model-router tiers:
 *   ai_chat        → tier2 (0.5)
 *   ai_stay_dining → tier3 (2)
 *   ai_deep_trip   → tier4 (5)
 *   route_optimize → tier2 (0.5)
 */
export const ACTION_CREDIT_COSTS: Record<AICreditAction, number> = {
  ai_chat: 0.5,
  ai_stay_dining: 2,
  ai_deep_trip: 5,
  route_optimize: 0.5,
} as const;

export function getActionCost(action: AICreditAction): number {
  return ACTION_CREDIT_COSTS[action] ?? 0.5;
}

// ─── Model-tier credit costs (used by backend model-router) ──────────────────

export type ModelTier = "tier1" | "tier2" | "tier3" | "tier4";

export const MODEL_TIER_CREDIT_COSTS: Record<ModelTier, number> = {
  tier1: 0,
  tier2: 0.5,
  tier3: 2,
  tier4: 5,
} as const;

// ─── Subscription plans (shared between web and backend) ─────────────────────

export type SubscriptionTierId = "free" | "explorer" | "pro" | "agency";
export type BillingCycle = "monthly" | "yearly";

export interface PlanFeature {
  text: string;
  included: boolean;
  highlight?: boolean;
}

export interface SubscriptionPlanDef {
  id: SubscriptionTierId;
  name: string;
  tagline: string;
  badge?: string;
  monthlyPriceTry: number;
  yearlyPriceTry: number;
  monthlyCredits: number;
  features: PlanFeature[];
  highlight?: boolean;
  color: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanDef[] = [
  {
    id: "free",
    name: "Gezgin (Free)",
    tagline: "Harita masasını keşfetmek ve temel seyahat planları için",
    monthlyPriceTry: 0,
    yearlyPriceTry: 0,
    monthlyCredits: 5,
    color: "#64748b",
    features: [
      { text: "Doğrulanmış yeni hesaba tek seferlik 5 kredi", included: true },
      { text: "3 Aktif Rota & 50 Kayıtlı Mekan Havuzu", included: true },
      { text: "Temel Harita Masası & OSRM Rota Çizimi", included: true },
      { text: "Gezginler Topluluğunu Keşfetme & Rota İnceleme", included: true },
      { text: "Doğal Dilde AI ile Rota Düzenleme & Versiyonlama", included: false },
      { text: "Tek Tıkla Google Maps'e Aktarım", included: false },
      { text: "Akıllı Gezi Arkadaşı Eşleşmesi", included: false },
    ],
  },
  {
    id: "explorer",
    name: "Kaşif (Explorer)",
    tagline: "Sık seyahat edenler ve gezi rotası oluşturanlar için ideal",
    monthlyPriceTry: 199,
    yearlyPriceTry: 159,
    monthlyCredits: 100,
    color: "#2563eb",
    features: [
      { text: "Aylık 100 AI Rota Kredisi", included: true, highlight: true },
      { text: "Sınırsız Rota ve Durak Kaydı", included: true },
      { text: "Tek Tıkla Google Maps'e Aktarım (Durak Sıralı)", included: true, highlight: true },
      { text: "OSRM Yaya ve Araç Yol Tarifleri", included: true },
      { text: "GPX & Çevrimdışı PDF Gezi Rehberi", included: true },
      { text: "Toplulukta Özel Rota Paylaşımı", included: true },
      { text: "Doğal Dilde AI ile Rota Düzenleme & Versiyonlama", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro Kaşif (Pro Traveler)",
    tagline: "Sınırsız AI rota planlama gücü ve gezi arkadaşı eşleşmesine ulaşmak isteyenler için",
    badge: "EN POPÜLER",
    monthlyPriceTry: 499,
    yearlyPriceTry: 399,
    monthlyCredits: 500,
    highlight: true,
    color: "#10b981",
    features: [
      { text: "Aylık 500 AI Rota Kredisi", included: true, highlight: true },
      {
        text: "Doğal Dilde AI ile Rota Düzenleme & Versiyonlama (v1, v2, v3...)",
        included: true,
        highlight: true,
      },
      { text: "Tek Tıkla Google Maps'e Sınırsız Aktarım", included: true },
      {
        text: "Akıllı Gezi Arkadaşı Eşleşmesi (% Uyum Algoritması)",
        included: true,
        highlight: true,
      },
      { text: "Otomatik Mekan Zenginleştirme Agent'ı", included: true },
      { text: "Sınırsız Katılımcılı Grup Gezileri & Ortak Planlama", included: true },
      { text: "7/24 Öncelikli VIP Destek", included: true },
    ],
  },
  {
    id: "agency",
    name: "Tur Lideri & Grup Paketi",
    tagline: "Rehberler, tur organizatörleri ve seyahat toplulukları için kurumsal güç",
    monthlyPriceTry: 1499,
    yearlyPriceTry: 1199,
    monthlyCredits: 2500,
    color: "#8b5cf6",
    features: [
      { text: "Aylık 2.500 AI Rota Kredisi", included: true, highlight: true },
      {
        text: "Toplu Gezi Grupları ve Eşzamanlı Canlı Rota Planlama",
        included: true,
        highlight: true,
      },
      { text: "Harita Üzerinde Özel Marka & Logo", included: true },
      { text: "Çoklu Rehber ve Ekip Üyesi Yönetimi", included: true },
      { text: "Özel API & Veri İçe/Dışa Aktarımı", included: true },
      { text: "Özel Müşteri Temsilcisi", included: true },
    ],
  },
];

// ─── Credit packages ─────────────────────────────────────────────────────────

export interface CreditPackageDef {
  id: string;
  title: string;
  credits: number;
  bonusCredits: number;
  priceTry: number;
  popular?: boolean;
  unitPriceTry: number;
  description: string;
}

export const CREDIT_PACKAGES: CreditPackageDef[] = [
  {
    id: "pack-starter",
    title: "Hızlı Başlangıç",
    credits: 50,
    bonusCredits: 0,
    priceTry: 89,
    unitPriceTry: 1.78,
    description: "5-10 kapsamlı AI seyahat planı ve harita analizi için.",
  },
  {
    id: "pack-popular",
    title: "Popüler Gezgin",
    credits: 300,
    bonusCredits: 0,
    priceTry: 299,
    popular: true,
    unitPriceTry: 0.99,
    description: "Düzenli gezginler için en avantajlı ve çok tercih edilen paket.",
  },
  {
    id: "pack-master",
    title: "Usta Kaşif",
    credits: 1000,
    bonusCredits: 0,
    priceTry: 749,
    unitPriceTry: 0.74,
    description: "Geniş rota kütüphanesi oluşturan kaşifler ve grup liderleri için.",
  },
  {
    id: "pack-pro",
    title: "Stratejik Kaşif",
    credits: 3000,
    bonusCredits: 0,
    priceTry: 1899,
    unitPriceTry: 0.63,
    description: "Acentalar, içerik üreticileri ve profesyonel tur rehberleri için dev paket.",
  },
];
