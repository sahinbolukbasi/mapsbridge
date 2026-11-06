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
