import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../../components/GradientView';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../theme';
import { Camera as CameraIcon } from 'lucide-react-native';
import RoketLogo from '../../assets/roket-logo-2.svg';
import RoketLogoHeader from '../../assets/roket-logo-simpel.svg';
import TagIcon from '../../components/TagIcon';
import { StatusTagId } from '../../statusTags';

interface ChatPreview {
  chatId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserPhoto: string | null;
  otherUserTestAccount: boolean;
  lastMessage: string;
  lastMessageTime: any;
  unreadCount: number;
  pinned: boolean;
  isEvent?: boolean;
  eventId?: string;
  eventTag?: StatusTagId | null;
}

const SWIPE_THRESHOLD = 70;

function SwipeableRow({ children, onAction, actionLabel, actionColor, rowBackground }: {
  children: React.ReactNode;
  onAction: () => void;
  actionLabel: string;
  actionColor: string;
  rowBackground: string;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const startOffset = useRef(0);
  const lastValue = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderGrant: () => {
        translateX.stopAnimation((value) => {
          startOffset.current = value;
          lastValue.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const target = startOffset.current + gestureState.dx;
        let value: number;
        if (target > 0) {
          value = target * 0.3;
        } else if (target > -100) {
          value = target;
        } else {
          value = -100 + (target + 100) * 0.3;
        }
        lastValue.current = value;
        translateX.setValue(value);
      },
      onPanResponderRelease: () => {
        if (lastValue.current < -SWIPE_THRESHOLD) {
          startOffset.current = -100;
          Animated.spring(translateX, {
            toValue: -100,
            useNativeDriver: true,
            tension: 60,
            friction: 9,
          }).start();
        } else {
          startOffset.current = 0;
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 60,
            friction: 9,
          }).start();
        }
      },
    })
  ).current;

  const handleAction = () => {
    startOffset.current = 0;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 9,
    }).start();
    onAction();
  };

  return (
    <View style={styles.swipeContainer}>
      <TouchableOpacity
        style={[styles.swipeAction, { backgroundColor: actionColor }]}
        onPress={handleAction}
        activeOpacity={0.8}
      >
        <Text style={styles.swipeActionText}>{actionLabel}</Text>
      </TouchableOpacity>
      <Animated.View
        style={{ transform: [{ translateX }], marginLeft: -20, paddingLeft: 20, backgroundColor: rowBackground }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export default function ChatsListScreen({ navigation }: any) {
  const { colors, isDark, t, showTestBadges, timeFormat } = useTheme();
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [openedChatIds, setOpenedChatIds] = useState<Set<string>>(new Set());
  const [pinnedChatIds, setPinnedChatIds] = useState<Set<string>>(new Set());
  const currentUser = auth().currentUser;

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    // Load pinned chats from user doc
    firestore().collection('users').doc(currentUser.uid).get().then(doc => {
      const data = doc.data();
      if (data?.pinnedChats) {
        setPinnedChatIds(new Set(data.pinnedChats));
      }
    });

    const unsubscribe = firestore()
      .collection('chats')
      .where('participants', 'array-contains', currentUser.uid)
      .orderBy('lastMessageTime', 'desc')
      .limit(50)
      .onSnapshot(async snapshot => {
        const chatPreviews: ChatPreview[] = [];

        // Hent egen blokerings-liste én gang
        const myDoc = await firestore().collection('users').doc(currentUser.uid).get();
        const myBlockedUsers: string[] = myDoc.data()?.blockedUsers ?? [];
        const pinned: string[] = myDoc.data()?.pinnedChats ?? [];
        const pinnedSet = new Set(pinned);
        setPinnedChatIds(pinnedSet);

        for (const doc of snapshot.docs) {
          const data = doc.data();
          if (!data.lastMessage) continue;

          // Event/gruppechat: brug event-titel og status-ikon
          if (data.eventId) {
            // Spring over hvis vi ikke længere er deltager
            if (!data.participants.includes(currentUser.uid)) continue;
            const unreadCount = data.unreadCount?.[currentUser.uid] ?? 0;
            chatPreviews.push({
              chatId: doc.id,
              otherUserId: data.eventId,
              otherUserName: data.eventTitle ?? t.chatsUnknown,
              otherUserPhoto: null,
              otherUserTestAccount: false,
              lastMessage: data.lastMessage,
              lastMessageTime: data.lastMessageTime,
              unreadCount,
              pinned: pinnedSet.has(doc.id),
              isEvent: true,
              eventId: data.eventId,
              eventTag: data.eventTag ?? null,
            });
            continue;
          }

          const otherUserId = data.participants.find(
            (id: string) => id !== currentUser.uid
          );
          // Spring over chats uden modtager (orphan eller fejldata)
          if (!otherUserId) continue;
          // Spring over hvis modtager-id ser ud som en chat-id (f.eks. fra gammel event-bug)
          if (otherUserId.includes('_') && otherUserId.length > 30) continue;

          // Spring over hvis vi har blokeret dem
          if (myBlockedUsers.includes(otherUserId)) continue;

          // Hent den anden brugers profil
          const otherUserDoc = await firestore()
            .collection('users')
            .doc(otherUserId)
            .get();
          const otherUserData = otherUserDoc.data();
          const otherUserName = otherUserData?.displayName ?? t.chatsUnknown;
          const otherUserPhoto: string | null = otherUserData?.photoURL ?? null;
          const otherUserTestAccount = otherUserData?.testAccount ?? false;

          // Spring over hvis de har blokeret os
          const theirBlockedUsers: string[] = otherUserData?.blockedUsers ?? [];
          if (theirBlockedUsers.includes(currentUser.uid)) continue;

          // Læs ulæste beskeder fra unreadCount-feltet
          const unreadCount = data.unreadCount?.[currentUser.uid] ?? 0;

          chatPreviews.push({
            chatId: doc.id,
            otherUserId,
            otherUserName,
            otherUserPhoto,
            otherUserTestAccount,
            lastMessage: data.lastMessage,
            lastMessageTime: data.lastMessageTime,
            unreadCount,
            pinned: pinnedSet.has(doc.id),
          });
        }

        // Sortér: fastgjorte først, derefter efter seneste besked
        chatPreviews.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          const timeA = a.lastMessageTime?.toDate?.()?.getTime() ?? Date.now();
          const timeB = b.lastMessageTime?.toDate?.()?.getTime() ?? Date.now();
          return timeB - timeA;
        });

        setChats(chatPreviews);
        setOpenedChatIds(new Set());
        setLoading(false);
      }, error => {
        console.error('Chats listener error:', error);
        setLoading(false);
      });

    return () => unsubscribe();
  }, []);

  const togglePin = async (chatId: string) => {
    if (!currentUser) return;
    const isPinned = pinnedChatIds.has(chatId);
    const newPinned = new Set(pinnedChatIds);
    if (isPinned) {
      newPinned.delete(chatId);
    } else {
      newPinned.add(chatId);
    }
    setPinnedChatIds(newPinned);

    // Update local chat list order immediately
    setChats(prev => {
      const updated = prev.map(c => ({
        ...c,
        pinned: newPinned.has(c.chatId),
      }));
      updated.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        const timeA = a.lastMessageTime?.toDate?.()?.getTime() ?? Date.now();
        const timeB = b.lastMessageTime?.toDate?.()?.getTime() ?? Date.now();
        return timeB - timeA;
      });
      return updated;
    });

    // Persist to Firestore
    await firestore().collection('users').doc(currentUser.uid).update({
      pinnedChats: Array.from(newPinned),
    });
  };

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h' });
    }
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  const renderChat = ({ item }: { item: ChatPreview }) => {
    const unread = item.unreadCount > 0 && !openedChatIds.has(item.chatId);
    const isPinned = pinnedChatIds.has(item.chatId);

    return (
      <SwipeableRow
        onAction={() => togglePin(item.chatId)}
        actionLabel={isPinned ? t.chatsUnpinChat : t.chatsPinChat}
        actionColor={isPinned ? colors.textMuted : colors.primaryBlue}
        rowBackground={colors.white}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.chatItem, { borderBottomColor: colors.borderLight, backgroundColor: colors.white }]}
          onPress={() => {
            setOpenedChatIds(prev => new Set(prev).add(item.chatId));
            navigation.navigate('Chat', {
              otherUser: { id: item.otherUserId, displayName: item.otherUserName, testAccount: item.otherUserTestAccount },
              ...(item.isEvent ? { eventChatId: item.chatId } : {}),
            });
          }}
        >
          {item.otherUserPhoto ? (
            <Image source={{ uri: item.otherUserPhoto }} style={styles.avatar} />
          ) : item.isEvent && item.eventTag ? (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.cardBackground }]}>
              <TagIcon tag={item.eventTag} size={28} color={colors.cardBackgroundIcon} />
            </View>
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.cardBackground }]}>
              <RoketLogo width={32} height={32} fill={colors.cardBackgroundIcon} />
            </View>
          )}
          <View style={styles.chatInfo}>
            <View style={styles.chatTop}>
              <Text style={[styles.chatName, { color: colors.textPrimary }]}>{item.otherUserName}</Text>
              {showTestBadges && item.otherUserTestAccount && <View style={styles.testTag}><Text style={styles.testTagText}>{t.testAccount}</Text></View>}
              <View style={styles.chatTopRight}>
                {isPinned && <Text style={styles.pinIcon}>📌</Text>}
                <Text style={[styles.chatTime, unread && { color: colors.primaryBlueText, fontWeight: '600' }]}>
                  {formatTime(item.lastMessageTime)}
                </Text>
              </View>
            </View>
            <View style={styles.chatBottom}>
              {item.lastMessage.includes('📷') ? (
                <View style={styles.lastMessagePhoto}>
                  <CameraIcon size={14} color={unread ? colors.textPrimary : colors.textMuted} />
                  <Text style={[styles.lastMessage, unread && { color: colors.textPrimary, fontWeight: '600' }]}>{item.lastMessage.replace('📷 ', '')}</Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.lastMessage,
                    unread && { color: colors.textPrimary, fontWeight: '600' },
                  ]}
                  numberOfLines={1}
                >
                  {item.lastMessage}
                </Text>
              )}
              {unread && (
                <View style={[styles.unreadBadge, { backgroundColor: colors.primaryBlue }]}>
                  <Text style={styles.unreadBadgeText}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: colors.white }]}>
      <GradientView
        colors={[colors.primaryBlue, colors.primaryRed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.textWhite }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textWhite }]}>{t.chatsTitle}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Feedback', { category: 'bug' })} style={{ marginLeft: 'auto' }}>
          <RoketLogoHeader width={24} height={24} fillRule="evenodd" />
        </TouchableOpacity>
      </GradientView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryBlueText} />
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.chatsEmpty}</Text>
          <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>{t.chatsEmptySubtext}</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={renderChat}
          keyExtractor={item => item.chatId}
          extraData={showTestBadges}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  swipeContainer: {
    overflow: 'hidden',
  },
  swipeAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 200,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 25,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 14,
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatInfo: {
    flex: 1,
  },
  chatTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinIcon: {
    fontSize: 12,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
  },
  chatTime: {
    fontSize: 12,
    color: '#aaa',
  },
  chatBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessagePhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  lastMessage: {
    fontSize: 14,
    color: '#888',
    flex: 1,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  testTag: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  testTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#888',
  },
});
