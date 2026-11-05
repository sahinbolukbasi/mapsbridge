import { Animated, Easing, LayoutAnimation, type LayoutAnimationConfig } from "react-native";
import { tokens } from "../theme";
import { isReducedMotion } from "./useReducedMotion";

// Animasyon yardımcıları (design §7.3, §8.2, §8.4, R6). Tüm Animated zamanlamaları buradan
// geçer (Animated.timing/spring/loop bu dosya dışında yazılmaz; mobile-design-system testi):
// sistemde "Hareketi azalt" açıkken süre 0'a iner, yaylar anında oturur, sonsuz döngüler hiç
// başlamaz. Süre, easing ve yay değerleri token'lardan (tokens.motion) gelir.

export type EasingName = keyof typeof tokens.motion.easing;
export type SpringPreset = keyof typeof tokens.motion.spring;
type EasingFn = (value: number) => number;

type TimingConfig = Omit<Animated.TimingAnimationConfig, "toValue" | "duration" | "easing"> & {
  duration?: number;
  /** Token easing adı ("enter", "exit" …) ya da hazır bir easing fonksiyonu. */
  easing?: EasingName | EasingFn;
  useNativeDriver: boolean;
};

const NOOP: Animated.CompositeAnimation = {
  start: (cb) => cb?.({ finished: true }),
  stop: () => undefined,
  reset: () => undefined,
};

/** tokens.motion.easing'teki cubic-bezier eğrisi (web `var(--easing-*)` ile aynı). */
export function easing(name: EasingName): EasingFn {
  const [x1, y1, x2, y2] = tokens.motion.easing[name];
  return Easing.bezier(x1, y1, x2, y2);
}

/** Tek değer animasyonu; reduce-motion açıkken süre 0. */
export function animate(
  value: Animated.Value,
  toValue: number,
  config: TimingConfig,
): Animated.CompositeAnimation {
  const duration = isReducedMotion() ? 0 : (config.duration ?? tokens.motion.duration.base);
  const curve = typeof config.easing === "string" ? easing(config.easing) : config.easing;
  return Animated.timing(value, { ...config, easing: curve, toValue, duration });
}

/**
 * Yay animasyonu (sheet snap'i, buton basma). Değerler tokens.motion.spring[preset]'ten;
 * reduce-motion açıkken süre 0'lık timing ile hedefe anında oturur.
 */
export function spring(
  value: Animated.Value,
  toValue: number,
  preset: SpringPreset,
  useNativeDriver: boolean,
): Animated.CompositeAnimation {
  if (isReducedMotion()) return Animated.timing(value, { toValue, duration: 0, useNativeDriver });
  const { stiffness, damping, mass } = tokens.motion.spring[preset];
  return Animated.spring(value, { toValue, stiffness, damping, mass, useNativeDriver });
}

/** Bekleme; reduce-motion açıkken 0. */
export function delay(ms: number): Animated.CompositeAnimation {
  return Animated.delay(isReducedMotion() ? 0 : ms);
}

export function sequence(steps: Animated.CompositeAnimation[]): Animated.CompositeAnimation {
  return Animated.sequence(steps);
}

export function parallel(steps: Animated.CompositeAnimation[]): Animated.CompositeAnimation {
  return Animated.parallel(steps);
}

/** Sonsuz döngü (nabız, yükleniyor noktaları); reduce-motion açıkken hiç oynatılmaz. */
export function loop(animation: Animated.CompositeAnimation): Animated.CompositeAnimation {
  return isReducedMotion() ? NOOP : Animated.loop(animation);
}

/** LayoutAnimation.configureNext; reduce-motion açıkken atlanır. */
export function layoutNext(config: LayoutAnimationConfig): void {
  if (!isReducedMotion()) LayoutAnimation.configureNext(config);
}
