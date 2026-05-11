import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

interface ScheduleEventModalProps {
  visible: boolean;
  initial?: Date | null;
  onClose: () => void;
  onConfirm: (date: Date) => void;
}

const TIME_SLOTS: { h: number; m: number }[] = [];
for (let h = 0; h < 24; h++) {
  TIME_SLOTS.push({ h, m: 0 });
  TIME_SLOTS.push({ h, m: 30 });
}

export default function ScheduleEventModal({ visible, initial, onClose, onConfirm }: ScheduleEventModalProps) {
  const { colors, t, timeFormat, language } = useTheme();
  const insets = useSafeAreaInsets();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [visible]);

  const days = useMemo(() => {
    const list: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      list.push(d);
    }
    return list;
  }, [today]);

  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    if (initial) {
      const d = new Date(initial);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return today;
  });
  const [selectedSlot, setSelectedSlot] = useState<{ h: number; m: number } | null>(() => {
    if (initial) return { h: initial.getHours(), m: initial.getMinutes() };
    return null;
  });

  const localeMap: Record<string, string> = {
    da: 'da-DK', en: 'en-GB', es: 'es-ES', de: 'de-DE', fr: 'fr-FR', pt: 'pt-PT',
  };
  const locale = localeMap[language] || 'en-GB';

  const formatDay = (d: Date): string => {
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) return t.eventsTimeToday;
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return t.eventsTimeTomorrow;
    return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatSlot = (h: number, m: number): string => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: timeFormat === '12h',
    });
  };

  const isSlotInPast = (h: number, m: number): boolean => {
    const isToday = selectedDay.toDateString() === today.toDateString();
    if (!isToday) return false;
    const now = new Date();
    if (h < now.getHours()) return true;
    if (h === now.getHours() && m <= now.getMinutes()) return true;
    return false;
  };

  const handleConfirm = () => {
    if (!selectedSlot) return;
    const result = new Date(selectedDay);
    result.setHours(selectedSlot.h, selectedSlot.m, 0, 0);
    onConfirm(result);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity activeOpacity={1} style={styles.overlayBg} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handleArea}>
            <View style={styles.handle} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t.eventsScheduleTitle}</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
            {days.map(d => {
              const isActive = d.toDateString() === selectedDay.toDateString();
              return (
                <TouchableOpacity
                  key={d.toISOString()}
                  style={[
                    styles.dayChip,
                    { backgroundColor: colors.card, borderColor: colors.inputBorder },
                    isActive && { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
                  ]}
                  onPress={() => setSelectedDay(d)}
                >
                  <Text style={[styles.dayChipText, { color: colors.textPrimary }, isActive && { color: '#fff' }]}>
                    {formatDay(d)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView style={styles.slotScroll} contentContainerStyle={styles.slotGrid}>
            {TIME_SLOTS.map(slot => {
              const past = isSlotInPast(slot.h, slot.m);
              const isActive = selectedSlot?.h === slot.h && selectedSlot?.m === slot.m;
              return (
                <TouchableOpacity
                  key={`${slot.h}-${slot.m}`}
                  style={[
                    styles.slot,
                    { backgroundColor: colors.card, borderColor: colors.inputBorder },
                    isActive && { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
                    past && { opacity: 0.3 },
                  ]}
                  onPress={() => !past && setSelectedSlot(slot)}
                  disabled={past}
                >
                  <Text style={[styles.slotText, { color: colors.textPrimary }, isActive && { color: '#fff' }]}>
                    {formatSlot(slot.h, slot.m)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: colors.primaryBlue }, !selectedSlot && { opacity: 0.5 }]}
              onPress={handleConfirm}
              disabled={!selectedSlot}
            >
              <Text style={styles.ctaText}>{t.eventsScheduleConfirm}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '85%',
  },
  handleArea: { paddingVertical: 8, alignItems: 'center', marginBottom: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  dayRow: { gap: 8, paddingRight: 20, paddingBottom: 4 },
  dayChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  dayChipText: { fontSize: 14, fontWeight: '600' },
  slotScroll: { maxHeight: 320, marginTop: 16 },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  slot: {
    width: '23%',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  slotText: { fontSize: 14, fontWeight: '600' },
  footer: { paddingTop: 16 },
  cta: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
