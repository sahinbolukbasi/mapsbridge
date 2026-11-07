// Fiyat kataloğu (design §7.1–7.3; kararlar S2, S18): apps/web/app/lib/billing/catalog.ts
// parseCatalog / findPlanProduct kopyası (parite testli). Fiyat YALNIZCA canlı katalogdan
// (GET /revenuecat/plans, services/api.ts billingService.getPlans) gelir; contracts TRY fiyatları
// gösterilmez. Native Paywall yalnız AYLIK abonelik gösterir (S18: `*-yearly` ürünü sunucu tier'a
// eşlemiyor, kullanıcı ödeyip yetki alamaz). Yalnızca gösterim: kredi istemcide hesaplanmaz.
import type { PlanTier } from "./plans";

export type CatalogMode = "subscription" | "credit_pack";
const CATALOG_MODES: readonly CatalogMode[] = ["subscription", "credit_pack"];
export type CatalogProduct = {
  id: string;
  mode: CatalogMode;
  credits: number;
  /** Kuruş (amount / 100 = TRY). `null`: sunucuda fiyat yok → fiyat çizilmez, satılamaz. */
  amount: number | null;
  available: boolean;
};
export type Catalog =
  { status: "ok"; enabled: boolean; products: CatalogProduct[] } | { status: "unavailable" };

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
  // Fiyatsız ürün satılamaz (web parseCatalog ile aynı).
  return {
    id,
    mode: mode as CatalogMode,
    credits,
    amount,
    available: available && amount !== null,
  };
}

/** Katalog yanıtını doğrular (web parseCatalog ile aynı). */
export function parseCatalog(raw: unknown): Catalog {
  if (!isRecord(raw) || typeof raw.enabled !== "boolean" || !Array.isArray(raw.products))
    return { status: "unavailable" };
  const products = raw.products.map(parseProduct).filter((p): p is CatalogProduct => p !== null);
  if (raw.products.length > 0 && products.length === 0) return { status: "unavailable" };
  return { status: "ok", enabled: raw.enabled, products };
}

/** Katalog ürününün mağaza (RevenueCat) kimlikleri. */
export type StoreIds = { packageId?: string; productId?: string };

/**
 * YALNIZ native (FEAT-012 review #1): /revenuecat/plans her ürünle birlikte mağaza paket/ürün
 * kimliğini de döndürür (ör. pro → packageId "$rc_monthly", productId "prode1930276ca"). Web
 * parseCatalog bu alanları taşımaz (parite korunur); Paywall eşlemeyi buradan okur.
 */
export function parseStoreIds(raw: unknown): Record<string, StoreIds> {
  const out: Record<string, StoreIds> = {};
  if (!isRecord(raw) || !Array.isArray(raw.products)) return out;
  for (const p of raw.products) {
    if (!isRecord(p) || typeof p.id !== "string" || p.id.length === 0) continue;
    const ids: StoreIds = {};
    if (typeof p.packageId === "string" && p.packageId) ids.packageId = p.packageId;
    if (typeof p.productId === "string" && p.productId) ids.productId = p.productId;
    if (ids.packageId || ids.productId) out[p.id] = ids;
  }
  return out;
}

/** Mağaza teklifindeki paket, katalog ürününün paket ya da ürün kimliğiyle eşleşiyor mu. */
export function matchesStoreIds(
  pkg: { identifier: string; product: { identifier: string } },
  ids: StoreIds | undefined,
): boolean {
  if (!ids) return false;
  return (
    (!!ids.packageId && pkg.identifier === ids.packageId) ||
    (!!ids.productId && pkg.product.identifier === ids.productId)
  );
}

/** Tier'in aylık katalog ürünü (`<tier>`; native yıllık satmaz, S18). */
export function findMonthlyProduct(
  products: readonly CatalogProduct[],
  tier: PlanTier,
): CatalogProduct | undefined {
  if (tier === "free") return undefined;
  return products.find((p) => p.mode === "subscription" && p.id === tier);
}

/** Native'de satılan abonelik kademeleri (aylık; yıllık kapalı, S29). */
export const PAID_TIERS = ["explorer", "pro", "agency"] as const;
/** Katalogdaki kredi paketleri (`pack-*`, web creditPacks ile aynı süzgeç), krediye göre artan. */
export function creditPacks(products: readonly CatalogProduct[]): CatalogProduct[] {
  return products.filter((p) => p.mode === "credit_pack").sort((a, b) => a.credits - b.credits);
}
/**
 * Satın alınabilir seçenek: satış açık + katalog ürünü available + mağaza teklifinde eşleşen paket.
 * Değilse neden döner (CTA "Şu an satın alınamıyor" + açıklama).
 */
export function sellState(
  catalog: Catalog | "loading",
  product: CatalogProduct | undefined,
  hasStorePackage: boolean,
): "ok" | "loading" | "unavailable" | "disabled" | "notDefined" {
  if (catalog === "loading") return "loading";
  if (catalog.status === "unavailable") return "unavailable";
  if (!catalog.enabled) return "disabled";
  if (!product || !product.available || !hasStorePackage) return "notDefined";
  return "ok";
}
