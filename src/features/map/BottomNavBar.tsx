import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
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
const ICON_SIZE = 23;

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

  // Den aktive fanes position måles så ikonets og labelens skærmkant-gradient
  // kan vise den rigtige slice af en gradient der spænder over hele skærmbredden
  const [activeTabLayout, setActiveTabLayout] = useState({ x: 0, w: 0 });
  const [activeLabelWidth, setActiveLabelWidth] = useState(0);
  const activeIconLeft = activeTabLayout.x + (activeTabLayout.w - ICON_SIZE) / 2;
  const labelWidth = Math.max(activeLabelWidth, 1);
  const activeLabelLeft = activeTabLayout.x + (activeTabLayout.w - labelWidth) / 2;

  const tab = (
    icon: React.ReactElement,
    label: string,
    onPress: (() => void) | undefined,
    opts?: { active?: boolean; badge?: number },
  ) => (
    <TouchableOpacity
      style={styles.tab}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
      onLayout={
        opts?.active
          ? e => setActiveTabLayout({ x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width })
          : undefined
      }
    >
      <View style={styles.iconSlot}>
        {opts?.active ? (
          // Gradient i selve ikon-stregen: ikonet er masken, gradienten fylder
          <MaskedView maskElement={icon}>
            <GradientView
              colors={[colors.primaryBlue, colors.primaryRed]}
              start={{ x: -activeIconLeft / ICON_SIZE, y: 0 }}
              end={{ x: (screenWidth - activeIconLeft) / ICON_SIZE, y: 0 }}
              style={{ width: ICON_SIZE, height: ICON_SIZE }}
            />
          </MaskedView>
        ) : (
          icon
        )}
        {!!opts?.badge && (
          <View style={[styles.badge, { backgroundColor: colors.primaryRed, borderColor: colors.white }]}>
            <Text style={styles.badgeText}>{opts.badge > 9 ? '9+' : opts.badge}</Text>
          </View>
        )}
      </View>
      {opts?.active ? (
        <MaskedView
          onLayout={e => setActiveLabelWidth(e.nativeEvent.layout.width)}
          maskElement={<Text style={[styles.tabLabel, styles.tabLabelActive]}>{label}</Text>}
        >
          {/* Usynlig tekst giver masken sin størrelse; gradienten fylder den */}
          <Text style={[styles.tabLabel, styles.tabLabelActive, styles.sizer]}>{label}</Text>
          <GradientView
            colors={[colors.primaryBlue, colors.primaryRed]}
            start={{ x: -activeLabelLeft / labelWidth, y: 0 }}
            end={{ x: (screenWidth - activeLabelLeft) / labelWidth, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </MaskedView>
      ) : (
        <Text style={[styles.tabLabel, { color: colors.textMuted }]}>{label}</Text>
      )}
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
      {tab(<MapIcon size={ICON_SIZE} color="#000" strokeWidth={2.2} />, t.navMap, undefined, { active: true })}
      {tab(<MessagesIcon size={23} color={colors.textMuted} strokeWidth={2} />, t.navMessages, onMessages, { badge: unreadTotal })}

      <TouchableOpacity onPress={onCreate} activeOpacity={0.85} style={[styles.fabWrap, { borderColor: colors.white }]}>
        <GradientView
          colors={[colors.primaryBlue, colors.primaryRed]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
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
  iconSlot: {
    height: ICON_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  tabLabelActive: {
    fontWeight: '700',
    color: '#000',
  },
  sizer: {
    opacity: 0,
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
