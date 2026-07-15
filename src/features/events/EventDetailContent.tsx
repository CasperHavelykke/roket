import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { GestureDetector, NativeGesture } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../theme';
import { getStatusTag } from '../../statusTags';
import TagIcon from '../../components/TagIcon';
import GradientView from '../../components/GradientView';
import useUserProfiles from '../../hooks/useUserProfiles';
import useContactRequests from '../../hooks/useContactRequests';
import { contactPairId, statusForRequest, requestOrAcceptContact, withdrawContactRequest, ContactStatus } from '../../contacts';
import { Clock, MapPin, Users, MessagesSquare, CalendarClock } from 'lucide-react-native';
import { EventDoc, isEventFull, eventEndsAt } from '../../events';
import { distanceBetween } from 'geofire-common';
import { formatDistance } from '../../utils/distance';

// Cap på renderede deltager-rækker — store events må ikke koste en lang
// liste af Image-mounts (jf. skalerbarheds-princippet)
const MAX_PARTICIPANTS_SHOWN = 20;

// Status-pillen viser "Starter om X min" op til denne grænse; derefter
// siger info-boksens tidspunkt det samme bedre
const STARTS_SOON_MINUTES = 60;

// Statusfarve for igangværende — samme grønne som drawer-kortenes stribe
const IN_PROGRESS_GREEN = '#22C55E';

interface EventDetailContentProps {
  event: EventDoc;
  // Kaldes når indholdet er "færdigt" (forladt/aflyst event)
  onClose: () => void;
  onOpenChat: (chatId: string, eventTitle: string) => void;
  // Gæste-gate (Pivot 2.0): kaldes hvis en gæst forsøger at deltage
  onRequireAccount?: () => void;
  // Sat (fx 400) i modal-konteksten hvor sheetet er indholds-dimensioneret;
  // udeladt fylder indholdet sin container (drawer-konteksten)
  scrollMaxHeight?: number;
  // Drawer-koordinering (hele draweren er træk-flade): sheet-pan'en ejer
  // lodrette træk indtil sheetet er helt åbent. Draweren leverer native-
  // gesture + scroll-tracking + enabled-flag; modal-konteksten udelader
  // dem og får en almindelig fri ScrollView.
  sheetScrollGesture?: NativeGesture;
  onSheetScroll?: any;
  sheetScrollEnabled?: boolean;
  // Brugerens position (on-device) — viser afstand på steds-linjen.
  // Udeladt (fx chat-nudgens modal) vises ingen afstand.
  userLocation?: { latitude: number; longitude: number } | null;
}

/**
 * Selve aktivitets-detaljen — deles mellem ActivityDrawer (kortets
 * "bladre videre"-flow, redesign 2026-07) og EventDetailModal (chattens
 * Hold kontakten-nudge). Ejer join/forlad/aflys-logikken og deltagerlisten
 * med Hold kontakten-knapperne.
 */
export default function EventDetailContent({
  event,
  onClose,
  onOpenChat,
  onRequireAccount,
  scrollMaxHeight,
  sheetScrollGesture,
  onSheetScroll,
  sheetScrollEnabled,
  userLocation,
}: EventDetailContentProps) {
  const { colors, t, timeFormat, language, distanceUnit } = useTheme();
  const [busy, setBusy] = useState(false);
  // Lokal kopi så join kan opdatere optimistisk (Chat/Forlad vises straks)
  const [ev, setEv] = useState<EventDoc>(event);
  useEffect(() => setEv(event), [event]);

  // Deltagerprofiler (navn + avatar) — batched + session-cachet
  const { profiles } = useUserProfiles(ev.participantIds);
  // Hold kontakten: live status for mine anmodninger (flipper i realtid ved
  // accept; hooken gen-binder selv ved auth-skift)
  const contactRequests = useContactRequests();
  const [contactBusyUid, setContactBusyUid] = useState<string | null>(null);

  const user = auth().currentUser;
  const isCreator = user?.uid === ev.creatorId;
  const isParticipant = !!user && ev.participantIds.includes(user.uid);
  const tag = getStatusTag(ev.tag);
  const full = isEventFull(ev);

  const minutesToStart = Math.round((ev.time.getTime() - Date.now()) / 60_000);
  // I grace-perioden (chat-nudgen kan åbne detaljen efter slut) er eventet
  // AFSLUTTET, ikke "i gang" — start-tjekket alene ville lyve i 4 timer
  const hasEnded = eventEndsAt(ev).getTime() <= Date.now();
  const inProgress = minutesToStart <= 0 && !hasEnded;

  // Afstand til aktiviteten (on-device beregning, samme som drawer-kortene)
  const distanceText =
    userLocation && ev.location
      ? formatDistance(
          distanceBetween(
            [userLocation.latitude, userLocation.longitude],
            [ev.location.latitude, ev.location.longitude],
          ),
          t,
          distanceUnit,
        )
      : null;

  const handleContactTap = async (otherUid: string) => {
    if (!user || contactBusyUid) return;
    setContactBusyUid(otherUid);
    try {
      await requestOrAcceptContact(user.uid, otherUid, ev.id);
      // Hooket live-opdaterer knappens tilstand via listeneren
    } catch (e) {
      console.warn('Contact request failed:', e);
      Alert.alert(t.error, t.contactsError);
    } finally {
      setContactBusyUid(null);
    }
  };

  const renderContactButton = (uid: string) => {
    // Kun deltagere med rigtig konto kan holde kontakten — og aldrig med sig selv
    if (!user || user.isAnonymous || !isParticipant || uid === user.uid) return null;

    const status: ContactStatus = statusForRequest(
      contactRequests[contactPairId(user.uid, uid)] ?? null,
      user.uid,
    );
    const contactBusy = contactBusyUid === uid;

    if (status === 'connected') {
      return (
        <View style={[styles.contactBtn, { borderColor: colors.borderLight }]}>
          <Text style={[styles.contactBtnText, { color: colors.textMuted }]}>{t.contactsConnected}</Text>
        </View>
      );
    }
    if (status === 'pending_sent') {
      // Tap fortryder anmodningen — listeneren flipper knappen tilbage
      return (
        <TouchableOpacity
          style={[styles.contactBtn, { borderColor: colors.borderLight }]}
          onPress={async () => {
            if (contactBusy) return;
            setContactBusyUid(uid);
            try {
              await withdrawContactRequest(user.uid, uid);
            } catch (e) {
              console.warn('Withdraw contact request failed:', e);
            } finally {
              setContactBusyUid(null);
            }
          }}
          disabled={contactBusy}
        >
          {contactBusy ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Text style={[styles.contactBtnText, { color: colors.textMuted }]}>{t.contactsRequested}</Text>
          )}
        </TouchableOpacity>
      );
    }
    if (status === 'pending_received') {
      return (
        <TouchableOpacity
          style={[styles.contactBtn, { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue }]}
          onPress={() => handleContactTap(uid)}
          disabled={contactBusy}
        >
          {contactBusy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.contactBtnText, { color: '#fff' }]}>{t.contactsAccept}</Text>
          )}
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        style={[styles.contactBtn, { borderColor: colors.primaryBlue }]}
        onPress={() => handleContactTap(uid)}
        disabled={contactBusy}
      >
        {contactBusy ? (
          <ActivityIndicator size="small" color={colors.primaryBlueText} />
        ) : (
          <Text style={[styles.contactBtnText, { color: colors.primaryBlueText }]}>{t.contactsRequest}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const handleJoin = async () => {
    if (!user) return;
    if (user.isAnonymous) {
      onRequireAccount?.();
      return;
    }
    setBusy(true);
    try {
      const batch = firestore().batch();
      batch.update(firestore().collection('events').doc(ev.id), {
        participantIds: firestore.FieldValue.arrayUnion(user.uid),
      });
      batch.update(firestore().collection('chats').doc(ev.chatId), {
        participants: firestore.FieldValue.arrayUnion(user.uid),
      });
      await batch.commit();
      setEv(prev => ({ ...prev, participantIds: [...prev.participantIds, user.uid] }));
    } catch (e) {
      console.error('Join failed:', e);
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!user) return;
    setBusy(true);
    // Tolerér mismatched state: hvis bruger kun er i den ene, fjernes de stadig der.
    try {
      await firestore().collection('events').doc(ev.id).update({
        participantIds: firestore.FieldValue.arrayRemove(user.uid),
      });
    } catch (e) {
      console.warn('Event leave failed (maybe already removed):', e);
    }
    try {
      await firestore().collection('chats').doc(ev.chatId).update({
        participants: firestore.FieldValue.arrayRemove(user.uid),
      });
    } catch (e) {
      console.warn('Chat leave failed (maybe already removed):', e);
    }
    setBusy(false);
    onClose();
  };

  const handleCancel = () => {
    Alert.alert(t.eventsCancel, t.eventsCancelConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await firestore().collection('events').doc(ev.id).delete();
            await firestore().collection('chats').doc(ev.chatId).delete();
            onClose();
          } catch (e) {
            console.error('Cancel failed:', e);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const localeMap: Record<string, string> = {
    da: 'da-DK', en: 'en-GB', es: 'es-ES', de: 'de-DE', fr: 'fr-FR', pt: 'pt-PT',
  };
  const locale = localeMap[language] || 'en-GB';

  const formatDateTime = (d: Date) => {
    const today = new Date();
    const isToday = today.toDateString() === d.toDateString();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = tomorrow.toDateString() === d.toDateString();
    const timeStr = d.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: timeFormat === '12h',
    });
    const dayLabel = isToday
      ? t.eventsTimeToday
      : isTomorrow
        ? t.eventsTimeTomorrow
        : d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${dayLabel} ${timeStr}`;
  };

  // Status-pillen: grøn "I gang" / blå "Starter om X min" (kun tæt på start)
  const statusPill = hasEnded ? (
    <View style={[styles.statusPill, { backgroundColor: colors.inputBackground }]}>
      <Clock size={12} color={colors.textMuted} strokeWidth={2.4} />
      <Text style={[styles.statusPillText, { color: colors.textMuted }]}>{t.eventsStatusEnded}</Text>
    </View>
  ) : inProgress ? (
    <View style={[styles.statusPill, { backgroundColor: `${IN_PROGRESS_GREEN}22` }]}>
      <Clock size={12} color={IN_PROGRESS_GREEN} strokeWidth={2.4} />
      <Text style={[styles.statusPillText, { color: IN_PROGRESS_GREEN }]}>{t.eventsStatusNow}</Text>
    </View>
  ) : minutesToStart <= STARTS_SOON_MINUTES ? (
    <View style={[styles.statusPill, { backgroundColor: `${colors.primaryBlue}1c` }]}>
      <Clock size={12} color={colors.primaryBlueText} strokeWidth={2.4} />
      <Text style={[styles.statusPillText, { color: colors.primaryBlueText }]}>
        {t.eventsStartsIn(minutesToStart)}
      </Text>
    </View>
  ) : null;

  // Scroll-delen bygges separat, så draweren kan wrappe den i sin
  // GestureDetector — modal-konteksten må IKKE wrappes (GestureDetector
  // inde i en RN Modal kræver egen GestureHandlerRootView)
  const scrollView = (
      <Animated.ScrollView
        style={scrollMaxHeight != null ? { maxHeight: scrollMaxHeight } : styles.fill}
        onScroll={onSheetScroll}
        scrollEventThrottle={16}
        scrollEnabled={sheetScrollGesture ? (sheetScrollEnabled ?? true) : true}
        // I drawer-kontekst: ingen bounce i toppen — nedad-træk ved offset 0
        // skal gå rent videre til sheetet
        bounces={!sheetScrollGesture}
        overScrollMode={sheetScrollGesture ? 'never' : 'auto'}
      >
        <View style={styles.headerRow}>
          <GradientView
            colors={[colors.primaryBlue, colors.primaryRed]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerIcon}
          >
            {/* Tag-løse events: samme CalendarClock-fallback som kort-markøren */}
            {tag ? (
              <TagIcon tag={tag.id} size={24} color="#fff" strokeWidth={2.2} />
            ) : (
              <CalendarClock size={24} color="#fff" strokeWidth={2.2} />
            )}
          </GradientView>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{ev.title}</Text>
            {statusPill}
          </View>
        </View>

        <View style={[styles.infoBox, { backgroundColor: colors.inputBackground }]}>
          <View style={styles.infoRow}>
            <Clock size={18} color={colors.textPrimary} />
            <Text style={[styles.infoLine, { color: colors.textPrimary }]}>
              {formatDateTime(ev.time)}
            </Text>
          </View>
          {(ev.meetingPlace || ev.location) ? (
            <Pressable
              style={styles.infoRow}
              onPress={() => {
                const q = ev.location
                  ? `${ev.location.latitude},${ev.location.longitude}`
                  : encodeURIComponent(ev.meetingPlace);
                const url = `https://www.google.com/maps/search/?api=1&query=${q}`;
                Linking.openURL(url).catch(() => {});
              }}
              disabled={!ev.location && !ev.meetingPlace}
            >
              {({ pressed }) => (
                <>
                  <MapPin size={18} color={colors.textPrimary} />
                  <Text style={[styles.infoLine, { color: colors.primaryBlueText, opacity: pressed ? 0.5 : 1 }]}>
                    {ev.meetingPlace || ((t as any).eventsOpenInMaps ?? 'Vis på kort')}
                    {distanceText ? (
                      <Text style={{ color: colors.textMuted }}>{`  ·  ${distanceText}`}</Text>
                    ) : null}
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}
          <View style={styles.infoRow}>
            <Users size={18} color={colors.textSecondary} />
            <Text style={[styles.infoLine, { color: colors.textSecondary }]}>
              {ev.maxParticipants
                ? t.eventsParticipantsOf(ev.participantIds.length, ev.maxParticipants)
                : t.eventsParticipants(ev.participantIds.length)}
            </Text>
          </View>
        </View>

        {ev.description ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {t.descriptionLabel}
            </Text>
            <Text style={[styles.description, { color: colors.textPrimary }]}>
              {ev.description}
            </Text>
          </>
        ) : null}

        {/* Deltagerliste — fundamentet for "Hold kontakten".
            Cappet visning: lange lister render kun de første og viser "+N". */}
        {ev.participantIds.length > 0 && (
          <View style={styles.participantsSection}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {t.eventsParticipantsLabel}
            </Text>
            {ev.participantIds.slice(0, MAX_PARTICIPANTS_SHOWN).map(uid => {
              const profile = profiles[uid];
              const name = profile?.displayName || t.chatsUnknown;
              const isHost = uid === ev.creatorId;
              return (
                <View key={uid} style={styles.participantRow}>
                  {profile?.avatarURL ? (
                    <Image source={{ uri: profile.avatarURL }} style={styles.participantAvatar} />
                  ) : (
                    <GradientView
                      colors={[colors.primaryBlue, colors.primaryRed]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.participantAvatar, styles.participantAvatarFallback]}
                    >
                      <Text style={styles.participantInitial}>{name.charAt(0).toUpperCase()}</Text>
                    </GradientView>
                  )}
                  <Text style={[styles.participantName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {name}
                  </Text>
                  {isHost && (
                    <View style={[styles.hostBadge, { backgroundColor: colors.primaryBlue }]}>
                      <Text style={styles.hostBadgeText}>{t.eventsHostBadge}</Text>
                    </View>
                  )}
                  {uid === user?.uid && (
                    <View style={[styles.hostBadge, { backgroundColor: colors.borderLight }]}>
                      <Text style={[styles.hostBadgeText, { color: colors.textMuted }]}>{t.eventsYouBadge}</Text>
                    </View>
                  )}
                  {renderContactButton(uid)}
                </View>
              );
            })}
            {ev.participantIds.length > MAX_PARTICIPANTS_SHOWN && (
              <Text style={[styles.participantsMore, { color: colors.textMuted }]}>
                {t.eventsParticipantsMore(ev.participantIds.length - MAX_PARTICIPANTS_SHOWN)}
              </Text>
            )}
          </View>
        )}
      </Animated.ScrollView>
  );

  return (
    <View style={scrollMaxHeight == null && styles.fill}>
      {sheetScrollGesture ? (
        <GestureDetector gesture={sheetScrollGesture}>{scrollView}</GestureDetector>
      ) : (
        scrollView
      )}

      <View style={styles.footer}>
        {isCreator ? (
          <>
            <TouchableOpacity style={styles.ctaWrap} onPress={() => onOpenChat(ev.chatId, ev.title)}>
              <GradientView
                colors={[colors.primaryBlue, colors.primaryRed]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cta}
              >
                <MessagesSquare size={18} color="#fff" />
                <Text style={[styles.ctaText, { marginLeft: 8 }]}>Chat</Text>
              </GradientView>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctaSecondary, { borderColor: colors.primaryRed }]}
              onPress={handleCancel}
              disabled={busy}
            >
              <Text style={[styles.ctaSecondaryText, { color: colors.primaryRed }]}>{t.eventsCancel}</Text>
            </TouchableOpacity>
          </>
        ) : isParticipant ? (
          <>
            <TouchableOpacity style={styles.ctaWrap} onPress={() => onOpenChat(ev.chatId, ev.title)}>
              <GradientView
                colors={[colors.primaryBlue, colors.primaryRed]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cta}
              >
                <MessagesSquare size={18} color="#fff" />
                <Text style={[styles.ctaText, { marginLeft: 8 }]}>Chat</Text>
              </GradientView>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctaSecondary, { borderColor: colors.border }]}
              onPress={handleLeave}
              disabled={busy}
            >
              <Text style={[styles.ctaSecondaryText, { color: colors.textPrimary }]}>{t.eventsLeave}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.ctaWrap} onPress={handleJoin} disabled={busy || full}>
            {full ? (
              <View style={[styles.cta, { backgroundColor: colors.textMuted, opacity: 0.6 }]}>
                <Text style={styles.ctaText}>{t.eventsFull}</Text>
              </View>
            ) : (
              <GradientView
                colors={[colors.primaryBlue, colors.primaryRed]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cta}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{t.eventsJoin}</Text>}
              </GradientView>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  infoBox: {
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLine: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  participantsSection: {
    marginBottom: 16,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  participantAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantInitial: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  participantName: {
    flex: 1,
    marginLeft: 11,
    fontSize: 14.5,
    fontWeight: '600',
  },
  hostBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  hostBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  participantsMore: {
    fontSize: 13,
    marginTop: 4,
    marginLeft: 43,
  },
  contactBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  contactBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 14,
  },
  ctaWrap: {
    flex: 1,
  },
  cta: {
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  ctaText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  ctaSecondary: {
    flex: 1,
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  ctaSecondaryText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
