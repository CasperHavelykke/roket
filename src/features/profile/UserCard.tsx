import React from 'react';
import { View, Text, StyleSheet, ImageSourcePropType } from 'react-native';
import { Mail as MailIcon } from 'lucide-react-native';
import CardCarousel from '../home/CardCarousel';
import TagIcon from '../../components/TagIcon';
import type { User } from '../home/HomeScreen';

interface UserCardProps {
  item: User;
  cardWidth: number;
  isCompact: boolean;
  isSingle: boolean;
  numColumns: number;
  primaryBlue: string;
  fallbackSource: ImageSourcePropType;
  isUnread: boolean;
  showTestBadge: boolean;
  testBadgeLabel: string;
  onPress: (item: User) => void;
  onLongPress: (item: User) => void;
  onMessagePress: (item: User) => void;
}

const UserCard = React.memo(function UserCard({
  item, cardWidth, isCompact, isSingle, numColumns,
  primaryBlue, fallbackSource, isUnread, showTestBadge,
  testBadgeLabel, onPress, onLongPress, onMessagePress,
}: UserCardProps) {
  const allPhotos = item.photoURL ? [item.photoURL, ...(item.photos || [])] : [];
  return (
    <>
      <CardCarousel
        photos={allPhotos}
        width={cardWidth}
        fallbackSource={fallbackSource}
        compact={isCompact}
        isSingle={isSingle}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item)}
      />
      {(item.status || isUnread) && (
        <View
          style={[
            styles.cardOverlay,
            !item.status && { backgroundColor: 'transparent' },
            isUnread && { backgroundColor: 'rgba(67,97,238,0.5)' },
          ]}
          pointerEvents="none"
        >
          {item.status ? (
            <>
              <Text
                style={[
                  styles.cardName,
                  isCompact && { fontSize: 18 },
                  numColumns === 4 && { fontSize: 14 },
                  isSingle && { fontSize: 34 },
                ]}
                numberOfLines={numColumns >= 2 && numColumns <= 4 ? 5 : 4}
                adjustsFontSizeToFit
                minimumFontScale={0.55}
              >{item.status}</Text>
              {isSingle && item.bio ? (
                <Text style={styles.cardBio}>{item.bio}</Text>
              ) : null}
            </>
          ) : null}
        </View>
      )}
      {item.statusTag && (
        <View style={[styles.tagBadge, isCompact && styles.tagBadgeCompact]} pointerEvents="none">
          <TagIcon tag={item.statusTag} size={isCompact ? 14 : 18} color="#fff" />
        </View>
      )}
      {showTestBadge && (
        <View style={styles.testBadge}>
          <Text style={styles.testBadgeText}>{testBadgeLabel}</Text>
        </View>
      )}
      {isUnread && (
        <>
          <View style={[styles.unreadBorder, { borderColor: primaryBlue }]} pointerEvents="none" />
          {!isCompact && (
            <View
              style={[styles.messageBadge, { backgroundColor: '#fff' }, isSingle && styles.messageBadgeSingle]}
              onStartShouldSetResponder={() => true}
              onResponderRelease={() => onMessagePress(item)}
            >
              <MailIcon size={isSingle ? 28 : 22} color={primaryBlue} />
            </View>
          )}
        </>
      )}
    </>
  );
});

export default UserCard;

const styles = StyleSheet.create({
  cardOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  cardName: {
    fontSize: 23,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  cardBio: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  testBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  testBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  tagBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagBadgeCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
    top: 6,
    right: 6,
  },
  unreadBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderRadius: 14,
    zIndex: 5,
  },
  messageBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  messageBadgeSingle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    bottom: 10,
    right: 10,
  },
});
