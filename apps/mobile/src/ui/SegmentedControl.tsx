import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { fontFamily, tokens } from "../theme";
import { animate } from "./motion";

// 2–4 karşılıklı dışlayan seçenek (design §4.2, R3): web SegmentedControl ile aynı prop sözlüğü.
// Kap radiogroup, her seçenek radio (accessibilityState.checked). Seçili zemin `base` süresinde
// kayar (motion.animate; reduce-motion'da anında).
export type SegmentOption<V extends string> = { value: V; label: string };
type Options<V extends string> =
  | readonly [SegmentOption<V>, SegmentOption<V>]
  | readonly [SegmentOption<V>, SegmentOption<V>, SegmentOption<V>]
  | readonly [SegmentOption<V>, SegmentOption<V>, SegmentOption<V>, SegmentOption<V>];

export interface SegmentedControlProps<V extends string> {
  label: string;
  options: Options<V>;
  value: V;
  onChange: (value: V) => void;
}

const PAD = 3;

export function SegmentedControl<V extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<V>) {
  const index = options.findIndex((o) => o.value === value);
  const [width, setWidth] = useState(0);
  const segment = width > 0 ? (width - PAD * 2) / options.length : 0;
  const x = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (segment <= 0 || index < 0) return;
    const target = index * segment;
    if (!placed.current) {
      x.setValue(target);
      placed.current = true;
      return;
    }
    animate(x, target, { useNativeDriver: true, easing: "standard" }).start();
  }, [index, segment, x]);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={styles.track}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {index >= 0 && segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { width: segment, transform: [{ translateX: x }] }]}
        />
      ) : null}
      {options.map((option, k) => {
        const checked = k === index;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked, selected: checked }}
            onPress={() => {
              if (!checked) onChange(option.value);
            }}
            hitSlop={{ top: PAD, bottom: PAD }}
            style={styles.option}
          >
            <Text
              style={[
                styles.label,
                checked ? styles.labelChecked : null,
                { fontFamily: fontFamily(checked ? "semibold" : "medium") },
              ]}
              maxFontSizeMultiplier={tokens.font.maxScale.compact}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: PAD,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.segmentBg,
  },
  indicator: {
    position: "absolute",
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.segmentSelectedBg,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  option: {
    flex: 1,
    minHeight: tokens.touch.min - PAD * 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.space["2"],
  },
  label: {
    fontSize: tokens.font.size.md,
    fontWeight: tokens.font.weight.medium,
    color: tokens.color.segmentFg,
  },
  labelChecked: { color: tokens.color.segmentSelectedFg, fontWeight: tokens.font.weight.semibold },
});
