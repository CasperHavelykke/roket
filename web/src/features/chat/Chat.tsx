import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import BackButton from '../../components/BackButton';
import './Chat.css';
import {
  collection, query, orderBy, onSnapshot, addDoc, doc, setDoc, getDoc, updateDoc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../../firebase';
import translations, { Language } from '@shared/translations';
import SendIcon from '@shared/assets/send.svg?react';
import CameraIcon from '@shared/assets/camera.svg?react';
import LogoMenu from '../../components/LogoMenu';
import RoketStars from '@shared/assets/roket-logo-stars-only.svg?react';

interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageURL?: string;
  timestamp?: Timestamp;
  deleted?: boolean;
  flagged?: boolean;
  imageExpired?: boolean;
  revealedBy?: string;
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

function isImageExpired(ts?: Timestamp): boolean {
  if (!ts) return false;
  const date = ts.toDate();
  return Date.now() - date.getTime() > 12 * 60 * 60 * 1000;
}

function getImageTimeRemaining(ts: Timestamp | undefined, t: (typeof translations)[Language]): string {
  if (!ts) return '';
  const date = ts.toDate();
  const msLeft = 12 * 60 * 60 * 1000 - (Date.now() - date.getTime());
  if (msLeft <= 0) return '';
  const hoursLeft = Math.floor(msLeft / (60 * 60 * 1000));
  const minsLeft = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
  if (hoursLeft > 0) return t.chatExpiresHoursMinutes(hoursLeft, minsLeft);
  return t.chatExpiresMinutes(minsLeft);
}

export default function Chat() {
  const { chatId } = useParams<{ chatId: string }>();
  const location = useLocation();
  const locationState = location.state as { otherUserName?: string; otherUserId?: string } | null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [otherUserName, setOtherUserName] = useState(locationState?.otherUserName || '');
  const [actionMenu, setActionMenu] = useState<{ msg: Message; x: number; y: number } | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Ensure chat doc with participants exists, THEN start listening to messages
  useEffect(() => {
    if (!chatId || !uid) return;
    let unsub: (() => void) | undefined;

    const other = otherUserId;
    setDoc(doc(db, 'chats', chatId), {
      participants: [uid, other].filter(Boolean),
      unreadCount: { [uid]: 0 },
      lastRead: { [uid]: serverTimestamp() },
    }, { merge: true }).then(() => {
      const q = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('timestamp', 'asc')
      );
      unsub = onSnapshot(q, (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
      });
    }).catch(() => {});

    return () => unsub?.();
  }, [chatId, uid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || !chatId || !uid) return;
    const msg = text.trim();
    setText('');

    const other = otherUserId;
    // Ensure chat doc exists (with participants) before writing to messages subcollection,
    // because Firestore rules require the sender to be in participants.
    await setDoc(doc(db, 'chats', chatId), {
      participants: [uid, other].filter(Boolean),
      lastMessage: msg.slice(0, 500),
      lastMessageTime: serverTimestamp(),
      lastMessageSenderId: uid,
      ...(other ? { unreadCount: { [other]: 1 } } : {}),
    }, { merge: true });

    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      senderId: uid,
      text: msg,
      timestamp: serverTimestamp(),
    });
  };

  // --- Message actions ---
  const openActionMenu = useCallback((msg: Message, x: number, y: number) => {
    if (msg.deleted || msg.flagged) return;
    setActionMenu({ msg, x, y });
  }, []);

  const closeActionMenu = useCallback(() => setActionMenu(null), []);

  useEffect(() => {
    if (!actionMenu) return;
    const handler = () => closeActionMenu();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [actionMenu, closeActionMenu]);

  const handleCopy = (msg: Message) => {
    if (msg.text) navigator.clipboard.writeText(msg.text);
    closeActionMenu();
  };

  const handleDelete = async (msg: Message) => {
    closeActionMenu();
    if (!chatId || !uid) return;
    if (!window.confirm(t.chatDeleteConfirm)) return;
    try {
      await updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), {
        deleted: true, text: null, imageURL: null,
      });
    } catch { /* ignore */ }
  };

  const handleReport = async (msg: Message) => {
    closeActionMenu();
    if (!chatId || !uid) return;
    if (!window.confirm(t.chatReportConfirm)) return;
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: uid,
        reportedUserId: msg.senderId,
        chatId,
        messageId: msg.id,
        messageText: msg.text || null,
        messageImageURL: msg.imageURL || null,
        createdAt: serverTimestamp(),
      });
      window.alert(t.chatReportReceived);
    } catch { /* ignore */ }
  };

  // --- Long press helpers ---
  const handleTouchStart = (msg: Message, e: React.TouchEvent) => {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    longPressTimer.current = setTimeout(() => {
      openActionMenu(msg, x, y);
    }, 300);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleContextMenu = (msg: Message, e: React.MouseEvent) => {
    e.preventDefault();
    openActionMenu(msg, e.clientX, e.clientY);
  };

  // --- Image upload ---
  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !uid) return;
    e.target.value = '';
    setSendingImage(true);
    try {
      const ts = Date.now();
      const storageRef = ref(storage, `chatImages/${chatId}/${ts}.jpg`);
      await uploadBytes(storageRef, file);
      const imageURL = await getDownloadURL(storageRef);

      const other = otherUserId;
      await setDoc(doc(db, 'chats', chatId), {
        participants: [uid, other].filter(Boolean),
        lastMessage: t.chatPhotoLabel,
        lastMessageTime: serverTimestamp(),
        lastMessageSenderId: uid,
        ...(other ? { unreadCount: { [other]: 1 } } : {}),
      }, { merge: true });

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: uid,
        imageURL,
        timestamp: serverTimestamp(),
      });
    } catch { /* ignore */ } finally {
      setSendingImage(false);
    }
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
        <LogoMenu items={[
          { label: t.settingsFeedback, icon: <RoketStars width={16} height={16} />, to: '/settings/feedback' },
          { label: 'Info', onClick: () => setShowChatInfo(!showChatInfo) },
        ]} />
      </nav>
      <div className="chat-spacer" />

      {showChatInfo && (
        <div className="chat-info-modal" onClick={() => setShowChatInfo(false)}>
          <div className="chat-info-card" onClick={e => e.stopPropagation()}>
            <div className="chat-info-tips">
              <p>- {t.chatTipImageExpiry}</p>
              <p>- {t.chatTipDeleted}</p>
              <p>- {t.chatTipAutoScan}</p>
              <p>- {t.chatTipBlurred}</p>
              <p>- {t.chatTipReportMessage}</p>
              <p>- {t.chatTipReportProfile}</p>
            </div>
            <button className="chat-info-close" onClick={() => setShowChatInfo(false)}>{t.ok}</button>
          </div>
        </div>
      )}

      <div className="chat-messages-wrap">
        <div className="chat-watermark">
          <img src="/logo.svg" alt="" />
        </div>

        <div className="messages">
          {messages.length === 0 && otherUserName && (
            <div className="chat-empty">
              <p className="chat-empty-greeting">{t.chatSayHi(otherUserName)}</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`message-row ${msg.senderId === uid ? 'mine' : 'theirs'}`}>
              <div
                className={`message ${msg.senderId === uid ? 'mine' : 'theirs'}`}
                onContextMenu={(e) => handleContextMenu(msg, e)}
                onTouchStart={(e) => handleTouchStart(msg, e)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
              >
                {msg.deleted || msg.flagged ? (
                  <p className="message-deleted">{t.chatDeleted}</p>
                ) : (() => {
                  const expired = msg.imageExpired || (msg.imageURL && isImageExpired(msg.timestamp));
                  const timeLeft = msg.imageURL && !expired ? getImageTimeRemaining(msg.timestamp, t) : '';
                  return (
                    <>
                      {msg.text && <p>{msg.text}</p>}
                      {(msg.imageURL || expired) && (
                        expired ? (
                          <p className="message-image-expired">{t.chatImageExpired}</p>
                        ) : (
                          <div className="message-image-wrap">
                            <a href={msg.imageURL} target="_blank" rel="noopener noreferrer">
                              <img src={msg.imageURL!} alt="" className="message-image" />
                            </a>
                            {timeLeft && <span className="message-image-timer">{timeLeft}</span>}
                          </div>
                        )
                      )}
                    </>
                  );
                })()}
                <div className="message-time">{formatMsgTime(msg.timestamp)}</div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {actionMenu && (
        <div
          className="message-action-menu"
          style={{ top: actionMenu.y, left: actionMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {actionMenu.msg.text && !actionMenu.msg.deleted && (
            <button onClick={() => handleCopy(actionMenu.msg)}>{t.chatCopy}</button>
          )}
          {actionMenu.msg.senderId === uid && !actionMenu.msg.deleted && (
            <button className="destructive" onClick={() => handleDelete(actionMenu.msg)}>{t.delete}</button>
          )}
          {actionMenu.msg.senderId !== uid && (
            <button className="destructive" onClick={() => handleReport(actionMenu.msg)}>{t.chatReportMessage}</button>
          )}
        </div>
      )}

      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handlePickImage}
        />
        <button
          type="button"
          className="chat-camera-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={sendingImage}
        >
          {sendingImage ? (
            <span className="chat-camera-spinner" />
          ) : (
            <CameraIcon width={22} height={22} />
          )}
        </button>
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
