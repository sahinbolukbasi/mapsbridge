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

// ─── Polar Catalog (TR / US / EU Multi-Market + Live Hosted Checkout Links) ───
export interface PolarProduct {
  id: string;
  mode: "subscription" | "credit_pack";
  credits: number;
  amount: number | null;
  prices?: {
    TRY: number;
    USD: number;
    EUR: number;
  };
  productId?: string;
  packageId?: string;
  checkoutUrl?: string;
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
    prices: { TRY: 19900, USD: 699, EUR: 649 },
    productId: process.env.POLAR_PRODUCT_EXPLORER || "a3443dcc-7050-4705-82c3-f986b0ef94ea",
    packageId: "polar_explorer",
    checkoutUrl:
      process.env.POLAR_CHECKOUT_URL_EXPLORER ||
      "https://buy.polar.sh/polar_cl_1YnWOZCCN94R9gaownJcFaKj8bnekRZl8nKm20FyTQO",
    name: "Kaşif (Explorer)",
  },
  {
    id: "pro",
    mode: "subscription",
    credits: 500,
    amount: envPolarPrice("POLAR_PRICE_PRO", 49900),
    prices: { TRY: 49900, USD: 1499, EUR: 1399 },
    productId: process.env.POLAR_PRODUCT_PRO || "bc53edf5-476c-4f5f-805a-3b2c1e8e8739",
    packageId: "$rc_monthly",
    checkoutUrl:
      process.env.POLAR_CHECKOUT_URL_PRO ||
      "https://buy.polar.sh/polar_cl_TitGKcwxcS7AtB2jTsmHW99kQc7sudzdd5gXP0rAve0",
    name: "Pro Kaşif (Pro Traveler)",
  },
  {
    id: "agency",
    mode: "subscription",
    credits: 2500,
    amount: envPolarPrice("POLAR_PRICE_AGENCY", 149900),
    prices: { TRY: 149900, USD: 4999, EUR: 4599 },
    productId: process.env.POLAR_PRODUCT_AGENCY || "62d9b9e3-9ddb-49db-b1d6-67d50f76c2b6",
    packageId: "polar_agency",
    checkoutUrl:
      process.env.POLAR_CHECKOUT_URL_AGENCY ||
      "https://buy.polar.sh/polar_cl_E0BpkvdYR74Fp0ye6i7m6mD1LQ4GJDZNDDCEw0f3Vc2",
    name: "Tur Lideri & Grup Paketi",
  },
  {
    id: "pack-30",
    mode: "credit_pack",
    credits: 30,
    amount: envPolarPrice("POLAR_PRICE_PACK_30", 9900),
    prices: { TRY: 9900, USD: 299, EUR: 279 },
    productId:
      process.env.POLAR_PRODUCT_PACK_30 ||
      process.env.POLAR_PRODUCT_PACK_STARTER ||
      "cd802b74-05b9-4234-b08b-21a1152ec8d6",
    packageId: "polar_pack_30",
    checkoutUrl:
      process.env.POLAR_CHECKOUT_URL_PACK_30 ||
      "https://buy.polar.sh/polar_cl_wpo0KNVyrThYAbhR8Iouc7mMBIGpfSNxQDsMW2nTfCh",
    name: "Başlangıç Kredi Paketi (30 Kredi)",
  },
  {
    id: "pack-100",
    mode: "credit_pack",
    credits: 100,
    amount: envPolarPrice("POLAR_PRICE_PACK_100", 24900),
    prices: { TRY: 24900, USD: 799, EUR: 749 },
    productId:
      process.env.POLAR_PRODUCT_PACK_100 ||
      process.env.POLAR_PRODUCT_PACK_POPULAR ||
      "31f3e0d0-8d81-4a3b-83f1-56bcbb5cde40",
    packageId: "polar_pack_100",
    checkoutUrl:
      process.env.POLAR_CHECKOUT_URL_PACK_100 ||
      "https://buy.polar.sh/polar_cl_qkvFdsPgPCAhOZu9GpLOhMJeULcO0hSEXqreE0D94hc",
    name: "Gezgin Kredi Paketi (100 Kredi)",
  },
  {
    id: "pack-300",
    mode: "credit_pack",
    credits: 300,
    amount: envPolarPrice("POLAR_PRICE_PACK_300", 59900),
    prices: { TRY: 59900, USD: 1899, EUR: 1749 },
    productId:
      process.env.POLAR_PRODUCT_PACK_300 ||
      process.env.POLAR_PRODUCT_PACK_MASTER ||
      "86fadb96-c068-4b69-b23a-0ed871d57718",
    packageId: "polar_pack_300",
    checkoutUrl:
      process.env.POLAR_CHECKOUT_URL_PACK_300 ||
      "https://buy.polar.sh/polar_cl_WH0IZVT4tIRlcxlftSnlyJbBFcjCTT4apO47w1stp5H",
    name: "Usta Kaşif Paketi (300 Kredi)",
  },
  {
    id: "pack-pro",
    mode: "credit_pack",
    credits: 3000,
    amount: envPolarPrice("POLAR_PRICE_PACK_PRO", 189900),
    prices: { TRY: 189900, USD: 5999, EUR: 5499 },
    productId: process.env.POLAR_PRODUCT_PACK_PRO || "adcadbdf-662d-4e3b-b53e-d3ae586225e8",
    packageId: "polar_pack_pro",
    checkoutUrl:
      process.env.POLAR_CHECKOUT_URL_PACK_PRO ||
      "https://buy.polar.sh/polar_cl_ay9kL24efjStvQzBnMy574uaOcnUbqjg7zyGw2M28th",
    name: "Stratejik Kaşif (3000 Kredi)",
  },
];

export const isPolarProductAvailable = (p: PolarProduct) =>
  process.env.BILLING_ENABLED !== "false" && !!p.productId && p.amount !== null;

