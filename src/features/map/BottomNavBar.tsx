import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Map as MapIcon,
  MessagesSquare as MessagesIcon,
  Plus,
  SquarePen,
  User as ProfileIcon,
  Settings as SettingsIcon,
} from 'lucide-react-native';
import GradientView from '../../components/GradientView';
import { useTheme } from '../../theme';
import { requireAccount } from '../../utils/guestGate';
import useUnreadTotal from '../../hooks/useUnreadTotal';

export const NAV_BAR_CONTENT_HEIGHT = 64;
const FAB_SIZE = 54;
const FAB_RAISE = 14;
const ICON_SIZE = 23;

/**
 * Persistent bundnavigation — custom tabBar for MainTabs (redesign 2026-07).
 * Kort er hjemmefanen; Beskeder/Profil er gæste-gatede; Mere (settings) er
 * åben. Midterknappen er FANENS PRIMÆRE HANDLING: opret aktivitet overalt,
 * undtagen på Profil hvor den bliver til rediger-blyanten. Aktivt ikon og
 * label får skærmkant-gradienten i selve stregen via MaskedView.
 */
export default function BottomNavBar({ state, navigation }: BottomTabBarProps) {
  const { colors, t } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { total: unreadTotal } = useUnreadTotal();

  const activeRoute = state.routes[state.index].name;

  // Fanernes positioner måles så gradient-maskerne kan vise den rigtige
  // slice af en gradient der spænder over hele skærmbredden
  const [tabLefts, setTabLefts] = useState<Record<string, { x: number; width: number }>>({});

  const gradientFor = (routeName: string, width: number) => {
    const layout = tabLefts[routeName];
    const left = layout ? layout.x + (layout.width - width) / 2 : 0;
    return {
      start: { x: -left / width, y: 0 },
      end: { x: (screenWidth - left) / width, y: 0 },
    };
  };

  const tab = (
    routeName: string,
    icon: React.ReactElement,
    label: string,
    onPress: () => void,
    badge?: number,
  ) => {
    const active = activeRoute === routeName;
    const iconGradient = gradientFor(routeName, ICON_SIZE);
    return (
      <TouchableOpacity
        key={routeName}
        style={styles.tab}
        onPress={onPress}
        activeOpacity={0.7}
        onLayout={e => {
          // Træk værdierne ud FØR setState — synthetic events genbruges,
          // så e.nativeEvent er null når updater-callbacken kører
          const { x, width } = e.nativeEvent.layout;
          setTabLefts(prev => ({ ...prev, [routeName]: { x, width } }));
        }}
      >
        <View style={styles.iconSlot}>
          {active ? (
            // Gradient i selve ikon-stregen: ikonet er masken, gradienten fylder
            <MaskedView maskElement={icon}>
              <GradientView
                colors={[colors.primaryBlue, colors.primaryRed]}
                {...iconGradient}
                style={{ width: ICON_SIZE, height: ICON_SIZE }}
              />
            </MaskedView>
          ) : (
            icon
          )}
          {!!badge && (
            <View style={[styles.badge, { backgroundColor: colors.primaryRed, borderColor: colors.white }]}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </View>
        {active ? (
          <MaskedView
            maskElement={<Text style={[styles.tabLabel, styles.tabLabelActive]}>{label}</Text>}
          >
            <GradientView
              colors={[colors.primaryBlue, colors.primaryRed]}
              {...gradientFor(routeName, 56)}
              style={styles.labelFill}
            />
          </MaskedView>
        ) : (
          <Text style={[styles.tabLabel, { color: colors.textMuted }]}>{label}</Text>
        )}
      </TouchableOpacity>
    );
  };

  // Midterknappen: rediger-blyant på Profil-fanen, ellers opret aktivitet.
  // Opret hopper til Kort-fanen og signalerer pin-picker via param.
  const onCenterPress = () => {
    if (!requireAccount(navigation as any, t)) return;
    if (activeRoute === 'MyProfile') {
      navigation.navigate('EditProfile' as never);
    } else {
      (navigation as any).navigate('MapHome', { createRequest: Date.now() });
    }
  };

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
      {tab(
        'MapHome',
        <MapIcon size={ICON_SIZE} color={activeRoute === 'MapHome' ? '#000' : colors.textMuted} strokeWidth={2.2} />,
        t.navMap,
        () => navigation.navigate('MapHome' as never),
      )}
      {tab(
        'ChatsList',
        <MessagesIcon size={ICON_SIZE} color={activeRoute === 'ChatsList' ? '#000' : colors.textMuted} strokeWidth={2} />,
        t.navMessages,
        // Gæster må gerne KIGGE (tom tilstand med CTA) — kun handlinger er gated
        () => navigation.navigate('ChatsList' as never),
        unreadTotal,
      )}

      <TouchableOpacity onPress={onCenterPress} activeOpacity={0.85} style={[styles.fabWrap, { borderColor: colors.white }]}>
        <GradientView
          colors={[colors.primaryBlue, colors.primaryRed]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabInner}
        >
          {activeRoute === 'MyProfile' ? (
            <SquarePen size={23} color="#fff" strokeWidth={2.4} />
          ) : (
            <Plus size={26} color="#fff" strokeWidth={2.6} />
          )}
        </GradientView>
      </TouchableOpacity>

      {tab(
        'MyProfile',
        <ProfileIcon size={ICON_SIZE} color={activeRoute === 'MyProfile' ? '#000' : colors.textMuted} strokeWidth={2} />,
        t.navProfile,
        // Gæster ser en eksempel-profil med opret-CTA
        () => navigation.navigate('MyProfile' as never),
      )}
      {tab(
        'Settings',
        <SettingsIcon size={ICON_SIZE} color={activeRoute === 'Settings' ? '#000' : colors.textMuted} strokeWidth={2} />,
        t.navMore,
        () => navigation.navigate('Settings' as never),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingTop: 11,
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
    textAlign: 'center',
    width: 56,
  },
  labelFill: {
    width: 56,
    height: 13,
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
