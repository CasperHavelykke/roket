import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Map as MapIcon,
  MessagesSquare as MessagesIcon,
  Plus,
  User as ProfileIcon,
  Settings as SettingsIcon,
} from 'lucide-react-native';
import GradientView from '../../components/GradientView';
import { useTheme } from '../../theme';

export const NAV_BAR_CONTENT_HEIGHT = 64;
const FAB_SIZE = 54;
const FAB_RAISE = 14;

interface BottomNavBarProps {
  unreadTotal: number;
  onMessages: () => void;
  onCreate: () => void;
  onProfile: () => void;
  onMore: () => void;
}

/**
 * Bundnavigation på forsiden (redesign 2026-07). Kort-fanen er altid aktiv —
 * MapHome ER hjemmeskærmen; de øvrige faner navigerer til deres skærme.
 * Midterknappen (opret) bruger skærmkant til skærmkant-gradienten ligesom
 * appens øvrige FABs.
 */
export default function BottomNavBar({
  unreadTotal,
  onMessages,
  onCreate,
  onProfile,
  onMore,
}: BottomNavBarProps) {
  const { colors, t } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  // Skærmkant-gradient: midterknappen viser sin slice af en gradient der
  // spænder over hele skærmbredden
  const fabLeft = (screenWidth - FAB_SIZE) / 2;

  const tab = (
    icon: React.ReactNode,
    label: string,
    onPress: (() => void) | undefined,
    opts?: { active?: boolean; badge?: number },
  ) => (
    <TouchableOpacity
      style={styles.tab}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View>
        {icon}
        {!!opts?.badge && (
          <View style={[styles.badge, { backgroundColor: colors.primaryRed, borderColor: colors.white }]}>
            <Text style={styles.badgeText}>{opts.badge > 9 ? '9+' : opts.badge}</Text>
          </View>
        )}
      </View>
      <Text
        style={[
          styles.tabLabel,
          { color: opts?.active ? colors.primaryRed : colors.textMuted },
          opts?.active && styles.tabLabelActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View
      style={[
        styles.bar,
        {
          height: NAV_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: colors.white,
          borderTopColor: colors.borderLight,
        },
      ]}
    >
      {tab(<MapIcon size={23} color={colors.primaryRed} strokeWidth={2} />, t.navMap, undefined, { active: true })}
      {tab(<MessagesIcon size={23} color={colors.textMuted} strokeWidth={2} />, t.navMessages, onMessages, { badge: unreadTotal })}

      <TouchableOpacity onPress={onCreate} activeOpacity={0.85} style={[styles.fabWrap, { borderColor: colors.white }]}>
        <GradientView
          colors={[colors.primaryBlue, colors.primaryRed]}
          start={{ x: -fabLeft / FAB_SIZE, y: 0 }}
          end={{ x: (screenWidth - fabLeft) / FAB_SIZE, y: 0 }}
          style={styles.fabInner}
        >
          <Plus size={26} color="#fff" strokeWidth={2.6} />
        </GradientView>
      </TouchableOpacity>

      {tab(<ProfileIcon size={23} color={colors.textMuted} strokeWidth={2} />, t.navProfile, onProfile)}
      {tab(<SettingsIcon size={23} color={colors.textMuted} strokeWidth={2} />, t.navMore, onMore)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingTop: 11,
    zIndex: 10,
  },
  tab: {
    alignItems: 'center',
    gap: 3,
    minWidth: 56,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  fabWrap: {
    width: FAB_SIZE + 6,
    height: FAB_SIZE + 6,
    marginTop: -FAB_RAISE - 11,
    borderRadius: (FAB_SIZE + 6) / 2,
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  fabInner: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    ...Platform.select({ android: { overflow: 'hidden' as const } }),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
