import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

/**
 * Samlet ulæst-tæller på tværs af alle chats (1:1, connection og event).
 * Samme semantik som grid'ets unread-lytter: unreadCount-map'et hvor det
 * findes, ellers lastRead-fallback (event-chats og ældre chats skriver
 * ikke unreadCount).
 */
export default function useUnreadTotal(): { total: number; hasUnread: boolean } {
  const [total, setTotal] = useState(0);

  // VIGTIGT: hooken lever på MapHome, som ALDRIG unmountes (rod-skærmen).
  // Derfor skal chats-lytteren gen-bindes ved hvert auth-skift — ellers
  // fryser badgen med den forrige kontos data efter logout/login.
  useEffect(() => {
    let unsubChats: (() => void) | null = null;

    const unsubAuth = auth().onAuthStateChanged(user => {
      if (unsubChats) {
        unsubChats();
        unsubChats = null;
      }
      if (!user || user.isAnonymous) {
        setTotal(0);
        return;
      }

      const uid = user.uid;
      unsubChats = firestore()
        .collection('chats')
        .where('participants', 'array-contains', uid)
        .onSnapshot(
          snapshot => {
            let sum = 0;
            snapshot.docs.forEach(doc => {
              const data = doc.data();
              if (!data.lastMessage || data.lastMessageSenderId === uid) return;
              const count = data.unreadCount?.[uid] ?? 0;
              if (count > 0) {
                sum += count;
              } else {
                const lastRead = data.lastRead?.[uid];
                const isUnread =
                  !lastRead ||
                  (data.lastMessageTime && lastRead.toMillis() < data.lastMessageTime.toMillis());
                if (isUnread) sum += 1;
              }
            });
            setTotal(sum);
          },
          err => console.warn('Unread total subscription error:', err),
        );
    });

    return () => {
      unsubAuth();
      if (unsubChats) unsubChats();
    };
  }, []);

  return { total, hasUnread: total > 0 };
}
