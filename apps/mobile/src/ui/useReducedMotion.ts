import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// Sistem "Hareketi azalt" ayarı (design §7.3). Değer modül düzeyinde de tutulur; böylece
// hook dışındaki animasyon yardımcıları (motion.ts) aynı değeri okur.
let reducedMotion = false;
let initialized = false;
const listeners = new Set<(value: boolean) => void>();

function set(value: boolean) {
  if (reducedMotion === value) return;
  reducedMotion = value;
  for (const l of listeners) l(value);
}

function ensureSubscribed() {
  if (initialized) return;
  initialized = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then(set)
    .catch(() => undefined);
  AccessibilityInfo.addEventListener("reduceMotionChanged", set);
}

/** Hook dışı okuma (son bilinen değer). */
export function isReducedMotion(): boolean {
  ensureSubscribed();
  return reducedMotion;
}

export function useReducedMotion(): boolean {
  ensureSubscribed();
  const [value, setValue] = useState(reducedMotion);
  useEffect(() => {
    listeners.add(setValue);
    setValue(reducedMotion);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
