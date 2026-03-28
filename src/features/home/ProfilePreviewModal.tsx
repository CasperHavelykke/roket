import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import GradientView from '../../components/GradientView';
import { useTheme } from '../../theme';

interface PreviewUser {
  id: string;
  displayName: string;
  bio: string;
  photoURL: string | null;
  distance?: number;
  lastSeen?: Date;
  distanceMode?: string;
  age?: number;
  gender?: string;
  sexuality?: string;
  photos?: string[];
}

interface ProfilePreviewModalProps {
  visible: boolean;
  user: PreviewUser | null;
  onClose: () => void;
  onViewProfile: () => void;
  onSendMessage: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.85, 380);
const INFO_PADDING = 16;
const BUTTON_GAP = 10;
const BUTTON_WIDTH = (CARD_WIDTH - INFO_PADDING * 2 - BUTTON_GAP) / 2;
const CARD_LEFT = (SCREEN_WIDTH - CARD_WIDTH) / 2;
const BTN1_LEFT = CARD_LEFT + INFO_PADDING;
const BTN2_LEFT = BTN1_LEFT + BUTTON_WIDTH + BUTTON_GAP;

export default function ProfilePreviewModal({ visible, user, onClose, onViewProfile, onSendMessage }: ProfilePreviewModalProps) {
  const { colors, isDark, t, distanceMode, distanceUnit } = useTheme();
  const [photoIndex, setPhotoIndex] = useState(0);

  if (!user) return null;

  const allPhotos = [user.photoURL, ...(user.photos || [])].filter(Boolean) as string[];
  const isOnline = user.lastSeen ? Date.now() - user.lastSeen.getTime() < 5 * 60 * 1000 : false;

  const formatLastSeen = (): string => {
    if (!user.lastSeen) return '';
    const diff = Date.now() - user.lastSeen.getTime();
    if (diff < 5 * 60 * 1000) return t.profileOnlineNow;
    if (diff < 60 * 60 * 1000) return t.profileLastSeenMinutes(Math.floor(diff / 60000));
    if (diff < 24 * 60 * 60 * 1000) return t.profileLastSeenHours(Math.floor(diff / 3600000));
    return t.profileLastSeenDays(Math.floor(diff / 86400000));
  };

  const formatDistance = (): string => {
    const d = user.distance;
    if (d == null) return '';
    if (distanceMode === 'hidden' || user.distanceMode === 'hidden') return '';
    if (distanceUnit === 'mi') {
      const miles = d * 0.621371;
      if ((distanceMode === 'fuzzy' || user.distanceMode === 'fuzzy') && d < 0.03) return t.distanceUnder100ft;
      if (miles < 1) return t.distanceFeet(Math.round(miles * 5280));
      return t.distanceMiles(miles.toFixed(1));
    }
    if ((distanceMode === 'fuzzy' || user.distanceMode === 'fuzzy') && d < 0.03) return t.distanceUnder30;
    if (d < 1) return t.distanceMeters(Math.round(d * 1000));
    return t.distanceKm(d.toFixed(1).replace('.', ','));
  };

  const genderLabels: Record<string, string> = {
    male: t.genderMale, female: t.genderFemale, nonbinary: t.genderNonBinary, trans: t.genderTrans,
  };
  const sexualityLabels: Record<string, string> = {
    straight: t.sexualityStraight, gay: t.sexualityGay, bisexual: t.sexualityBisexual,
    pansexual: t.sexualityPansexual, other: t.sexualityOther,
  };

  const distStr = formatDistance();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.overlayBackground} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          {/* Photo */}
          <View style={styles.photoContainer}>
            {allPhotos.length > 1 ? (
              <>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  bounces={false}
                  onMomentumScrollEnd={(e) => {
                    setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH));
                  }}
                >
                  {allPhotos.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={styles.photo} resizeMode="cover" />
                  ))}
                </ScrollView>
                <View style={styles.photoCountBadge} pointerEvents="none">
                  <Text style={styles.photoCountText}>{photoIndex + 1}/{allPhotos.length}</Text>
                </View>
              </>
            ) : allPhotos.length === 1 ? (
              <Image source={{ uri: allPhotos[0] }} style={styles.photo} resizeMode="cover" />
            ) : (
              <Image
                source={isDark ? require('../../assets/missing-profile-pic.png') : require('../../assets/missing-profile-pic-light.png')}
                style={styles.photo}
                resizeMode="cover"
              />
            )}
            {isOnline && <View style={[styles.onlineDot, { backgroundColor: colors.online }]} />}
          </View>

          {/* Info */}
          <View style={styles.info}>
            <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
              {user.displayName || ''}{user.displayName && user.age ? `, ${user.age}` : user.age ? `${user.age}` : ''}
            </Text>

            {user.lastSeen && (
              <Text style={[styles.status, { color: isOnline ? colors.online : colors.offline }]}>
                {isOnline ? '● ' : '○ '}{formatLastSeen()}
              </Text>
            )}

            {distStr !== '' && (
              <Text style={[styles.distance, { color: colors.primaryRed }]}>📍 {distStr}</Text>
            )}

            {(user.gender || user.sexuality) && (
              <View style={styles.chips}>
                {user.gender && (
                  <View style={[styles.chip, { backgroundColor: colors.backgroundLight, borderColor: colors.inputBorder }]}>
                    <Text style={[styles.chipText, { color: colors.textSecondary }]}>{genderLabels[user.gender] ?? user.gender}</Text>
                  </View>
                )}
                {user.sexuality && (
                  <View style={[styles.chip, { backgroundColor: colors.backgroundLight, borderColor: colors.inputBorder }]}>
                    <Text style={[styles.chipText, { color: colors.textSecondary }]}>{sexualityLabels[user.sexuality] ?? user.sexuality}</Text>
                  </View>
                )}
              </View>
            )}

            {user.bio ? (
              <Text style={[styles.bio, { color: colors.textPrimary }]} numberOfLines={3}>{user.bio}</Text>
            ) : (
              <Text style={[styles.bio, { color: colors.textMuted }]}>{t.profileNoBio}</Text>
            )}

            <View style={styles.buttons}>
              <Pressable
                onPress={onViewProfile}
                style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.8 : 1 }]}
              >
                <GradientView
                  colors={[colors.primaryBlue, colors.primaryRed]}
                  start={{ x: -BTN1_LEFT / BUTTON_WIDTH, y: 0 }}
                  end={{ x: (SCREEN_WIDTH - BTN1_LEFT) / BUTTON_WIDTH, y: 0 }}
                  style={styles.actionButtonGradient}
                >
                  <Text style={styles.actionButtonText}>{t.previewViewProfile}</Text>
                </GradientView>
              </Pressable>
              <Pressable
                onPress={onSendMessage}
                style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.8 : 1 }]}
              >
                <GradientView
                  colors={[colors.primaryBlue, colors.primaryRed]}
                  start={{ x: -BTN2_LEFT / BUTTON_WIDTH, y: 0 }}
                  end={{ x: (SCREEN_WIDTH - BTN2_LEFT) / BUTTON_WIDTH, y: 0 }}
                  style={styles.actionButtonGradient}
                >
                  <Text style={styles.actionButtonText}>{t.profileSendMessage}</Text>
                </GradientView>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  photoContainer: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
  },
  photo: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
  },
  photoCountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  photoCountText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  onlineDot: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  info: {
    padding: 16,
    gap: 6,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
  },
  distance: {
    fontSize: 13,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
