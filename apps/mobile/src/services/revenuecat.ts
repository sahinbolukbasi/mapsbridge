import Purchases, {
  type PurchasesOffering,
  type CustomerInfo,
  LOG_LEVEL,
} from "react-native-purchases";
import { Platform } from "react-native";

const RC_API_KEY_IOS = process.env.EXPO_PUBLIC_RC_API_KEY_IOS ?? "";
const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID ?? "";

export type EntitlementId = "explorer" | "pro" | "agency";

export async function initRevenueCat(userId: string) {
  const apiKey = Platform.OS === "ios" ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
  if (!apiKey) return;
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  await Purchases.configure({ apiKey, appUserID: userId });
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
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export function getActiveEntitlement(
  info: CustomerInfo,
): EntitlementId | "free" {
  const tiers: EntitlementId[] = ["agency", "pro", "explorer"];
  for (const tier of tiers) {
    const ent = info.entitlements.active[tier];
    if (ent) return tier;
  }
  return "free";
}

export async function purchasePackage(pkg: {
  identifier: string;
  offeringIdentifier: string;
}): Promise<{ success: boolean; customerInfo?: CustomerInfo; error?: string }> {
  try {
    const offerings = await Purchases.getOfferings();
    const offering = offerings.current;
    if (!offering) return { success: false, error: "Paketler yüklenemedi." };
    const rcPackage = offering.availablePackages.find(
      (p) => p.identifier === pkg.identifier,
    );
    if (!rcPackage) return { success: false, error: "Paket bulunamadı." };
    const { customerInfo } = await Purchases.purchasePackage(rcPackage);
    return { success: true, customerInfo };
  } catch (err: any) {
    if (err?.userCancelled) return { success: false, error: "İptal edildi." };
    return { success: false, error: err?.message || "Satın alma başarısız." };
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.restorePurchases();
  } catch {
    return null;
  }
}
