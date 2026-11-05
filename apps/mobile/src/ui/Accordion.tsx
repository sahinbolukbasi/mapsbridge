import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { fontFamily, tokens } from "../theme";
import { Icon } from "./Icon";
import { animate } from "./motion";

// SSS / açılır bölümler (design §4.2): web Accordion ile aynı `items` sözlüğü. Başlık düğme
// rolündedir ve accessibilityState.expanded taşır; ikon dönüşü `base` süresinde (motion.animate).
export type AccordionItem = { id: string; summary: string; content: React.ReactNode };

export interface AccordionProps {
  items: AccordionItem[];
}

export function Accordion({ items }: AccordionProps) {
  return (
    <View style={styles.list}>
      {items.map((item, i) => (
        <AccordionRow key={item.id} item={item} first={i === 0} />
      ))}
    </View>
  );
}

function AccordionRow({ item, first }: { item: AccordionItem; first: boolean }) {
  const [open, setOpen] = useState(false);
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    animate(turn, open ? 1 : 0, { useNativeDriver: true, easing: "standard" }).start();
  }, [open, turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  return (
    <View style={first ? null : styles.divider}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.summary}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.summary}
      >
        <Text
          style={[styles.title, { fontFamily: fontFamily("semibold") }]}
          maxFontSizeMultiplier={tokens.font.maxScale.body}
        >
          {item.summary}
        </Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Icon name="chevron" size={20} color={tokens.color.textMuted} />
        </Animated.View>
      </Pressable>
      {open ? <View style={styles.content}>{item.content}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.color.border },
  summary: {
    minHeight: tokens.touch.min,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space["3"],
    paddingHorizontal: tokens.space["4"],
    paddingVertical: tokens.space["3"],
  },
  title: {
    flex: 1,
    fontSize: tokens.font.size.base,
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  content: { paddingHorizontal: tokens.space["4"], paddingBottom: tokens.space["4"] },
});
