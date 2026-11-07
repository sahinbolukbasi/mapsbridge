import { useRef } from "react";
import { Animated } from "react-native";
import { spring } from "./motion";

// Buton basma deseni (direction §2 "Basma", web .97): pressIn'de scale .97, bırakınca 1; yay
// değerleri tokens.motion.spring.press. Reduce-motion açıkken motion.spring anında oturur.
// Çip/ikon düğmesi daha belirgin basılır: usePressScale(CHIP_PRESSED_SCALE) (.94).
export const PRESSED_SCALE = 0.97;
export const CHIP_PRESSED_SCALE = 0.94;

export function usePressScale(pressed: number = PRESSED_SCALE) {
  const scale = useRef(new Animated.Value(1)).current;
  return {
    scale,
    onPressIn: () => spring(scale, pressed, "press", true).start(),
    onPressOut: () => spring(scale, 1, "press", true).start(),
  };
}
