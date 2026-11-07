import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { fontFamily, tokens } from "../theme";
import { animate, delay, parallel, sequence, spring } from "./motion";
import { haptic } from "./haptics";
import { useAnnounce } from "./useAnnounce";
import { useReducedMotion } from "./useReducedMotion";
// Başarı anı (web Celebrate ile aynı ad, direction §2/§3): onay halkası "pop", onay işareti,
// 18 token renkli konfeti (≤ route × 1.2). Hareket azaltmada yalnız statik onay işareti.
// Başlık ve mesaj ekran okuyucuya bir kez duyurulur; başarı haptiği haptics.ts üzerinden.
// Kayıt, ilk rota, satın alma, paylaşım ve istek kabulünde kullanılır; metin gerçek olayı anlatır.
export const CELEBRATE_BITS = 18;
const BIT_COLORS = [
  tokens.color.accent,
  tokens.color.brand,
  tokens.color.warningIcon,
  tokens.color.infoIcon,
  tokens.color.dangerIcon,
  tokens.color.successStrong,
];
const RING = 72;
export interface CelebrateProps {
  title: string;
  message?: string;
  action?: React.ReactNode;
}
export function Celebrate({ title, message, action }: CelebrateProps) {
  const reduced = useReducedMotion();
  const ring = useRef(new Animated.Value(reduced ? 1 : 0.6)).current;
  const burst = useRef(new Animated.Value(0)).current;
  useAnnounce(message ? `${title}. ${message}` : title);
  useEffect(() => {
    haptic("success");
    if (reduced) {
      ring.setValue(1);
      return;
    }
    parallel([
      spring(ring, 1, "press", true),
      sequence([
        delay(tokens.motion.duration.fast),
        animate(burst, 1, {
          duration: tokens.motion.duration.route * 1.1,
          easing: "enter",
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [reduced, ring, burst]);
  return (
    <View
      style={styles.root}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={message ? `${title}. ${message}` : title}
    >
      <View style={styles.mark} importantForAccessibility="no-hide-descendants">
        {reduced
          ? null
          : Array.from({ length: CELEBRATE_BITS }, (_, i) => {
              const angle = (i / CELEBRATE_BITS) * Math.PI * 2;
              const dist = RING * (0.75 + (i % 3) * 0.2);
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.bit,
                    {
                      backgroundColor: BIT_COLORS[i % BIT_COLORS.length],
                      opacity: burst.interpolate({
                        inputRange: [0, 0.15, 0.8, 1],
                        outputRange: [0, 1, 1, 0],
                      }),
                      transform: [
                        {
                          translateX: burst.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, Math.cos(angle) * dist],
                          }),
                        },
                        {
                          translateY: burst.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, Math.sin(angle) * dist],
                          }),
                        },
                        { rotate: `${(i * 47) % 360}deg` },
                      ],
                    },
                  ]}
                />
              );
            })}
        <Animated.View style={[styles.ring, { transform: [{ scale: ring }] }]}>
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
            <Path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke={tokens.color.buttonBrandFg}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      </View>
      <Text
        style={[styles.title, { fontFamily: fontFamily("bold", "display") }]}
        maxFontSizeMultiplier={tokens.font.maxScale.compact}
      >
        {title}
      </Text>
      {message ? (
        <Text style={styles.message} maxFontSizeMultiplier={tokens.font.maxScale.body}>
          {message}
        </Text>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { alignItems: "center", gap: tokens.space["3"], paddingVertical: tokens.space["4"] },
  mark: { width: RING * 2, height: RING * 1.6, alignItems: "center", justifyContent: "center" },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    backgroundColor: tokens.color.brand,
    alignItems: "center",
    justifyContent: "center",
    ...tokens.shadow.md,
  },
  bit: { position: "absolute", width: 8, height: 4, borderRadius: 2 },
  title: {
    fontSize: tokens.font.size.xl,
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.text,
    textAlign: "center",
  },
  message: { fontSize: tokens.font.size.md, color: tokens.color.textMuted, textAlign: "center" },
  action: { alignSelf: "stretch" },
});
