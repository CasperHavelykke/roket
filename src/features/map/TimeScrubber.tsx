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
import { EventDoc } from '../../events';
import {
  TimeWindow,
  NOW_SNAP_FRACTION,
  fractionForTime,
  windowForFraction,
} from './scrubberTime';

const THUMB_SIZE = 22;
// Bred nok til den længste "nu"-label ("Maintenant") og "10:45 PM"
const CHIP_WIDTH = 80;

// ReText-mønsteret: en ikke-redigerbar TextInput hvis tekst sættes via
// animatedProps — så kan labelen opdatere på UI-tråden under drag,
// uden en eneste React-render.
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface TimeScrubberProps {
  // Ufiltrerede aktiviteter i viewporten — bruges til prikkerne på tracken
  activities: EventDoc[];
  value: TimeWindow;
  onChange: (window: TimeWindow) => void;
}

/**
 * Tidslinjen i bunden af kortet: NU ─●──●────●─── 24.
 *
 * Under drag opdateres kun thumb + label (Reanimated, UI-tråden).
 * Først ved slip committes vinduet via onChange — dét re-filtrerer
 * kortets pins. Adskillelsen holder gesturen på 60fps uanset hvor
 * dyr filtreringen er.
 */
export default function TimeScrubber({ activities, value, onChange }: TimeScrubberProps) {
  const { colors, t, timeFormat } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const now = new Date();
  // Ren aritmetik til worklet'en — Date-API'er undgås på UI-tråden
  const nowMinutesOfDay = now.getHours() * 60 + now.getMinutes();
  const spanMinutes = 24 * 60 - nowMinutesOfDay;
  const use24h = timeFormat === '24h';
  const nowLabel = t.mapScrubNow;

  const fraction = useSharedValue(value.mode === 'at' ? fractionForTime(value.at, now) : 0);

  // Hold thumben i sync hvis vinduet sættes udefra (fx nulstilles til NU)
  useEffect(() => {
    const target = value.mode === 'at' ? fractionForTime(value.at, new Date()) : 0;
    fraction.value = withTiming(target, { duration: 180 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (f: number) => {
    onChange(windowForFraction(f, new Date()));
  };

  const pan = Gesture.Pan()
    .onBegin(e => {
      'worklet';
      if (trackWidth > 0) {
        fraction.value = Math.min(Math.max(e.x / trackWidth, 0), 1);
      }
    })
    .onUpdate(e => {
      'worklet';
      if (trackWidth > 0) {
        fraction.value = Math.min(Math.max(e.x / trackWidth, 0), 1);
      }
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(commit)(fraction.value);
    });

  // Label formatteres med ren aritmetik (kvarter-rundet, som et slip vil committe)
  const label = useDerivedValue(() => {
    const f = fraction.value;
    if (f <= NOW_SNAP_FRACTION) {
      return nowLabel;
    }
    const minutes = Math.min(Math.round((nowMinutesOfDay + f * spanMinutes) / 15) * 15, 24 * 60);
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    const mmStr = mm < 10 ? `0${mm}` : `${mm}`;
    if (use24h) {
      return `${hh < 10 ? `0${hh}` : `${hh}`}:${mmStr}`;
    }
    const isAm = hh < 12 || hh === 24;
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12}:${mmStr} ${isAm ? 'AM' : 'PM'}`;
  });

  const labelProps = useAnimatedProps(() => ({ text: label.value } as any));

  const travel = Math.max(trackWidth - THUMB_SIZE, 0);
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: fraction.value * travel }],
  }));
  const chipStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: fraction.value * travel + THUMB_SIZE / 2 - CHIP_WIDTH / 2 }],
  }));

  // Prik pr. aktivitets-starttid; allerede igangværende lander på NU (0).
  // Deduperet i 2,5%-buckets så tætte tider ikke stabler identiske prikker.
  const dotFractions = useMemo(() => {
    const seen = new Set<number>();
    const dotNow = new Date();
    activities.forEach(ev => {
      seen.add(Math.round(fractionForTime(ev.time, dotNow) * 40) / 40);
    });
    return [...seen];
  }, [activities]);

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
      <Animated.View pointerEvents="none" style={[styles.chip, chipStyle]}>
        <AnimatedTextInput
          editable={false}
          defaultValue={nowLabel}
          animatedProps={labelProps}
          style={[styles.chipText, { color: colors.textPrimary }]}
        />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <View
          style={styles.trackArea}
          onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
        >
          <View style={[styles.track, { backgroundColor: colors.borderLight }]} />
          {dotFractions.map(f => (
            <View
              key={f}
              pointerEvents="none"
              style={[styles.dot, { backgroundColor: colors.textMuted, left: `${f * 100}%` }]}
            />
          ))}
          <Animated.View pointerEvents="none" style={[styles.thumbWrap, thumbStyle]}>
            <GradientView
              colors={[colors.primaryBlue, colors.primaryRed]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.thumb}
            />
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.endLabels}>
        <Text style={[styles.endLabel, { color: colors.textMuted }]}>{nowLabel}</Text>
        <Text style={[styles.endLabel, { color: colors.textMuted }]}>
          {use24h ? '24:00' : '12 AM'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingTop: 30,
    paddingBottom: 8,
    paddingHorizontal: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  chip: {
    position: 'absolute',
    top: 4,
    left: 14,
    width: CHIP_WIDTH,
    alignItems: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    padding: 0,
    width: CHIP_WIDTH,
  },
  trackArea: {
    height: 32,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
  },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: -3,
    top: 13,
  },
  thumbWrap: {
    position: 'absolute',
    top: 5,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2,
    borderColor: '#fff',
  },
  endLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  endLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
});
