import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { STATUS_TAGS, StatusTagId } from '../../statusTags';
import { DEFAULT_EVENT_DURATION_MINUTES, eventEndsAt, eventExpiryFromEnd } from '../../events';
import { geohashForLocation } from 'geofire-common';
import ScheduleEventModal from './ScheduleEventModal';
import TagIcon from '../../components/TagIcon';
import MapPickerModal from './MapPickerModal';
import { Calendar, MapPin, X } from 'lucide-react-native';

interface CreateEventModalProps {
  visible: boolean;
  onClose: () => void;
  userLocation: { latitude: number; longitude: number } | null;
}

const TIME_PRESETS = [30, 60, 120, 180]; // minutter

export default function CreateEventModal({ visible, onClose, userLocation }: CreateEventModalProps) {
  const { colors, t } = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [meetingPlace, setMeetingPlace] = useState('');
  const [meetingLocation, setMeetingLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [tag, setTag] = useState<StatusTagId | null>(null);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [minutesFromNow, setMinutesFromNow] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(visible);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const translateY = useRef(new Animated.Value(600)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
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
          Animated.timing(translateY, { toValue: 600, duration: 200, useNativeDriver: true }).start(() => {
            handleClose();
          });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        }
      },
    }),
  ).current;

  // Rund tid op til nærmeste halve time (00 eller 30 min)
  const computeEventTime = (minsFromNow: number): Date => {
    if (scheduledTime) return scheduledTime;
    const t = new Date(Date.now() + minsFromNow * 60 * 1000);
    const mins = t.getMinutes();
    const roundedMins = Math.round(mins / 30) * 30;
    t.setMinutes(roundedMins, 0, 0);
    return t;
  };

  const reset = () => {
    setTitle('');
    setDescription('');
    setMeetingPlace('');
    setMeetingLocation(null);
    setTag(null);
    setMaxParticipants('');
    setMinutesFromNow(60);
    setScheduledTime(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert(t.error, t.eventsErrorTitle);
      return;
    }
    if (scheduledTime && !meetingLocation) {
      Alert.alert(t.error, t.eventsErrorLocation);
      return;
    }
    if (!userLocation) return;

    const user = auth().currentUser;
    if (!user) return;

    const time = computeEventTime(minutesFromNow);
    // Varighed-UI kommer i Fase 2 — indtil da default 2 timer
    const durationMinutes = DEFAULT_EVENT_DURATION_MINUTES;
    const endsAt = eventEndsAt({ time, durationMinutes });
    const expiresAt = eventExpiryFromEnd(endsAt);
    const max = parseInt(maxParticipants, 10);

    setSubmitting(true);
    try {
      const eventRef = firestore().collection('events').doc();
      const chatId = `event_${eventRef.id}`;

      const eventLoc = meetingLocation ?? userLocation;
      await eventRef.set({
        creatorId: user.uid,
        title: title.trim(),
        description: description.trim(),
        meetingPlace: meetingPlace.trim(),
        location: {
          latitude: eventLoc.latitude,
          longitude: eventLoc.longitude,
        },
        geohash: geohashForLocation([eventLoc.latitude, eventLoc.longitude]),
        meetingLocationManual: !!meetingLocation,
        time: firestore.Timestamp.fromDate(time),
        durationMinutes: durationMinutes,
        maxParticipants: isNaN(max) || max < 2 ? null : max,
        participantIds: [user.uid],
        tag: tag,
        chatId: chatId,
        createdAt: firestore.FieldValue.serverTimestamp(),
        expiresAt: firestore.Timestamp.fromDate(expiresAt),
      });

      // Opret den tilhørende gruppechat
      await firestore().collection('chats').doc(chatId).set({
        participants: [user.uid],
        eventId: eventRef.id,
        eventTitle: title.trim(),
        expiresAt: firestore.Timestamp.fromDate(expiresAt),
        createdAt: firestore.FieldValue.serverTimestamp(),
        lastMessage: '',
        lastMessageTime: firestore.FieldValue.serverTimestamp(),
      });

      reset();
      onClose();
    } catch (e) {
      console.error('Failed to create event:', e);
      Alert.alert(t.error, t.eventsErrorCreate);
    } finally {
      setSubmitting(false);
    }
  };

  const presetLabel = (mins: number) => {
    if (mins < 60) return `${mins}${t.eventsUnitMin}`;
    return `${mins / 60}${t.eventsUnitHour}`;
  };

  return (
    <Modal visible={mounted} animationType="none" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.flex}
      >
        <View style={styles.overlay}>
          <Animated.View style={[styles.overlayBg, { opacity: overlayOpacity }]}>
            <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={handleClose} />
          </Animated.View>
          <Animated.View
            style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20, transform: [{ translateY }] }]}
          >
            <View style={styles.handleArea} {...panResponder.panHandlers}>
              <View style={styles.handle} />
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t.eventsCreateTitle}</Text>

            <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t.eventsTitleLabel}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.inputBorder }]}
                value={title}
                onChangeText={setTitle}
                placeholder={t.eventsTitlePlaceholder}
                placeholderTextColor={colors.textMuted}
                maxLength={75}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>{t.eventsTimeLabel}</Text>
              <View style={styles.chipRow}>
                {TIME_PRESETS.map(mins => {
                  const isActive = !scheduledTime && minutesFromNow === mins;
                  return (
                    <TouchableOpacity
                      key={mins}
                      style={[
                        styles.chip,
                        { backgroundColor: colors.card, borderColor: colors.inputBorder },
                        isActive && { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
                      ]}
                      onPress={() => { setScheduledTime(null); setMinutesFromNow(mins); }}
                    >
                      <Text style={[styles.chipText, { color: colors.textPrimary }, isActive && { color: '#fff' }]}>
                        {presetLabel(mins)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[
                    styles.chip,
                    { backgroundColor: colors.card, borderColor: colors.inputBorder },
                    !!scheduledTime && { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
                  ]}
                  onPress={() => setShowScheduler(true)}
                >
                  <Calendar size={14} color={!!scheduledTime ? '#fff' : colors.textPrimary} />
                  <Text style={[styles.chipText, { color: colors.textPrimary, marginLeft: 5 }, !!scheduledTime && { color: '#fff' }]}>
                    {t.eventsSchedule}
                  </Text>
                </TouchableOpacity>
              </View>
              {(() => {
                const eventTime = computeEventTime(minutesFromNow);
                const expiry = eventExpiryFromEnd(eventEndsAt({ time: eventTime }));
                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const formatLabel = (d: Date) => {
                  const isToday = today.toDateString() === d.toDateString();
                  const isTomorrow = tomorrow.toDateString() === d.toDateString();
                  const hh = d.getHours().toString().padStart(2, '0');
                  const mm = d.getMinutes().toString().padStart(2, '0');
                  const day = isToday ? t.eventsTimeToday : isTomorrow ? t.eventsTimeTomorrow : d.toLocaleDateString();
                  return `${day} ${hh}:${mm}`;
                };
                return (
                  <>
                    <Text style={[styles.hint, { color: colors.textMuted }]}>
                      {t.eventsStartsAt(formatLabel(eventTime))}
                    </Text>
                    <Text style={[styles.hint, { color: colors.textMuted, marginTop: 2 }]}>
                      {t.eventsVisibleUntil(formatLabel(expiry))}
                    </Text>
                  </>
                );
              })()}

              <Text style={[styles.label, { color: colors.textSecondary }]}>{t.eventsPlaceLabel}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.inputBorder }]}
                value={meetingPlace}
                onChangeText={setMeetingPlace}
                placeholder={t.eventsPlacePlaceholder}
                placeholderTextColor={colors.textMuted}
                maxLength={100}
              />
              <TouchableOpacity
                style={[
                  styles.locationButton,
                  { borderColor: meetingLocation ? colors.primaryBlue : (scheduledTime ? colors.primaryRed : colors.inputBorder) },
                ]}
                onPress={() => setShowMapPicker(true)}
              >
                <MapPin size={16} color={meetingLocation ? colors.primaryBlue : (scheduledTime ? colors.primaryRed : colors.textSecondary)} />
                <Text style={[styles.locationButtonText, { color: meetingLocation ? colors.primaryBlueText : (scheduledTime ? colors.primaryRed : colors.textSecondary) }]}>
                  {meetingLocation
                    ? `${meetingLocation.latitude.toFixed(4)}, ${meetingLocation.longitude.toFixed(4)}`
                    : (scheduledTime
                      ? (t.eventsPickLocationCta ?? 'Vælg mødested')
                      : ((t as any).eventsPickLocationOptional ?? 'Tilføj pin på kort (valgfri)'))}
                </Text>
                {meetingLocation && (
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); setMeetingLocation(null); }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              {!meetingLocation && !scheduledTime && (
                <Text style={[styles.hint, { color: colors.textMuted, marginTop: 6 }]}>
                  {(t as any).eventsPlaceFallbackHint}
                </Text>
              )}

              <Text style={[styles.label, { color: colors.textSecondary }]}>{t.eventsTagLabel}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowScroll}>
                {STATUS_TAGS.map(s => {
                  const isActive = tag === s.id;
                  const labelKey = `tag${s.id.charAt(0).toUpperCase() + s.id.slice(1)}` as keyof typeof t;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.chip,
                        { backgroundColor: colors.card, borderColor: colors.inputBorder, marginRight: 8 },
                        isActive && { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
                      ]}
                      onPress={() => setTag(isActive ? null : s.id)}
                    >
                      <TagIcon tag={s.id} size={14} color={isActive ? '#fff' : colors.textPrimary} />
                      <Text style={[styles.chipText, { color: colors.textPrimary, marginLeft: 5 }, isActive && { color: '#fff' }]}>
                        {String(t[labelKey] ?? s.id)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.label, { color: colors.textSecondary }]}>{t.eventsMaxLabel}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.inputBorder }]}
                value={maxParticipants}
                onChangeText={v => setMaxParticipants(v.replace(/[^0-9]/g, '').slice(0, 3))}
                placeholder={t.eventsMaxPlaceholder}
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>{t.eventsDescriptionLabel}</Text>
              <TextInput
                style={[styles.input, styles.textarea, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.inputBorder }]}
                value={description}
                onChangeText={setDescription}
                placeholder={t.eventsDescriptionPlaceholder}
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
              />
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.cta, { backgroundColor: colors.primaryBlue }, (submitting || !title.trim()) && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={submitting || !title.trim()}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaText}>{t.eventsCreateButton}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
      <ScheduleEventModal
        visible={showScheduler}
        initial={scheduledTime}
        onClose={() => setShowScheduler(false)}
        onConfirm={(d) => setScheduledTime(d)}
      />
      <MapPickerModal
        visible={showMapPicker}
        initial={meetingLocation ?? userLocation}
        onClose={() => setShowMapPicker(false)}
        onConfirm={(loc) => setMeetingLocation(loc)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
  },
  form: {
    maxHeight: 480,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chipRowScroll: {
    paddingRight: 20,
    gap: 0,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  locationButtonText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipEmoji: {
    fontSize: 14,
    marginRight: 5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    marginTop: 8,
  },
  footer: {
    paddingTop: 16,
  },
  cta: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
