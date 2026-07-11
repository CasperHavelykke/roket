import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

const SCREEN_W = Dimensions.get('window').width;
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../../components/GradientView';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../theme';
import { Camera as CameraIcon, Calendar as CalendarIcon, Pin as PinIcon } from 'lucide-react-native';
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

type SwipeAction = { label: string; color: string; onPress: () => void };

function SwipeableRow({ children, actions, rowBackground }: {
  children: React.ReactNode;
  actions: SwipeAction[];
  rowBackground: string;
}) {
  const ref = useRef<any>(null);

  const renderRightActions = () => (
    <View style={styles.swipeActions}>
      {actions.map((a, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.swipeAction, { backgroundColor: a.color }]}
          activeOpacity={0.8}
          onPress={() => { ref.current?.close?.(); a.onPress(); }}
        >
          <Text style={styles.swipeActionText}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderRightActions}
      containerStyle={{ backgroundColor: rowBackground }}
    >
      {children}
    </ReanimatedSwipeable>
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

  // Bind ved FOKUS, ikke mount: som tab unmountes skærmen aldrig, så en
  // mount-bundet listener ville dø ved logout og aldrig gen-binde (F4-lektien).
  // Blur rydder op — baggrundsfaner holder ingen listeners.
  const boundUid = useRef<string | null>(null);
  useFocusEffect(useCallback(() => {
    // Skygger bevidst den ydre currentUser: frisk auth-state pr. fokus
    const currentUser = auth().currentUser;
    if (!currentUser || currentUser.isAnonymous) {
      boundUid.current = null;
      setChats([]);
      setLoading(false);
      return;
    }
    // Konto-skift: ryd den forrige kontos liste FØR der bindes — ellers
    // blinker de gamle beskeder et øjeblik når snapshottet er på vej
    if (boundUid.current !== currentUser.uid) {
      boundUid.current = currentUser.uid;
      setChats([]);
      setLoading(true);
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
          // Connection-chats (Hold kontakten) vises fra fødslen — ellers ville
          // en frisk accepteret forbindelse være usynlig indtil første besked
          if (!data.lastMessage && data.type !== 'connection') continue;

          // Slet-for-mig: skjul samtalen medmindre der er kommet en nyere besked siden
          const clearedAt = data.clearedBy?.[currentUser.uid];
          if (clearedAt) {
            const clearedMs = clearedAt.toMillis?.() ?? 0;
            const lastMs = data.lastMessageTime?.toMillis?.() ?? 0;
            if (lastMs <= clearedMs) continue;
          }

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
          const otherUserPhoto: string | null = otherUserData?.avatarURL ?? null;
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
  }, []));

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

  const confirmDelete = (item: ChatPreview) => {
    Alert.alert(t.chatsDeleteTitle, t.chatsDeleteMessage, [
      { text: t.cancel, style: 'cancel' },
      { text: t.chatsDeleteConfirm, style: 'destructive', onPress: () => deleteConversationForMe(item) },
    ]);
  };

  const deleteConversationForMe = async (item: ChatPreview) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    setChats(prev => prev.filter(c => c.chatId !== item.chatId));
    try {
      const chatRef = firestore().collection('chats').doc(item.chatId);
      // Slet mine egne beskeder (batch-vis)
      const ownMsgs = await chatRef.collection('messages').where('senderId', '==', uid).get();
      const docs = ownMsgs.docs;
      for (let i = 0; i < docs.length; i += 450) {
        const batch = firestore().batch();
        docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      const myDoc = await firestore().collection('users').doc(uid).get();
      const myName = myDoc.data()?.displayName || '';
      const sysText = t.chatSystemDeleted(myName);
      // System-besked (skrevet af mig, så modparten ser at samtalen er slettet)
      await chatRef.collection('messages').add({
        senderId: uid,
        text: sysText,
        timestamp: firestore.FieldValue.serverTimestamp(),
        system: true,
      });
      // Marker ryddet for mig + opdatér lastMessage så modparten ser notitsen
      await chatRef.update({
        [`clearedBy.${uid}`]: firestore.FieldValue.serverTimestamp(),
        lastMessage: sysText.slice(0, 500),
        lastMessageTime: firestore.FieldValue.serverTimestamp(),
        lastMessageSenderId: uid,
      });
    } catch (e) {
      console.warn('Delete conversation error:', e);
    }
  };

  const confirmLeave = (item: ChatPreview) => {
    Alert.alert(t.chatsLeaveTitle, t.chatsLeaveMessage, [
      { text: t.cancel, style: 'cancel' },
      { text: t.chatsLeaveConfirm, style: 'destructive', onPress: () => leaveEventChat(item) },
    ]);
  };

  const leaveEventChat = async (item: ChatPreview) => {
    if (!currentUser || !item.eventId) return;
    const uid = currentUser.uid;
    setChats(prev => prev.filter(c => c.chatId !== item.chatId));
    try {
      const chatRef = firestore().collection('chats').doc(item.chatId);
      const myDoc = await firestore().collection('users').doc(uid).get();
      const myName = myDoc.data()?.displayName || '';
      const sysText = t.chatSystemLeft(myName);
      // System-besked først (mens jeg stadig er deltager)
      await chatRef.collection('messages').add({
        senderId: uid,
        text: sysText,
        timestamp: firestore.FieldValue.serverTimestamp(),
        system: true,
      });
      await firestore().collection('events').doc(item.eventId).update({
        participantIds: firestore.FieldValue.arrayRemove(uid),
      });
      await chatRef.update({
        participants: firestore.FieldValue.arrayRemove(uid),
        lastMessage: sysText.slice(0, 500),
        lastMessageTime: firestore.FieldValue.serverTimestamp(),
        lastMessageSenderId: uid,
      });
    } catch (e) {
      console.warn('Leave event chat error:', e);
    }
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

    const swipeActions: SwipeAction[] = [
      {
        label: isPinned ? t.chatsUnpinChat : t.chatsPinChat,
        color: isPinned ? colors.textMuted : colors.primaryBlue,
        onPress: () => togglePin(item.chatId),
      },
      item.isEvent
        ? { label: t.chatsLeave, color: colors.primaryRed, onPress: () => confirmLeave(item) }
        : { label: t.chatsDelete, color: colors.primaryRed, onPress: () => confirmDelete(item) },
    ];

    return (
      <SwipeableRow
        actions={swipeActions}
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
          ) : item.isEvent ? (
            <GradientView
              colors={[colors.primaryBlue, colors.primaryRed]}
              start={{ x: -16 / 52, y: 0 }}
              end={{ x: (SCREEN_W - 16) / 52, y: 0 }}
              style={[styles.avatar, styles.avatarFallback]}
            >
              {item.eventTag
                ? <TagIcon tag={item.eventTag} size={26} color="#fff" />
                : <CalendarIcon size={26} color="#fff" />}
            </GradientView>
          ) : item.otherUserName ? (
            <GradientView
              colors={[colors.primaryBlue, colors.primaryRed]}
              start={{ x: -16 / 52, y: 0 }}
              end={{ x: (SCREEN_W - 16) / 52, y: 0 }}
              style={[styles.avatar, styles.avatarFallback]}
            >
              <Text style={styles.avatarInitials}>
                {item.otherUserName.trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('')}
              </Text>
            </GradientView>
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.cardBackground }]}>
              <RoketLogo width={32} height={32} fill={colors.cardBackgroundIcon} />
            </View>
          )}
          <View style={styles.chatInfo}>
            <View style={styles.chatTop}>
              <Text style={[styles.chatName, { color: colors.textPrimary }]} numberOfLines={1}>{item.otherUserName}</Text>
              {showTestBadges && item.otherUserTestAccount && <View style={styles.testTag}><Text style={styles.testTagText}>{t.testAccount}</Text></View>}
              <View style={styles.chatTopRight}>
                {isPinned && <PinIcon size={13} color={colors.textMuted} />}
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
      {/* Tab-rod: flad stor titel i stedet for gradient-header — nav-baren
          i bunden fortæller allerede hvor man er (redesign 2026-07) */}
      <View style={[styles.largeTitleRow, { paddingTop: insets.top + 26 }]}>
        <Text style={[styles.largeTitle, { color: colors.textPrimary }]}>{t.chatsTitle}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Feedback', { category: 'bug' })} style={{ marginLeft: 'auto' }}>
          <RoketLogoHeader width={24} height={24} fill={colors.textPrimary} fillRule="evenodd" />
        </TouchableOpacity>
      </View>

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
  largeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 18,
  },
  largeTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
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
  swipeActions: {
    flexDirection: 'row',
  },
  swipeAction: {
    width: 76,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
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
  avatarInitials: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  chatInfo: {
    flex: 1,
  },
  chatTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    marginLeft: 8,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
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
