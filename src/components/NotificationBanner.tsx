import React, { useState, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

export interface NotificationData {
  senderName: string;
  senderId: string;
  message: string;
  senderPhoto?: string | null;
  // Sat for event-gruppechats — tap skal åbne gruppechatten, ikke 1:1
  eventChatId?: string;
  eventTitle?: string;
  // Label i højre side — default er "Ny besked"; pushes uden afsender
  // (nærheds-events, Hold kontakten) sætter deres egen
  label?: string;
  // Hold kontakten-anmodning: tap åbner aktivitetens detalje på kortet
  contactEventId?: string;
}

export interface NotificationBannerRef {
  show: (data: NotificationData) => void;
}

const BANNER_HEIGHT = 80;
const AUTO_DISMISS_MS = 4000;

const NotificationBanner = forwardRef<NotificationBannerRef, { onPress: (data: NotificationData) => void }>(
  ({ onPress }, ref) => {
    const { colors, isDark, t } = useTheme();
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(-(BANNER_HEIGHT + insets.top + 20))).current;
    const [data, setData] = useState<NotificationData | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const visibleRef = useRef(false);

    const dismiss = useCallback(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      visibleRef.current = false;
      Animated.timing(translateY, {
        toValue: -(BANNER_HEIGHT + insets.top + 20),
        duration: 250,
        useNativeDriver: true,
      }).start();
    }, [insets.top]);

    useImperativeHandle(ref, () => ({
      show: (newData: NotificationData) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setData(newData);
        visibleRef.current = true;

        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 10,
          tension: 80,
        }).start();

        timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
      },
    }), [dismiss]);

    const handlePress = () => {
      dismiss();
      if (data) onPress(data);
    };

    if (!data) return null;

    return (
      <Animated.View
        style={[
          styles.container,
          {
            paddingTop: insets.top + 8,
            transform: [{ translateY }],
            backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
            shadowColor: '#000',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.content}
          activeOpacity={0.8}
          onPress={handlePress}
        >
          {data.senderPhoto ? (
            <Image source={{ uri: data.senderPhoto }} style={styles.avatar} />
          ) : (
            <Image
              source={isDark ? require('../assets/missing-profile-pic.png') : require('../assets/missing-profile-pic-light.png')}
              style={styles.avatar}
            />
          )}
          <View style={styles.textContainer}>
            <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
              {data.senderName}
            </Text>
            <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={1}>
              {data.message}
            </Text>
          </View>
          <Text style={[styles.label, { color: colors.primaryBlueText }]}>{data.label ?? t.notificationNewMessage}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingBottom: 12,
    paddingHorizontal: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default NotificationBanner;
