import React, { Children, createContext, isValidElement, useContext } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fontFamily, tokens } from "../theme";
import { Icon, type IconName } from "./Icon";
import { chipLocked, type ChoiceMode } from "./logic/choice";

// Seçenek çipi (design §4.2, R3): başlangıç önerisi, filtre, I3 seçenekleri. Web Chip ile aynı
// prop sözlüğü; durum accessibilityState.selected ile okunur. Görsel 40pt, dokunma hedefi
// tokens.touch.min (hitSlop). Çoklu grupta `max` dolunca seçili olmayanlar devre dışı kalır.
type GroupState = { mode: ChoiceMode; max?: number; selectedCount: number };
const ChipGroupContext = createContext<GroupState | null>(null);

const CHIP_HEIGHT = 40;
const SLOP = Math.max(0, Math.ceil((tokens.touch.min - CHIP_HEIGHT) / 2));

export interface ChipProps {
  pressed?: boolean;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  children: string;
}

export function Chip({ pressed = false, icon, onPress, disabled = false, children }: ChipProps) {
  const group = useContext(ChipGroupContext);
  const locked = group ? chipLocked(pressed, group.selectedCount, group.mode, group.max) : false;
  const inert = disabled || locked;
  const fg = pressed ? tokens.color.chipSelectedFg : tokens.color.chipFg;
  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ selected: pressed, disabled: inert }}
      hitSlop={{ top: SLOP, bottom: SLOP, left: 0, right: 0 }}
      style={({ pressed: touching }) => [
        styles.chip,
        pressed ? styles.selected : null,
        inert ? styles.inert : null,
        touching ? styles.touching : null,
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text
        style={[styles.label, { color: fg, fontFamily: fontFamily("medium") }]}
        maxFontSizeMultiplier={tokens.font.maxScale.compact}
      >
        {children}
      </Text>
      {pressed ? <Icon name="check" size={16} color={fg} /> : null}
    </Pressable>
  );
}

export interface ChipGroupProps {
  /** Grubun erişilebilir adı; `labelHidden` değilse görünür etiket olarak da çizilir. */
  label: string;
  /** Etiket başka bir yerde görünüyorsa (ör. QuestionCard soru başlığı) yalnızca ad olur. */
  labelHidden?: boolean;
  mode: ChoiceMode;
  max?: number;
  children: React.ReactNode;
}

export function ChipGroup({ label, labelHidden = false, mode, max, children }: ChipGroupProps) {
  const selectedCount = Children.toArray(children).filter(
    (child) => isValidElement<{ pressed?: boolean }>(child) && child.props.pressed,
  ).length;
  return (
    <View role="group" accessibilityLabel={label} style={styles.group}>
      {labelHidden ? null : (
        <Text
          style={[styles.groupLabel, { fontFamily: fontFamily("semibold") }]}
          maxFontSizeMultiplier={tokens.font.maxScale.body}
        >
          {label}
        </Text>
      )}
      <View style={styles.items}>
        <ChipGroupContext.Provider value={{ mode, max, selectedCount }}>
          {children}
        </ChipGroupContext.Provider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: CHIP_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["1"],
    paddingHorizontal: tokens.space["3"],
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: tokens.color.chipBorder,
    backgroundColor: tokens.color.chipBg,
  },
  selected: {
    backgroundColor: tokens.color.chipSelectedBg,
    borderColor: tokens.color.chipSelectedBg,
  },
  inert: { opacity: 0.5 },
  touching: { opacity: 0.85 },
  label: { fontSize: tokens.font.size.md, fontWeight: tokens.font.weight.medium },
  group: { gap: tokens.space["2"] },
  groupLabel: {
    fontSize: tokens.font.size.sm,
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  items: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] },
});
