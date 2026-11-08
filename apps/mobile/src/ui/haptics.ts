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
// Açılış öz-denetimi (native-selfcheck.ts) için: R16 gereği expo-haptics YALNIZ bu dosyadan import
// edilir, bu yüzden kullanılan yöntemlerin callable olup olmadığını buradan bildiririz. "modül.yöntem"
// biçiminde eksik/yanlış tipli üyeleri döndürür (hepsi mevcutsa boş dizi).
export function hapticsSelfCheck(): string[] {
  const missing: string[] = [];
  for (const name of ["selectionAsync", "notificationAsync", "impactAsync"] as const) {
    if (typeof (Haptics as Record<string, unknown>)[name] !== "function") {
      missing.push(`expo-haptics.${name}`);
    }
  }
  return missing;
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
