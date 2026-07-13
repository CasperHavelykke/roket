import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { EventDoc } from '../../events';
import useUserProfiles from '../../hooks/useUserProfiles';
import ActivityCard, { ACTIVITY_CARD_AVATARS } from '../../components/ActivityCard';
import EventDetailContent from '../events/EventDetailContent';
import TimeScrubber from './TimeScrubber';
import { TimeWindow } from './scrubberTime';

// Drawerens synlige højde i kollapset tilstand:
// håndtag + tidsvindue-scrubber + tæller-linje
export const DRAWER_COLLAPSED_HEIGHT = 150;

// Stiv, overdæmpet fjeder: kontant snap uden efter-sving.
// overshootClamping dræber det "flyvende" gyng en blødere fjeder giver.
const SNAP_SPRING = { damping: 28, stiffness: 350, overshootClamping: true };

interface ActivityDrawerProps {
  // Aktiviteter i det valgte tidsvindue (samme liste som kortets pins)
  activities: EventDoc[];
  // ALLE aktiviteter i viewporten — scrubberens prikker skal også vise
  // dem uden for vinduet
  allActivities: EventDoc[];
  headerText: string;
  userLocation: { latitude: number; longitude: number } | null;
  onSelect: (event: EventDoc) => void;
  timeWindow: TimeWindow;
  onChangeWindow: (window: TimeWindow) => void;
  // Detalje-i-drawer (redesign 2026-07): når sat bladrer draweren til
  // detaljen for den valgte aktivitet i stedet for listen
  selected: EventDoc | null;
  onCloseDetail: () => void;
  onOpenChat: (chatId: string, eventTitle: string) => void;
  onRequireAccount: () => void;
}

/**
 * Pull-up liste over aktiviteter — egen bottom-sheet på Reanimated + RNGH.
 * Bevidst IKKE @gorhom/bottom-sheet (silent fail på RN 0.83 + Reanimated 4
 * + Fabric).
 *
 * Gesture-koordinering: HELE drawerens flade trækker i sheetet. Listen
 * scroller kun selv når sheetet er helt åbent; er den scrollet ned, ruller
 * et nedad-træk den først til toppen, hvorefter sheetet overtager glat
 * (re-anker-teknikken i pan.onUpdate). Scrubberen claimer kun vandrette
 * træk (activeOffsetX/failOffsetY), så lodrette træk på den går til sheetet.
 */
export default function ActivityDrawer({
  activities,
  allActivities,
  headerText,
  userLocation,
  onSelect,
  timeWindow,
  onChangeWindow,
  selected,
  onCloseDetail,
  onOpenChat,
  onRequireAccount,
}: ActivityDrawerProps) {
  const { colors, t } = useTheme();
  const { height: screenH } = useWindowDimensions();

  // Draweren lever i en tab-scene der slutter ved nav-baren — bottom:0 er
  // nav-barens overkant, og safe area er nav-barens problem
  const collapsedH = DRAWER_COLLAPSED_HEIGHT;
  const halfH = Math.round(screenH * 0.42);
  const openH = Math.round(screenH * 0.78);

  // translateY: 0 = helt åben; (openH - collapsedH) = kollapset
  const collapsedY = openH - collapsedH;
  const halfY = openH - halfH;
  const translateY = useSharedValue(collapsedY);
  const startY = useSharedValue(collapsedY);

  // Vælges en aktivitet, bladrer draweren til detaljen og åbner op;
  // tilbage til listen efterlader den på halv højde. Ref-vagten sikrer
  // at mount ikke flytter draweren fra sin kollapsede startposition.
  const prevSelected = useRef<EventDoc | null>(null);
  useEffect(() => {
    if (selected) {
      translateY.value = withSpring(0, SNAP_SPRING);
    } else if (prevSelected.current) {
      translateY.value = withSpring(halfY, SNAP_SPRING);
    }
    prevSelected.current = selected;
    // Ny scroll-flade (liste↔detalje) starter altid i toppen — en hængende
    // offset fra den forrige ville blokere nedad-handoff'et
    scrollOffset.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Listen må kun selv scrolle når sheetet er helt åbent — ellers er et
  // lodret træk på listen et træk i sheetet
  const [listScrollable, setListScrollable] = useState(false);
  const scrollOffset = useSharedValue(0);
  useAnimatedReaction(
    () => translateY.value < 1,
    (fullyOpen, prev) => {
      if (fullyOpen !== prev) runOnJS(setListScrollable)(fullyOpen);
    },
  );
  const onListScroll = useAnimatedScrollHandler(e => {
    scrollOffset.value = e.contentOffset.y;
  });
  const listNative = Gesture.Native();
  // Detaljens ScrollView koordineres med samme mekanik som listen —
  // liste og detalje er aldrig aktive samtidig, så de deler scrollOffset
  const detailNative = Gesture.Native();

  const pan = Gesture.Pan()
    // Kun lodrette træk — taps på kort og vandrette scrub-træk går igennem
    .activeOffsetY([-12, 12])
    .simultaneousWithExternalGesture(listNative, detailNative)
    .onBegin(() => {
      'worklet';
      startY.value = translateY.value;
    })
    .onUpdate(e => {
      'worklet';
      // Helt åben og listen har bolden (opad-træk, eller nedad-træk mens
      // listen stadig er scrollet): re-anker løbende, så sheetet overtager
      // uden hop i det øjeblik listen rammer toppen
      if (translateY.value < 1 && (e.translationY < 0 || scrollOffset.value > 0)) {
        startY.value = -e.translationY;
        return;
      }
      translateY.value = Math.min(Math.max(startY.value + e.translationY, 0), collapsedY);
    })
    .onEnd(e => {
      'worklet';
      // Slip mens listen stadig er scrollet: gesturen var et liste-scroll,
      // ikke et sheet-træk — lad være at fling-snappe sheetet i gulvet
      if (translateY.value < 1 && scrollOffset.value > 0) return;
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

  // Avatar-stakken viser de første deltagere pr. kort — ét batched opslag
  // for alle kort via session-cachen i useUserProfiles
  const avatarUids = useMemo(
    () => [...new Set(sorted.flatMap(ev => ev.participantIds.slice(0, ACTIVITY_CARD_AVATARS)))],
    [sorted],
  );
  const { profiles } = useUserProfiles(avatarUids);

  const renderRow = ({ item }: { item: EventDoc }) => (
    <ActivityCard
      event={item}
      profiles={profiles}
      userLocation={userLocation}
      onPress={() => onSelect(item)}
    />
  );

  return (
    <Animated.View
      style={[
        styles.sheet,
        { height: openH, backgroundColor: colors.white },
        sheetStyle,
      ]}
    >
      {selected ? (
        /* Detalje-tilstand: draweren "bladrer videre" — tilbage-pil til
            listen, scrubberen er skjult imens. Hele fladen trækker (samme
            handoff-mekanik som listen: detaljen scroller kun selv når
            sheetet er helt åbent) */
        <GestureDetector gesture={pan}>
          <View style={styles.grabSurface}>
            <View style={styles.handleArea}>
              <View style={[styles.handle, { backgroundColor: colors.textMuted }]} />
            </View>
            <TouchableOpacity style={styles.backRow} onPress={onCloseDetail} activeOpacity={0.7}>
              <ArrowLeft size={20} color={colors.textMuted} strokeWidth={2.2} />
              <Text style={[styles.backText, { color: colors.textMuted }]}>{t.drawerBackToList}</Text>
            </TouchableOpacity>
            <View style={styles.detailWrap}>
              <EventDetailContent
                event={selected}
                onClose={onCloseDetail}
                onOpenChat={onOpenChat}
                onRequireAccount={onRequireAccount}
                sheetScrollGesture={detailNative}
                onSheetScroll={onListScroll}
                sheetScrollEnabled={listScrollable}
              />
            </View>
          </View>
        </GestureDetector>
      ) : (
        <GestureDetector gesture={pan}>
          <View style={styles.grabSurface}>
            <View style={styles.handleArea}>
              <View style={[styles.handle, { backgroundColor: colors.textMuted }]} />
            </View>

            {/* Tidsvinduet bor i drawerens top (redesign 2026-07) — scrubberen
                claimer kun vandrette træk, lodrette går til sheetet */}
            <TimeScrubber activities={allActivities} value={timeWindow} onChange={onChangeWindow} />

            <View style={[styles.countRow, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.headerText, { color: colors.textPrimary }]}>{headerText}</Text>
            </View>

            <GestureDetector gesture={listNative}>
              <Animated.FlatList
                data={sorted}
                keyExtractor={item => item.id}
                renderItem={renderRow}
                scrollEnabled={listScrollable}
                onScroll={onListScroll}
                scrollEventThrottle={16}
                // Ingen bounce/overscroll i toppen — nedad-træk ved offset 0
                // skal gå rent videre til sheetet
                bounces={false}
                overScrollMode="never"
                contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 16 }}
                ListEmptyComponent={
                  <Text style={[styles.empty, { color: colors.textMuted }]}>{t.mapDrawerEmpty}</Text>
                }
              />
            </GestureDetector>
          </View>
        </GestureDetector>
      )}
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
  grabSurface: {
    flex: 1,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 9,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderTopWidth: 1,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailWrap: {
    flex: 1,
    paddingHorizontal: 18,
    // Luft mellem CTA-rækken (Join/Chat) og nav-baren
    paddingBottom: 26,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '800',
  },
  empty: {
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 28,
  },
});
