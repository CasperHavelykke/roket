import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Link } from 'react-router-dom';
import translations, { Language } from '@shared/translations';
import BackButton from '../../components/BackButton';
import { placeholderPic } from '../../utils/theme';
import './ChatsList.css';

interface ChatPreview {
  chatId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserPhoto: string | null;
  lastMessage: string;
  lastMessageTime: any;
  unreadCount: number;
  pinned: boolean;
}

function getLang(): Language {
  return (localStorage.getItem('roket-language') as Language) || 'da';
}

function getTimeFormat(): '12h' | '24h' {
  return (localStorage.getItem('roket-timeFormat') as '12h' | '24h') || '24h';
}

function formatTime(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: getTimeFormat() === '12h' });
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export default function ChatsList() {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [openedChatIds, setOpenedChatIds] = useState<Set<string>>(new Set());
  const t = translations[getLang()];

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', uid),
      orderBy('lastMessageTime', 'desc'),
      limit(50),
    );

    return onSnapshot(q, async (snap) => {
      const myDoc = await getDoc(doc(db, 'users', uid));
      const myData = myDoc.data();
      const myBlocked: string[] = myData?.blockedUsers ?? [];
      const pinnedSet = new Set<string>(myData?.pinnedChats ?? []);

      const previews: ChatPreview[] = [];
      for (const chatDoc of snap.docs) {
        const data = chatDoc.data();
        if (!data.lastMessage) continue;

        const otherUserId = data.participants?.find((p: string) => p !== uid);
        if (!otherUserId) continue;
        if (myBlocked.includes(otherUserId)) continue;

        const userSnap = await getDoc(doc(db, 'users', otherUserId));
        const userData = userSnap.data();

        const theirBlocked: string[] = userData?.blockedUsers ?? [];
        if (theirBlocked.includes(uid)) continue;

        previews.push({
          chatId: chatDoc.id,
          otherUserId,
          otherUserName: userData?.displayName ?? t.chatsUnknown,
          otherUserPhoto: userData?.photoURL ?? null,
          lastMessage: data.lastMessage,
          lastMessageTime: data.lastMessageTime,
          unreadCount: data.unreadCount?.[uid] ?? 0,
          pinned: pinnedSet.has(chatDoc.id),
        });
      }

      previews.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        const timeA = a.lastMessageTime?.toDate?.()?.getTime() ?? Date.now();
        const timeB = b.lastMessageTime?.toDate?.()?.getTime() ?? Date.now();
        return timeB - timeA;
      });

      setChats(previews);
      setOpenedChatIds(new Set());
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  if (loading) return <div className="loading">{t.chatsTitle}...</div>;

  return (
    <div className="page chats-page">
      <nav className="navbar">
        <BackButton>{t.back}</BackButton>
        <h1>{t.chatsTitle}</h1>
        <Link to="/settings/feedback" style={{ marginLeft: 'auto' }}>
          <img src="/logo-simpel.svg" alt="" className="navbar-logo" />
        </Link>
      </nav>
      <div className="chats-list">
        {chats.length === 0 ? (
          <div className="chats-empty">
            <p className="chats-empty-title">{t.chatsEmpty}</p>
            <p className="chats-empty-sub">{t.chatsEmptySubtext}</p>
          </div>
        ) : chats.map((chat) => {
          const unread = chat.unreadCount > 0 && !openedChatIds.has(chat.chatId);
          return (
            <Link
              to={`/chat/${chat.chatId}`}
              key={chat.chatId}
              className="chat-row"
              onClick={() => setOpenedChatIds(prev => new Set(prev).add(chat.chatId))}
            >
              <img
                src={chat.otherUserPhoto || placeholderPic()}
                alt=""
                className="chat-avatar"
              />
              <div className="chat-info">
                <div className="chat-top">
                  <span className={'chat-name' + (unread ? ' unread' : '')}>{chat.otherUserName}</span>
                  <div className="chat-top-right">
                    {chat.pinned && <span className="pin-icon">📌</span>}
                    <span className={'chat-time' + (unread ? ' unread' : '')}>
                      {formatTime(chat.lastMessageTime)}
                    </span>
                  </div>
                </div>
                <div className="chat-bottom">
                  <span className={'chat-last' + (unread ? ' unread' : '')}>{chat.lastMessage}</span>
                  {unread && (
                    <span className="unread-badge">
                      {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
