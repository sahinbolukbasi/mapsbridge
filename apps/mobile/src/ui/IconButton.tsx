import React from "react";
import { Pressable, StyleSheet, type Insets, type StyleProp, type ViewStyle } from "react-native";
import { tokens } from "../theme";
import { Icon, type IconName } from "./Icon";

// Yalnız ikonlu düğme (design §7.3). Etiket zorunlu (ekran okuyucu adı). Dokunma hedefi
// en az tokens.touch.min (44pt): görsel boyut küçükse eksik kısım hitSlop ile tamamlanır.
// `icon` bir ikon adı (Icon primitive'i, web IconButton ile aynı sözlük) ya da hazır düğümdür.
export interface IconButtonProps {
  icon: IconName | React.ReactNode;
  label: string;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  /** Görsel kare boyutu (varsayılan 44). */
  size?: number;
  /** `icon` bir ad olduğunda çizgi rengi. */
  color?: string;
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
  color,
  style,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: selected ?? undefined }}
      hitSlop={hitSlopFor(size)}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        style,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      {typeof icon === "string" ? (
        <Icon name={icon as IconName} size={size >= 40 ? 20 : 16} color={color} />
      ) : (
        icon
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
