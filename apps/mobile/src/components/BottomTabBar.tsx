import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { MobileTab } from "../types";
import { TAB_ITEMS } from "../navigation/tab-items";
import { Icon } from "../ui";
import { fontFamily, tokens } from "../theme";

// Alt sekme çubuğu (design §5.3 tek IA, §9 "Ana gezinme"): web mobil alt menüsüyle aynı 5 öğe,
// aynı sıra, etiket ve ikon (navigation/tab-items.ts). Oturumsuz: Keşfet · Planla · Asistan ·
// Topluluk · Giriş; oturumlu: Planla · Asistan · Topluluk · Mesajlar · Profil.
interface BottomTabBarProps {
  tabs: readonly MobileTab[];
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
}

export function BottomTabBar({ tabs, activeTab, onSelectTab }: BottomTabBarProps) {
  const isIOS = Platform.OS === "ios";
  return (
    <View
      style={[styles.container, isIOS ? styles.iosContainer : styles.androidContainer]}
      accessibilityRole="tabbar"
    >
      <View style={styles.barTrack}>
        {tabs.map((id) => {
          const tab = TAB_ITEMS[id];
          const isActive = activeTab === id;
          const color = isActive ? tokens.color.tabsFgSelected : tokens.color.tabsFg;
          return (
            <Pressable
              key={id}
              style={({ pressed }) => [styles.tabItem, pressed ? styles.pressed : null]}
              onPress={() => onSelectTab(id)}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <View style={[styles.iconWrap, isActive && styles.activeIconWrap]}>
                <Icon name={tab.icon} size={24} color={color} />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  { color, fontFamily: fontFamily(isActive ? "bold" : "medium") },
                  isActive ? styles.activeLabel : styles.inactiveLabel,
                ]}
                maxFontSizeMultiplier={tokens.font.maxScale.compact}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.color.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
    zIndex: 100,
  },
  iosContainer: {
    paddingBottom: 28,
    paddingTop: 8,
  },
  androidContainer: {
    paddingBottom: 8,
    paddingTop: 6,
  },
  barTrack: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    minHeight: 52,
    paddingHorizontal: tokens.space["2"],
    width: "100%",
  },
  tabItem: {
    minHeight: tokens.touch.min,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  pressed: { opacity: 0.7 },
  iconWrap: {
    width: 48,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIconWrap: {
    backgroundColor: tokens.color.surfaceBrand,
    borderRadius: tokens.radius.full,
  },
  tabLabel: {
    fontSize: tokens.font.size["2xs"],
    marginTop: 2,
  },
  activeLabel: { fontWeight: tokens.font.weight.bold },
  inactiveLabel: { fontWeight: tokens.font.weight.medium },
});
