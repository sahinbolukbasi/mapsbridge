import { apiFetch } from "../api-client";
import { getStoredSession } from "../cognito";
import { createRevenueCatCheckout } from "./revenuecat-client";
import {
  getActionCreditCost,
  type AICreditAction,
} from "@mapsbridge/contracts";
// ============================================================
// MapsBridge Billing & Monetization Service
// Manages Subscriptions, Credit Packs, Creator Wallet & Payouts
// ============================================================

import {
  SubscriptionPlan,
  CreditPackage,
  WalletData,
  BillingTransaction,
  CheckoutPayload,
  CheckoutResult,
  SubscriptionTierId,
  BillingDetails,
  MarketplaceRouteItem,
} from "./billing-types";

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Gezgin (Free)",
    tagline: "Harita masasını keşfetmek ve temel seyahat planları için",
    monthlyPriceTry: 0,
    yearlyPriceTry: 0,
    monthlyCredits: 5,
    color: "#64748b",
    features: [
      { text: "Doğrulanmış yeni hesaba 100 ücretsiz kredi", included: true },
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

export const CREDIT_PACKAGES: CreditPackage[] = [
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

const STORAGE_KEYS = {
  WALLET: "mapsbridge.wallet",
  TRANSACTIONS: "mapsbridge.billing_transactions",
  BILLING_DETAILS: "mapsbridge.billing_details",
  MARKETPLACE_ROUTES: "mapsbridge.marketplace_routes",
};

const DEFAULT_BILLING_DETAILS: BillingDetails = {
  invoiceType: "individual",
  fullNameOrCompany: "",
  taxOrIdNumber: "",
  taxOffice: "",
  address: "",
  city: "",
  country: "Türkiye",
};

const DEFAULT_MARKETPLACE_ROUTES: MarketplaceRouteItem[] = [];

const DEFAULT_WALLET: WalletData = {
  credits: 0,
  subscriptionTier: "free",
  subscriptionCycle: "monthly",
  creatorEarningsTry: 0,
  creatorPendingPayoutTry: 0,
  totalWithdrawnTry: 0,
};

export class BillingService {
  private static instance: BillingService;

  private serverWallet: WalletData = { ...DEFAULT_WALLET };
  private walletOwner = "";
  private constructor() {}

  public static getInstance(): BillingService {
    if (!BillingService.instance) {
      BillingService.instance = new BillingService();
    }
    return BillingService.instance;
  }

  public getWallet(): WalletData {
    const owner = typeof window !== "undefined" ? getStoredSession()?.token || "" : "";
    return owner && owner === this.walletOwner ? { ...this.serverWallet } : { ...DEFAULT_WALLET };
  }

  public async refreshWallet(): Promise<WalletData> {
    const owner = getStoredSession()?.token || "";
    this.walletOwner = "";
    this.serverWallet = { ...DEFAULT_WALLET };
    if (!owner) return this.getWallet();
    const data = await apiFetch<{
      credits: number;
      tier: SubscriptionTierId;
      currentPeriodEnd?: string;
      welcomeGift?: WalletData["welcomeGift"];
    }>("/revenuecat/wallet");
    if (getStoredSession()?.token !== owner) return this.getWallet();
    this.walletOwner = owner;
    this.serverWallet = {
      ...DEFAULT_WALLET,
      credits: data.credits,
      welcomeGift: data.welcomeGift,
      subscriptionTier: data.tier,
      subscriptionRenewsAt: data.currentPeriodEnd,
    };
    window.dispatchEvent(
      new CustomEvent("mapsbridge:wallet_updated", { detail: this.getWallet() }),
    );
    return this.getWallet();
  }

  public saveWallet(_wallet: WalletData): void {
    throw new Error("Kredi ve üyelik yalnız sunucuda güncellenebilir.");
  }
  public getTransactions(): BillingTransaction[] {
    return [];
  }
  public addTransaction(_tx: Omit<BillingTransaction, "id" | "date">): void {
    throw new Error("İşlem kaydı sunucu onayı gerektirir.");
  }
  public deductCredits(_amount: number, _reason: string): boolean {
    return false;
  }
  public addCredits(_amount: number, _reason: string, _amountTry?: number): void {
    throw new Error("Kredi yalnız doğrulanmış ödeme ile eklenebilir.");
  }
  public async processCheckout(payload: CheckoutPayload): Promise<CheckoutResult> {
    return createRevenueCatCheckout(payload);
  }
  public recordRouteSale(_title: string, _price: number): void {
    throw new Error("Satış sunucu doğrulaması gerektirir.");
  }
  public async requestPayout(
    _amount: number,
    _iban: string,
    _holder: string,
  ): Promise<{ success: boolean; message: string }> {
    return { success: false, message: "Para çekme servisi henüz kullanıma açık değil." };
  }

  public getBillingDetails(): BillingDetails {
    if (typeof window === "undefined") return DEFAULT_BILLING_DETAILS;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.BILLING_DETAILS);
      if (!raw) return DEFAULT_BILLING_DETAILS;
      return { ...DEFAULT_BILLING_DETAILS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_BILLING_DETAILS;
    }
  }

  /**
   * Saves updated billing invoice details
   */
  public saveBillingDetails(details: BillingDetails): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEYS.BILLING_DETAILS, JSON.stringify(details));
      window.dispatchEvent(
        new CustomEvent("mapsbridge:billing_details_updated", { detail: details }),
      );
    } catch {}
  }

  /**
   * Credit cost per AI / Map operation
   */
  public getActionCost(action: AICreditAction): number {
    return getActionCreditCost(action);
  }

  /**
   * Checks whether the user has sufficient credits for an action
   */
  public canAffordAction(action: AICreditAction): {
    allowed: boolean;
    cost: number;
    currentCredits: number;
  } {
    const cost = this.getActionCost(action);
    const wallet = this.getWallet();
    return {
      allowed: wallet.credits >= cost,
      cost,
      currentCredits: wallet.credits,
    };
  }

  /**
   * Deducts credits for a specific AI / travel action and emits an event
   */
  public consumeActionCredits(action: AICreditAction, _contextLabel?: string) {
    return {
      success: false,
      remainingCredits: this.getWallet().credits,
      cost: this.getActionCost(action),
      error: "Kredi AI isteği sırasında sunucuda işlenir.",
    };
  }

  /**
   * Enforces route creation limits based on membership plan.
   * Free tier: max 3 routes.
   * Explorer, Pro, Agency: unlimited routes.
   */
  public canCreateRoute(currentRouteCount: number): {
    allowed: boolean;
    maxRoutes: number;
    reason?: string;
  } {
    const wallet = this.getWallet();
    if (wallet.subscriptionTier === "free") {
      const MAX_FREE_ROUTES = 3;
      if (currentRouteCount >= MAX_FREE_ROUTES) {
        return {
          allowed: false,
          maxRoutes: MAX_FREE_ROUTES,
          reason:
            "Ücretsiz Gezgin planında en fazla 3 aktif rota oluşturabilirsiniz. Sınırsız rota kaydetmek ve GPX/PDF çıktısı almak için Kaşif veya Pro Plana geçebilirsiniz.",
        };
      }
      return { allowed: true, maxRoutes: MAX_FREE_ROUTES };
    }
    return { allowed: true, maxRoutes: Infinity };
  }

  /**
   * Enforces route monetization capabilities: Only Pro Kaşif and Agency can list routes for sale.
   */
  public canSellRoutes(): { allowed: boolean; minTier: SubscriptionTierId; reason?: string } {
    const wallet = this.getWallet();
    const isAllowed = wallet.subscriptionTier === "pro" || wallet.subscriptionTier === "agency";
    return {
      allowed: isAllowed,
      minTier: "pro",
      reason: isAllowed
        ? undefined
        : "Rota satışı yaparak %85 net gelir elde etmek Pro Kaşif veya Tur Lideri planına sahip kullanıcılara özeldir. Gezi rotalarınızı kazanca dönüştürmek için planınızı yükseltin.",
    };
  }

  /**
   * Checks if user can export GPX/PDF
   */
  public canExportGpxOrPdf(): { allowed: boolean; reason?: string } {
    const wallet = this.getWallet();
    if (wallet.subscriptionTier === "free") {
      return {
        allowed: false,
        reason:
          "GPX rota dosyası ve çevrimdışı PDF gezi rehberi dışa aktarma özelliği Kaşif ve Pro üyelere özeldir.",
      };
    }
    return { allowed: true };
  }

  /**
   * Marketplace routes
   */
  public getMarketplaceRoutes(): MarketplaceRouteItem[] {
    if (typeof window === "undefined") return DEFAULT_MARKETPLACE_ROUTES;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.MARKETPLACE_ROUTES);
      if (!raw) return DEFAULT_MARKETPLACE_ROUTES;
      return JSON.parse(raw);
    } catch {
      return DEFAULT_MARKETPLACE_ROUTES;
    }
  }

  /**
   * Publishes a creator route to the marketplace
   */
  public publishRouteToMarketplace(item: Omit<MarketplaceRouteItem, "isPurchased">): {
    success: boolean;
    error?: string;
  } {
    const permission = this.canSellRoutes();
    if (!permission.allowed) {
      return { success: false, error: permission.reason };
    }

    try {
      const current = this.getMarketplaceRoutes();
      const existingIdx = current.findIndex((r) => r.id === item.id);
      let updated: MarketplaceRouteItem[];

      if (existingIdx >= 0) {
        updated = [...current];
        updated[existingIdx] = { ...item, isPurchased: false };
      } else {
        updated = [{ ...item, isPurchased: false }, ...current];
      }

      localStorage.setItem(STORAGE_KEYS.MARKETPLACE_ROUTES, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("mapsbridge:marketplace_updated", { detail: updated }));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "Rota pazara eklenemedi." };
    }
  }

  /**
   * Purchases a route from the marketplace
   */
  public buyMarketplaceRoute(
    _routeId: string,
    _cardName?: string,
  ): { success: boolean; message: string; route?: MarketplaceRouteItem } {
    return { success: false, message: "Rota satın alma servisi henüz kullanıma açık değil." };
  }
}

export const billingService = BillingService.getInstance();
