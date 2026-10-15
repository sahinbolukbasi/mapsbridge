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
