import React from "react";
import { StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from "react-native";
import { tokens } from "../theme";

// Kart yüzeyi (design §7.3). onPress verilirse düğme rolü alır (min 44pt).
export interface CardProps {
  onPress?: () => void;
  /** Erişilebilir ad (onPress varsa önerilir). */
  label?: string;
  padding?: keyof typeof tokens.space;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function Card({ onPress, label, padding = "4", style, children }: CardProps) {
  const s = [styles.card, { padding: tokens.space[padding] }, style];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.85}
      style={[s, { minHeight: tokens.touch.min }]}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.cardBg,
    borderColor: tokens.color.cardBorder,
    borderWidth: 1,
    borderRadius: tokens.radius.lg,
  },
});
