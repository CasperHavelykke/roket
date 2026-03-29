import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import translations, { Language } from '@shared/translations';
import './DeleteAccount.css';

export default function DeleteAccount() {
  const lang = (localStorage.getItem('roket-language') as Language) || 'da';
  const t = translations[lang];
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!currentUser) return null;

  const bullets = [
    t.deleteAccountBullet1,
    t.deleteAccountBullet2,
    t.deleteAccountBullet3,
    t.deleteAccountBullet4,
    t.deleteAccountBullet5,
  ];

  const handleDelete = async () => {
    if (!password) {
      setError(t.settingsDeleteErrorEmpty);
      return;
    }

    setDeleting(true);
    setError('');
    try {
      const credential = EmailAuthProvider.credential(currentUser.email || '', password);
      await reauthenticateWithCredential(currentUser, credential);
      await deleteDoc(doc(db, 'users', currentUser.uid));
      await deleteUser(currentUser);
      navigate('/login');
    } catch (e: any) {
      setDeleting(false);
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setError(t.settingsDeleteErrorWrongPassword);
      } else {
        setError(e.message);
      }
    }
  };

  return (
    <div className="page">
      <nav className="navbar">
        <Link to="/settings" className="back">{'\u2190'}</Link>
        <h1>{t.deleteAccountTitle}</h1>
      </nav>

      <div className="deleteaccount-content">
        <div className="deleteaccount-warning">
          <div className="deleteaccount-warning-title">{t.deleteAccountWhat}</div>
          {bullets.map((text, i) => (
            <div key={i} className="deleteaccount-bullet">
              <span className="deleteaccount-bullet-dot">{'\u2022'}</span>
              <span className="deleteaccount-bullet-text">{text}</span>
            </div>
          ))}
        </div>

        <div className="deleteaccount-confirm">
          <div className="deleteaccount-confirm-label">{t.deleteAccountConfirmLabel}</div>
          {error && <div className="deleteaccount-error">{error}</div>}
          <input
            type="password"
            className="deleteaccount-input"
            placeholder={t.settingsDeletePasswordPlaceholder}
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={deleting}
          />
        </div>

        <button
          className="deleteaccount-btn"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? '...' : t.deleteAccountButton}
        </button>
      </div>
    </div>
  );
}
