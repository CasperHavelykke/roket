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
import { MessageSquare as MessageIcon } from 'lucide-react-native';
import { getStatusTag } from '../../statusTags';
import TagIcon from '../../components/TagIcon';

interface PreviewUser {
  id: string;
  displayName: string;
  bio: string;
  status?: string;
  statusTag?: string | null;
  photoURL: string | null;
  distance?: number;
  lastSeen?: Date;
  distanceMode?: string;
  age?: number;
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

  const distStr = formatDistance();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.overlayBackground} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          {/* Header: thumbnail (tappable) + status */}
          <View style={styles.header}>
            <Pressable onPress={onViewProfile}>
              <Image
                source={allPhotos.length > 0 ? { uri: allPhotos[0] } : (isDark ? require('../../assets/missing-profile-pic.png') : require('../../assets/missing-profile-pic-light.png'))}
                style={styles.thumbnail}
              />
            </Pressable>
            <View style={styles.headerText}>
              {(() => {
                const tag = getStatusTag(user.statusTag);
                return tag ? (
                  <View style={[styles.tagPill, { backgroundColor: colors.primaryBlue }]}>
                    <TagIcon tag={tag.id} size={14} color="#fff" />
                    <Text style={[styles.tagPillText, { marginLeft: 5 }]}>{String((t as any)[`tag${tag.id.charAt(0).toUpperCase() + tag.id.slice(1)}`] ?? tag.id)}</Text>
                  </View>
                ) : null;
              })()}
              {user.status ? (
                <Text style={[styles.statusText, { color: colors.textPrimary }]}>{user.status}</Text>
              ) : null}
            </View>
          </View>

          {/* Description */}
          <View style={styles.info}>
            {user.bio ? (
              <Text style={[styles.bio, { color: colors.textSecondary }]}>{user.bio}</Text>
            ) : (
              <Text style={[styles.bio, { color: colors.textMuted }]}>{t.profileNoBio}</Text>
            )}

            <Pressable
              onPress={onSendMessage}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <GradientView
                colors={[colors.primaryBlue, colors.primaryRed]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sendButton}
              >
                <MessageIcon size={20} color="#fff" />
                <Text style={styles.actionButtonText}>{t.profileSendMessage}</Text>
              </GradientView>
            </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  headerText: {
    flex: 1,
  },
  statusText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 6,
  },
  tagPillEmoji: {
    fontSize: 13,
    marginRight: 4,
  },
  tagPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  info: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
