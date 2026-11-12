import { Accelerometer } from "expo-sensors";
import { storage } from "./storage";

export const SHAKE_EMERGENCY_KEY = "mapsbridge.settings.shake_emergency";
export const LOCATION_SHARING_KEY = "mapsbridge.settings.location_sharing";

type ShakeListener = () => void;

class ShakeDetector {
  private subscription: { remove: () => void } | null = null;
  private listeners = new Set<ShakeListener>();
  private lastShakeTime = 0;
  private enabled = false;

  public async init() {
    try {
      const stored = await storage.getItem(SHAKE_EMERGENCY_KEY);
      this.enabled = stored === "true";
      if (this.enabled) {
        this.start();
      }
    } catch {
      this.enabled = false;
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

  private start() {
    if (this.subscription) return;
    try {
      Accelerometer.setUpdateInterval(150);
      this.subscription = Accelerometer.addListener((data) => {
        const { x, y, z } = data;
        const totalAcceleration = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();

        // Detect vigorous shake (acceleration > 2.6g with 3s cooldown)
        if (totalAcceleration > 2.6 && now - this.lastShakeTime > 3000) {
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

