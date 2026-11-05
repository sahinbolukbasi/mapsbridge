import React from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { fontFamily, tokens } from "../theme";
import { formatCreditCost, type CreditCost } from "../billing/credit-costs";
import { CostBadge } from "./CostBadge";
import { hitSlopFor } from "./IconButton";
import { usePressScale } from "./usePressScale";

// Metinli düğme (design §4.1, §7.3). Pressable + basma yayı (spring.press, scale .98).
// minHeight tokens.touch.min; `sm` (36) için hitSlop ile 44pt. `cost` verilirse sağda CostBadge
// çizilir ve erişilebilir ad "Etiket, 1 kredi" olur (web Button `cost` ile aynı; yalnızca gösterim).
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
  cost?: CreditCost;
  /** Ek açıklama (ör. devre dışı nedeni); ekran okuyucu ipucu. */
  hint?: string;
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
  cost,
  hint,
  style,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const height = HEIGHTS[size];
  const inactive = disabled || loading;
  const press = usePressScale();
  const name = cost === undefined ? label : `${label}, ${formatCreditCost(cost)}`;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityHint={hint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={size === "sm" ? hitSlopFor(height) : undefined}
      style={style}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.base,
            {
              minHeight: size === "sm" ? height : Math.max(height, tokens.touch.min),
              backgroundColor: v.bg,
              borderColor: v.border ?? "transparent",
              opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
              transform: [{ scale: press.scale }],
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={v.fg} />
          ) : (
            <View style={styles.row}>
              {icon}
              <Text
                style={[styles.label, { color: v.fg, fontFamily: fontFamily("bold") }]}
                maxFontSizeMultiplier={tokens.font.maxScale.compact}
              >
                {label}
              </Text>
              {cost !== undefined ? <CostBadge cost={cost} /> : null}
            </View>
          )}
        </Animated.View>
      )}
    </Pressable>
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
