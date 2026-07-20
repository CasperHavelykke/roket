import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { ChevronRight, CalendarClock } from 'lucide-react-native';
import { distanceBetween } from 'geofire-common';
import GradientView from './GradientView';
import TagIcon from './TagIcon';
import { useTheme } from '../theme';
import { EventDoc } from '../events';
import { formatDistance } from '../utils/distance';
import { formatTime, LOCALE_MAP } from '../utils/eventTime';
import { UserProfileLite } from '../hooks/useUserProfiles';

// Statusstriben: grøn = i gang nu, blå (primaryBlue) = starter senere
const IN_PROGRESS_GREEN = '#22C55E';

// Fallback-farver til initial-avatarer — dæmpede så de ikke konkurrerer
// med gradient-accenten
const AVATAR_COLORS = ['#8b93a7', '#a78b9b', '#8ba79a', '#a79a8b'];

// Højst så mange avatarer i stakken; resten bliver en +N-chip.
// Eksporteret så forældre kan batche præcis de uids kortet viser.
export const ACTIVITY_CARD_AVATARS = 2;

// Under denne grænse viser metaen "Om X min" i stedet for klokkeslæt
const STARTS_SOON_MINUTES = 60;

// "Forsmag"-dæmpning: i dark mode mørklægges indholdet, i light mode
// VASKES det ud (hvidt overlay) — et mørkt overlay ville paradoksalt
// give indholdet MERE kontrast mod den lyse baggrund
export const dimOverlayColor = (isDark: boolean) =>
  isDark ? 'rgba(8,8,12,0.45)' : 'rgba(255,255,255,0.6)';

interface ActivityCardProps {
  event: EventDoc;
  // Batched profiler fra useUserProfiles — kortet slår selv sine uids op
  profiles: Record<string, UserProfileLite>;
  userLocation?: { latitude: number; longitude: number } | null;
  onPress: () => void;
  // Mock-/forsmagstilstand: mørkt overlay + deaktiveret tap (gæste-eksemplet)
  dimmed?: boolean;
}

/**
 * Aktivitetskortet fra forsidens drawer (redesign 2026-07) — delt komponent
 * så profil-skærmenes "Aktiv i" og drawer-listen er pixel-identiske.
 */
export default function ActivityCard({ event, profiles, userLocation, onPress, dimmed }: ActivityCardProps) {
  const { colors, t, language, timeFormat, distanceUnit, isDark } = useTheme();
  // En anelse mørkere end inputBackground i light mode (mockup-tonen)
  const cardBg = isDark ? colors.inputBackground : '#F0F0F4';

  const locale = LOCALE_MAP[language] ?? 'en-GB';
  const hour12 = timeFormat === '12h';

  const tagLabel = (() => {
    if (!event.tag) return null;
    const key = `tag${event.tag.charAt(0).toUpperCase()}${event.tag.slice(1)}` as keyof typeof t;
    const label = t[key];
    return typeof label === 'string' ? label : event.tag;
  })();

  const distanceKm = userLocation
    ? distanceBetween(
        [userLocation.latitude, userLocation.longitude],
        [event.location.latitude, event.location.longitude],
      )
    : null;

  const minutesToStart = Math.round((event.time.getTime() - Date.now()) / 60_000);
  const inProgress = minutesToStart <= 0;
  const parts = [
    tagLabel,
    distanceKm != null ? formatDistance(distanceKm, t, distanceUnit) : null,
    // I gang-kort behøver ingen tid — striben siger det; snart = relativ tid
    inProgress
      ? null
      : minutesToStart <= STARTS_SOON_MINUTES
        ? t.timeInMinutes(minutesToStart)
        : formatTime(event.time, t, locale, hour12),
  ].filter(Boolean);

  const stack = event.participantIds.slice(0, ACTIVITY_CARD_AVATARS);
  const overflow = event.participantIds.length - stack.length;

  const avatarCircle = (uid: string, index: number) => {
    const profile = profiles[uid];
    const initial = profile?.displayName?.trim().charAt(0).toUpperCase();
    return (
      <View
        key={uid}
        style={[
          styles.avatar,
          { borderColor: cardBg },
          index > 0 && styles.avatarOverlap,
          !profile?.avatarURL && {
            backgroundColor: AVATAR_COLORS[uid.charCodeAt(0) % AVATAR_COLORS.length],
          },
        ]}
      >
        {profile?.avatarURL ? (
          <Image source={{ uri: profile.avatarURL }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarInitial}>{initial || '?'}</Text>
        )}
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBg }]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={dimmed}
    >
      <View
        style={[
          styles.cardStripe,
          { backgroundColor: inProgress ? IN_PROGRESS_GREEN : colors.primaryBlue },
        ]}
      />
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <GradientView
            colors={[colors.primaryBlue, colors.primaryRed]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardIcon}
          >
            {/* Tag-løse events: samme CalendarClock-fallback som kort-markøren */}
            {event.tag ? (
              <TagIcon tag={event.tag} size={19} color="#fff" strokeWidth={2.2} />
            ) : (
              <CalendarClock size={19} color="#fff" strokeWidth={2.2} />
            )}
          </GradientView>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {event.title}
            </Text>
            <Text style={[styles.cardMeta, { color: colors.textMuted }]} numberOfLines={1}>
              {parts.join(' · ')}
            </Text>
          </View>
          <ChevronRight size={19} color={colors.textMuted} strokeWidth={2.4} />
        </View>
        <View style={styles.cardBottomRow}>
          <View style={styles.avatarStack}>
            {stack.map(avatarCircle)}
            {overflow > 0 && (
              <View
                style={[
                  styles.avatar,
                  styles.avatarOverlap,
                  { backgroundColor: colors.borderLight, borderColor: cardBg },
                ]}
              >
                <Text style={[styles.avatarInitial, { color: colors.textMuted }]}>+{overflow}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.goingText, { color: colors.textMuted }]}>
            {t.drawerGoingCount(event.participantIds.length)}
          </Text>
        </View>
      </View>
      {/* Demo-badge i øvre højre hjørne — mærkningen skal ses allerede i
          listen, ikke først i detaljens note. Kortets overflow:hidden
          klipper pillen præcist til hjørnet. */}
      {event.isDemo && (
        <View style={[styles.demoBadge, { backgroundColor: `${colors.primaryBlue}1c` }]}>
          <Text style={[styles.demoBadgeText, { color: colors.primaryBlueText }]}>
            {t.eventsDemoBadge}
          </Text>
        </View>
      )}
      {dimmed && (
        // Kortets overflow:hidden klipper overlayet præcist til hjørnerne
        <View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: dimOverlayColor(isDark) }]}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  cardStripe: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 11,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 9.5,
    fontWeight: '700',
  },
  goingText: {
    fontSize: 12,
  },
  demoBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomLeftRadius: 10,
  },
  demoBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
