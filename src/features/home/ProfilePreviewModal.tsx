import React from 'react';
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
import { MapPin } from 'lucide-react-native';
import { getStatusTag } from '../../statusTags';
import TagIcon from '../../components/TagIcon';
import RoketLogo from '../../assets/roket-logo-2.svg';

interface PreviewUser {
  id: string;
  displayName: string;
  bio: string;
  status?: string;
  statusTag?: string | null;
  photoURL: string | null;
  avatarURL?: string | null;
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
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.88, 380);
const CARD_PADDING = 20;
const CARD_LEFT = (SCREEN_WIDTH - CARD_WIDTH) / 2;
const AVATAR_SIZE = 32;
const AVATAR_LEFT_IN_SCREEN = CARD_LEFT + CARD_PADDING;
const PHOTO_GAP = 6;
const PHOTO_SIZE = (CARD_WIDTH - CARD_PADDING * 2 - PHOTO_GAP * 2) / 3;

export default function ProfilePreviewModal({ visible, user, onClose, onViewProfile }: ProfilePreviewModalProps) {
  const { colors, t, distanceMode, distanceUnit } = useTheme();

  if (!user) return null;

  const allPhotos = [user.photoURL, ...(user.photos || [])].filter(Boolean) as string[];
  const tag = getStatusTag(user.statusTag);

  const formatLastSeen = (): string => {
    if (!user.lastSeen) return '';
    const diff = Date.now() - user.lastSeen.getTime();
    if (diff < 24 * 60 * 60 * 1000) return '';
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

  const distanceText = formatDistance();
  const lastSeenText = formatLastSeen();
  const hasStatus = !!user.status?.trim();
  const hasBio = !!user.bio?.trim();
  const hasPhotos = allPhotos.length > 0;
  const hasName = !!user.displayName;
  const hasAge = user.age != null;
  const hasDistance = !!distanceText;
  const hasLastSeen = !!lastSeenText;
  const hasIdentityFooter = hasName || hasAge || hasDistance || hasLastSeen;
  const isEmpty = !hasStatus && !tag && !hasBio && !hasPhotos;

  const initials = hasName
    ? user.displayName.trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('')
    : '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.overlayBackground} onPress={onClose} />
        <Pressable style={[styles.card, { backgroundColor: colors.white }]} onPress={onViewProfile}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {isEmpty ? (
              <View style={styles.emptyWrap}>
                <View style={{ opacity: 0.35 }}>
                  <RoketLogo width={CARD_WIDTH * 0.45} height={CARD_WIDTH * 0.45} fill={colors.cardBackgroundIcon} />
                </View>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  {(t as any).profileEmptyState}
                </Text>
              </View>
            ) : (
              <View>
            {tag && (
              <View style={[styles.tagPill, { backgroundColor: colors.primaryBlue }]}>
                <TagIcon tag={tag.id} size={13} color="#fff" />
                <Text style={styles.tagPillText}>
                  {String((t as any)[`tag${tag.id.charAt(0).toUpperCase() + tag.id.slice(1)}`] ?? tag.id)}
                </Text>
              </View>
            )}

            {hasStatus && (
              <View style={styles.statusQuoteWrap}>
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

            {hasPhotos && (
              <View style={styles.photoRow}>
                {allPhotos.slice(0, 3).map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.photo} />
                ))}
              </View>
            )}

            {hasBio && (
              <Text style={[styles.bio, { color: colors.textPrimary }]}>{user.bio}</Text>
            )}

            {hasIdentityFooter && (
              <View style={[styles.identityFooter, { borderTopColor: colors.borderLight }]}>
                <View style={styles.identityLeft}>
                  {user.avatarURL ? (
                    <Image source={{ uri: user.avatarURL }} style={styles.identityAvatar} />
                  ) : initials ? (
                    <GradientView
                      colors={[colors.primaryBlue, colors.primaryRed]}
                      start={{ x: -AVATAR_LEFT_IN_SCREEN / AVATAR_SIZE, y: 0 }}
                      end={{ x: (SCREEN_WIDTH - AVATAR_LEFT_IN_SCREEN) / AVATAR_SIZE, y: 0 }}
                      style={styles.identityAvatar}
                    >
                      <Text style={styles.identityAvatarText}>{initials}</Text>
                    </GradientView>
                  ) : (
                    <View style={[styles.identityAvatar, { backgroundColor: colors.cardBackground }]}>
                      <RoketLogo width={14} height={14} fill={colors.cardBackgroundIcon} />
                    </View>
                  )}
                  <View style={styles.identityText}>
                    {(hasName || hasAge) && (
                      <Text style={[styles.identityName, { color: colors.textPrimary }]}>
                        {user.displayName || ''}{user.displayName && hasAge ? `, ${user.age}` : hasAge ? `${user.age}` : ''}
                      </Text>
                    )}
                    {hasLastSeen && (
                      <Text style={[styles.identityMeta, { color: colors.textMuted }]}>{lastSeenText}</Text>
                    )}
                  </View>
                </View>
                {hasDistance && (
                  <View style={styles.identityDistance}>
                    <MapPin size={12} color={colors.textMuted} />
                    <Text style={[styles.identityDistanceText, { color: colors.textMuted }]}>{distanceText}</Text>
                  </View>
                )}
              </View>
            )}
              </View>
            )}
          </ScrollView>
        </Pressable>
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
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: CARD_WIDTH,
    maxHeight: '85%',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  scroll: {
    padding: CARD_PADDING,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  statusQuoteWrap: {
    flexDirection: 'row',
    paddingBottom: 14,
    paddingLeft: 4,
  },
  statusAccent: {
    width: 3,
    marginRight: 14,
    borderRadius: 100,
    overflow: 'hidden',
  },
  statusAccentFill: { flex: 1 },
  statusQuote: {
    flex: 1,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '400',
    fontStyle: 'italic',
    letterSpacing: -0.2,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 100,
    gap: 5,
    marginBottom: 16,
  },
  tagPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  photoRow: {
    flexDirection: 'row',
    gap: PHOTO_GAP,
    marginBottom: 16,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 10,
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  identityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
  },
  identityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  identityAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  identityAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  identityText: { flex: 1 },
  identityName: {
    fontSize: 13,
    fontWeight: '500',
  },
  identityMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  identityDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    marginLeft: 12,
  },
  identityDistanceText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
