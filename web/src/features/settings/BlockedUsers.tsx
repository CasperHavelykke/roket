import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import translations, { Language } from '@shared/translations';
import './BlockedUsers.css';

interface BlockedUser {
  id: string;
  name: string;
}

function getLang(): Language {
  const v = localStorage.getItem('roket-language');
  return (['da', 'en', 'es', 'de', 'fr', 'pt'] as Language[]).includes(v as Language) ? (v as Language) : 'da';
}

export default function BlockedUsers() {
  const t = translations[getLang()];
  const user = auth.currentUser;
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then(async snap => {
      const blockedIds: string[] = snap.data()?.blockedUsers ?? [];
      if (blockedIds.length === 0) {
        setBlockedUsers([]);
        setLoading(false);
        return;
      }
      const users = await Promise.all(
        blockedIds.map(async id => {
          const userDoc = await getDoc(doc(db, 'users', id));
          return { id, name: userDoc.data()?.displayName ?? t.blockedDeletedUser };
        }),
      );
      setBlockedUsers(users);
      setLoading(false);
    });
  }, [user]);

  const handleUnblock = async (userId: string, name: string) => {
    if (!user) return;
    if (!confirm(t.blockedUnblockConfirm(name))) return;
    await updateDoc(doc(db, 'users', user.uid), {
      blockedUsers: arrayRemove(userId),
    });
    setBlockedUsers(prev => prev.filter(u => u.id !== userId));
  };

  return (
    <div className="page">
      <nav className="navbar">
        <Link to="/settings" className="back">{t.back}</Link>
        <h1>{t.blockedTitle}</h1>
      </nav>

      {loading ? (
        <div className="loading">{t.blockedTitle}...</div>
      ) : blockedUsers.length === 0 ? (
        <div className="empty">{t.blockedEmpty}</div>
      ) : (
        <div className="blocked-list">
          {blockedUsers.map(u => (
            <div key={u.id} className="blocked-row">
              <div className="blocked-avatar">{u.name.charAt(0).toUpperCase()}</div>
              <span className="blocked-name">{u.name}</span>
              <button className="unblock-btn" onClick={() => handleUnblock(u.id, u.name)}>
                {t.blockedUnblock}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
