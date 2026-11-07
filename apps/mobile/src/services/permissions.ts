import { Linking } from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { storage } from "./storage";
// Bağlamsal izinler (N1, direction §7): izin tanıtımın sonunda değil, ilgili özellik ilk
// kullanıldığında istenir — konum "Yakınımda"da, bildirim ilk rota kaydında. Önce kendi gerekçe
// ekranımız (PermissionPrompt), sonra sistem penceresi; "Şimdi değil" her zaman var. Gerekçe bir
// kez gösterilir (`mb_perm_explained_<tür>`); sonra yalnız sistem durumu okunur. Arka plan konumu
// istenmez (yalnız uygulama açıkken).
export type PermissionKind = "location" | "notifications";
export type PermissionState = "granted" | "denied" | "undetermined";
const explainedKey = (kind: PermissionKind) => `mb_perm_explained_${kind}`;
export async function wasExplained(kind: PermissionKind): Promise<boolean> {
  return (await storage.getItem(explainedKey(kind)).catch(() => null)) === "true";
}
export async function markExplained(kind: PermissionKind): Promise<void> {
  await storage.setItem(explainedKey(kind), "true").catch(() => undefined);
}
function toState(r: { granted: boolean; canAskAgain?: boolean; status?: string }): PermissionState {
  if (r.granted) return "granted";
  return r.status === "undetermined" || r.canAskAgain ? "undetermined" : "denied";
}
export async function permissionState(kind: PermissionKind): Promise<PermissionState> {
  try {
    return toState(
      kind === "location"
        ? await Location.getForegroundPermissionsAsync()
        : await Notifications.getPermissionsAsync(),
    );
  } catch {
    return "denied";
  }
}
/** Sistem penceresini açar; verildiyse true. */
export async function requestPermission(kind: PermissionKind): Promise<boolean> {
  try {
    const r =
      kind === "location"
        ? await Location.requestForegroundPermissionsAsync()
        : await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowBadge: false, allowSound: true },
          });
    return r.granted;
  } catch {
    return false;
  }
}
export function openSystemSettings(): void {
  Linking.openSettings().catch(() => undefined);
}
