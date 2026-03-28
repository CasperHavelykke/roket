import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Link } from 'react-router-dom';
import './ChatsList.css';

interface ChatPreview {
  chatId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserPhoto?: string;
  lastMessage?: string;
}

export default function ChatsList() {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', uid)
    );

    return onSnapshot(q, async (snap) => {
      const previews: ChatPreview[] = [];
      for (const chatDoc of snap.docs) {
        const data = chatDoc.data();
        const otherUserId = data.participants?.find((p: string) => p !== uid);
        if (!otherUserId) continue;

        const userSnap = await getDoc(doc(db, 'users', otherUserId));
        const userData = userSnap.data();

        previews.push({
          chatId: chatDoc.id,
          otherUserId,
          otherUserName: userData?.displayName ?? 'Ukendt',
          otherUserPhoto: userData?.photoURL,
          lastMessage: data.lastMessage,
        });
      }
      setChats(previews);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="loading">Indlæser...</div>;

  return (
    <div className="page">
      <nav className="navbar">
        <Link to="/" className="back">Tilbage</Link>
        <h1>Beskeder</h1>
      </nav>
      <div className="chats-list">
        {chats.length === 0 && <p className="empty">Ingen beskeder endnu</p>}
        {chats.map((chat) => (
          <Link to={`/chat/${chat.chatId}`} key={chat.chatId} className="chat-row">
            {chat.otherUserPhoto ? (
              <img src={chat.otherUserPhoto} alt="" className="chat-avatar" />
            ) : (
              <div className="chat-avatar no-photo" />
            )}
            <div className="chat-info">
              <span className="chat-name">{chat.otherUserName}</span>
              <span className="chat-last">{chat.lastMessage ?? 'Ingen beskeder'}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
