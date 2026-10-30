import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { tokens, withAlpha } from "../theme";
import { CompassIcon } from "../components/Icons";

// Ekran başlığı (design §7.3/§7.4). `brand` varyantı eski AppHeader görünümünü birebir korur
// (logo, "MapsBridge", "BOTANICAL ATELIER"); tek fark sabit `height` yerine `minHeight` (§7.5).
// Başlık metni accessibilityRole="header" taşır.
export interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  variant?: "brand" | "default";
}

const compact = tokens.font.maxScale.compact;

export function ScreenHeader({
  title,
  subtitle,
  left,
  right,
  variant = "default",
}: ScreenHeaderProps) {
  if (variant === "brand") {
    return (
      <View style={styles.header}>
        <View style={styles.brandRow}>
          {left ?? (
            <View style={styles.brandIconWrap}>
              <CompassIcon size={20} color={tokens.color.onPrimary} />
            </View>
          )}
          <View style={styles.brandTextWrap}>
            <Text
              style={styles.brandTitle}
              accessibilityRole="header"
              maxFontSizeMultiplier={compact}
            >
              {title ?? "MapsBridge"}
            </Text>
            <Text style={styles.brandSubtitle} maxFontSizeMultiplier={compact}>
              {subtitle ?? "BOTANICAL ATELIER"}
            </Text>
          </View>
        </View>
        {right ? <View style={styles.actionRow}>{right}</View> : null}
      </View>
    );
  }
  return (
    <View style={[styles.header, styles.defaultHeader]}>
      <View style={styles.brandRow}>
        {left}
        <View style={styles.brandTextWrap}>
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={compact}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} maxFontSizeMultiplier={compact}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {right ? <View style={styles.actionRow}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: withAlpha(tokens.color.bg, 0.96),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withAlpha(tokens.color.black, 0.06),
    zIndex: 50,
  },
  defaultHeader: {
    backgroundColor: tokens.color.surface,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTextWrap: {
    flexDirection: "column",
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: tokens.color.textBrand,
    letterSpacing: -0.3,
    lineHeight: 18,
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: "700",
    color: tokens.color.brand,
    letterSpacing: 1.2,
    lineHeight: 12,
  },
  title: {
    fontSize: tokens.font.size.lg,
    fontWeight: tokens.font.weight.extrabold,
    color: tokens.color.textBrand,
  },
  subtitle: {
    fontSize: tokens.font.size.xs,
    color: tokens.color.textMuted,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
