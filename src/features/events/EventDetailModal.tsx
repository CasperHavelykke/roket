import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  PanResponder,
  Linking,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { getStatusTag } from '../../statusTags';
import TagIcon from '../../components/TagIcon';
import { Clock, MapPin, Users, MessagesSquare } from 'lucide-react-native';
import { EventDoc, isEventFull } from '../../events';

interface EventDetailModalProps {
  visible: boolean;
  event: EventDoc | null;
  onClose: () => void;
  onOpenChat: (chatId: string, eventTitle: string) => void;
}

export default function EventDetailModal({ visible, event, onClose, onOpenChat }: EventDetailModalProps) {
  const { colors, t, timeFormat, language } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(visible);
  const [displayEvent, setDisplayEvent] = useState<EventDoc | null>(event);
  const translateY = useRef(new Animated.Value(600)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (event) setDisplayEvent(event);
  }, [event]);

  useEffect(() => {
    if (visible) {
      // Hvis modal lige er ved at lukke, reset translateY til startposition før indgang
      if (!mounted) {
        translateY.setValue(600);
        overlayOpacity.setValue(0);
      }
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 9, tension: 65 }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 600, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.6) {
          Animated.timing(translateY, { toValue: 600, duration: 200, useNativeDriver: true }).start(() => onClose());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        }
      },
    }),
  ).current;

  if (!displayEvent || !mounted) return null;
  const ev = displayEvent;

  const user = auth().currentUser;
  const isCreator = user?.uid === ev.creatorId;
  const isParticipant = !!user && ev.participantIds.includes(user.uid);
  const tag = getStatusTag(ev.tag);
  const full = isEventFull(ev);

  const handleJoin = async () => {
    if (!user) return;
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
      // Optimistisk opdater lokalt så Chat/Forlad-knapper vises straks
      setDisplayEvent(prev => prev ? { ...prev, participantIds: [...prev.participantIds, user.uid] } : prev);
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

  return (
    <Modal visible={mounted} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.overlayBg, { opacity: overlayOpacity }]}>
          <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20, transform: [{ translateY }] }]}>
          <View style={styles.handleArea} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>
          <ScrollView style={styles.content}>
            <View style={styles.headerRow}>
              {tag && <TagIcon tag={tag.id} size={28} color={colors.textPrimary} />}
              <Text style={[styles.title, { color: colors.textPrimary }]}>{ev.title}</Text>
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.card }]}>
              <View style={styles.infoRow}>
                <Clock size={18} color={colors.textPrimary} />
                <Text style={[styles.infoLine, { color: colors.textPrimary }]}>
                  {formatDateTime(ev.time)}
                </Text>
              </View>
              {(ev.meetingPlace || ev.location) ? (
                <TouchableOpacity
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
                  <MapPin size={18} color={colors.textPrimary} />
                  <Text style={[styles.infoLine, { color: colors.primaryBlueText }]}>
                    {ev.meetingPlace || ((t as any).eventsOpenInMaps ?? 'Vis på kort')}
                  </Text>
                </TouchableOpacity>
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
                <Text style={[styles.descriptionLabel, { color: colors.textSecondary }]}>
                  {t.descriptionLabel}
                </Text>
                <Text style={[styles.description, { color: colors.textPrimary }]}>
                  {ev.description}
                </Text>
              </>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {isCreator ? (
              <>
                <TouchableOpacity
                  style={[styles.cta, { backgroundColor: colors.primaryBlue }]}
                  onPress={() => onOpenChat(ev.chatId, ev.title)}
                >
                  <MessagesSquare size={18} color="#fff" />
                  <Text style={[styles.ctaText, { marginLeft: 8 }]}>Chat</Text>
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
                <TouchableOpacity
                  style={[styles.cta, { backgroundColor: colors.primaryBlue }]}
                  onPress={() => onOpenChat(ev.chatId, ev.title)}
                >
                  <MessagesSquare size={18} color="#fff" />
                  <Text style={[styles.ctaText, { marginLeft: 8 }]}>Chat</Text>
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
              <TouchableOpacity
                style={[styles.cta, { backgroundColor: full ? colors.textMuted : colors.primaryBlue }, full && { opacity: 0.6 }]}
                onPress={handleJoin}
                disabled={busy || full}
              >
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.ctaText}>{full ? t.eventsFull : t.eventsJoin}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
    maxHeight: '90%',
  },
  handleArea: {
    paddingVertical: 14,
    paddingHorizontal: 60,
    alignItems: 'center',
    marginBottom: 4,
    marginHorizontal: -20,
    marginTop: -12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
  },
  content: {
    maxHeight: 400,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  emoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    flex: 1,
  },
  infoBox: {
    borderRadius: 14,
    padding: 14,
    gap: 10,
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
  descriptionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  footer: {
    paddingTop: 16,
    gap: 10,
  },
  cta: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  ctaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  ctaSecondary: {
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  ctaSecondaryText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
