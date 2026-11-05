import { useRef } from "react";
import { Animated } from "react-native";
import { spring } from "./motion";

// Buton basma deseni (design §8.2 "Buton basma"): pressIn'de scale .98, bırakınca 1; yay değerleri
// tokens.motion.spring.press. Reduce-motion açıkken motion.spring anında oturur.
export const PRESSED_SCALE = 0.98;

export function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  return {
    scale,
    onPressIn: () => spring(scale, PRESSED_SCALE, "press", true).start(),
    onPressOut: () => spring(scale, 1, "press", true).start(),
  };
}
