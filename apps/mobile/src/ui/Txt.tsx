import React from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { fontFamily, letterSpacingPt, tokens } from "../theme";

// Metin primitive'i (design §3.3 tipografi, §9 "Dinamik tip"): ekranlar ham <Text> yerine bunu
// kullanır. Ölçek, ağırlık ve yazı tipi token'dan; `maxFontSizeMultiplier` her zaman verilir
// (başlıklar compact 1.4, gövde 2). `header` başlık rolü taşır (ekran okuyucu başlık gezinmesi).
export type TxtVariant =
  "display" | "title" | "heading" | "body" | "small" | "caption" | "eyebrow" | "label";
export type TxtTone =
  | "default"
  | "muted"
  | "subtle"
  | "inverse"
  | "inverseMuted"
  | "brand"
  | "success"
  | "danger"
  | "warning"
  | "highlight";

export interface TxtProps {
  variant?: TxtVariant;
  tone?: TxtTone;
  header?: boolean;
  numberOfLines?: number;
  align?: "left" | "center";
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  children?: React.ReactNode;
}

const TONE: Record<TxtTone, string> = {
  default: tokens.color.text,
  muted: tokens.color.textMuted,
  subtle: tokens.color.textSubtle,
  inverse: tokens.color.textInverse,
  inverseMuted: tokens.color.textInverseMuted,
  brand: tokens.color.textBrand,
  success: tokens.color.success,
  danger: tokens.color.danger,
  warning: tokens.color.warning,
  highlight: tokens.color.highlightText,
};

const COMPACT: Record<TxtVariant, boolean> = {
  display: true,
  title: true,
  heading: false,
  body: false,
  small: false,
  caption: false,
  eyebrow: true,
  label: false,
};

function familyOf(variant: TxtVariant): string | undefined {
  switch (variant) {
    case "display":
    case "title":
      return fontFamily("extrabold", "display");
    case "heading":
    case "label":
      return fontFamily("semibold");
    case "eyebrow":
      return fontFamily("semibold");
    default:
      return fontFamily("regular");
  }
}

export function Txt({
  variant = "body",
  tone = "default",
  header = false,
  numberOfLines,
  align,
  style,
  accessibilityLabel,
  children,
}: TxtProps) {
  return (
    <Text
      accessibilityRole={header ? "header" : undefined}
      accessibilityLabel={accessibilityLabel}
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={
        COMPACT[variant] ? tokens.font.maxScale.compact : tokens.font.maxScale.body
      }
      style={[
        styles[variant],
        { color: TONE[tone], fontFamily: familyOf(variant) },
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const size = tokens.font.size;
const weight = tokens.font.weight;
const styles = StyleSheet.create({
  display: {
    fontSize: size["3xl"],
    lineHeight: Math.round(size["3xl"] * tokens.font.lineHeight.tight),
    fontWeight: weight.extrabold,
    letterSpacing: letterSpacingPt(-0.02, size["3xl"]),
  },
  title: {
    fontSize: size["2xl"],
    lineHeight: Math.round(size["2xl"] * tokens.font.lineHeight.heading),
    fontWeight: weight.extrabold,
  },
  heading: {
    fontSize: size.lg,
    lineHeight: Math.round(size.lg * tokens.font.lineHeight.heading),
    fontWeight: weight.semibold,
  },
  body: {
    fontSize: size.base,
    lineHeight: Math.round(size.base * tokens.font.lineHeight.body),
  },
  small: {
    fontSize: size.md,
    lineHeight: Math.round(size.md * tokens.font.lineHeight.body),
  },
  caption: {
    fontSize: size.xs,
    lineHeight: Math.round(size.xs * tokens.font.lineHeight.body),
  },
  eyebrow: {
    fontSize: size.xs,
    fontWeight: weight.semibold,
    letterSpacing: letterSpacingPt(0.06, size.xs),
    textTransform: "uppercase",
  },
  label: {
    fontSize: size.md,
    fontWeight: weight.semibold,
  },
});
