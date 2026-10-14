import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MobileTab } from '../types';
import { MapIcon, CalendarIcon, SparkIcon, ExploreIcon, ProfileIcon } from './Icons';

interface BottomTabBarProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
}

export function BottomTabBar({ activeTab, onSelectTab }: BottomTabBarProps) {
  const isIOS = Platform.OS === 'ios';

  const TABS: { id: MobileTab; label: string; icon: (color: string) => React.ReactNode }[] = [
    {
      id: 'map',
      label: 'Harita',
      icon: (color) => <MapIcon size={22} color={color} />,
    },
    {
      id: 'plan',
      label: 'Planım',
      icon: (color) => <CalendarIcon size={22} color={color} />,
    },
    {
      id: 'ai',
      label: 'AI Asistan',
      icon: (color) => <SparkIcon size={22} color={color} />,
    },
    {
      id: 'community',
      label: 'Keşfet',
      icon: (color) => <ExploreIcon size={22} color={color} />,
    },
    {
      id: 'profile',
      label: 'Profil',
      icon: (color) => <ProfileIcon size={22} color={color} />,
    },
  ];

  return (
    <View style={[styles.container, isIOS ? styles.iosContainer : styles.androidContainer]}>
      <View style={styles.barTrack}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const activeColor = '#013628';
          const inactiveColor = '#717974';

          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => onSelectTab(tab.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, isActive && styles.activeIconWrap]}>
                {tab.icon(isActive ? activeColor : inactiveColor)}
              </View>

              <Text
                style={[
                  styles.tabLabel,
                  isActive ? styles.activeLabel : styles.inactiveLabel,
                ]}
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
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#000000',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 52,
    paddingHorizontal: 8,
    width: '100%',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconWrap: {
    width: 38,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconWrap: {
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  activeLabel: {
    color: '#013628',
    fontWeight: '700',
  },
  inactiveLabel: {
    color: '#717974',
    fontWeight: '500',
  },
});
