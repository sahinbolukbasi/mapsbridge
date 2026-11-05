import React, { useEffect, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { fontFamily, tokens } from "../theme";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { animate, loop, sequence } from "./motion";
import { useReducedMotion } from "./useReducedMotion";
import { tr } from "../i18n/ui";
import { useAnnounce } from "./useAnnounce";

// Sohbet (design §4.2, §8.2, §8.3): web MessageBubble / MessageLog ile aynı prop sözlüğü.
// MessageLog canlı bölgedir (Android accessibilityLiveRegion="polite"; iOS'ta `announcement`
// değişince VoiceOver'a okutulur, çünkü canlı bölge iOS'ta çalışmaz); içerik büyüdüğünde kullanıcı
// alttaysa otomatik kaydırılır, değilse "Yeni mesaj" hapı çıkar. Yeni balon opacity + 4pt kayma
// ile girer; yazıyor göstergesi döngüsü reduce-motion'da durur ve statik metin kalır.

export interface MessageBubbleProps {
  role: "user" | "assistant";
  children: React.ReactNode;
}

export function MessageBubble({ role, children }: MessageBubbleProps) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    animate(enter, 1, { useNativeDriver: true, easing: "enter" }).start();
  }, [enter]);
  const translateY = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [tokens.motion.distance.sm, 0],
  });
  const user = role === "user";
  const content =
    typeof children === "string" ? (
      <Text
        style={[styles.text, user ? styles.textUser : null, { fontFamily: fontFamily("regular") }]}
        maxFontSizeMultiplier={tokens.font.maxScale.body}
      >
        {children}
      </Text>
    ) : (
      children
    );
  return (
    <Animated.View
      style={[
        styles.msg,
        user ? styles.msgUser : styles.msgAssistant,
        { opacity: enter, transform: [{ translateY }] },
      ]}
    >
      <View style={[styles.bubble, user ? styles.bubbleUser : styles.bubbleAssistant]}>
        {content}
      </View>
    </Animated.View>
  );
}

/** "Yanıt hazırlanıyor…": hareket tercihinde 3 nokta, metin her zaman ekran okuyucuya kalır. */
export function TypingIndicator() {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    if (reduced) return;
    // 1200 ms döngü (design §8.2 "Yazıyor göstergesi"): iki yarım = route / 1.5.
    const half = tokens.motion.duration.route / 1.5;
    const anim = loop(
      sequence([
        animate(pulse, 1, { duration: half, useNativeDriver: true, easing: "standard" }),
        animate(pulse, 0.4, { duration: half, useNativeDriver: true, easing: "standard" }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [reduced, pulse]);
  return (
    <View
      style={styles.typing}
      accessibilityRole="progressbar"
      accessibilityLabel={tr("assistant.typing")}
    >
      {reduced ? null : (
        <Animated.View style={[styles.dots, { opacity: pulse }]}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </Animated.View>
      )}
      <Text style={styles.typingText} maxFontSizeMultiplier={tokens.font.maxScale.body}>
        {tr("assistant.typing")}
      </Text>
    </View>
  );
}

/** Alttan bu kadar punto içindeyse kullanıcı "altta" sayılır. */
const BOTTOM_SLACK = 48;

export interface MessageLogProps {
  label?: string;
  busy?: boolean;
  /** true → TypingIndicator, düğüm → o düğüm (ör. akış metni), asistan balonunda. */
  typing?: boolean | React.ReactNode;
  children: React.ReactNode;
  /** iOS duyurusu: son eklenen mesajın düz metni (değişince okunur). Android canlı bölgeyi okur. */
  announcement?: string;
}
export function MessageLog({
  label = tr("assistant.log.label"),
  busy = false,
  typing,
  children,
  announcement,
}: MessageLogProps) {
  useAnnounce(announcement);
  const ref = useRef<ScrollView>(null);
  const atBottom = useRef(true);
  const lastHeight = useRef(0);
  const [hasNew, setHasNew] = useState(false);
  const toBottom = () => {
    atBottom.current = true;
    ref.current?.scrollToEnd({ animated: false });
    setHasNew(false);
  };
  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={ref}
        accessibilityLabel={label}
        accessibilityLiveRegion="polite"
        accessibilityState={{ busy }}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={64}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const bottom =
            contentSize.height - contentOffset.y - layoutMeasurement.height <= BOTTOM_SLACK;
          atBottom.current = bottom;
          if (bottom && hasNew) setHasNew(false);
        }}
        onContentSizeChange={(_w, h) => {
          if (h > lastHeight.current + 1) {
            if (atBottom.current) ref.current?.scrollToEnd({ animated: false });
            else setHasNew(true);
          }
          lastHeight.current = h;
        }}
      >
        {children}
        {typing ? (
          <MessageBubble role="assistant">
            {typing === true ? <TypingIndicator /> : typing}
          </MessageBubble>
        ) : null}
      </ScrollView>
      {hasNew ? (
        <View style={styles.newPill}>
          <Button
            label={tr("assistant.log.new")}
            variant="secondary"
            size="sm"
            onPress={toBottom}
            icon={<Icon name="chevron" size={16} color={tokens.color.buttonSecondaryFg} />}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  list: { gap: tokens.space["3"], padding: tokens.space["4"] },
  msg: { flexDirection: "row" },
  msgUser: { justifyContent: "flex-end" },
  msgAssistant: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "85%",
    paddingHorizontal: tokens.space["3"],
    paddingVertical: tokens.space["2"],
    borderRadius: tokens.radius.lg,
  },
  bubbleUser: { backgroundColor: tokens.color.surfaceInverse },
  bubbleAssistant: {
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  text: { fontSize: tokens.font.size.base, color: tokens.color.text },
  textUser: { color: tokens.color.textInverse },
  typing: { flexDirection: "row", alignItems: "center", gap: tokens.space["2"] },
  dots: { flexDirection: "row", gap: tokens.space["1"] },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.color.textMuted },
  typingText: { fontSize: tokens.font.size.sm, color: tokens.color.textMuted },
  newPill: {
    position: "absolute",
    bottom: tokens.space["3"],
    alignSelf: "center",
  },
});
