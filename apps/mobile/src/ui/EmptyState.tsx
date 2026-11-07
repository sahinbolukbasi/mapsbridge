import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fontFamily, tokens } from "../theme";
import { Icon, type IconName } from "./Icon";
// Boş durum (web EmptyState ile aynı ad ve prop sözlüğü, direction §3): kontur illüstrasyonu +
// gerçek eylemler (birincil `action`, isteğe bağlı `secondaryAction`). Başlık header rolündedir.
export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  contour?: boolean;
}
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  contour = false,
}: EmptyStateProps) {
  return (
    <View style={styles.root}>
      {contour ? (
        <View style={styles.art}>
          <Icon name="contour" size={96} color={tokens.color.borderStrong} />
          {icon ? (
            <View style={styles.artIcon}>
              <Icon name={icon} size={24} color={tokens.color.textBrand} />
            </View>
          ) : null}
        </View>
      ) : icon ? (
        <View style={styles.iconCircle}>
          <Icon name={icon} size={24} color={tokens.color.textBrand} />
        </View>
      ) : null}
      <Text
        accessibilityRole="header"
        style={[styles.title, { fontFamily: fontFamily("bold") }]}
        maxFontSizeMultiplier={tokens.font.maxScale.compact}
      >
        {title}
      </Text>
      {description ? (
        <Text style={styles.description} maxFontSizeMultiplier={tokens.font.maxScale.body}>
          {description}
        </Text>
      ) : null}
      {action || secondaryAction ? (
        <View style={styles.actions}>
          {action}
          {secondaryAction}
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    gap: tokens.space["3"],
    paddingVertical: tokens.space["8"],
    paddingHorizontal: tokens.space["5"],
  },
  art: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  artIcon: { position: "absolute" },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.surfaceBrand,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: tokens.font.size.lg,
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.text,
    textAlign: "center",
  },
  description: {
    fontSize: tokens.font.size.md,
    color: tokens.color.textMuted,
    textAlign: "center",
    maxWidth: 420,
  },
  actions: { alignSelf: "stretch", gap: tokens.space["2"], marginTop: tokens.space["2"] },
});
