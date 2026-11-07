import * as Haptics from "expo-haptics";
import { isReducedMotion } from "./useReducedMotion";
// Haptik geri bildirim (design-system.md R6 ek / approval ruleChanges g). expo-haptics YALNIZ bu
// dosyadan çağrılır (mobile-design-system testi). Sistem "Hareketi azalt" açıkken ve uygulama
// içi ayar kapalıyken titreşim yok; iOS sistem titreşim ayarını (Ses ve Dokunuş) zaten uygular.
// Haptik hiçbir zaman tek bilgi taşıyıcı değildir: her durum ekranda da görünür.
export type HapticKind = "selection" | "success" | "warning" | "error" | "impact";
let enabled = true;
/** Uygulama içi ayar (Profil → Ayarlar). Varsayılan açık; kalıcılığı çağıran sağlar. */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}
/** Ayarın cihazdaki anahtarı (App açılışta okur, Profil yazar). */
export const HAPTICS_KEY = "mb_haptics_enabled";
export function hapticsEnabled(): boolean {
  return enabled && !isReducedMotion();
}
/** Tek atımlık haptik; desteklenmeyen cihazda ya da hata olursa sessizce yok sayılır. */
export function haptic(kind: HapticKind): void {
  if (!hapticsEnabled()) return;
  let run: Promise<void>;
  switch (kind) {
    case "selection":
      run = Haptics.selectionAsync();
      break;
    case "success":
      run = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case "warning":
      run = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;
    case "error":
      run = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      break;
    default:
      run = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  run.catch(() => undefined);
}
