import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useDerivedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import GradientView from '../../components/GradientView';
import { useTheme } from '../../theme';
import useNow from '../../hooks/useNow';
import { EventDoc, VISIBLE_WINDOW_MINUTES, eventEndsAt, overlapsWindow } from '../../events';
import {
  TimeWindow,
  AXIS_MINUTES,
  NOW_SNAP_MINUTES,
  axisStart,
  axisEnd,
  fractionForTime,
  fractionForWindow,
  windowForFraction,
} from './scrubberTime';

// Striberne i fortids-zonen (mockup-hatch): tynde diagonale streger
const STRIPE_SPACING = 7;
const STRIPE_WIDTH = 3;

// ReText-mønsteret: en ikke-redigerbar TextInput hvis tekst sættes via
// animatedProps — så kan readouten opdatere på UI-tråden under drag,
// uden en eneste React-render.
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface TimeScrubberProps {
  // Ufiltrerede aktiviteter i viewporten — bruges til prikkerne på aksen
  activities: EventDoc[];
  value: TimeWindow;
  onChange: (window: TimeWindow) => void;
}

// Formatér minutter-på-døgnet (kan overstige 1440 hen over midnat).
// Ren aritmetik så samme funktion kan køre som worklet på UI-tråden.
function formatMinutes(totalMinutes: number, use24h: boolean): string {
  'worklet';
  const minutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const mmStr = mm < 10 ? `0${mm}` : `${mm}`;
  if (use24h) {
    return `${hh < 10 ? `0${hh}` : `${hh}`}:${mmStr}`;
  }
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${mmStr} ${hh < 12 ? 'AM' : 'PM'}`;
}

/**
 * Tidsvinduet i drawerens top (redesign 2026-07): fast døgnakse 06→06,
 * fortiden markeret som låst, og synligheds-vinduet som en gradient-kapsel
 * man trækker langs aksen. Readouten ("Nu → 13:24") følger med live.
 *
 * Kapsel + readout følger fingeren pr. frame (Reanimated, UI-tråden).
 * Vinduet committes LIVE under trækket, men kun når det kvarter-rundede
 * vindue faktisk ændrer sig (bucket-vagten) — så kortets pins og
 * drawer-listen re-filtreres en håndfuld gange pr. træk, ikke 60/s.
 */
export default function TimeScrubber({ activities, value, onChange }: TimeScrubberProps) {
  const { colors, t, timeFormat } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  // Tikkende nu (30 s): uden det frøs NU-markør, striber, readout og
  // akse på render-tidspunktet — efter længere tid på skærmen viste
  // scrubberen en forkert "nutid", og det committede vindue ≠ det viste
  const now = useNow();
  const axisStartDate = axisStart(now);
  const nowFraction = fractionForTime(now, now);
  const windowFraction = VISIBLE_WINDOW_MINUTES / AXIS_MINUTES;
  const maxFraction = Math.max(1 - windowFraction, nowFraction);
  const use24h = timeFormat === '24h';
  const nowLabel = t.mapScrubNow;

  // Ren aritmetik til worklet'en — Date-API'er undgås på UI-tråden.
  // Aksen starter altid på en hel time, så minutter-på-døgnet er nok.
  const axisStartMinutesOfDay = axisStartDate.getHours() * 60;
  const nowSnapFraction = nowFraction + NOW_SNAP_MINUTES / AXIS_MINUTES;
  // "Nu → HH:MM" — slut-tiden for NU-vinduet er fast pr. render
  const nowReadout = `${nowLabel} → ${formatMinutes(now.getHours() * 60 + now.getMinutes() + VISIBLE_WINDOW_MINUTES, use24h)}`;

  const fraction = useSharedValue(fractionForWindow(value, now));
  const isScrubbing = useSharedValue(false);
  // Sidst committede kvarter-bucket — live-commits fyrer kun på bucket-skift
  const committedBucket = useSharedValue<number | null>(null);

  // Hold kapslen i sync hvis vinduet sættes udefra (fx nulstilles til NU) —
  // men IKKE under drag: dér er live-commits selv årsag til prop-ændringen,
  // og en withTiming ville rykke kapslen væk fra fingeren. `now` er med i
  // deps: aksen ruller, så NU-kapslen skal glide med ved hvert tick.
  useEffect(() => {
    if (isScrubbing.value) return;
    fraction.value = withTiming(fractionForWindow(value, now), { duration: 180 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, now]);

  const commit = (f: number) => {
    onChange(windowForFraction(f, new Date(), VISIBLE_WINDOW_MINUTES));
  };

  // Fingeren styrer kapslens MIDTE — venstre-kant-forankring føles som om
  // kapslen hopper væk fra grebet
  const halfWindowFraction = windowFraction / 2;

  // Flyt kapslen til finger-x og live-commit hvis det kvarter-rundede
  // vindue har flyttet sig. Bucket-vagten spejler commit'ens egen runding
  // (inkl. NU-snap-zonen), så vi aldrig committer to ens vinduer i træk.
  const scrubTo = (x: number) => {
    'worklet';
    if (trackWidth <= 0) return;
    fraction.value = Math.min(Math.max(x / trackWidth - halfWindowFraction, nowFraction), maxFraction);
    const bucket =
      fraction.value <= nowSnapFraction
        ? -1
        : Math.round((fraction.value * AXIS_MINUTES) / 15);
    if (bucket !== committedBucket.value) {
      committedBucket.value = bucket;
      runOnJS(commit)(fraction.value);
    }
  };

  // Pan'en claimer kun VANDRETTE træk og opgiver lodrette — dem skal
  // drawerens sheet-pan have (hele draweren er træk-flade). Kapslen
  // placeres først ved aktivering (onStart), ikke ved touch-down, så et
  // lodret træk hen over scrubberen ikke flytter vinduet. Ingen commit i
  // onFinalize — en fejlet (lodret) gesture må ikke committe.
  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-14, 14])
    .onStart(e => {
      'worklet';
      isScrubbing.value = true;
      committedBucket.value = null;
      scrubTo(e.x);
    })
    .onUpdate(e => {
      'worklet';
      scrubTo(e.x);
    })
    .onEnd(() => {
      'worklet';
      runOnJS(commit)(fraction.value);
    })
    .onFinalize(() => {
      'worklet';
      // Altid — også når gesturen fejler/annulleres, ellers forbliver
      // sync-effekten slukket
      isScrubbing.value = false;
    });

  // Tap-til-placering (før: onBegin-hoppet) — nu en separat tap-gesture,
  // så den ikke kolliderer med sheet-trækket
  const tap = Gesture.Tap().onEnd(e => {
    'worklet';
    if (trackWidth > 0) {
      fraction.value = Math.min(Math.max(e.x / trackWidth - halfWindowFraction, nowFraction), maxFraction);
      runOnJS(commit)(fraction.value);
    }
  });

  const scrubGesture = Gesture.Race(pan, tap);

  // Readout formatteres som et slip ville committe (kvarter-rundet)
  const readout = useDerivedValue(() => {
    const f = fraction.value;
    if (f <= nowSnapFraction) {
      return nowReadout;
    }
    const startMinutes = Math.round((axisStartMinutesOfDay + f * AXIS_MINUTES) / 15) * 15;
    return `${formatMinutes(startMinutes, use24h)} → ${formatMinutes(startMinutes + VISIBLE_WINDOW_MINUTES, use24h)}`;
  });

  const readoutProps = useAnimatedProps(() => ({ text: readout.value } as any));

  const capsuleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: fraction.value * trackWidth }],
  }));

  // Prik pr. aktivitets-starttid på døgnaksen. Events i det committede
  // vindue farves; resten er dæmpede. Grace-periode-events (slut men
  // ikke slettet) og events efter aksens slut udelades.
  const dots = useMemo(() => {
    const axisEndMs = axisEnd(now).getTime();
    const windowStart = value.mode === 'at' ? value.at : now;
    const buckets = new Map<number, boolean>();
    activities.forEach(ev => {
      if (ev.time.getTime() > axisEndMs) return;
      if (eventEndsAt(ev).getTime() < now.getTime()) return;
      const bucket = Math.round(fractionForTime(ev.time, now) * 40) / 40;
      const active = overlapsWindow(ev, windowStart);
      buckets.set(bucket, (buckets.get(bucket) ?? false) || active);
    });
    return [...buckets.entries()].map(([f, active]) => ({ f, active }));
  }, [activities, value, now]);

  // Timelabels følger tidsformatet — 06/12/18/00 i 24h, 6 AM/12 PM/… i 12h
  const axisHourText = (hour: number) =>
    use24h
      ? (hour < 10 ? `0${hour}` : `${hour}`)
      : `${hour % 12 === 0 ? 12 : hour % 12} ${hour % 24 < 12 ? 'AM' : 'PM'}`;

  const hourLabel = (hour: number, leftPct: number) => (
    <View key={leftPct} style={[styles.hourLabelBox, { left: `${leftPct}%` }]}>
      <Text style={[styles.hourLabel, { color: colors.textMuted }]}>{axisHourText(hour)}</Text>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={[styles.windowLabel, { color: colors.textMuted }]}>{t.scrubberWindowLabel}</Text>
        <AnimatedTextInput
          editable={false}
          defaultValue={nowReadout}
          animatedProps={readoutProps}
          style={[styles.readout, { color: colors.textPrimary }]}
        />
      </View>

      <GestureDetector gesture={scrubGesture}>
        <View
          style={styles.trackArea}
          onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
        >
          <View style={[styles.track, { backgroundColor: colors.borderLight }]} />
          {/* Fortiden: stribet, låst zone fra aksens start til nu — fader
              ud mod venstre kant */}
          {trackWidth > 0 && (
            <View pointerEvents="none" style={[styles.pastZone, { width: nowFraction * trackWidth }]}>
              {Array.from(
                { length: Math.ceil((nowFraction * trackWidth) / STRIPE_SPACING) + 2 },
                (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.stripe,
                      { left: i * STRIPE_SPACING, backgroundColor: colors.textMuted },
                    ]}
                  />
                ),
              )}
              {/* Fade mod venstre — farven skal matche drawerens sheet-baggrund */}
              <GradientView
                colors={[colors.white, `${colors.white}00`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          )}
          {dots.map(({ f, active }) => (
            <View
              key={f}
              pointerEvents="none"
              style={[
                styles.dot,
                { backgroundColor: active ? colors.primaryBlueText : colors.textMuted, left: `${f * 100}%` },
                !active && styles.dotInactive,
              ]}
            />
          ))}
          {/* Synligheds-vinduet: kapsel med gradient + markeret forkant */}
          <Animated.View
            pointerEvents="none"
            style={[styles.capsuleWrap, { width: Math.max(windowFraction * trackWidth, 1) }, capsuleStyle]}
          >
            <GradientView
              colors={[`${colors.primaryBlue}59`, `${colors.primaryRed}59`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.capsule}
            />
            <View style={[styles.capsuleEdge, { backgroundColor: colors.primaryBlueText }]} />
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.hourLabels}>
        <Text style={[styles.hourLabel, styles.hourLabelLeft, { color: colors.textMuted }]}>
          {axisHourText(axisStartDate.getHours())}
        </Text>
        {hourLabel((axisStartDate.getHours() + 6) % 24, 25)}
        {hourLabel((axisStartDate.getHours() + 12) % 24, 50)}
        {hourLabel((axisStartDate.getHours() + 18) % 24, 75)}
        <Text style={[styles.hourLabel, styles.hourLabelRight, { color: colors.textMuted }]}>
          {axisHourText(axisStartDate.getHours())}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  windowLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  readout: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    padding: 0,
    minWidth: 150,
  },
  trackArea: {
    height: 26,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
  },
  pastZone: {
    position: 'absolute',
    left: 0,
    top: 8,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  stripe: {
    position: 'absolute',
    top: -4,
    width: STRIPE_WIDTH,
    height: 18,
    opacity: 0.3,
    transform: [{ rotate: '35deg' }],
  },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: -3,
    top: 10,
  },
  dotInactive: {
    opacity: 0.55,
  },
  capsuleWrap: {
    position: 'absolute',
    left: 0,
    top: 3,
    height: 20,
  },
  capsule: {
    flex: 1,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
  },
  capsuleEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    opacity: 0.75,
  },
  hourLabels: {
    position: 'relative',
    height: 15,
    marginTop: 7,
  },
  // Midterlabels centreres om deres akse-position via en fast-bredde boks
  hourLabelBox: {
    position: 'absolute',
    width: 48,
    marginLeft: -24,
    alignItems: 'center',
  },
  hourLabel: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  hourLabelLeft: {
    position: 'absolute',
    left: 0,
  },
  hourLabelRight: {
    position: 'absolute',
    right: 0,
  },
});
