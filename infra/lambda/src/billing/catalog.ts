// RevenueCat product IDs from mapsbridge project
// Monthly: prode1930276ca, Yearly: prod99e16b0cb7, Lifetime: prod742c37a698
// Offering: ofrng762b1657ce, Packages: $rc_monthly, $rc_annual, $rc_lifetime
// Entitlement: entl39bf296e8c (lookup_key: mapsbridge_pro)
export const catalog = () => [
  {
    id: "pro",
    mode: "subscription",
    credits: 500,
    amount: 49900,
    productId: "prode1930276ca", // Monthly product
    packageId: "$rc_monthly", // Monthly package
    entitlementId: "mapsbridge_pro", // mapsbridge_pro entitlement lookup_key
    priceId: process.env.STRIPE_PRO_PRICE_ID, // Stripe fallback
  },
  {
    id: "pro-yearly",
    mode: "subscription",
    credits: 5500, // 10% bonus for annual commitment
    amount: 499900,
    productId: "prod99e16b0cb7", // Yearly product
    packageId: "$rc_annual", // Yearly package
    entitlementId: "mapsbridge_pro",
    priceId: process.env.STRIPE_PRO_PRICE_ID,
  },
  {
    id: "lifetime",
    mode: "subscription",
    credits: 100000, // Unlimited usage
    amount: 999900,
    productId: "prod742c37a698", // Lifetime product
    packageId: "$rc_lifetime", // Lifetime package
    entitlementId: "mapsbridge_pro",
    priceId: null,
  },
];

/**
 * RevenueCat kataloğu (Increment 1.2, bug 1) = mevcut ürünler + Kaşif / Tur Lideri abonelikleri
 * ve kredi paketleri. Ürün/paket kimliği ve fiyat koda GÖMÜLMEZ: RevenueCat dashboard'da
 * oluşturulup env ile verilir (revenuecat-setup.md). Env yoksa productId boş → /revenuecat/plans
 * available:false, checkout "Satışa açık bir paket seçin." döner; amount null → UI fiyat çizmez.
 * Stripe yolu (danger zone #3) yalnız `catalog()`'u okur ve değişmez.
 */
export const revenuecatCatalog = () => [
  ...catalog().map((p) => ({ ...p, amount: p.amount as number | null })),
  envProduct("explorer", "subscription", 100),
  envProduct("agency", "subscription", 2500),
  envProduct("pack-30", "credit_pack", 30),
  envProduct("pack-100", "credit_pack", 100),
  envProduct("pack-300", "credit_pack", 300),
];

/** `pack-100` → `PACK_100`; env anahtarı soneki. */
const envSuffix = (id: string) => id.toUpperCase().replace(/-/g, "_");

/**
 * Env'den okunan ürün. `RC_PRICE_<ID>` kuruş cinsinden pozitif tam sayıysa amount, aksi halde
 * null (fiyat uydurulmaz).
 */
function envProduct(id: string, mode: "subscription" | "credit_pack", credits: number) {
  const suffix = envSuffix(id);
  const rawPrice = process.env[`RC_PRICE_${suffix}`];
  const price = rawPrice && /^\d+$/.test(rawPrice) ? Number(rawPrice) : NaN;
  return {
    id,
    mode,
    credits,
    amount: Number.isSafeInteger(price) && price > 0 ? price : null,
    productId: process.env[`RC_PRODUCT_${suffix}`] || undefined,
    packageId: process.env[`RC_PACKAGE_${suffix}`] || undefined,
    entitlementId: mode === "subscription" ? "mapsbridge_pro" : undefined,
    priceId: null,
  };
}

export type CatalogProduct = ReturnType<typeof revenuecatCatalog>[number];
/** Satın alınabilir: satış açık + ürün kimliği + sunucu fiyatı var. */
export const isProductAvailable = (p: CatalogProduct) =>
  process.env.BILLING_ENABLED === "true" && !!p.productId && p.amount !== null;

// ─── Polar Catalog ────────────────────────────────────────────────────────
export interface PolarProduct {
  id: string;
  mode: "subscription" | "credit_pack";
  credits: number;
  amount: number | null;
  productId?: string;
  name: string;
}

function envPolarPrice(key: string, fallback: number): number | null {
  const raw = process.env[key];
  if (!raw) return fallback;
  const num = Number(raw);
  return Number.isSafeInteger(num) && num > 0 ? num : fallback;
}

export const polarCatalog = (): PolarProduct[] => [
  {
    id: "explorer",
    mode: "subscription",
    credits: 100,
    amount: envPolarPrice("POLAR_PRICE_EXPLORER", 19900),
    productId: process.env.POLAR_PRODUCT_EXPLORER || "polar_prod_explorer",
    name: "Kaşif (Explorer)",
  },
  {
    id: "pro",
    mode: "subscription",
    credits: 500,
    amount: envPolarPrice("POLAR_PRICE_PRO", 49900),
    productId: process.env.POLAR_PRODUCT_PRO || "polar_prod_pro",
    name: "Pro Kaşif (Pro Traveler)",
  },
  {
    id: "agency",
    mode: "subscription",
    credits: 2500,
    amount: envPolarPrice("POLAR_PRICE_AGENCY", 149900),
    productId: process.env.POLAR_PRODUCT_AGENCY || "polar_prod_agency",
    name: "Tur Lideri & Grup Paketi",
  },
  {
    id: "pack-30",
    mode: "credit_pack",
    credits: 30,
    amount: envPolarPrice("POLAR_PRICE_PACK_30", 9900),
    productId: process.env.POLAR_PRODUCT_PACK_30 || process.env.POLAR_PRODUCT_PACK_STARTER || "polar_prod_pack_30",
    name: "Başlangıç Paketi (30 Kredi)",
  },
  {
    id: "pack-100",
    mode: "credit_pack",
    credits: 100,
    amount: envPolarPrice("POLAR_PRICE_PACK_100", 24900),
    productId: process.env.POLAR_PRODUCT_PACK_100 || process.env.POLAR_PRODUCT_PACK_POPULAR || "polar_prod_pack_100",
    name: "Gezgin Paketi (100 Kredi)",
  },
  {
    id: "pack-300",
    mode: "credit_pack",
    credits: 300,
    amount: envPolarPrice("POLAR_PRICE_PACK_300", 59900),
    productId: process.env.POLAR_PRODUCT_PACK_300 || process.env.POLAR_PRODUCT_PACK_MASTER || "polar_prod_pack_300",
    name: "Usta Kaşif Paketi (300 Kredi)",
  },
  {
    id: "pack-pro",
    mode: "credit_pack",
    credits: 3000,
    amount: envPolarPrice("POLAR_PRICE_PACK_PRO", 189900),
    productId: process.env.POLAR_PRODUCT_PACK_PRO || "polar_prod_pack_pro",
    name: "Stratejik Kaşif (3000 Kredi)",
  },
];

export const isPolarProductAvailable = (p: PolarProduct) =>
  (process.env.BILLING_ENABLED === "true" || process.env.POLAR_ENABLED === "true" || !process.env.ENVIRONMENT || process.env.ENVIRONMENT === "dev") &&
  !!p.productId &&
  p.amount !== null;

