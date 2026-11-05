import React, { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { tokens } from "../theme";
import { Icon } from "./Icon";

// Oranlı görsel (design §4.2, F20): web Media ile aynı prop sözlüğü. Kutu oranı yüklemeden önce
// ayrılır; görsel yoksa ya da yüklenemezse sunken zemin + ikon. `alt` boşsa dekoratiftir.
export type MediaRatio = "1/1" | "4/3" | "16/9";
const RATIO: Record<MediaRatio, number> = { "1/1": 1, "4/3": 4 / 3, "16/9": 16 / 9 };

export interface MediaProps {
  src?: string | null;
  alt: string;
  ratio?: MediaRatio;
}

export function Media({ src, alt, ratio = "4/3" }: MediaProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !src || failedSrc === src;
  const a11y = alt
    ? { accessible: true, accessibilityRole: "image" as const, accessibilityLabel: alt }
    : { accessible: false, importantForAccessibility: "no-hide-descendants" as const };
  return (
    <View style={[styles.box, { aspectRatio: RATIO[ratio] }]} {...a11y}>
      {failed ? (
        <View style={styles.fallback}>
          <Icon name="image" size={24} color={tokens.color.textSubtle} />
        </View>
      ) : (
        <Image
          source={{ uri: src ?? undefined }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailedSrc(src ?? null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: "100%",
    overflow: "hidden",
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surfaceSunken,
  },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center" },
});
