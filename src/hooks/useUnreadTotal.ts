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
      // (3) blokerede modparter — hentes én gang pr. auth-bind (en NY
      // blokering slår først igennem ved næste bind; acceptabel unøjagtighed)
      let blockedUsers: string[] = [];
      firestore().collection('users').doc(uid).get()
        .then(doc => { blockedUsers = doc.data()?.blockedUsers ?? []; })
        .catch(() => {});
      unsubChats = firestore()
        .collection('chats')
        .where('participants', 'array-contains', uid)
        .onSnapshot(
          snapshot => {
            let sum = 0;
            snapshot.docs.forEach(doc => {
              const data = doc.data();
              if (!data.lastMessage || data.lastMessageSenderId === uid) return;
              // Spejl chatlistens skjulninger — ellers kan badgen tælle
              // chats man ikke kan se og dermed aldrig nulstille:
              // (1) slet-for-mig uden nyere besked
              const clearedAt = data.clearedBy?.[uid];
              if (clearedAt) {
                const clearedMs = clearedAt.toMillis?.() ?? 0;
                const lastMs = data.lastMessageTime?.toMillis?.() ?? 0;
                if (lastMs <= clearedMs) return;
              }
              // (2) gruppechats man har forladt
              if (data.eventId && !(data.participants ?? []).includes(uid)) return;
              // (3) 1:1 med blokeret modpart
              if (!data.eventId) {
                const other = (data.participants ?? []).find((id: string) => id !== uid);
                if (other && blockedUsers.includes(other)) return;
              }
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
