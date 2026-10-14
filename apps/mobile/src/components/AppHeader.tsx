import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { CompassIcon, SearchIcon, UserIcon } from './Icons';

interface AppHeaderProps {
  onPressSearch?: () => void;
  onPressProfile?: () => void;
  hideActions?: boolean;
}

export function AppHeader({ onPressSearch, onPressProfile, hideActions }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      {/* Brand Identity */}
      <View style={styles.brandRow}>
        <View style={styles.brandIconWrap}>
          <CompassIcon size={20} color="#ffffff" />
        </View>
        <View style={styles.brandTextWrap}>
          <Text style={styles.brandTitle}>MapsBridge</Text>
          <Text style={styles.brandSubtitle}>BOTANICAL ATELIER</Text>
        </View>
      </View>

      {/* Header Actions: Search & Profile */}
      {!hideActions && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onPressSearch}
            accessibilityLabel="Arama"
            activeOpacity={0.7}
          >
            <SearchIcon size={20} color="#404945" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileButton}
            onPress={onPressProfile}
            accessibilityLabel="Profilim"
            activeOpacity={0.7}
          >
            <View style={styles.profileAvatar}>
              <UserIcon size={16} color="#ffffff" />
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(250, 248, 255, 0.96)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    zIndex: 50,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#013628',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextWrap: {
    flexDirection: 'column',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#013628',
    letterSpacing: -0.3,
    lineHeight: 18,
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#286954',
    letterSpacing: 1.2,
    lineHeight: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  profileButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#013628',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
