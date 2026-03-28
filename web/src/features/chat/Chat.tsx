import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import './Chat.css';
import {
  collection, query, orderBy, onSnapshot, addDoc, doc, setDoc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../../firebase';

interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageURL?: string;
  timestamp?: Timestamp;
}

export default function Chat() {
  const { chatId } = useParams<{ chatId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const uid = auth.currentUser?.uid;

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

  const sendMessage = async () => {
    if (!text.trim() || !chatId || !uid) return;
    const msg = text.trim();
    setText('');

    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      senderId: uid,
      text: msg,
      timestamp: serverTimestamp(),
    });

    const otherUserId = chatId.split('_').find((id) => id !== uid);
    await setDoc(doc(db, 'chats', chatId), {
      lastMessage: msg.slice(0, 500),
      lastMessageTime: serverTimestamp(),
      lastMessageSenderId: uid,
      ...(otherUserId ? { unreadCount: { [otherUserId]: 1 } } : {}),
    }, { merge: true });
  };

  return (
    <div className="page chat-page">
      <nav className="navbar">
        <Link to="/chats" className="back">Tilbage</Link>
        <h1>Chat</h1>
      </nav>
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.senderId === uid ? 'mine' : 'theirs'}`}>
            {msg.text && <p>{msg.text}</p>}
            {msg.imageURL && <img src={msg.imageURL} alt="" />}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Skriv en besked..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
