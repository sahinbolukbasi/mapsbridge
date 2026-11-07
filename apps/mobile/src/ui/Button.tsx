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
import { fontFamily, tokens, withAlpha } from "../theme";
import { formatCreditCost, type CreditCost } from "../billing/credit-costs";
import { CostBadge } from "./CostBadge";
import { hitSlopFor } from "./IconButton";
import { usePressScale } from "./usePressScale";

// Metinli düğme (design §4.1, §7.3). Pressable + basma yayı (spring.press, scale .97) + Android
// ripple. minHeight tokens.touch.min; `sm` (36) için hitSlop ile 44pt. `cost` verilirse sağda
// CostBadge çizilir ve erişilebilir ad "Etiket, 1 kredi" olur (web Button `cost` ile aynı).
// loading ≠ disabled (direction §3): yüklenirken spinner + görünür etiket (`loadingLabel`, ör.
// "Kaydediliyor…"); devre dışıyken `disabledReason` düğmenin altında görünür ve ipucu olur.
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
  /** Ek açıklama; ekran okuyucu ipucu. */
  hint?: string;
  /** Yüklenirken görünen etiket (varsayılan `label`). */
  loadingLabel?: string;
  /** Devre dışı nedeni: düğmenin altında görünür metin + ekran okuyucu ipucu. */
  disabledReason?: string;
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
const RIPPLE: Record<ButtonVariant, string> = {
  primary: withAlpha(c.buttonPrimaryFg, 0.2),
  brand: withAlpha(c.buttonBrandFg, 0.2),
  secondary: withAlpha(c.buttonSecondaryFg, 0.12),
  ghost: withAlpha(c.buttonGhostFg, 0.12),
  danger: withAlpha(c.buttonDangerFg, 0.2),
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
  loadingLabel,
  disabledReason,
  style,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const height = HEIGHTS[size];
  const inactive = disabled || loading;
  const press = usePressScale();
  const shown = loading && loadingLabel ? loadingLabel : label;
  const name = cost === undefined ? shown : `${shown}, ${formatCreditCost(cost)}`;
  const reason = disabled && !loading ? disabledReason : undefined;
  const button = (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityHint={reason ?? hint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={size === "sm" ? hitSlopFor(height) : undefined}
      android_ripple={{ color: RIPPLE[variant], foreground: true }}
      style={reason ? undefined : style}
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
          <View style={styles.row}>
            {loading ? <ActivityIndicator size="small" color={v.fg} /> : icon}
            <Text
              style={[styles.label, { color: v.fg, fontFamily: fontFamily("bold") }]}
              maxFontSizeMultiplier={tokens.font.maxScale.compact}
            >
              {shown}
            </Text>
            {cost !== undefined && !loading ? <CostBadge cost={cost} /> : null}
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
  if (!reason) return button;
  return (
    <View style={[styles.withReason, style]}>
      {button}
      <Text
        style={styles.reason}
        maxFontSizeMultiplier={tokens.font.maxScale.body}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        {reason}
      </Text>
    </View>
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
  withReason: { gap: tokens.space["1"] },
  reason: { fontSize: tokens.font.size.sm, color: tokens.color.textMuted },
});
