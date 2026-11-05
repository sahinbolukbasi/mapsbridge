import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { tokens } from "../theme";

// Kart yüzeyi (design §4.1, §7.3). B varsayılanı kenarlıklı ve gölgesiz; `raised` gölge,
// `inverse` koyu zemin. onPress verilirse düğme rolü alır (min 44pt).
export type CardVariant = "bordered" | "raised" | "inverse";

export interface CardProps {
  onPress?: () => void;
  /** Erişilebilir ad (onPress varsa önerilir). */
  label?: string;
  variant?: CardVariant;
  padding?: keyof typeof tokens.space;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function Card({
  onPress,
  label,
  variant = "bordered",
  padding = "4",
  style,
  children,
}: CardProps) {
  const s = [styles.card, VARIANT[variant], { padding: tokens.space[padding] }, style];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s, { minHeight: tokens.touch.min }, pressed ? styles.pressed : null]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.cardBg,
    borderColor: tokens.color.cardBorder,
    borderWidth: 1,
    borderRadius: tokens.radius.lg,
  },
  pressed: { opacity: 0.85 },
});

const VARIANT: Record<CardVariant, ViewStyle> = {
  bordered: {},
  raised: { ...tokens.shadow.sm },
  inverse: {
    backgroundColor: tokens.color.cardInverseBg,
    borderColor: tokens.color.cardInverseBorder,
  },
};
