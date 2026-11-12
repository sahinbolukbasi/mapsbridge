import React, { useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { storage } from "../services/storage";
import {
  Button,
  Icon,
  SafeArea,
  Txt,
  haptic,
  useBackHandler,
  useReducedMotion,
  type IconName,
} from "../ui";
import { tr, type UiKey } from "../i18n/ui";
import { fontFamily, tokens, withAlpha } from "../theme";
// İlk açılış tanıtımı ve Apple Review Uyumlu İzin Katmanı:
export const ONBOARDING_KEY = "mb_onboarding_seen_v1";
export const TOUR_KEYS = ["map", "plan", "ai", "community", "profile"].map(
  (s) => `mb_tour_seen_${s}`,
);
interface OnboardingPageItem {
  icon: IconName;
  title?: UiKey;
  body?: UiKey;
  customTitle?: string;
  customBody?: string;
}

const PAGES: readonly OnboardingPageItem[] = [
  { icon: "map", title: "native.onboarding.1.title", body: "native.onboarding.1.body" },
  { icon: "sparkle", title: "native.onboarding.2.title", body: "native.onboarding.2.body" },
  { icon: "share", title: "native.onboarding.3.title", body: "native.onboarding.3.body" },
  {
    icon: "compass",
    customTitle: "Konum ve Seyahat İzinleri",
    customBody:
      "Haritada yakınınızdaki turistik noktaları keşfetmek, canlı yol tarifi almak ve durak hatırlatmalarını kaçırmamak için konum ve bildirim erişimine izin verin. Verileriniz KVKK ve GDPR uyumlu güvendedir.",
  },
];
export async function markOnboardingSeen(): Promise<void> {
  await storage.setItem(ONBOARDING_KEY, "true").catch(() => undefined);
  await Promise.all(TOUR_KEYS.map((k) => storage.setItem(k, "true").catch(() => undefined)));
}
export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [page, setPage] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const ios = Platform.OS === "ios";
  const last = page === PAGES.length - 1;
  const goTo = (next: number) => {
    const target = Math.max(0, Math.min(PAGES.length - 1, next));
    scroller.current?.scrollTo({ x: target * width, animated: !reduced });
    if (target !== page) haptic("selection");
    setPage(target);
  };
  const finish = () => {
    void markOnboardingSeen();
    onDone();
  };
  useBackHandler(page > 0, () => goTo(page - 1));
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    if (next !== page) {
      haptic("selection");
      setPage(next);
    }
  };
  return (
    <SafeArea style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={tokens.color.bg} />
      {/* Android'de üst satır boştur ("Atla" altta); durum çubuğu boşluğu içerik ortalamasından. */}
      <View style={styles.top}>
        {ios && page > 0 ? (
          <Button label={tr("nav.back")} variant="ghost" size="sm" onPress={() => goTo(page - 1)} />
        ) : (
          <View />
        )}
        {ios ? (
          <Button label={tr("native.onboarding.skip")} variant="ghost" size="sm" onPress={finish} />
        ) : null}
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        accessibilityLabel={tr("native.onboarding.label")}
      >
        {PAGES.map((p, i) => (
          <View
            key={p.title}
            style={[styles.page, { width }]}
            accessibilityElementsHidden={i !== page}
            importantForAccessibility={i === page ? "auto" : "no-hide-descendants"}
          >
            <View style={styles.art} importantForAccessibility="no-hide-descendants">
              <Icon name="contour" size={96} color={tokens.color.borderStrong} />
              <View style={styles.badge}>
                <Icon name={p.icon} size={32} color={tokens.color.onPrimary} />
              </View>
            </View>
            <Txt variant="eyebrow" tone="highlight">
              {tr("native.onboarding.step", { n: i + 1, total: PAGES.length })}
            </Txt>
            <Text
              accessibilityRole="header"
              style={[styles.title, { fontFamily: fontFamily("extrabold", "display") }]}
              maxFontSizeMultiplier={tokens.font.maxScale.compact}
            >
              {p.customTitle || (p.title ? tr(p.title) : "")}
            </Text>
            <Txt tone="muted">{p.customBody || (p.body ? tr(p.body) : "")}</Txt>
          </View>
        ))}
      </ScrollView>
      <View
        style={styles.dots}
        accessible
        accessibilityRole="text"
        accessibilityLabel={tr("native.onboarding.step", { n: page + 1, total: PAGES.length })}
      >
        {PAGES.map((p, i) => (
          <View key={p.customTitle || p.title || i} style={[styles.dot, i === page ? styles.dotActive : null]} />
        ))}
      </View>
      {ios ? (
        <View style={styles.bottomIos}>
          <Button
            label={last ? tr("native.onboarding.start") : tr("assistant.question.submit")}
            size="lg"
            variant="primary"
            onPress={() => (last ? finish() : goTo(page + 1))}
          />
        </View>
      ) : (
        <View style={styles.bottomAndroid}>
          <Button label={tr("native.onboarding.skip")} variant="ghost" onPress={finish} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={last ? tr("native.onboarding.start") : tr("native.onboarding.next")}
            onPress={() => (last ? finish() : goTo(page + 1))}
            android_ripple={{ color: withAlpha(tokens.color.onPrimary, 0.25), borderless: false }}
            style={styles.fab}
          >
            <Icon name={last ? "check" : "arrow"} size={24} color={tokens.color.onPrimary} />
          </Pressable>
        </View>
      )}
    </SafeArea>
  );
}
const FAB = 56;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: tokens.touch.min,
    paddingHorizontal: tokens.space["3"],
  },
  page: { paddingHorizontal: tokens.space["6"], justifyContent: "center", gap: tokens.space["3"] },
  art: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tokens.space["4"],
  },
  badge: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
    ...tokens.shadow.md,
  },
  title: {
    fontSize: tokens.font.size["3xl"],
    fontWeight: tokens.font.weight.extrabold,
    color: tokens.color.text,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: tokens.space["2"],
    paddingVertical: tokens.space["4"],
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.color.borderStrong },
  dotActive: { width: 24, backgroundColor: tokens.color.primary },
  bottomIos: { paddingHorizontal: tokens.space["5"], paddingBottom: tokens.space["5"] },
  bottomAndroid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: tokens.space["5"],
    paddingBottom: tokens.space["6"],
  },
  fab: {
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...tokens.shadow.md,
  },
});
