import React from "react";
import { StyleSheet, Text, View, TouchableOpacity, Platform } from "react-native";
import { MobileTab } from "../types";
import { MapIcon, CalendarIcon, SparkIcon, ExploreIcon, ProfileIcon } from "./Icons";

import { tokens } from "../theme";
interface BottomTabBarProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
}

export function BottomTabBar({ activeTab, onSelectTab }: BottomTabBarProps) {
  const isIOS = Platform.OS === "ios";

  const TABS: { id: MobileTab; label: string; icon: (color: string) => React.ReactNode }[] = [
    {
      id: "map",
      label: "Harita",
      icon: (color) => <MapIcon size={22} color={color} />,
    },
    {
      id: "plan",
      label: "Rotalarım",
      icon: (color) => <CalendarIcon size={22} color={color} />,
    },
    {
      id: "ai",
      label: "AI Asistan",
      icon: (color) => <SparkIcon size={22} color={color} />,
    },
    {
      id: "community",
      label: "Topluluk",
      icon: (color) => <ExploreIcon size={22} color={color} />,
    },
    {
      id: "profile",
      label: "Profil",
      icon: (color) => <ProfileIcon size={22} color={color} />,
    },
  ];

  return (
    <View
      style={[styles.container, isIOS ? styles.iosContainer : styles.androidContainer]}
      accessibilityRole="tabbar"
    >
      <View style={styles.barTrack}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const activeColor = tokens.color.textBrand;
          const inactiveColor = tokens.color.textSubtle;

          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => onSelectTab(tab.id)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <View style={[styles.iconWrap, isActive && styles.activeIconWrap]}>
                {tab.icon(isActive ? activeColor : inactiveColor)}
              </View>

              <Text
                style={[styles.tabLabel, isActive ? styles.activeLabel : styles.inactiveLabel]}
                maxFontSizeMultiplier={tokens.font.maxScale.compact}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
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
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 20,
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
    height: 52,
    paddingHorizontal: 8,
    width: "100%",
  },
  tabItem: {
    minHeight: tokens.touch.min,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  iconWrap: {
    width: 38,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIconWrap: {
    backgroundColor: tokens.color.surfaceBrand,
    borderRadius: 14,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  activeLabel: {
    color: tokens.color.textBrand,
    fontWeight: "700",
  },
  inactiveLabel: {
    color: tokens.color.textSubtle,
    fontWeight: "500",
  },
});
