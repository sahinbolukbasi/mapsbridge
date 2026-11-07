import * as LocalAuthentication from "expo-local-authentication";
import { storage } from "./storage";
import { tr } from "../i18n/ui";
// Biyometrik uygulama kilidi (K4, isteğe bağlı; Profil → Ayarlar). Varsayılan KAPALI. Açıkken
// uygulama soğuk açılışta ve arka planda GRACE_MS'ten uzun kaldıktan sonra kilitlenir. Kimlik
// doğrulaması cihazda yapılır (Face ID / parmak izi / cihaz kodu); hiçbir biyometrik veri
// uygulamaya ya da sunucuya ulaşmaz.
const KEY = "mb_biometric_lock";
export { GRACE_MS, shouldLock } from "./lock-logic";
export async function biometricAvailable(): Promise<boolean> {
  try {
    return (
      (await LocalAuthentication.hasHardwareAsync()) &&
      (await LocalAuthentication.isEnrolledAsync())
    );
  } catch {
    return false;
  }
}
export async function lockEnabled(): Promise<boolean> {
  return (await storage.getItem(KEY).catch(() => null)) === "true";
}
export async function setLockEnabled(value: boolean): Promise<void> {
  await storage.setItem(KEY, value ? "true" : "false").catch(() => undefined);
}
export async function authenticate(): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: tr("native.lock.prompt"),
      cancelLabel: tr("ui.cancel"),
      disableDeviceFallback: false,
    });
    return r.success;
  } catch {
    return false;
  }
}
