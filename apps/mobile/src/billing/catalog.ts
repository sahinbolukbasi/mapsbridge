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
  /** Kuruş (amount / 100 = TRY). */
  amount: number;
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
  if (!isNonNegative(amount)) return null;
  if (typeof available !== "boolean") return null;
  return { id, mode: mode as CatalogMode, credits, amount, available };
}

/** Katalog yanıtını doğrular (web parseCatalog ile aynı). */
export function parseCatalog(raw: unknown): Catalog {
  if (!isRecord(raw) || typeof raw.enabled !== "boolean" || !Array.isArray(raw.products))
    return { status: "unavailable" };
  const products = raw.products.map(parseProduct).filter((p): p is CatalogProduct => p !== null);
  if (raw.products.length > 0 && products.length === 0) return { status: "unavailable" };
  return { status: "ok", enabled: raw.enabled, products };
}

/** Tier'in aylık katalog ürünü (`<tier>`; native yıllık satmaz, S18). */
export function findMonthlyProduct(
  products: readonly CatalogProduct[],
  tier: PlanTier,
): CatalogProduct | undefined {
  if (tier === "free") return undefined;
  return products.find((p) => p.mode === "subscription" && p.id === tier);
}
