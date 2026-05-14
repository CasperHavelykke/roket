import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Calendar as CalendarIcon, Users } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { getStatusTag } from '../../statusTags';
import TagIcon from '../../components/TagIcon';
import { EventDoc } from '../../events';
import GradientView from '../../components/GradientView';

interface EventCardProps {
  event: EventDoc;
  width: number;
  compact?: boolean;
  tiny?: boolean;
  isSingle?: boolean;
  cardLeft?: number;
  screenWidth?: number;
  onPress: () => void;
}

function formatTime(time: Date, t: any, locale: string, hour12: boolean): string {
  const now = Date.now();
  const diffMs = time.getTime() - now;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 0) return t.eventsTimeAgo;
  if (diffMins < 60) return t.eventsTimeIn(diffMins);

  const today = new Date();
  const eventDay = new Date(time);
  const isToday = today.toDateString() === eventDay.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = tomorrow.toDateString() === eventDay.toDateString();

  const timeStr = eventDay.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12,
  });

  if (isToday) return `${t.eventsTimeToday} ${timeStr}`;
  if (isTomorrow) return `${t.eventsTimeTomorrow} ${timeStr}`;
  const dateStr = eventDay.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
  return `${dateStr} ${timeStr}`;
}

const LOCALE_MAP: Record<string, string> = {
  da: 'da-DK', en: 'en-GB', es: 'es-ES', de: 'de-DE', fr: 'fr-FR', pt: 'pt-PT',
};

export default function EventCard({ event, width, compact, tiny, isSingle, cardLeft, screenWidth, onPress }: EventCardProps) {
  const { colors, t, timeFormat, language } = useTheme();
  const tag = getStatusTag(event.tag);
  const participantCount = event.participantIds.length;
  const locale = LOCALE_MAP[language] || 'en-GB';
  const timeText = formatTime(event.time, t, locale, timeFormat === '12h');

  // Gradient spænder fra skærmkant til skærmkant ligesom FAB
  const useScreenSpanning = cardLeft !== undefined && screenWidth !== undefined && width > 0;
  const gradientStart = useScreenSpanning
    ? { x: -cardLeft! / width, y: 0 }
    : { x: 0, y: 0 };
  const gradientEnd = useScreenSpanning
    ? { x: (screenWidth! - cardLeft!) / width, y: 0 }
    : { x: 1, y: 1 };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fill,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <GradientView
        colors={[colors.primaryBlue, colors.primaryRed]}
        start={gradientStart}
        end={gradientEnd}
        style={StyleSheet.absoluteFill}
      />
      {/* Tag-watermark i baggrunden */}
      {tag && (
        <View style={[styles.watermark, { opacity: 0.18 }]} pointerEvents="none">
          <TagIcon tag={tag.id} size={width * 0.7} color="#fff" strokeWidth={1.5} />
        </View>
      )}

      {/* Calendar/Event indicator badge top-left */}
      <View style={[styles.cornerBadge, styles.cornerLeft, compact && styles.cornerCompact]} pointerEvents="none">
        <CalendarIcon size={compact ? 12 : 16} color="#fff" />
      </View>

      {/* Participants pill top-right */}
      <View style={[styles.participantPill, compact && styles.participantPillCompact]} pointerEvents="none">
        <Users size={compact ? 11 : 14} color="#fff" />
        <Text style={[styles.participantPillText, compact && { fontSize: 11 }]} numberOfLines={1}>
          {event.maxParticipants ? `${participantCount}/${event.maxParticipants}` : `${participantCount}`}
        </Text>
      </View>

      {/* Center content */}
      <View style={[
        styles.center,
        compact && { paddingTop: 26, paddingBottom: 28 },
        tiny && { paddingTop: 22, paddingBottom: 22, paddingHorizontal: 6 },
      ]}>
        <Text
          style={[
            styles.title,
            compact && { fontSize: 12, lineHeight: 15 },
            tiny && { fontSize: 10, lineHeight: 13 },
            isSingle && { fontSize: 22, lineHeight: 28 },
          ]}
          numberOfLines={isSingle ? 4 : 5}
        >
          {event.title}
        </Text>
        {isSingle && event.description ? (
          <Text style={styles.description} numberOfLines={3}>
            {event.description}
          </Text>
        ) : null}
      </View>

      {/* Bottom info */}
      <View style={[styles.bottom, compact && { padding: 6 }]} pointerEvents="none">
        <Text style={[styles.timeText, compact && { fontSize: 10 }]} numberOfLines={1}>
          {timeText}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  watermark: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerBadge: {
    position: 'absolute',
    top: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  cornerLeft: { left: 8 },
  cornerRight: { right: 8 },
  cornerDark: { backgroundColor: 'rgba(0,0,0,0.35)' },
  cornerCompact: { width: 22, height: 22, borderRadius: 11, top: 6 },
  cornerEmoji: { fontSize: 15 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 36,
    paddingBottom: 44,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  description: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
  },
  timeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  participants: { color: 'rgba(255,255,255,0.95)', fontSize: 11, fontWeight: '600' },
  participantPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 1,
  },
  participantPillCompact: {
    top: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  participantPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
