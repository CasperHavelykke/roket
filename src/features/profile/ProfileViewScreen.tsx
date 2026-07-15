import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardAvoidingView from '../../components/KeyboardAvoidingView';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../../components/GradientView';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../theme';
import LocationService from '../../services/LocationService';
import { ArrowLeft, MoreVertical } from 'lucide-react-native';
import TagIcon from '../../components/TagIcon';
import { StatusTagId } from '../../statusTags';
import { EventDoc, eventFromData, eventEndsAt } from '../../events';
import RoketLogo from '../../assets/roket-logo-2.svg';
import useUserProfiles from '../../hooks/useUserProfiles';
import ActivityCard, { ACTIVITY_CARD_AVATARS } from '../../components/ActivityCard';

interface RouteParams {
  user: {
    id: string;
    displayName: string;
    bio: string;
    status?: string;
    statusTag?: StatusTagId | null;
    avatarURL?: string | null;
    lastSeen?: number; // millisekunder siden epoch
    age?: number;
    testAccount?: boolean;
  };
}

export default function ProfileViewScreen({ route, navigation }: any) {
  const { colors, isDark, t, showTestBadges, language, timeFormat } = useTheme();
  const insets = useSafeAreaInsets();

  const formatLastSeen = (lastSeenMs?: number): string => {
    if (!lastSeenMs) return '';
    const diff = Date.now() - lastSeenMs;
    if (diff < 24 * 60 * 60 * 1000) return '';
    return t.profileLastSeenDays(Math.floor(diff / 86400000));
  };

  const { user, fromChat } = route.params as RouteParams & { fromChat?: boolean };
  const currentUser = auth().currentUser;
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  // Profilen viser personens AKTUELLE aktiviteter i stedet for
  // billedgalleri — en bro tilbage til aktiviteterne, ikke et katalog
  const [activeEvents, setActiveEvents] = useState<EventDoc[]>([]);
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

  // Avatar-stakke til aktivitetskortene — batched via session-cachen
  const activityAvatarUids = useMemo(
    () => [...new Set(activeEvents.flatMap(ev => ev.participantIds.slice(0, ACTIVITY_CARD_AVATARS)))],
    [activeEvents],
  );
  const { profiles } = useUserProfiles(activityAvatarUids);

  useEffect(() => {
    const unsub = firestore()
      .collection('events')
      .where('participantIds', 'array-contains', user.id)
      .onSnapshot(snap => {
        const now = Date.now();
        const list = snap.docs
          .map(d => eventFromData(d.id, d.data()))
          // Sluttid, IKKE expiresAt: i 4-timers grace-perioden efter slut
          // lever eventet stadig i databasen (chat + Hold kontakten), men
          // "Aktiv i" skal ikke vise afsluttede aktiviteter
          .filter(ev => eventEndsAt(ev).getTime() > now)
          .sort((a, b) => a.time.getTime() - b.time.getTime());
        setActiveEvents(list);
      }, err => console.warn('Active events subscription error:', err));
    return () => unsub();
  }, [user.id]);

  if (!currentUser) return null;

  const handleBlockReport = () => setShowMenu(true);

  const handleBlock = () => {
    setShowMenu(false);
    Alert.alert(
      t.profileBlockConfirm(user.displayName),
      t.profileBlockDescription(user.displayName),
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.profileBlockButton,
          style: 'destructive',
          onPress: async () => {
            await Promise.all([
              firestore()
                .collection('users')
                .doc(currentUser.uid)
                .update({
                  blockedUsers: firestore.FieldValue.arrayUnion(user.id),
                }),
              firestore().collection('blocks').add({
                blockerId: currentUser.uid,
                blockedUserId: user.id,
                createdAt: firestore.FieldValue.serverTimestamp(),
                status: 'pending',
              }),
            ]);
            if (fromChat) {
              navigation.pop(2);
            } else {
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const handleReport = () => {
    setShowMenu(false);
    setReportText('');
    setShowReportModal(true);
  };

  const handleSendReport = async () => {
    setShowReportModal(false);
    await firestore().collection('reports').add({
      reporterId: currentUser.uid,
      reportedUserId: user.id,
      message: reportText.trim() || null,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    setReportText('');
    Alert.alert(t.profileReportThanks, t.profileReportReceived);
  };

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={21} color={colors.textPrimary} strokeWidth={2.2} />
          <Text style={[styles.backRowText, { color: colors.textPrimary }]}>{t.profileBack}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleBlockReport} style={styles.moreButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MoreVertical size={20} color={colors.textMuted} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}>
        {(() => {
          const hasStatus = !!user.status?.trim();
          const hasTag = !!user.statusTag;
          const hasBio = !!user.bio?.trim();
          const hasActivities = activeEvents.length > 0;
          const hasName = !!user.displayName;
          const hasAge = user.age != null;
          const lastSeenText = user.lastSeen !== undefined ? formatLastSeen(user.lastSeen) : '';
          const hasLastSeen = !!lastSeenText;
          const isEmpty = !hasStatus && !hasTag && !hasBio && !hasActivities;
          const initials = (() => {
            if (!hasName) return '';
            const parts = user.displayName.trim().split(/\s+/).slice(0, 2);
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
                  {(t as any).profileEmptyState}
                </Text>
                {showTestBadges && user.testAccount && (
                  <View style={[styles.testDisclaimer, { backgroundColor: colors.card, borderColor: colors.borderLight, marginTop: 20 }]}>
                    <Text style={[styles.testDisclaimerText, { color: colors.textSecondary }]}>{t.testAccountDisclaimer}</Text>
                  </View>
                )}
              </View>
            );
          }

          return (
            <>
              {/* Brugerinfo samlet i én blok (profil-redesign 2026-07) —
                  lastSeen/afstand vises som diskret meta under navnet */}
              <View style={[styles.infoBlock, { backgroundColor: colors.white, borderColor: colors.borderLight }]}>
                <View style={styles.infoTopRow}>
                  {user.avatarURL ? (
                    <Image source={{ uri: user.avatarURL }} style={styles.infoAvatar} />
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
                  <View style={styles.infoNameWrap}>
                    <Text style={[styles.infoName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {user.displayName || ''}{user.displayName && hasAge ? `, ${user.age}` : hasAge ? `${user.age}` : ''}
                    </Text>
                    {hasLastSeen && (
                      <Text style={[styles.infoMeta, { color: colors.textMuted }]} numberOfLines={1}>
                        {lastSeenText}
                      </Text>
                    )}
                  </View>
                  {hasTag && (
                    <View style={[styles.tagPill, { backgroundColor: colors.primaryBlue, marginBottom: 0 }]}>
                      <TagIcon tag={user.statusTag!} size={12} color="#fff" />
                      <Text style={styles.tagPillText}>
                        {String((t as any)[`tag${user.statusTag!.charAt(0).toUpperCase() + user.statusTag!.slice(1)}`] ?? user.statusTag)}
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
                      {'“'}{user.status}{'”'}
                    </Text>
                  </View>
                )}

                {hasBio && (
                  <Text style={[styles.infoBio, { color: colors.textSecondary }]}>{user.bio}</Text>
                )}
              </View>

              {/* Aktivitetskortene fra kortets drawer — tap åbner aktivitetens
                  detalje på Kort-fanen */}
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
                        (navigation as any).navigate('Tabs', {
                          screen: 'MapHome',
                          params: { openEventId: ev.id, openEventNonce: Date.now() },
                        })
                      }
                    />
                  ))}
                </View>
              )}

              {showTestBadges && user.testAccount && (
                <View style={[styles.testDisclaimer, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
                  <Text style={[styles.testDisclaimerText, { color: colors.textSecondary }]}>{t.testAccountDisclaimer}</Text>
                </View>
              )}
            </>
          );
        })()}
      </ScrollView>

      {/* Pivot 2.0: besked-FAB'en (kold DM fra profiler) er fjernet —
          kontakt går gennem aktiviteter og Hold kontakten */}

      <Modal visible={showReportModal} transparent animationType="fade" onRequestClose={() => setShowReportModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t.profileReportConfirm(user.displayName)}
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              {t.profileReportDescription}
            </Text>
            <TextInput
              style={[styles.modalInput, {
                borderColor: colors.inputBorder,
                backgroundColor: colors.inputBackground,
                color: colors.textPrimary,
              }]}
              placeholder={t.profileReportPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={reportText}
              onChangeText={setReportText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.backgroundLight }]}
                onPress={() => setShowReportModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primaryRed }]}
                onPress={handleSendReport}
              >
                <Text style={[styles.modalButtonText, { color: '#FFF' }]}>{t.profileReportSend}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuCard, { backgroundColor: colors.card, top: insets.top + 50, right: 16 }]}>
            <TouchableOpacity style={styles.menuOption} onPress={handleBlock}>
              <Text style={[styles.menuOptionText, { color: colors.primaryRed }]}>{t.profileBlock(user.displayName)}</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuOption} onPress={handleReport}>
              <Text style={[styles.menuOptionText, { color: colors.textPrimary }]}>{t.profileReport(user.displayName)}</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuOption} onPress={() => setShowMenu(false)}>
              <Text style={[styles.menuOptionText, { color: colors.textMuted }]}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  menuOverlay: {
    flex: 1,
  },
  menuCard: {
    position: 'absolute',
    minWidth: 200,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuOption: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  menuOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  backRowText: {
    fontSize: 18,
    fontWeight: '700',
  },
  moreButton: {
    padding: 4,
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
  infoNameWrap: {
    flex: 1,
    minWidth: 0,
  },
  infoName: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoMeta: {
    fontSize: 12,
    marginTop: 1,
  },
  infoBio: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  emptyProfileWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
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
  photoPlaceholder: {
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').width - 40,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 80,
    fontWeight: 'bold',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  testBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  testBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  testDisclaimer: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  testDisclaimerText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
