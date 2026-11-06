// Fiyat kataloğu (design §7.1–7.3, §12.2; karar S2). Fiyat ve satın alınabilirlik YALNIZCA canlı
// katalogdan (GET /revenuecat/plans) okunur; contracts TRY fiyatları gösterilmez. Tier adı ve
// aylık kredi statiktir (SUBSCRIPTION_PLAN_DEFS.monthlyCredits + i18n pricing.tier.*). Bu modül
// yalnızca GÖSTERİM içindir: kredi istemcide hesaplanmaz/düşülmez, sunucu kredi zinciri değişmez.
// UI hoş geldin 100 (sunucuyla hizalı) / ai_chat 1 gösterir; sunucu değeri yayından önce kullanıcı tarafından teyit
// edilmeli.
import { SUBSCRIPTION_PLAN_DEFS } from "@mapsbridge/contracts";
import { apiFetch } from "../api-client";
import { CREDIT_COST_ROWS, WELCOME_CREDITS_DISPLAY } from "./credit-costs";

export type PlanTier = "free" | "explorer" | "pro" | "agency";
export const PLAN_TIERS: readonly PlanTier[] = ["free", "explorer", "pro", "agency"];
export type PlanPeriod = "monthly" | "yearly";
export const PLAN_PERIODS: readonly PlanPeriod[] = ["monthly", "yearly"];
export type CatalogMode = "subscription" | "credit_pack";
const CATALOG_MODES: readonly CatalogMode[] = ["subscription", "credit_pack"];

export type CatalogProduct = {
  id: string;
  mode: CatalogMode;
  credits: number;
  /**
   * Kuruş (amount / 100 = TRY); checkout bugün de böyle gösterir. `null`: sunucuda fiyat
   * tanımlı değil (RC_PRICE_<ID> env yok) → fiyat satırı çizilmez, ürün satın alınamaz.
   */
  amount: number | null;
  available: boolean;
};
export type Catalog =
  { status: "ok"; enabled: boolean; products: CatalogProduct[] } | { status: "unavailable" };

export const CATALOG_TIMEOUT_MS = 8000;
const CATALOG_ENDPOINT = "/revenuecat/plans";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNonNegative = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

function parseProduct(raw: unknown): CatalogProduct | null {
  if (!isRecord(raw)) return null;
  const { id, mode, credits, amount, available } = raw;
  if (typeof id !== "string" || id.length === 0) return null;
  if (typeof mode !== "string" || !CATALOG_MODES.includes(mode as CatalogMode)) return null;
  if (!isNonNegative(credits) || !Number.isInteger(credits)) return null;
  if (amount !== null && !isNonNegative(amount)) return null;
  if (typeof available !== "boolean") return null;
  // Fiyatsız ürün satılamaz (sunucu da available:false yazar; burada ikinci kez zorlanır).
  return {
    id,
    mode: mode as CatalogMode,
    credits,
    amount,
    available: available && amount !== null,
  };
}

/**
 * Katalog yanıtını doğrular (design §12.2): şemaya uymayan ürün atılır; gövde bozuksa ya da
 * ürünlerin hepsi geçersizse { status: "unavailable" } ("Fiyatlar şu an yüklenemedi").
 * `enabled: false` korunur (satın alma kapalı durumu, §7.3).
 */
export function parseCatalog(raw: unknown): Catalog {
  if (!isRecord(raw) || typeof raw.enabled !== "boolean" || !Array.isArray(raw.products))
    return { status: "unavailable" };
  const products = raw.products.map(parseProduct).filter((p): p is CatalogProduct => p !== null);
  if (raw.products.length > 0 && products.length === 0) return { status: "unavailable" };
  return { status: "ok", enabled: raw.enabled, products };
}

/**
 * Kataloğu getirir: oturumsuz (skipAuth), 8 sn zaman aşımı. Hata, zaman aşımı ya da `signal`
 * iptali `{ status: "unavailable" }` döner; asla fırlatmaz (kartlar kredi bilgisiyle görünür).
 */
export async function fetchCatalog(signal?: AbortSignal): Promise<Catalog> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    if (signal?.aborted) return { status: "unavailable" };
    // apiFetch kendi zaman aşımı sinyalini kullanır; iptal/8 sn sınırı burada yarıştırılır.
    const aborted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => reject(new Error("catalog aborted")));
    });
    const raw = await Promise.race([
      apiFetch<unknown>(CATALOG_ENDPOINT, { skipAuth: true, timeoutMs: CATALOG_TIMEOUT_MS }),
      aborted,
    ]);
    return parseCatalog(raw);
  } catch (err) {
    if (process.env.NODE_ENV !== "production")
      console.warn("[pricing] katalog yüklenemedi", err instanceof Error ? err.message : err);
    return { status: "unavailable" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

const COST_OF = (action: "ai_deep_trip" | "ai_chat"): number => {
  const cost = CREDIT_COST_ROWS.find((r) => r.action === action)?.cost;
  return typeof cost === "number" ? cost : 1;
};

/** "≈ N derin rota ya da N sohbet mesajı" (design §7.2): yalnızca maliyet tablosundan, aşağı yuvarlar. */
export function derivePlanEquivalents(credits: number): { deepTrips: number; chats: number } {
  const safe = Number.isFinite(credits) && credits > 0 ? credits : 0;
  return {
    deepTrips: Math.floor(safe / COST_OF("ai_deep_trip")),
    chats: Math.floor(safe / COST_OF("ai_chat")),
  };
}

/**
 * Yıllık indirim yüzdesi, KREDİ BAŞINA (design §7.2 madde 2): yalnızca katalogda iki dönem de
 * varsa; aksi halde undefined (metin gösterilmez). Yıllık ürün 12 × aylık kredi vermeyebilir
 * (ör. pro 500 kr/₺499, pro-yearly 5.500 kr/₺4.999), bu yüzden yalnızca tutar karşılaştırılmaz;
 * kredi başına fiyat karşılaştırılır (≈ %9). Kredi başı yıllık pahalı ya da eşitse undefined.
 */
export function yearlyDiscount(
  monthly: CatalogProduct | undefined,
  yearly: CatalogProduct | undefined,
): number | undefined {
  if (!monthly || !yearly || monthly.amount === null || yearly.amount === null) return undefined;
  if (monthly.amount <= 0 || yearly.amount <= 0 || monthly.credits <= 0 || yearly.credits <= 0)
    return undefined;
  const monthlyPerCredit = monthly.amount / monthly.credits;
  const yearlyPerCredit = yearly.amount / yearly.credits;
  const pct = Math.round((1 - yearlyPerCredit / monthlyPerCredit) * 100);
  return pct > 0 ? pct : undefined;
}

/** Tier'in seçilen dönemdeki katalog ürünü: aylık = `<tier>`, yıllık = `<tier>-yearly`. */
export function findPlanProduct(
  products: readonly CatalogProduct[],
  tier: PlanTier,
  period: PlanPeriod,
): CatalogProduct | undefined {
  if (tier === "free") return undefined;
  const id = period === "yearly" ? `${tier}-yearly` : tier;
  return products.find((p) => p.mode === "subscription" && p.id === id);
}

/**
 * Web'de satılabilir mi (karar S18): yalnızca aylık abonelik (`<tier>`) ve kredi paketleri.
 * `*-yearly` ürünler yalnızca GÖSTERİLİR (fiyat + yıllık kredi), CTA "Şu an satın alınamıyor".
 * Gerekçe: sunucu `pro-yearly` alımında tier'ı "pro-yearly" yazıyor, wallet bunu "free" sayıyor;
 * kullanıcı ödeyip Pro yetkisi alamaz. Backend *-yearly → tier eşlemesini yapana kadar geçerli.
 */
export function isWebSellable(product: CatalogProduct): boolean {
  return product.mode === "credit_pack" || !product.id.endsWith("-yearly");
}

/**
 * Checkout'un tek durumu (bug 1): `closed` (enabled:false → yalnız "Kredi satışı henüz açık
 * değil" uyarısı), `noProducts` (satış açık ama satın alınabilir ürün yok), `open`. Bugünkü uyarı
 * + devre dışı düğme + "paket yok" metni üst üste binmesin diye checkout bunu tek yerden okur.
 */
export type CheckoutAvailability = "closed" | "noProducts" | "open";
export function checkoutAvailability(
  catalog: Extract<Catalog, { status: "ok" }>,
): CheckoutAvailability {
  if (!catalog.enabled) return "closed";
  const sellable = catalog.products.some(
    (p) => p.available && p.amount !== null && isWebSellable(p),
  );
  return sellable ? "open" : "noProducts";
}
/** Kredi paketleri yalnızca katalogdan (design §7.2 madde 5). */
export function creditPacks(products: readonly CatalogProduct[]): CatalogProduct[] {
  return products.filter((p) => p.mode === "credit_pack");
}

/** Kart başına statik bilgi: free hoş geldin kredisi, ücretli tier'ler aylık kredi (contracts). */
export type PlanInfo = { tier: PlanTier; credits: number; kind: "welcome" | "monthly" };
export function planInfos(): PlanInfo[] {
  return PLAN_TIERS.map((tier) => {
    if (tier === "free") return { tier, credits: WELCOME_CREDITS_DISPLAY, kind: "welcome" };
    const def = SUBSCRIPTION_PLAN_DEFS.find((p) => p.id === tier);
    return { tier, credits: def?.monthlyCredits ?? 0, kind: "monthly" };
  });
}

/** Katalogdan gelen fiyat (design §7.1: fiyat yalnızca canlı katalogdan). */
export type CatalogPrice = { amount: number; period: PlanPeriod; credits: number };
/**
 * loading: Skeleton · unavailable: katalog yüklenemedi ("ödeme adımında") · free: ücretsiz plan ·
 * none: katalog yüklendi ama bu tier/dönem için ürün yok (fiyat satırı çizilmez, I10).
 */
export type PlanPriceState = CatalogPrice | "loading" | "unavailable" | "free" | "none";
/**
 * ok: CTA etkin · closed: enabled:false · unavailable: ürün yok / available:false / web'de
 * satılmaz (yıllık, S18) · current.
 */
export type PlanPurchase = "ok" | "closed" | "unavailable" | "current";
/**
 * `credits` yalnızca yıllık dönemde katalogda yıllık ürün varsa verilir: kartın birincil kredi
 * satırı ve "≈" satırı o zaman ürünün yıllık kredisinden gelir ("5.500 kredi / yıl"); aksi halde
 * statik aylık kredi (planInfos) gösterilir.
 */
export type PlanOffer = {
  price: PlanPriceState;
  discount?: number;
  purchase: PlanPurchase;
  credits?: { n: number; kind: "yearly" };
};

/**
 * Kart durumu (design §7.3) tek yerde: fiyat, kredi, yıllık indirim ve CTA'nın satın
 * alınabilirliği. "Mevcut planın" tier VE dönem eşleşince (free dönemsizdir); sunucu wallet'ı
 * dönem bildirmez, `subscriptionCycle` bugün hep "monthly" (sunucuda tier "pro" yalnızca aylık
 * `pro` ürününden yazılır).
 */
export function planOffer(
  tier: PlanTier,
  period: PlanPeriod,
  catalog: Catalog | "loading",
  currentTier: PlanTier | null,
  currentPeriod: PlanPeriod = "monthly",
): PlanOffer {
  const current = currentTier === tier && (tier === "free" || currentPeriod === period);
  if (tier === "free") return { price: "free", purchase: current ? "current" : "ok" };
  if (catalog === "loading") return { price: "loading", purchase: current ? "current" : "ok" };
  if (catalog.status === "unavailable")
    return { price: "unavailable", purchase: current ? "current" : "ok" };
  const product = findPlanProduct(catalog.products, tier, period);
  const discount =
    period === "yearly"
      ? yearlyDiscount(
          findPlanProduct(catalog.products, tier, "monthly"),
          findPlanProduct(catalog.products, tier, "yearly"),
        )
      : undefined;
  const price: PlanPriceState =
    product && product.amount !== null
      ? { amount: product.amount, period, credits: product.credits }
      : "none";
  const purchase: PlanPurchase = current
    ? "current"
    : !catalog.enabled
      ? "closed"
      : !product || !product.available || product.amount === null || !isWebSellable(product)
        ? "unavailable"
        : "ok";
  const offer: PlanOffer = { price, purchase };
  if (discount !== undefined) offer.discount = discount;
  if (product && period === "yearly") offer.credits = { n: product.credits, kind: "yearly" };
  return offer;
}

/** Katalog tutarı (kuruş) → "₺499" / "₺49,90"; para birimi bugünkü checkout ile aynı (TRY). */
export function formatPrice(amount: number, locale: "tr" | "en"): string {
  const value = amount / 100;
  return value.toLocaleString(locale === "en" ? "en-GB" : "tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
