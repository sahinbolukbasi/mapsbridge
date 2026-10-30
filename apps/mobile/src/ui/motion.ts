import { Animated, LayoutAnimation, type LayoutAnimationConfig } from "react-native";
import { tokens } from "../theme";
import { isReducedMotion } from "./useReducedMotion";

// Animasyon yardımcıları (design §7.3). Tüm Animated zamanlamaları buradan geçer: sistemde
// "Hareketi azalt" açıkken süre 0'a iner, sonsuz döngüler hiç başlamaz.

type TimingConfig = Omit<Animated.TimingAnimationConfig, "toValue" | "duration"> & {
  duration?: number;
  useNativeDriver: boolean;
};

const NOOP: Animated.CompositeAnimation = {
  start: (cb) => cb?.({ finished: true }),
  stop: () => undefined,
  reset: () => undefined,
};

/** Tek değer animasyonu; reduce-motion açıkken süre 0. */
export function animate(
  value: Animated.Value,
  toValue: number,
  config: TimingConfig,
): Animated.CompositeAnimation {
  const duration = isReducedMotion() ? 0 : (config.duration ?? tokens.motion.duration.base);
  return Animated.timing(value, { ...config, toValue, duration });
}

/** Bekleme; reduce-motion açıkken 0. */
export function delay(ms: number): Animated.CompositeAnimation {
  return Animated.delay(isReducedMotion() ? 0 : ms);
}

export function sequence(steps: Animated.CompositeAnimation[]): Animated.CompositeAnimation {
  return Animated.sequence(steps);
}

/** Sonsuz döngü (nabız, yükleniyor noktaları); reduce-motion açıkken hiç oynatılmaz. */
export function loop(animation: Animated.CompositeAnimation): Animated.CompositeAnimation {
  return isReducedMotion() ? NOOP : Animated.loop(animation);
}

/** LayoutAnimation.configureNext; reduce-motion açıkken atlanır. */
export function layoutNext(config: LayoutAnimationConfig): void {
  if (!isReducedMotion()) LayoutAnimation.configureNext(config);
}
