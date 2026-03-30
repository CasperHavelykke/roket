import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import BackButton from '../../components/BackButton';
import './Chat.css';
import {
  collection, query, orderBy, onSnapshot, addDoc, doc, setDoc, getDoc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import translations, { Language } from '@shared/translations';
import SendIcon from '@shared/assets/send.svg?react';

interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageURL?: string;
  timestamp?: Timestamp;
}

function getLang(): Language {
  return (localStorage.getItem('roket-language') as Language) || 'da';
}

function getTimeFormat(): '12h' | '24h' {
  return (localStorage.getItem('roket-timeFormat') as '12h' | '24h') || '24h';
}

function formatMsgTime(ts?: Timestamp): string {
  if (!ts) return '';
  const date = ts.toDate();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: getTimeFormat() === '12h' });
}

export default function Chat() {
  const { chatId } = useParams<{ chatId: string }>();
  const location = useLocation();
  const locationState = location.state as { otherUserName?: string; otherUserId?: string } | null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [otherUserName, setOtherUserName] = useState(locationState?.otherUserName || '');
  const bottomRef = useRef<HTMLDivElement>(null);
  const uid = auth.currentUser?.uid;
  const nav = useNavigate();
  const t = translations[getLang()];
  const fromProfile = !!locationState?.otherUserId;
  const otherUserId = locationState?.otherUserId || chatId?.split('_').find(id => id !== uid);

  // Load other user's name if not passed via state
  useEffect(() => {
    if (otherUserName || !chatId || !uid) return;
    getDoc(doc(db, 'chats', chatId)).then(snap => {
      const data = snap.data();
      if (!data?.participants) return;
      const otherId = data.participants.find((p: string) => p !== uid);
      if (!otherId) return;
      getDoc(doc(db, 'users', otherId)).then(userSnap => {
        setOtherUserName(userSnap.data()?.displayName ?? t.chatsUnknown);
      });
    });
  }, [chatId, uid, otherUserName]);

  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
    });
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clear unread count when opening chat
  useEffect(() => {
    if (!chatId || !uid) return;
    setDoc(doc(db, 'chats', chatId), {
      unreadCount: { [uid]: 0 },
    }, { merge: true }).catch(() => {});
  }, [chatId, uid]);

  const sendMessage = async () => {
    if (!text.trim() || !chatId || !uid) return;
    const msg = text.trim();
    setText('');

    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      senderId: uid,
      text: msg,
      timestamp: serverTimestamp(),
    });

    const otherUserId = locationState?.otherUserId || chatId.split('_').find((id) => id !== uid);
    await setDoc(doc(db, 'chats', chatId), {
      participants: [uid, otherUserId].filter(Boolean),
      lastMessage: msg.slice(0, 500),
      lastMessageTime: serverTimestamp(),
      lastMessageSenderId: uid,
      ...(otherUserId ? { unreadCount: { [otherUserId]: 1 } } : {}),
    }, { merge: true });
  };

  return (
    <div className="page chat-page">
      <nav className="navbar">
        <BackButton>{t.back}</BackButton>
        {fromProfile ? (
          <h1>{otherUserName}</h1>
        ) : (
          <Link to={`/profile/${otherUserId}`} state={{ fromChat: true }} className="chat-header-name">
            <h1>{otherUserName}</h1>
          </Link>
        )}
        <img src="/logo-simpel.svg" alt="" className="navbar-logo" />
      </nav>

      <div className="chat-messages-wrap">
        <div className="chat-watermark">
          <img src="/logo.svg" alt="" />
        </div>

        <div className="messages">
          {messages.length === 0 && otherUserName && (
            <div className="chat-empty">
              <p className="chat-empty-greeting">{t.chatSayHi(otherUserName)}</p>
              <div className="chat-tips">
                <p>- {t.chatTipImageExpiry}</p>
                <p>- {t.chatTipDeleted}</p>
                <p>- {t.chatTipAutoScan}</p>
                <p>- {t.chatTipBlurred}</p>
                <p>- {t.chatTipReportMessage}</p>
                <p>- {t.chatTipReportProfile}</p>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`message-row ${msg.senderId === uid ? 'mine' : 'theirs'}`}>
              <div className={`message ${msg.senderId === uid ? 'mine' : 'theirs'}`}>
                {msg.text && <p>{msg.text}</p>}
                {msg.imageURL && <img src={msg.imageURL} alt="" />}
                <div className="message-time">{formatMsgTime(msg.timestamp)}</div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.chatInputPlaceholder}
          maxLength={1000}
        />
        <button type="submit" className="chat-send-btn" disabled={!text.trim()}>
          <SendIcon width={20} height={20} stroke="#fff" />
        </button>
      </form>
    </div>
  );
}
