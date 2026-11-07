import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type DimensionValue } from "react-native";
import { tokens } from "../theme";
import { animate, loop, sequence } from "./motion";
import { useReducedMotion } from "./useReducedMotion";
// Dekoratif yer tutucu (web Skeleton ile aynı ad ve prop sözlüğü). Erişilebilirlik ağacından
// gizlidir; yükleniyor durumunu çağıran duyurur. Parıltı (yavaş nabız, 1,6 × route) yalnız hareket
// serbestken; azaltmada düz blok.
export type SkeletonVariant = "line" | "card" | "list-row" | "panel";
export interface SkeletonProps {
  shape?: "text" | "rect" | "circle";
  variant?: SkeletonVariant;
  lines?: number;
  count?: number;
  width?: DimensionValue;
  height?: DimensionValue;
}
function useShimmer() {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    const half = (tokens.motion.duration.route * 1.6) / 2;
    const anim = loop(
      sequence([
        animate(v, 0.55, { duration: half, easing: "standard", useNativeDriver: true }),
        animate(v, 1, { duration: half, easing: "standard", useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [reduced, v]);
  return v;
}
function Block({
  shape,
  width,
  height,
  opacity,
}: {
  shape: "text" | "rect" | "circle" | "heading";
  width?: DimensionValue;
  height?: DimensionValue;
  opacity: Animated.Value;
}) {
  return (
    <Animated.View
      style={[
        styles.block,
        styles[shape],
        width !== undefined ? { width } : null,
        height !== undefined ? { height } : null,
        { opacity },
      ]}
    />
  );
}
export function Skeleton({
  shape = "text",
  variant,
  lines = 1,
  count = 1,
  width,
  height,
}: SkeletonProps) {
  const opacity = useShimmer();
  const hidden = {
    accessibilityElementsHidden: true,
    importantForAccessibility: "no-hide-descendants" as const,
  };
  if (variant) {
    const n = variant === "line" ? 1 : variant === "panel" ? 3 : 2;
    return (
      <View style={styles.group} {...hidden}>
        {Array.from({ length: Math.max(1, count) }, (_, k) => (
          <View key={k} style={variant === "list-row" ? styles.row : styles.pattern}>
            {variant === "card" ? <Block shape="rect" opacity={opacity} /> : null}
            {variant === "list-row" ? <Block shape="circle" opacity={opacity} /> : null}
            {variant === "panel" ? <Block shape="heading" opacity={opacity} /> : null}
            <View style={styles.lines}>
              {Array.from({ length: n }, (_, i) => (
                <Block
                  key={i}
                  shape="text"
                  width={i === n - 1 && n > 1 ? "60%" : undefined}
                  opacity={opacity}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    );
  }
  if (shape === "text" && lines > 1)
    return (
      <View style={styles.lines} {...hidden}>
        {Array.from({ length: lines }, (_, k) => (
          <Block
            key={k}
            shape="text"
            width={k === lines - 1 ? (width ?? "60%") : undefined}
            opacity={opacity}
          />
        ))}
      </View>
    );
  return (
    <View {...hidden}>
      <Block shape={shape} width={width} height={height} opacity={opacity} />
    </View>
  );
}
const styles = StyleSheet.create({
  group: { gap: tokens.space["3"] },
  pattern: { gap: tokens.space["2"] },
  row: { flexDirection: "row", alignItems: "center", gap: tokens.space["3"] },
  lines: { flex: 1, gap: tokens.space["2"] },
  block: { backgroundColor: tokens.color.skeletonBg, borderRadius: tokens.radius.sm },
  text: { height: 12, width: "100%" },
  heading: { height: 18, width: "50%" },
  rect: { height: 140, width: "100%", borderRadius: tokens.radius.md },
  circle: { height: 40, width: 40, borderRadius: tokens.radius.full },
});
