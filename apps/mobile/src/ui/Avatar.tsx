import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { tokens } from "../theme";
import { Txt } from "./Txt";

// Kişi görseli (design §4.1): yalnızca gerçek görsel adresi varsa görsel, yoksa ad baş harfleri
// (FEAT-009 kuralı: uydurma/stok avatar yok). Dekoratiftir; ad yanında metin olarak verilir.
export interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
}

export function initialsOf(name: string): string {
  const parts = name.replace(/^@/, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : (parts[0][1] ?? "");
  return `${first}${last}`.toLocaleUpperCase("tr-TR");
}

export function Avatar({ name, uri, size = 44 }: AvatarProps) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri && /^(https?:|file:|content:|data:image\/)/.test(uri))
    return (
      <Image
        source={{ uri }}
        style={[styles.base, box]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    );
  return (
    <View
      style={[styles.base, styles.initials, box]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Txt variant="label" style={{ color: tokens.color.avatarFg }}>
        {initialsOf(name)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: tokens.color.avatarBg, overflow: "hidden" },
  initials: { alignItems: "center", justifyContent: "center" },
});
