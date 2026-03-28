import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import './Profile.css';

interface UserProfile {
  displayName: string;
  photoURL?: string;
  photos?: string[];
  bio?: string;
  age?: number;
}

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    getDoc(doc(db, 'users', userId)).then((snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
      setLoading(false);
    });
  }, [userId]);

  const openChat = () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !userId) return;
    const chatId = [uid, userId].sort().join('_');
    navigate(`/chat/${chatId}`);
  };

  if (loading) return <div className="loading">Indlæser...</div>;
  if (!profile) return <div className="page"><p>Bruger ikke fundet</p></div>;

  const allPhotos = profile.photoURL
    ? [profile.photoURL, ...(profile.photos ?? [])]
    : [];

  return (
    <div className="page profile-page">
      <nav className="navbar">
        <Link to="/" className="back">Tilbage</Link>
        <h1>{profile.displayName}</h1>
      </nav>
      <div className="profile-photos">
        {allPhotos.map((url, i) => (
          <img key={i} src={url} alt="" className="profile-photo" />
        ))}
      </div>
      <div className="profile-info">
        {profile.age && <p className="age">{profile.age} år</p>}
        {profile.bio && <p className="bio">{profile.bio}</p>}
      </div>
      <button className="primary-btn" onClick={openChat}>Send besked</button>
    </div>
  );
}
