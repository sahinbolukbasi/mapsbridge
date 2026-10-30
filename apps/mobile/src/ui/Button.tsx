import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { tokens } from "../theme";
import { hitSlopFor } from "./IconButton";

// Metinli düğme (design §7.3). minHeight tokens.touch.min; `sm` (36) için hitSlop ile 44pt.
export type ButtonVariant = "primary" | "brand" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const c = tokens.color;
const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: c.buttonPrimaryBg, fg: c.buttonPrimaryFg },
  brand: { bg: c.buttonBrandBg, fg: c.buttonBrandFg },
  secondary: { bg: c.buttonSecondaryBg, fg: c.buttonSecondaryFg, border: c.buttonSecondaryBorder },
  ghost: { bg: "transparent", fg: c.buttonGhostFg },
  danger: { bg: c.buttonDangerBg, fg: c.buttonDangerFg },
};
const HEIGHTS: Record<ButtonSize, number> = {
  sm: tokens.control.heightSm,
  md: tokens.control.height,
  lg: tokens.control.heightLg,
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  style,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const height = HEIGHTS[size];
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={size === "sm" ? hitSlopFor(height) : undefined}
      activeOpacity={0.8}
      style={[
        styles.base,
        {
          minHeight: size === "sm" ? height : Math.max(height, tokens.touch.min),
          backgroundColor: v.bg,
          borderColor: v.border ?? "transparent",
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text
            style={[styles.label, { color: v.fg }]}
            maxFontSizeMultiplier={tokens.font.maxScale.compact}
          >
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    paddingHorizontal: tokens.space["4"],
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: tokens.space["2"] },
  label: { fontSize: tokens.font.size.md, fontWeight: tokens.font.weight.bold },
});
