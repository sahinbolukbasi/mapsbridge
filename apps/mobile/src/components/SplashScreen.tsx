import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { SafeArea } from "../ui";
import { tokens, withAlpha } from "../theme";

// Açılış ekranı (design §5.5 J6, F38): yalnızca gerçek yükleme (yazı tipleri + oturum) sürerken
// görünür; yapay en kısa süre, sahte ilerleme adımı ya da istatistik yoktur (I1). Yazı tipleri
// henüz yüklenmemiş olabilir: sistem yazı tipiyle çizilir.
export function SplashScreen() {
  return (
    <SafeArea style={styles.container}>
      <View style={styles.center} accessible accessibilityLabel="MapsBridge yükleniyor">
        <View style={styles.logo}>
          <Svg width={48} height={48} viewBox="0 0 48 48">
            <Path
              d="M10 36C14 26 22 22 28 20C34 18 38 13 40 8"
              stroke={withAlpha(tokens.color.onPrimary, 0.4)}
              strokeDasharray="3 3"
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M8 38C15 28 25 24 32 22C38 20 40 12 40 12"
              stroke={tokens.color.accent}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx="10" cy="36" r="3.5" fill={tokens.color.accentStrong} />
            <Circle cx="28" cy="22" r="3" fill={tokens.color.onPrimary} />
            <Circle cx="39" cy="11" r="3.5" fill={tokens.color.accentStrong} />
          </Svg>
        </View>
        <Text style={styles.name} maxFontSizeMultiplier={tokens.font.maxScale.compact}>
          MapsBridge
        </Text>
        <ActivityIndicator size="small" color={tokens.color.textMuted} />
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.color.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: tokens.space["4"] },
  logo: {
    width: 88,
    height: 88,
    borderRadius: tokens.radius.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.primary,
  },
  name: {
    fontSize: tokens.font.size["2xl"],
    fontWeight: tokens.font.weight.extrabold,
    color: tokens.color.text,
  },
});
