import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { storage } from "../services/storage";
import { Button, Icon, ModalFrame, Txt, type IconName } from "../ui";
import { tr } from "../i18n/ui";
import { homeText } from "../i18n/home";
import { tokens } from "../theme";

// Ekran başına ilk açılış rehberi (FEAT-012: primitive'lerle yeniden yazıldı). Metinler yalnızca
// gerçekten var olan davranışı anlatır (I1): eski "%38 zaman tasarrufu", "sıfır halüsinasyon /
// güncel açılış saatleri", "6 haneli canlı kod", "yükseklik eğimi" gibi doğrulanmamış iddialar
// kaldırıldı. Görülme işareti aynı anahtarda (`mb_tour_seen_<ekran>`).
export type TourScreenType = "map" | "plan" | "ai" | "community" | "profile";

interface TourStep {
  icon: IconName;
  title: string;
  desc: string;
}
interface TourContent {
  title: string;
  steps: TourStep[];
}

const TOURS: Record<TourScreenType, TourContent> = {
  plan: {
    title: tr("planner.trips.title"),
    steps: [
      { icon: "plus", title: tr("planner.trips.create"), desc: tr("profile.tripsBody") },
      { icon: "search", title: tr("planner.search.label"), desc: tr("planner.search.hint") },
      {
        icon: "route",
        title: tr("planner.optimize"),
        desc: tr("native.tour.optimize"),
      },
    ],
  },
  map: {
    title: tr("planner.map.label"),
    steps: [
      { icon: "search", title: tr("planner.search.label"), desc: tr("planner.search.hint") },
      { icon: "walk", title: tr("planner.sheet.label"), desc: tr("planner.note.osrm") },
      { icon: "offline", title: tr("trip.day.offline"), desc: tr("planner.map.errorBody") },
    ],
  },
  ai: {
    title: homeText("home.how.title"),
    steps: [
      {
        icon: "message",
        title: homeText("home.how.step1.title"),
        desc: homeText("home.how.step1.body"),
      },
      {
        icon: "check",
        title: homeText("home.how.step2.title"),
        desc: homeText("home.how.step2.body"),
      },
      {
        icon: "map",
        title: homeText("home.how.step3.title"),
        desc: homeText("home.how.step3.body"),
      },
    ],
  },
  community: {
    title: tr("community.title"),
    steps: [
      { icon: "users", title: tr("community.title"), desc: tr("community.description") },
      { icon: "edit", title: tr("community.newPost"), desc: tr("community.empty.body") },
    ],
  },
  profile: {
    title: tr("nav.profile"),
    steps: [
      { icon: "route", title: tr("profile.trips"), desc: tr("profile.tripsBody") },
      { icon: "coin", title: tr("profile.plans"), desc: tr("upgrade.note") },
    ],
  },
};

interface ScreenTourModalProps {
  screen: TourScreenType;
  visible?: boolean;
  onClose?: () => void;
  autoCheckStorage?: boolean;
}

export function ScreenTourModal({
  screen,
  visible: controlledVisible,
  onClose,
  autoCheckStorage = true,
}: ScreenTourModalProps) {
  const [internalVisible, setInternalVisible] = useState(false);
  useEffect(() => {
    if (controlledVisible !== undefined) {
      setInternalVisible(controlledVisible);
      return;
    }
    if (!autoCheckStorage) return;
    let alive = true;
    storage
      .getItem(`mb_tour_seen_${screen}`)
      .then((seen) => {
        if (alive && !seen) setInternalVisible(true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [screen, controlledVisible, autoCheckStorage]);

  const handleDismiss = async () => {
    setInternalVisible(false);
    try {
      await storage.setItem(`mb_tour_seen_${screen}`, "true");
    } catch {}
    onClose?.();
  };

  const content = TOURS[screen];
  return (
    <ModalFrame
      visible={internalVisible}
      variant="bottomSheet"
      title={content.title}
      onRequestClose={handleDismiss}
    >
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.body}>
          <Txt variant="title" header>
            {content.title}
          </Txt>
          {content.steps.map((step) => (
            <View key={step.title} style={styles.step}>
              <View style={styles.icon}>
                <Icon name={step.icon} size={20} color={tokens.color.textBrand} />
              </View>
              <View style={styles.text}>
                <Txt variant="heading">{step.title}</Txt>
                <Txt variant="small" tone="muted">
                  {step.desc}
                </Txt>
              </View>
            </View>
          ))}
          <Button label={tr("ui.close")} size="lg" onPress={handleDismiss} />
        </ScrollView>
      </View>
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    backgroundColor: tokens.color.sheetBg,
  },
  body: {
    padding: tokens.space["5"],
    paddingBottom: tokens.space["10"],
    gap: tokens.space["4"],
  },
  step: { flexDirection: "row", gap: tokens.space["3"], alignItems: "flex-start" },
  icon: {
    width: tokens.touch.min,
    height: tokens.touch.min,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surfaceBrand,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: tokens.space["1"] },
});
