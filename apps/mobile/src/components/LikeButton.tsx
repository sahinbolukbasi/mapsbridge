import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, haptic, motion } from "../ui";
import { tokens } from "../theme";
// Beğeni tepkisi (direction §2 "Mikro etkileşimler"): kalp sıkışır-büyür + halka patlar; geri
// almada yalnız durum değişir. Hareket motion.ts üzerinden (reduce-motion'da anında), haptik
// haptics.ts'ten. Sayı ve durum metinle de verilir (renk tek bilgi taşıyıcı değil).
export interface LikeButtonProps {
  liked: boolean;
  count: number;
  label: string;
  onPress: () => void;
}
export function LikeButton({ liked, count, label, onPress }: LikeButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const press = () => {
    if (!liked) {
      ring.setValue(0);
      motion
        .parallel([
          motion.sequence([
            motion.animate(scale, 0.8, {
              duration: tokens.motion.duration.fast,
              easing: "exit",
              useNativeDriver: true,
            }),
            motion.spring(scale, 1.25, "press", true),
            motion.spring(scale, 1, "press", true),
          ]),
          motion.animate(ring, 1, {
            duration: tokens.motion.duration.deliberate,
            easing: "enter",
            useNativeDriver: true,
          }),
        ])
        .start();
    }
    haptic("selection");
    onPress();
  };
  const color = liked ? tokens.color.dangerIcon : tokens.color.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} · ${count}`}
      accessibilityState={{ selected: liked }}
      onPress={press}
      hitSlop={4}
      style={({ pressed }) => [styles.root, pressed ? styles.pressed : null]}
    >
      <View style={styles.icon}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              opacity: ring.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.8, 0] }),
              transform: [
                { scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.8] }) },
              ],
            },
          ]}
        />
        <Animated.View style={{ transform: [{ scale }] }}>
          <Icon name="heart" size={20} color={color} />
        </Animated.View>
      </View>
      <Text style={[styles.count, { color }]} maxFontSizeMultiplier={tokens.font.maxScale.compact}>
        {count}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  root: {
    minHeight: tokens.touch.min,
    minWidth: tokens.touch.min,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["1"],
    paddingHorizontal: tokens.space["2"],
    borderRadius: tokens.radius.full,
  },
  pressed: { backgroundColor: tokens.color.surfaceSunken },
  icon: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: tokens.color.dangerIcon,
  },
  count: { fontSize: tokens.font.size.sm, fontWeight: tokens.font.weight.semibold },
});
