import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, View } from "react-native";
import { tokens } from "../theme";
import { tr } from "../i18n/ui";
import { Icon } from "./Icon";
import { animate, loop, sequence } from "./motion";
import { useAnnounce } from "./useAnnounce";
import { useReducedMotion } from "./useReducedMotion";
import { clampProgress, stepAnnouncement, stepState } from "./logic/progress";
// İlerleme (web Progress ile aynı ad ve prop sözlüğü, direction §2): belirli (genişlik geçişi),
// belirsiz (kayan çubuk), adımlı (etkin adım döner, tamamlanan onaylanır). Adımlar gerçek boru
// hattı adımlarıdır; süre uydurulmaz. Hareket azaltmada statik çubuk ve adım metni.
type Common = { label: string };
export type ProgressProps =
  | (Common & { variant: "determinate"; value: number; max?: number; showValue?: boolean })
  | (Common & { variant: "indeterminate" })
  | (Common & {
      variant: "steps";
      steps: readonly { id: string; label: string }[];
      current: number;
    });
function Bar({ pct }: { pct: number }) {
  const width = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    animate(width, pct, {
      duration: tokens.motion.duration.slow,
      easing: "standard",
      useNativeDriver: false,
    }).start();
  }, [pct, width]);
  return (
    <View style={styles.track}>
      <Animated.View
        style={[
          styles.bar,
          { width: width.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) },
        ]}
      />
    </View>
  );
}
function Indeterminate() {
  const reduced = useReducedMotion();
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const anim = loop(
      sequence([
        animate(x, 1, {
          duration: tokens.motion.duration.route,
          easing: "standard",
          useNativeDriver: true,
        }),
        animate(x, 0, { duration: 0, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [reduced, x]);
  return (
    <View style={styles.track}>
      <Animated.View
        style={[
          styles.bar,
          styles.slider,
          reduced
            ? null
            : {
                transform: [
                  { translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-120, 360] }) },
                ],
              },
        ]}
      />
    </View>
  );
}
export function Progress(props: ProgressProps) {
  const announcement =
    props.variant === "steps"
      ? props.current >= props.steps.length
        ? tr("ui.progress.done")
        : stepAnnouncement(
            tr("ui.progress.step"),
            props.current,
            props.steps.map((s) => s.label),
          )
      : undefined;
  useAnnounce(announcement);
  if (props.variant === "steps") {
    const { steps, current } = props;
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={props.label}
        accessibilityValue={{
          min: 0,
          max: steps.length,
          now: Math.min(current, steps.length),
          text: announcement,
        }}
        accessibilityLiveRegion="polite"
        style={styles.steps}
      >
        {steps.map((s, i) => {
          const state = stepState(i, current);
          return (
            <View key={s.id} style={styles.step}>
              <View
                style={[
                  styles.marker,
                  state === "done" && styles.markerDone,
                  state === "active" && styles.markerActive,
                ]}
              >
                {state === "done" ? (
                  <Icon name="check" size={16} color={tokens.color.buttonBrandFg} />
                ) : state === "active" ? (
                  <ActivityIndicator size="small" color={tokens.color.brand} />
                ) : null}
              </View>
              <Text
                style={[styles.stepLabel, state === "pending" && styles.stepPending]}
                maxFontSizeMultiplier={tokens.font.maxScale.body}
              >
                {s.label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }
  if (props.variant === "indeterminate")
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={props.label}
        accessibilityState={{ busy: true }}
      >
        <Indeterminate />
      </View>
    );
  const pct = clampProgress(props.value, props.max);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={props.label}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={styles.determinate}
    >
      <View style={styles.flex}>
        <Bar pct={pct} />
      </View>
      {props.showValue ? (
        <Text style={styles.value} maxFontSizeMultiplier={tokens.font.maxScale.compact}>
          %{Math.round(pct)}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  determinate: { flexDirection: "row", alignItems: "center", gap: tokens.space["2"] },
  track: {
    height: 6,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.skeletonBg,
    overflow: "hidden",
  },
  bar: { height: "100%", borderRadius: tokens.radius.full, backgroundColor: tokens.color.brand },
  slider: { width: "35%" },
  value: { fontSize: tokens.font.size.sm, color: tokens.color.textMuted },
  steps: { gap: tokens.space["3"] },
  step: { flexDirection: "row", alignItems: "center", gap: tokens.space["3"] },
  marker: {
    width: 28,
    height: 28,
    borderRadius: tokens.radius.full,
    borderWidth: 2,
    borderColor: tokens.color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  markerDone: { backgroundColor: tokens.color.brand, borderColor: tokens.color.brand },
  markerActive: { borderColor: tokens.color.brand },
  stepLabel: { flex: 1, fontSize: tokens.font.size.md, color: tokens.color.text },
  stepPending: { color: tokens.color.textMuted },
});
