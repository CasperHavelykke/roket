import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Users } from 'lucide-react-native';
import { distanceBetween } from 'geofire-common';
import GradientView from '../../components/GradientView';
import TagIcon from '../../components/TagIcon';
import { useTheme } from '../../theme';
import { EventDoc } from '../../events';
import { formatDistance } from '../../utils/distance';
import { formatTime, LOCALE_MAP } from '../../utils/eventTime';

// Drawerens synlige højde i kollapset tilstand (håndtag + tæller-linje)
export const DRAWER_COLLAPSED_HEIGHT = 64;

// Stiv, overdæmpet fjeder: kontant snap uden efter-sving.
// overshootClamping dræber det "flyvende" gyng en blødere fjeder giver.
const SNAP_SPRING = { damping: 28, stiffness: 350, overshootClamping: true };

interface ActivityDrawerProps {
  // Aktiviteter i det valgte tidsvindue (samme liste som kortets pins)
  activities: EventDoc[];
  headerText: string;
  userLocation: { latitude: number; longitude: number } | null;
  onSelect: (event: EventDoc) => void;
  // Løft over bundnavigationen — når sat dækker nav-baren safe area,
  // så drawerens egen bund-inset udgår
  bottomOffset?: number;
}

/**
 * Pull-up liste over aktiviteter — egen bottom-sheet på Reanimated + RNGH.
 * Bevidst IKKE @gorhom/bottom-sheet (silent fail på RN 0.83 + Reanimated 4
 * + Fabric). Gesture-koordinering holdt simpel: kun håndtags-/header-området
 * trækker i sheetet; listen scroller frit selv. Det undgår hele
 * simultaneousHandlers-problemfeltet.
 */
export default function ActivityDrawer({
  activities,
  headerText,
  userLocation,
  onSelect,
  bottomOffset = 0,
}: ActivityDrawerProps) {
  const { colors, t, language, timeFormat, distanceUnit } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  const collapsedH = DRAWER_COLLAPSED_HEIGHT + (bottomOffset > 0 ? 0 : insets.bottom);
  const halfH = Math.round(screenH * 0.42);
  const openH = Math.round(screenH * 0.82) - bottomOffset;

  // translateY: 0 = helt åben; (openH - collapsedH) = kollapset
  const collapsedY = openH - collapsedH;
  const halfY = openH - halfH;
  const translateY = useSharedValue(collapsedY);
  const startY = useSharedValue(collapsedY);

  const pan = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      startY.value = translateY.value;
    })
    .onUpdate(e => {
      'worklet';
      translateY.value = Math.min(Math.max(startY.value + e.translationY, 0), collapsedY);
    })
    .onEnd(e => {
      'worklet';
      // Projicér positionen lidt frem ad velociteten og snap til nærmeste punkt
      const projected = translateY.value + e.velocityY * 0.15;
      const snaps = [0, halfY, collapsedY];
      let target = snaps[0];
      for (const s of snaps) {
        if (Math.abs(s - projected) < Math.abs(target - projected)) target = s;
      }
      translateY.value = withSpring(target, SNAP_SPRING);
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const sorted = useMemo(
    () => [...activities].sort((a, b) => a.time.getTime() - b.time.getTime()),
    [activities],
  );

  const locale = LOCALE_MAP[language] ?? 'en-GB';
  const hour12 = timeFormat === '12h';

  const renderRow = ({ item }: { item: EventDoc }) => {
    const distanceKm = userLocation
      ? distanceBetween(
          [userLocation.latitude, userLocation.longitude],
          [item.location.latitude, item.location.longitude],
        )
      : null;
    const parts = [
      formatTime(item.time, t, locale, hour12),
      distanceKm != null ? formatDistance(distanceKm, t, distanceUnit) : null,
    ].filter(Boolean);

    return (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: colors.borderLight }]}
        onPress={() => {
          // Kollaps sheetet når detaljen åbner — aldrig to åbne lag oven på hinanden
          translateY.value = withSpring(collapsedY, SNAP_SPRING);
          onSelect(item);
        }}
        activeOpacity={0.7}
      >
        <GradientView
          colors={[colors.primaryBlue, colors.primaryRed]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.rowIcon}
        >
          {item.tag && <TagIcon tag={item.tag} size={16} color="#fff" strokeWidth={2.2} />}
        </GradientView>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {parts.join(' · ')}
          </Text>
        </View>
        <View style={styles.rowCount}>
          <Users size={13} color={colors.textMuted} strokeWidth={2} />
          <Text style={[styles.rowCountText, { color: colors.textMuted }]}>
            {item.participantIds.length}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View
      style={[
        styles.sheet,
        { height: openH, bottom: bottomOffset, backgroundColor: colors.cardBackground },
        sheetStyle,
      ]}
    >
      <GestureDetector gesture={pan}>
        <View style={styles.header}>
          <View style={[styles.handle, { backgroundColor: colors.textMuted }]} />
          <Text style={[styles.headerText, { color: colors.textPrimary }]}>{headerText}</Text>
        </View>
      </GestureDetector>

      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        renderItem={renderRow}
        contentContainerStyle={{ paddingBottom: (bottomOffset > 0 ? 0 : insets.bottom) + 24 }}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>{t.mapDrawerEmpty}</Text>
        }
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
    marginBottom: 10,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    marginLeft: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowMeta: {
    fontSize: 12.5,
    marginTop: 1,
  },
  rowCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  rowCountText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 28,
  },
});
