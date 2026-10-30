import React from "react";
import {
  StyleSheet,
  TouchableOpacity,
  type Insets,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { tokens } from "../theme";

// Yalnız ikonlu düğme (design §7.3). Etiket zorunlu (ekran okuyucu adı). Dokunma hedefi
// en az tokens.touch.min (44pt): görsel boyut küçükse eksik kısım hitSlop ile tamamlanır.
export interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  /** Görsel kare boyutu (varsayılan 44). */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function hitSlopFor(size: number): Insets | undefined {
  const gap = Math.max(0, Math.ceil((tokens.touch.min - size) / 2));
  return gap > 0 ? { top: gap, bottom: gap, left: gap, right: gap } : undefined;
}

export function IconButton({
  icon,
  label,
  onPress,
  selected,
  disabled,
  size = tokens.touch.min,
  style,
}: IconButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: selected ?? undefined }}
      hitSlop={hitSlopFor(size)}
      activeOpacity={0.7}
      style={[styles.base, { width: size, height: size, borderRadius: size / 2 }, style]}
    >
      {icon}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
});
