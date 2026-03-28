import { useState, useEffect } from 'react';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Link } from 'react-router-dom';
import Fab from '../../components/Fab';
import { ProfileIcon, MessagesIcon, SettingsIcon } from '../../components/icons';
import './Home.css';

interface UserProfile {
  id: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  age?: number;
}

export default function Home() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      const q = query(collection(db, 'users'), limit(50));
      const snap = await getDocs(q);
      const list: UserProfile[] = [];
      snap.forEach((doc) => {
        if (doc.id !== auth.currentUser?.uid) {
          list.push({ id: doc.id, ...doc.data() } as UserProfile);
        }
      });
      setUsers(list);
      setLoading(false);
    };
    fetchUsers();
  }, []);

  if (loading) return <div className="loading">Indlæser...</div>;

  return (
    <div className="page home-page">
      <nav className="navbar">
        <h1>Røket</h1>
        <img src="/logo.svg" alt="" className="navbar-logo" />
      </nav>
      <div className="user-grid">
        {users.map((user) => (
          <Link to={`/profile/${user.id}`} key={user.id} className="user-card">
            <img
              src={user.photoURL || '/missing-profile-pic.png'}
              alt={user.displayName}
            />
            <div className="user-card-info">
              <span className="user-name">{user.displayName}{user.age ? `, ${user.age}` : ''}</span>
            </div>
          </Link>
        ))}
      </div>
      <Fab items={[
        { to: '/profile/me', icon: ProfileIcon },
        { to: '/chats', icon: MessagesIcon },
        { to: '/settings', icon: SettingsIcon },
      ]} />
    </div>
  );
}
