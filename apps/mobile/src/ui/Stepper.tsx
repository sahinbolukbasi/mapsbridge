import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fontFamily, tokens } from "../theme";
import { IconButton } from "./IconButton";
import { clampStep } from "./logic/choice";
import { tr } from "../i18n/ui";

// Sayı seçici (design §4.2): gün/gece sayısı. Web Stepper ile aynı prop sözlüğü; iki IconButton
// ("Azalt: …" / "Artır: …") ve canlı bölge değer. Değer [min, max]'ta kalır (logic/choice.ts).
export interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function Stepper({ label, value, min, max, onChange }: StepperProps) {
  const atMin = clampStep(value, -1, min, max) === value;
  const atMax = clampStep(value, 1, min, max) === value;
  const step = (delta: number) => {
    const next = clampStep(value, delta, min, max);
    if (next !== value) onChange(next);
  };
  return (
    <View style={styles.row} accessibilityLabel={label}>
      <Text
        style={[styles.label, { fontFamily: fontFamily("semibold") }]}
        maxFontSizeMultiplier={tokens.font.maxScale.body}
      >
        {label}
      </Text>
      <View style={styles.controls}>
        <IconButton
          icon="minus"
          label={`${tr("ui.stepper.decrease")}: ${label}`}
          disabled={atMin}
          onPress={() => step(-1)}
          style={styles.button}
        />
        <Text
          style={[styles.value, { fontFamily: fontFamily("bold") }]}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${label}: ${value}`}
          maxFontSizeMultiplier={tokens.font.maxScale.compact}
        >
          {value}
        </Text>
        <IconButton
          icon="plus"
          label={`${tr("ui.stepper.increase")}: ${label}`}
          disabled={atMax}
          onPress={() => step(1)}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space["3"],
    minHeight: tokens.touch.min,
  },
  label: {
    flex: 1,
    fontSize: tokens.font.size.md,
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  controls: { flexDirection: "row", alignItems: "center", gap: tokens.space["2"] },
  button: {
    borderWidth: 1,
    borderColor: tokens.color.buttonSecondaryBorder,
    backgroundColor: tokens.color.buttonSecondaryBg,
  },
  value: {
    minWidth: tokens.space["8"],
    textAlign: "center",
    fontSize: tokens.font.size.lg,
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.text,
  },
});
