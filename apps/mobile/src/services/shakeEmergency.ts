import { Linking, NativeModules, PermissionsAndroid, Platform } from "react-native";
import { Accelerometer } from "expo-sensors";
import { storage } from "./storage";

export const SHAKE_EMERGENCY_KEY = "mapsbridge.settings.shake_emergency";
export const LOCATION_SHARING_KEY = "mapsbridge.settings.location_sharing";

type ShakeListener = () => void;

/**
 * Süre bittiğinde ek onay veya arama tuşuna basılmasını beklemeden
 * doğrudan telefon aramasını başlatır (Native DirectCall / Android CALL_PHONE intent / iOS telprompt).
 */
export async function placeDirectEmergencyCall(phoneNumber = "112"): Promise<void> {
  const cleanNumber = phoneNumber.replace(/[^0-9+]/g, "") || "112";
  try {
    const nativeDirect =
      NativeModules?.RNImmediatePhoneCall ??
      NativeModules?.DirectCallModule ??
      NativeModules?.ImmediatePhoneCall;
    if (nativeDirect && typeof nativeDirect.immediatePhoneCall === "function") {
      nativeDirect.immediatePhoneCall(cleanNumber);
      return;
    }
    if (nativeDirect && typeof nativeDirect.call === "function") {
      nativeDirect.call(cleanNumber);
      return;
    }

    if (Platform.OS === "android") {
      try {
        const callPerm = PermissionsAndroid.PERMISSIONS.CALL_PHONE;
        if (callPerm) {
          const hasPerm = await PermissionsAndroid.check(callPerm);
          if (!hasPerm) {
            await PermissionsAndroid.request(callPerm);
          }
        }
      } catch {
        // İzin kontrolü başarısız olsa bile doğrudan aramayı dene
      }
      if (typeof Linking.sendIntent === "function") {
        try {
          await Linking.sendIntent("android.intent.action.CALL", [
            { key: "android.intent.extra.PHONE_NUMBER", value: cleanNumber },
          ]);
          return;
        } catch {
          // sendIntent desteklenmiyorsa tel: şemasına düş
        }
      }
    }

    const candidates =
      Platform.OS === "ios"
        ? [`tel://${cleanNumber}`, `telprompt:${cleanNumber}`, `tel:${cleanNumber}`]
        : [`tel:${cleanNumber}`];

    for (const url of candidates) {
      try {
        await Linking.openURL(url);
        return;
      } catch {
        // Sıradaki URI şemasını dene
      }
    }
  } catch {
    // Sessiz yedek: uygulama içi canlı acil çağrı ekranı her durumda devreye girer
  }
}

class ShakeDetector {
  private subscription: { remove: () => void } | null = null;
  private listeners = new Set<ShakeListener>();
  private lastShakeTime = 0;
  private enabled = true;

  public async init() {
    try {
      const stored = await storage.getItem(SHAKE_EMERGENCY_KEY);
      // Varsayılan olarak açık (kullanıcı açıkça "false" yapmadıysa aktif)
      this.enabled = stored !== "false";
      if (this.enabled) {
        this.start();
      }
    } catch {
      this.enabled = true;
      this.start();
    }
  }

  public setEnabled(enable: boolean) {
    this.enabled = enable;
    storage.setItem(SHAKE_EMERGENCY_KEY, enable ? "true" : "false").catch(() => {});
    if (enable) {
      this.start();
    } else {
      this.stop();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public subscribe(listener: ShakeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public triggerNow() {
    this.notify();
  }

  private start() {
    if (this.subscription) return;
    try {
      Accelerometer.setUpdateInterval(120);
      this.subscription = Accelerometer.addListener((data) => {
        const { x, y, z } = data;
        const totalAcceleration = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();

        // Vigorous shake (> 2.35g with 3s cooldown)
        if (totalAcceleration > 2.35 && now - this.lastShakeTime > 3000) {
          this.lastShakeTime = now;
          this.notify();
        }
      });
    } catch (e) {
      console.warn("[ShakeDetector] Accelerometer unavailable:", e);
    }
  }

  private stop() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const shakeDetector = new ShakeDetector();
