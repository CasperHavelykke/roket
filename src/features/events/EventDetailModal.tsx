import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import EventDetailContent from './EventDetailContent';
import { EventDoc } from '../../events';

interface EventDetailModalProps {
  visible: boolean;
  event: EventDoc | null;
  onClose: () => void;
  onOpenChat: (chatId: string, eventTitle: string) => void;
  // Gæste-gate (Pivot 2.0): kaldes hvis en gæst forsøger at deltage
  onRequireAccount?: () => void;
}

/**
 * Modal-indpakning af EventDetailContent. Efter forside-redesignet
 * (detalje-i-drawer) bruges modalen kun fra chattens Hold kontakten-nudge,
 * hvor detaljen skal åbne OVEN PÅ chatten — draweren findes kun på kortet.
 */
export default function EventDetailModal({ visible, event, onClose, onOpenChat, onRequireAccount }: EventDetailModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <EventDetailContent
            event={displayEvent}
            onClose={onClose}
            onOpenChat={onOpenChat}
            onRequireAccount={onRequireAccount}
            scrollMaxHeight={400}
          />
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
});
