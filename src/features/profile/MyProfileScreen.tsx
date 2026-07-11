import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../../components/GradientView';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme';
import LocationService from '../../services/LocationService';
import { EventDoc, eventFromData } from '../../events';
import { formatTime, LOCALE_MAP } from '../../utils/eventTime';
import { MapPin } from 'lucide-react-native';
import TagIcon from '../../components/TagIcon';
import { StatusTagId } from '../../statusTags';
import RoketLogo from '../../assets/roket-logo-2.svg';
import RoketHeaderLogo from '../../assets/roket-logo-simpel.svg';

export default function MyProfileScreen({ navigation }: any) {
  const { colors, isDark, t, distanceUnit, showTestBadges, language, timeFormat } = useTheme();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState('');
  const [statusTag, setStatusTag] = useState<StatusTagId | null>(null);
  const [avatarURL, setAvatarURL] = useState<string | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [distanceModeValue, setDistanceModeValue] = useState<string | null>(null);
  const [locationGranted, setLocationGranted] = useState(true);
  const [testAccount, setTestAccount] = useState(false);
  // Pivot 2.0: egne aktuelle aktiviteter vises hvor galleriet før lå
  const [activeEvents, setActiveEvents] = useState<EventDoc[]>([]);
  const currentUser = auth().currentUser;

  // Bind ved FOKUS, ikke mount: som tab unmountes skærmen aldrig — en
  // mount-bundet listener ville dø ved logout og pege på gammel uid efter
  // konto-skift (F4-lektien). Blur rydder op.
  const eventsBoundUid = useRef<string | null>(null);
  useFocusEffect(useCallback(() => {
    const user = auth().currentUser;
    if (!user || user.isAnonymous) {
      eventsBoundUid.current = null;
      setActiveEvents([]);
      return;
    }
    // Konto-skift: ryd den forrige kontos aktiviteter før der bindes
    if (eventsBoundUid.current !== user.uid) {
      eventsBoundUid.current = user.uid;
      setActiveEvents([]);
    }
    const unsub = firestore()
      .collection('events')
      .where('participantIds', 'array-contains', user.uid)
      .onSnapshot(snap => {
        const now = Date.now();
        const list = snap.docs
          .map(d => eventFromData(d.id, d.data()))
          .filter(ev => ev.expiresAt.getTime() > now)
          .sort((a, b) => a.time.getTime() - b.time.getTime());
        setActiveEvents(list);
      }, err => console.warn('Active events subscription error:', err));
    return () => unsub();
  }, []));

  useEffect(() => {
    LocationService.checkCurrentPrecision().then(p => setLocationGranted(p !== 'denied'));
  }, []);

  const formatLastSeen = (lastSeenMs: number): string => {
    const diff = Date.now() - lastSeenMs;
    if (diff < 24 * 60 * 60 * 1000) return '';
    return t.profileLastSeenDays(Math.floor(diff / 86400000));
  };

  const profileBoundUid = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      // Frisk auth-state pr. fokus — render-closurens currentUser kan være
      // forældet efter konto-skift på en always-mounted tab
      const user = auth().currentUser;
      if (!user || user.isAnonymous) {
        profileBoundUid.current = null;
        return;
      }
      // Konto-skift: ryd den forrige kontos profilfelter FØR der hentes —
      // ellers blinker den gamle profil et øjeblik
      if (profileBoundUid.current !== user.uid) {
        profileBoundUid.current = user.uid;
        setDisplayName('');
        setBio('');
        setStatus('');
        setStatusTag(null);
        setAvatarURL(null);
        setAge(null);
        setLastSeen(null);
        setTestAccount(false);
      }
      firestore()
        .collection('users')
        .doc(user.uid)
        .get()
        .then(doc => {
          const data = doc.data();
          if (data) {
            setDisplayName(data.displayName ?? '');
            setBio(data.bio ?? '');
            setStatus(data.status ?? '');
            setStatusTag(data.statusTag ?? null);
            setAvatarURL(data.avatarURL ?? null);
            if (data.birthday && data.showAge !== false) {
              const today = new Date();
              const birth = new Date(data.birthday.year, data.birthday.month - 1, data.birthday.day);
              let a = today.getFullYear() - birth.getFullYear();
              const m = today.getMonth() - birth.getMonth();
              if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
              setAge(a);
            } else {
              setAge(null);
            }
            setLastSeen(data.lastSeen?.toMillis?.() ?? null);
            setDistanceModeValue(data.distanceMode ?? null);
            setTestAccount(data.testAccount ?? false);
          }
        });
    }, [])
  );

  if (!currentUser) return null;

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab-rod: flad stor titel — ingen tilbage-knap (nav-baren) og ingen
          rediger-blyant (tab-barens midterknap er rediger på denne fane) */}
      <View style={[styles.largeTitleRow, { paddingTop: insets.top + 14 }]}>
        <Text style={[styles.largeTitle, { color: colors.textPrimary }]}>{t.navProfile}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Feedback', { category: 'bug' })} style={{ marginLeft: 'auto' }}>
          <RoketHeaderLogo width={24} height={24} fill={colors.textPrimary} fillRule="evenodd" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}>
        {(() => {
          const hasStatus = !!status?.trim();
          const hasTag = !!statusTag;
          const hasBio = !!bio?.trim();
          const hasActivities = activeEvents.length > 0;
          const hasName = !!displayName;
          const hasAge = age != null;
          const lastSeenText = lastSeen !== null ? formatLastSeen(lastSeen) : '';
          const hasLastSeen = !!lastSeenText;
          const distanceVisible = locationGranted && distanceModeValue && distanceModeValue !== 'hidden';
          const distancePreview = distanceModeValue === 'fuzzy'
            ? (distanceUnit === 'mi' ? t.distanceUnder100ft : t.distanceUnder30)
            : (distanceUnit === 'mi' ? t.distanceFeet(0) : t.distanceMeters(0));
          const hasDistance = !!distanceVisible;
          const hasIdentityFooter = hasName || hasAge || hasDistance || hasLastSeen;
          const isEmpty = !hasStatus && !hasTag && !hasBio && !hasActivities;
          const initials = (() => {
            if (!hasName) return '';
            const parts = displayName.trim().split(/\s+/).slice(0, 2);
            return parts.map(p => p.charAt(0).toUpperCase()).join('');
          })();

          if (isEmpty) {
            const logoSize = Dimensions.get('window').width * 0.66;
            return (
              <View style={styles.emptyProfileWrap}>
                <View style={{ opacity: isDark ? 0.5 : 0.35 }}>
                  <RoketLogo width={logoSize} height={logoSize} fill={colors.cardBackgroundIcon} />
                </View>
                <Text style={[styles.emptyProfileText, { color: colors.textMuted }]}>
                  {(t as any).profileEmptyStateSelf}
                </Text>
                {showTestBadges && testAccount && (
                  <View style={[styles.testDisclaimer, { backgroundColor: colors.card, borderColor: colors.borderLight, marginTop: 12 }]}>
                    <Text style={[styles.testDisclaimerText, { color: colors.textSecondary }]}>{t.testAccountDisclaimer}</Text>
                  </View>
                )}
              </View>
            );
          }

          return (
            <View style={styles.content}>
              {hasTag && (
                <View style={[styles.tagPill, { backgroundColor: colors.primaryBlue }]}>
                  <TagIcon tag={statusTag!} size={14} color="#fff" />
                  <Text style={styles.tagPillText}>
                    {String((t as any)[`tag${statusTag!.charAt(0).toUpperCase() + statusTag!.slice(1)}`] ?? statusTag)}
                  </Text>
                </View>
              )}

              {hasStatus && (
                <View style={styles.statusQuoteWrap}>
                  <View style={styles.statusAccent}>
                    <GradientView
                      colors={[colors.primaryBlue, colors.primaryRed]}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={styles.statusAccentFill}
                    />
                  </View>
                  <Text style={[styles.statusQuote, { color: colors.textPrimary }]}>
                    {'“'}{status}{'”'}
                  </Text>
                </View>
              )}

              {/* Pivot 2.0: galleriet er erstattet af mine aktuelle aktiviteter */}
              {hasActivities && (
                <View style={styles.aboutSection}>
                  <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>{t.profileActiveIn}</Text>
                  {activeEvents.map(ev => (
                    <View key={ev.id} style={styles.activityRow}>
                      <GradientView
                        colors={[colors.primaryBlue, colors.primaryRed]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.activityIcon}
                      >
                        {ev.tag && <TagIcon tag={ev.tag} size={14} color="#fff" strokeWidth={2.2} />}
                      </GradientView>
                      <View style={styles.activityText}>
                        <Text style={[styles.activityTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                          {ev.title}
                        </Text>
                        <Text style={[styles.activityMeta, { color: colors.textMuted }]} numberOfLines={1}>
                          {formatTime(ev.time, t, LOCALE_MAP[language] ?? 'en-GB', timeFormat === '12h')}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {hasBio && (
                <View style={styles.aboutSection}>
                  <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>{(t as any).descriptionLabel ?? 'OM'}</Text>
                  <Text style={[styles.bioText, { color: colors.textPrimary }]}>{bio}</Text>
                </View>
              )}

              {hasIdentityFooter && (
                <View style={[styles.identityFooter, { borderTopColor: colors.borderLight }]}>
                  <View style={styles.identityLeft}>
                    {avatarURL ? (
                      <Image source={{ uri: avatarURL }} style={styles.identityAvatar} />
                    ) : initials ? (
                      <GradientView
                        colors={[colors.primaryBlue, colors.primaryRed]}
                        start={{ x: -20 / 32, y: 0 }}
                        end={{ x: (Dimensions.get('window').width - 20) / 32, y: 0 }}
                        style={styles.identityAvatar}
                      >
                        <Text style={styles.identityAvatarText}>{initials}</Text>
                      </GradientView>
                    ) : (
                      <View style={[styles.identityAvatar, { backgroundColor: colors.cardBackground }]}>
                        <RoketLogo width={14} height={14} fill={colors.cardBackgroundIcon} />
                      </View>
                    )}
                    <View style={styles.identityText}>
                      {(hasName || hasAge) && (
                        <Text style={[styles.identityName, { color: colors.textPrimary }]}>
                          {displayName || ''}{displayName && hasAge ? `, ${age}` : hasAge ? `${age}` : ''}
                        </Text>
                      )}
                      {hasLastSeen && (
                        <Text style={[styles.identityMeta, { color: colors.textMuted }]}>{lastSeenText}</Text>
                      )}
                    </View>
                  </View>
                  {hasDistance && (
                    <View style={styles.identityDistance}>
                      <MapPin size={13} color={colors.textMuted} />
                      <Text style={[styles.identityDistanceText, { color: colors.textMuted }]}>{distancePreview}</Text>
                    </View>
                  )}
                </View>
              )}

              {showTestBadges && testAccount && (
                <View style={[styles.testDisclaimer, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
                  <Text style={[styles.testDisclaimerText, { color: colors.textSecondary }]}>{t.testAccountDisclaimer}</Text>
                </View>
              )}
            </View>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  largeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 18,
  },
  largeTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  emptyProfileWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
    gap: 24,
  },
  emptyProfileText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  statusQuoteWrap: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 8,
  },
  statusAccent: {
    width: 3,
    marginRight: 16,
    borderRadius: 100,
    overflow: 'hidden',
  },
  statusAccentFill: { flex: 1 },
  statusQuote: {
    flex: 1,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '400',
    fontStyle: 'italic',
    letterSpacing: -0.3,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  activityIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: {
    flex: 1,
    marginLeft: 10,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  activityMeta: {
    fontSize: 12.5,
    marginTop: 1,
  },
  aboutSection: {
    marginTop: 28,
  },
  aboutLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
  },
  identityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
  },
  identityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  identityAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  identityAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  identityText: {
    flex: 1,
  },
  identityName: {
    fontSize: 14,
    fontWeight: '500',
  },
  identityMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  identityDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    marginLeft: 12,
  },
  identityDistanceText: {
    fontSize: 13,
    fontWeight: '500',
  },
  photoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  photoCarousel: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  photo: {
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').width - 40,
    borderRadius: 16,
  },
  photoFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoCountText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  infoContainer: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 10,
    gap: 5,
  },
  tagPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  onlineStatus: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  distance: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  detailChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  detailChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  bioLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  bioContainer: {
    paddingTop: 16,
  },
  bio: {
    fontSize: 17,
    lineHeight: 26,
  },
  bioEmpty: {
    fontSize: 15,
    fontStyle: 'italic',
  },
  testBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  testBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  testDisclaimer: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  testDisclaimerText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
