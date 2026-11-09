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

export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch {
    return null;
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
