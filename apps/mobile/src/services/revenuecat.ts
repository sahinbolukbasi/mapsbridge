import Purchases, {
  type PurchasesOffering,
  type PurchasesPackage,
  type CustomerInfo,
  LOG_LEVEL,
} from "react-native-purchases";
import { Platform } from "react-native";

const RC_API_KEY_IOS = process.env.EXPO_PUBLIC_RC_API_KEY_IOS ?? "";
const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID ?? "";

export const ENTITLEMENT_ID = "mapsbridge_pro";

export type PlanTier = "pro" | "free";

// Cached customer info — refreshed on init and after purchases
let _cachedCustomerInfo: CustomerInfo | null = null;

export async function initRevenueCat(userId: string): Promise<void> {
  const apiKey = Platform.OS === "ios" ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
  if (!apiKey) return;
  // Native pod bağlı değilse (ör. eski TestFlight binary) Purchases üyeleri undefined olabilir ve
  // çağrılınca "object is not a function" atar. Tüm SDK dokunuşları try/catch ile sarılır; init
  // sessizce no-op olur ve uygulama açılışı asla çökmez (mobile-crash2).
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    _cachedCustomerInfo = null;
    // Aynı çalıştırmada çıkıp yeniden girişte SDK zaten yapılandırılmıştır: kimlik logIn ile değişir.
    if (await Purchases.isConfigured().catch(() => false)) {
      await Purchases.logIn(userId);
    } else {
      await Purchases.configure({ apiKey, appUserID: userId });
    }
    // Warm up cache
    _cachedCustomerInfo = await Purchases.getCustomerInfo();
  } catch {
    // Native eksik/çağrı başarısız: Pro özellikleri kapalı kalır, açılış sürer.
    _cachedCustomerInfo = null;
  }
}

/**
 * Çıkışta çağrılır (FEAT-011 review #2): önbellekteki yetki silinir ve SDK kimliği bırakılır;
 * misafir önceki hesabın Pro durumunu görmez, satın alma o hesaba yazılmaz.
 */
export async function resetRevenueCat(): Promise<void> {
  _cachedCustomerInfo = null;
  try {
    if (await Purchases.isConfigured()) await Purchases.logOut();
  } catch {
    // Anonim kullanıcıda logOut hata verir; önbellek yine de temizlendi.
  }
}

function buildPolarFallbackPackage(
  identifier: string,
  productId: string,
  title: string,
  description: string,
  price: number,
  priceString: string,
  isSubscription: boolean,
): PurchasesPackage {
  return {
    identifier,
    packageType: (isSubscription && identifier === "$rc_monthly" ? "MONTHLY" : "CUSTOM") as PurchasesPackage["packageType"],
    offeringIdentifier: "polar_live",
    presentedOfferingContext: {
      offeringIdentifier: "polar_live",
      placementIdentifier: null,
      targetingContext: null,
    },
    product: {
      identifier: productId,
      description,
      title,
      price,
      priceString,
      pricePerWeek: null,
      pricePerMonth: isSubscription ? price : null,
      pricePerYear: null,
      pricePerWeekString: null,
      pricePerMonthString: isSubscription ? priceString : null,
      pricePerYearString: null,
      currencyCode: "TRY",
      introPrice: null,
      discounts: null,
      productCategory: null,
      productType: (isSubscription ? "AUTO_RENEWABLE_SUBSCRIPTION" : "NON_CONSUMABLE") as PurchasesPackage["product"]["productType"],
      subscriptionPeriod: isSubscription ? "P1M" : null,
      defaultOption: null,
      subscriptionOptions: null,
      presentedOfferingIdentifier: "polar_live",
      presentedOfferingContext: {
        offeringIdentifier: "polar_live",
        placementIdentifier: null,
        targetingContext: null,
      },
    } as unknown as PurchasesPackage["product"],
  } as unknown as PurchasesPackage;
}

const POLAR_FALLBACK_PACKAGES: PurchasesPackage[] = [
  buildPolarFallbackPackage(
    "polar_explorer",
    "a3443dcc-7050-4705-82c3-f986b0ef94ea",
    "Kaşif (Explorer)",
    "Kaşif (Explorer) — 100 Kredi / Ay",
    199,
    "₺199 / $6.99",
    true,
  ),
  buildPolarFallbackPackage(
    "$rc_monthly",
    "bc53edf5-476c-4f5f-805a-3b2c1e8e8739",
    "Pro Kaşif (Pro Traveler)",
    "Pro Kaşif (Pro Traveler) — 500 Kredi / Ay",
    499,
    "₺499 / $14.99",
    true,
  ),
  buildPolarFallbackPackage(
    "polar_agency",
    "62d9b9e3-9ddb-49db-b1d6-67d50f76c2b6",
    "Tur Lideri & Grup Paketi",
    "Tur Lideri & Grup Paketi — 2500 Kredi / Ay",
    1499,
    "₺1.499 / $49.99",
    true,
  ),
  buildPolarFallbackPackage(
    "polar_pack_30",
    "cd802b74-05b9-4234-b08b-21a1152ec8d6",
    "Başlangıç Paketi (30 Kredi)",
    "Başlangıç Kredi Paketi (30 Kredi)",
    99,
    "₺99 / $2.99",
    false,
  ),
  buildPolarFallbackPackage(
    "polar_pack_100",
    "31f3e0d0-8d81-4a3b-83f1-56bcbb5cde40",
    "Gezgin Paketi (100 Kredi)",
    "Gezgin Kredi Paketi (100 Kredi)",
    249,
    "₺249 / $7.99",
    false,
  ),
  buildPolarFallbackPackage(
    "polar_pack_300",
    "86fadb96-c068-4b69-b23a-0ed871d57718",
    "Usta Kaşif Paketi (300 Kredi)",
    "Usta Kaşif Paketi (300 Kredi)",
    599,
    "₺599 / $18.99",
    false,
  ),
  buildPolarFallbackPackage(
    "polar_pack_pro",
    "adcadbdf-662d-4e3b-b53e-d3ae586225e8",
    "Stratejik Kaşif (3000 Kredi)",
    "Stratejik Kaşif (3000 Kredi)",
    1899,
    "₺1.899 / $59.99",
    false,
  ),
];

const POLAR_FALLBACK_OFFERING: PurchasesOffering = {
  identifier: "polar_live",
  serverDescription: "Maps Bridge Polar Multi-Market Catalog",
  metadata: {},
  availablePackages: POLAR_FALLBACK_PACKAGES,
  lifetime: null,
  annual: null,
  sixMonth: null,
  threeMonth: null,
  twoMonth: null,
  monthly: POLAR_FALLBACK_PACKAGES[1] ?? null,
  weekly: null,
  webCheckoutUrl: "https://buy.polar.sh/polar_cl_TitGKcwxcS7AtB2jTsmHW99kQc7sudzdd5gXP0rAve0",
} as unknown as PurchasesOffering;

export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current && offerings.current.availablePackages.length > 0) {
      return offerings.current;
    }
    return POLAR_FALLBACK_OFFERING;
  } catch {
    return POLAR_FALLBACK_OFFERING;
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    _cachedCustomerInfo = await Purchases.getCustomerInfo();
    return _cachedCustomerInfo;
  } catch {
    return _cachedCustomerInfo;
  }
}

/**
 * Returns true if the user has an active mapsbridge_pro entitlement.
 * Uses cached value for fast synchronous-like calls — refresh with getCustomerInfo().
 */
export async function isPro(): Promise<boolean> {
  const info = await getCustomerInfo();
  if (!info) return false;
  return !!info.entitlements.active[ENTITLEMENT_ID];
}

/** Fast cached read — does NOT make a network call. */
export function isProSync(): boolean {
  if (!_cachedCustomerInfo) return false;
  return !!_cachedCustomerInfo.entitlements.active[ENTITLEMENT_ID];
}

export function getActiveTier(info: CustomerInfo): PlanTier {
  if (info.entitlements.active[ENTITLEMENT_ID]) return "pro";
  return "free";
}

export async function purchasePackage(
  pkg: PurchasesPackage,
  placement?: string,
): Promise<{ success: boolean; customerInfo?: CustomerInfo; error?: string }> {
  try {
    // Dönüşüm ölçümü: paywall yerleşimini RevenueCat subscriber attribute'una yaz.
    // Webhook payload'ında ve dashboard'da yerleşim bazlı dönüşüm görünür olur.
    if (placement) {
      // attribute yazımı satın almayı asla engellemez; hatayı yut
      await Purchases.setAttributes({ paywall_placement: placement }).catch(() => {});
    }
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    _cachedCustomerInfo = customerInfo;
    return { success: true, customerInfo };
  } catch (err: unknown) {
    const rcErr = err as { userCancelled?: boolean; message?: string } | null;
    if (rcErr?.userCancelled) return { success: false, error: "cancelled" };
    return { success: false, error: rcErr?.message || "Satın alma başarısız." };
  }
}

export async function restorePurchases(): Promise<{
  success: boolean;
  isPro: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    _cachedCustomerInfo = customerInfo;
    const pro = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
    return { success: true, isPro: pro, customerInfo };
  } catch (err: unknown) {
    return {
      success: false,
      isPro: false,
      error: err instanceof Error ? err.message : "Geri yükleme başarısız.",
    };
  }
}
