import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import { EventDoc, eventFromData, eventEndsAt } from '../../events';
import { formatTime, LOCALE_MAP } from '../../utils/eventTime';
import LocationService from '../../services/LocationService';
import TagIcon from '../../components/TagIcon';
import { StatusTagId } from '../../statusTags';
import RoketLogo from '../../assets/roket-logo-2.svg';
import RoketHeaderLogo from '../../assets/roket-logo-simpel.svg';
import useUserProfiles from '../../hooks/useUserProfiles';
import ActivityCard, { ACTIVITY_CARD_AVATARS, dimOverlayColor } from '../../components/ActivityCard';
import { requireAccount } from '../../utils/guestGate';

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
  const [testAccount, setTestAccount] = useState(false);
  // Egen position til afstand på Aktiv i-kortene — promptless (kun hvis
  // permission allerede er givet; profilskærme skal ikke trigge prompts)
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  useEffect(() => {
    LocationService.checkCurrentPrecision().then(p => {
      if (p === 'denied') return;
      LocationService.getCurrentPosition().then(pos => {
        if (pos) setUserLocation({ latitude: pos.latitude, longitude: pos.longitude });
      });
    });
  }, []);
  // Pivot 2.0: egne aktuelle aktiviteter vises hvor galleriet før lå
  const [activeEvents, setActiveEvents] = useState<EventDoc[]>([]);
  const currentUser = auth().currentUser;

  // Avatar-stakke til aktivitetskortene — batched via session-cachen
  const activityAvatarUids = useMemo(
    () => [...new Set(activeEvents.flatMap(ev => ev.participantIds.slice(0, ACTIVITY_CARD_AVATARS)))],
    [activeEvents],
  );
  const { profiles } = useUserProfiles(activityAvatarUids);

  // Gæste-status som state — always-mounted tab re-renderer ikke selv ved
  // login/logout, så fokus opdaterer den (samme mønster som Settings)
  const [isGuest, setIsGuest] = useState(auth().currentUser?.isAnonymous ?? true);
  useFocusEffect(useCallback(() => {
    setIsGuest(auth().currentUser?.isAnonymous ?? true);
  }, []));

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
          // Sluttid, IKKE expiresAt — afsluttede aktiviteter i grace-perioden
          // skal ikke stå som "Aktiv i" (spejler ProfileViewScreen)
          .filter(ev => eventEndsAt(ev).getTime() > now)
          .sort((a, b) => a.time.getTime() - b.time.getTime());
        setActiveEvents(list);
      }, err => console.warn('Active events subscription error:', err));
    return () => unsub();
  }, []));

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
            setTestAccount(data.testAccount ?? false);
          }
        });
    }, [])
  );

  if (!currentUser) return null;

  // Gæst: eksempel-profil i stedet for gate — man må gerne SE hvad en
  // profil er, kontoen kræves først når man vil lave sin egen
  if (isGuest) {
    // Mock-aktiviteter i rigtige ActivityCard-klæder: én i gang, én snart
    const sampleNow = Date.now();
    const sampleBase = {
      creatorId: 'sample-a',
      description: '',
      meetingPlace: '',
      location: { latitude: 0, longitude: 0 },
      durationMinutes: 120,
      maxParticipants: null,
      chatId: '',
      createdAt: new Date(sampleNow),
      expiresAt: new Date(sampleNow + 6 * 3_600_000),
    };
    const sampleEvents: EventDoc[] = [
      {
        ...sampleBase,
        id: 'sample-1',
        title: t.guestSampleActivity1,
        tag: 'gaming',
        time: new Date(sampleNow - 15 * 60_000),
        participantIds: ['sample-a', 'sample-b', 'sample-c', 'sample-d'],
      },
      {
        ...sampleBase,
        id: 'sample-2',
        title: t.guestSampleActivity2,
        tag: 'walk',
        time: new Date(sampleNow + 40 * 60_000),
        participantIds: ['sample-b', 'sample-e', 'sample-f'],
      },
    ];
    const sampleProfiles = {
      'sample-a': { id: 'sample-a', displayName: 'Sofie', avatarURL: null },
      'sample-b': { id: 'sample-b', displayName: 'Mads', avatarURL: null },
      'sample-e': { id: 'sample-e', displayName: 'Ida', avatarURL: null },
    };

    return (
      <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.largeTitleRow, { paddingTop: insets.top + 26 }]}>
          <Text style={[styles.largeTitle, { color: colors.textPrimary }]}>{t.navProfile}</Text>
          <TouchableOpacity
            onPress={() => { if (requireAccount(navigation, t)) navigation.navigate('Feedback', { category: 'bug' }); }}
            style={{ marginLeft: 'auto' }}
          >
            <RoketHeaderLogo width={24} height={24} fill={colors.textPrimary} fillRule="evenodd" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}>
          <View style={styles.content}>
            {/* Mock-indholdet dæmpes pr. element — overlays følger hver
                forms hjørner (blok 20, kort 16) i stedet for én stor firkant */}
            <View style={[styles.guestExampleBadge, { backgroundColor: colors.borderLight }]}>
              <Text style={[styles.guestExampleBadgeText, { color: colors.textMuted }]}>{t.guestProfileExample}</Text>
            </View>
            <View style={styles.mockBlockWrap}>
              <View style={[styles.infoBlock, { backgroundColor: colors.white, borderColor: colors.borderLight }]}>
                <View style={styles.infoTopRow}>
                  <GradientView
                    colors={[colors.primaryBlue, colors.primaryRed]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[styles.infoAvatar, styles.infoAvatarFallback]}
                  >
                    <Text style={styles.infoAvatarInitial}>A</Text>
                  </GradientView>
                  <Text style={[styles.infoName, { color: colors.textPrimary }]}>{t.guestSampleName}</Text>
                  <View style={[styles.tagPill, { backgroundColor: colors.primaryBlue, marginBottom: 0 }]}>
                    <TagIcon tag="coffee" size={12} color="#fff" />
                    <Text style={styles.tagPillText}>{String((t as any).tagCoffee ?? 'Kaffe')}</Text>
                  </View>
                </View>
                <View style={[styles.statusQuoteWrap, { marginTop: 14, marginBottom: 0 }]}>
                  <View style={styles.statusAccent}>
                    <GradientView
                      colors={[colors.primaryBlue, colors.primaryRed]}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={styles.statusAccentFill}
                    />
                  </View>
                  <Text style={[styles.statusQuote, { color: colors.textPrimary }]}>
                    {'“'}{t.guestProfileSampleStatus}{'”'}
                  </Text>
                </View>
              </View>
              <View
                style={[styles.mockBlockOverlay, { backgroundColor: dimOverlayColor(isDark) }]}
              />
            </View>
            {/* Mockede aktiviteter i de rigtige kort — viser hvad "Aktiv i" betyder */}
            <View style={styles.aboutSection}>
              <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>{t.profileActiveIn}</Text>
              {sampleEvents.map(ev => (
                <ActivityCard
                  key={ev.id}
                  event={ev}
                  profiles={sampleProfiles}
                  userLocation={null}
                  onPress={() => {}}
                  dimmed
                />
              ))}
            </View>

            <TouchableOpacity onPress={() => navigation.navigate('Signup')} activeOpacity={0.85} style={[styles.guestCtaWrap, { marginTop: 24 }]}>
              <GradientView
                colors={[colors.primaryBlue, colors.primaryRed]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.guestCta}
              >
                <Text style={styles.guestCtaText}>{t.guestCreateAccount}</Text>
              </GradientView>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.guestLoginLink}>
              <Text style={[styles.guestLoginText, { color: colors.primaryBlueText }]}>{t.settingsLogin}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab-rod: flad stor titel — ingen tilbage-knap (nav-baren) og ingen
          rediger-blyant (tab-barens midterknap er rediger på denne fane) */}
      <View style={[styles.largeTitleRow, { paddingTop: insets.top + 26 }]}>
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
              {/* Brugerinfo samlet i én blok (profil-redesign 2026-07):
                  avatar + navn/alder + tag-pill, statuscitat og bio */}
              <View style={[styles.infoBlock, { backgroundColor: colors.white, borderColor: colors.borderLight }]}>
                <View style={styles.infoTopRow}>
                  {avatarURL ? (
                    <Image source={{ uri: avatarURL }} style={styles.infoAvatar} />
                  ) : (
                    <GradientView
                      colors={[colors.primaryBlue, colors.primaryRed]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={[styles.infoAvatar, styles.infoAvatarFallback]}
                    >
                      {initials ? (
                        <Text style={styles.infoAvatarInitial}>{initials}</Text>
                      ) : (
                        <RoketLogo width={14} height={14} fill="#fff" />
                      )}
                    </GradientView>
                  )}
                  <Text style={[styles.infoName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {displayName || ''}{displayName && hasAge ? `, ${age}` : ''}
                  </Text>
                  {hasTag && (
                    <View style={[styles.tagPill, { backgroundColor: colors.primaryBlue, marginBottom: 0 }]}>
                      <TagIcon tag={statusTag!} size={12} color="#fff" />
                      <Text style={styles.tagPillText}>
                        {String((t as any)[`tag${statusTag!.charAt(0).toUpperCase() + statusTag!.slice(1)}`] ?? statusTag)}
                      </Text>
                    </View>
                  )}
                </View>

                {hasStatus && (
                  <View style={[styles.statusQuoteWrap, { marginTop: 14, marginBottom: 0 }]}>
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

                {hasBio && (
                  <Text style={[styles.infoBio, { color: colors.textSecondary }]}>{bio}</Text>
                )}
              </View>

              {/* Aktivitetskortene fra kortets drawer — tap hopper til
                  aktivitetens detalje på Kort-fanen */}
              {hasActivities && (
                <View style={styles.aboutSection}>
                  <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>{t.profileActiveIn}</Text>
                  {activeEvents.map(ev => (
                    <ActivityCard
                      key={ev.id}
                      event={ev}
                      profiles={profiles}
                      userLocation={userLocation}
                      onPress={() =>
                        (navigation as any).navigate('MapHome', {
                          openEventId: ev.id,
                          openEventNonce: Date.now(),
                        })
                      }
                    />
                  ))}
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
  infoBlock: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  infoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  infoAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  infoAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoAvatarInitial: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  infoName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  infoBio: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
  },
  mockBlockWrap: {
    position: 'relative',
  },
  mockBlockOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  guestExampleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 14,
  },
  guestExampleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  guestHint: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 24,
    marginBottom: 18,
  },
  guestCtaWrap: {
    borderRadius: 15,
  },
  guestCta: {
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestCtaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  guestLoginLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  guestLoginText: {
    fontSize: 14,
    fontWeight: '700',
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
