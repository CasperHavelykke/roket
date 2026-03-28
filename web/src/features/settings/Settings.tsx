import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut, sendPasswordResetEmail, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import translations, { Language } from '@shared/translations';
import './Settings.css';

type Theme = 'light' | 'dark' | 'system';
type TimeFormat = '12h' | '24h';
type DistanceMode = 'exact' | 'fuzzy' | 'hidden';
type DistanceUnit = 'km' | 'mi';

function load<T extends string>(key: string, fallback: T, valid: T[]): T {
  const v = localStorage.getItem(key);
  return valid.includes(v as T) ? (v as T) : fallback;
}

function applyTheme(theme: Theme) {
  localStorage.setItem('roket-theme', theme);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

function saveToFirestore(key: string, value: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  setDoc(doc(db, 'users', uid), { settings: { [key]: value } }, { merge: true }).catch(() => {});
}

export default function Settings() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [theme, setTheme] = useState<Theme>(() => load('roket-theme', 'system', ['light', 'dark', 'system']));
  const [language, setLanguage] = useState<Language>(() => load('roket-language', 'da', ['da', 'en', 'es', 'de', 'fr', 'pt']));
  const [timeFormat, setTimeFormat] = useState<TimeFormat>(() => load('roket-timeFormat', '24h', ['12h', '24h']));
  const [distanceMode, setDistanceMode] = useState<DistanceMode>(() => load('roket-distanceMode', 'exact', ['exact', 'fuzzy', 'hidden']));
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(() => load('roket-distanceUnit', 'km', ['km', 'mi']));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [error, setError] = useState('');

  const t = translations[language];

  // Load settings from Firestore on mount
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      const s = snap.data()?.settings;
      if (!s) return;
      if (['light', 'dark', 'system'].includes(s.themeMode)) { setTheme(s.themeMode); applyTheme(s.themeMode); localStorage.setItem('roket-theme', s.themeMode); }
      if (['da', 'en', 'es', 'de', 'fr', 'pt'].includes(s.language)) { setLanguage(s.language); localStorage.setItem('roket-language', s.language); }
      if (['12h', '24h'].includes(s.timeFormat)) { setTimeFormat(s.timeFormat); localStorage.setItem('roket-timeFormat', s.timeFormat); }
      if (['exact', 'fuzzy', 'hidden'].includes(s.distanceMode)) { setDistanceMode(s.distanceMode); localStorage.setItem('roket-distanceMode', s.distanceMode); }
      if (['km', 'mi'].includes(s.distanceUnit)) { setDistanceUnit(s.distanceUnit); localStorage.setItem('roket-distanceUnit', s.distanceUnit); }
    }).catch(() => {});
  }, [user]);

  const set = <T extends string>(key: string, firestoreKey: string, setter: (v: T) => void) => (value: T) => {
    setter(value);
    localStorage.setItem(key, value);
    saveToFirestore(firestoreKey, value);
  };

  const handleThemeChange = (t: Theme) => {
    set<Theme>('roket-theme', 'themeMode', setTheme)(t);
    applyTheme(t);
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      alert(t.settingsChangePasswordSentMessage);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleLogout = async () => {
    if (!confirm(t.settingsLogoutConfirm)) return;
    await signOut(auth);
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setError('');
    try {
      if (deletePassword && user.email) {
        const credential = EmailAuthProvider.credential(user.email, deletePassword);
        await reauthenticateWithCredential(user, credential);
      }
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
      navigate('/login');
    } catch (e: any) {
      if (e.code === 'auth/requires-recent-login' || e.code === 'auth/wrong-password') {
        setShowDeleteConfirm(true);
        setError(e.code === 'auth/wrong-password' ? t.settingsDeleteErrorWrongPassword : t.settingsDeleteText);
      } else {
        setError(e.message);
      }
    }
  };

  const distanceDesc =
    distanceMode === 'exact' ? t.settingsDistanceDescExact
    : distanceMode === 'fuzzy' ? (distanceUnit === 'mi' ? t.settingsDistanceDescFuzzyMi : t.settingsDistanceDescFuzzy)
    : t.settingsDistanceDescHidden;

  const languages: [Language, string][] = [
    ['da', 'Dansk'], ['en', 'English'], ['es', 'Español'],
    ['de', 'Deutsch'], ['fr', 'Français'], ['pt', 'Português'],
  ];

  return (
    <div className="page">
      <nav className="navbar">
        <Link to="/" className="back">{t.back}</Link>
        <h1>{t.settingsTitle}</h1>
      </nav>

      <div className="settings-content">
        <h3 className="section-title">{t.settingsLanguage}</h3>
        <div className="settings-card">
          <div className="selector selector-wrap">
            {languages.map(([val, label]) => (
              <button
                key={val}
                className={'selector-btn selector-btn-third' + (language === val ? ' active' : '')}
                onClick={set<Language>('roket-language', 'language', setLanguage).bind(null, val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <h3 className="section-title">{t.settingsTheme}</h3>
        <div className="settings-card">
          <div className="selector">
            {([['light', t.settingsThemeLight], ['dark', t.settingsThemeDark], ['system', t.settingsThemeSystem]] as const).map(([val, label]) => (
              <button
                key={val}
                className={'selector-btn' + (theme === val ? ' active' : '')}
                onClick={() => handleThemeChange(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <h3 className="section-title">{t.settingsTimeFormat}</h3>
        <div className="settings-card">
          <div className="selector">
            {([['24h', t.settingsTime24], ['12h', t.settingsTimeAMPM]] as const).map(([val, label]) => (
              <button
                key={val}
                className={'selector-btn' + (timeFormat === val ? ' active' : '')}
                onClick={set<TimeFormat>('roket-timeFormat', 'timeFormat', setTimeFormat).bind(null, val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <h3 className="section-title">{t.settingsDistance}</h3>
        <div className="settings-card">
          <div className="selector">
            {([['exact', t.settingsDistanceExact], ['fuzzy', distanceUnit === 'mi' ? t.settingsDistanceFuzzyMi : t.settingsDistanceFuzzy], ['hidden', t.settingsDistanceHidden]] as const).map(([val, label]) => (
              <button
                key={val}
                className={'selector-btn' + (distanceMode === val ? ' active' : '')}
                onClick={() => {
                  set<DistanceMode>('roket-distanceMode', 'distanceMode', setDistanceMode)(val);
                  const uid = auth.currentUser?.uid;
                  if (uid) setDoc(doc(db, 'users', uid), { distanceMode: val }, { merge: true }).catch(() => {});
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="setting-desc">{distanceDesc}</p>
        </div>

        <h3 className="section-title">{t.settingsDistanceUnit}</h3>
        <div className="settings-card">
          <div className="selector">
            {([['km', t.settingsDistanceUnitKm], ['mi', t.settingsDistanceUnitMi]] as const).map(([val, label]) => (
              <button
                key={val}
                className={'selector-btn' + (distanceUnit === val ? ' active' : '')}
                onClick={set<DistanceUnit>('roket-distanceUnit', 'distanceUnit', setDistanceUnit).bind(null, val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <h3 className="section-title">{t.settingsPrivacy}</h3>
        <div className="settings-card">
          <Link to="/settings/blocked" className="settings-row">
            <span>{t.settingsBlockedUsers}</span><span className="row-arrow">→</span>
          </Link>
          <a href="https://roket-ac4de.web.app/community-guidelines" target="_blank" rel="noreferrer" className="settings-row">
            <span>{t.settingsGuidelines}</span><span className="row-arrow">→</span>
          </a>
          <a href="https://roket-ac4de.web.app/privacy" target="_blank" rel="noreferrer" className="settings-row">
            <span>{t.settingsPrivacyPolicy}</span><span className="row-arrow">→</span>
          </a>
          <a href="https://roket-ac4de.web.app/terms" target="_blank" rel="noreferrer" className="settings-row">
            <span>{t.settingsTerms}</span><span className="row-arrow">→</span>
          </a>
          <a href="https://roket-ac4de.web.app/child-safety" target="_blank" rel="noreferrer" className="settings-row last">
            <span>{t.settingsChildSafety}</span><span className="row-arrow">→</span>
          </a>
        </div>

        <h3 className="section-title">{t.settingsSupport}</h3>
        <div className="settings-card">
          <Link to="/settings/feedback" className="settings-row gradient-row last">
            <span>{t.settingsFeedback}</span><span className="row-arrow">→</span>
          </Link>
        </div>

        <h3 className="section-title">{t.settingsAccount}</h3>
        <div className="settings-card">
          <button className="settings-row" onClick={handleChangePassword}>
            <span>{t.settingsChangePassword}</span><span className="row-arrow">→</span>
          </button>
          <button className="settings-row" onClick={handleLogout}>
            <span className="text-red">{t.settingsLogout}</span><span className="row-arrow">→</span>
          </button>
          <button className="settings-row last" onClick={() => setShowDeleteConfirm(true)}>
            <span className="text-dark-red">{t.settingsDeleteAccount}</span><span className="row-arrow">→</span>
          </button>
        </div>

        {showDeleteConfirm && (
          <div className="delete-confirm">
            <p>{t.settingsDeleteText}</p>
            {error && <p className="error">{error}</p>}
            <input
              type="password"
              placeholder={t.settingsDeletePasswordPlaceholder}
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
            />
            <div className="delete-actions">
              <button className="cancel-btn" onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setError(''); }}>{t.cancel}</button>
              <button className="danger-btn" onClick={handleDeleteAccount}>{t.settingsDeleteButton}</button>
            </div>
          </div>
        )}

        <p className="copyright">&copy; 2026 Røket</p>
      </div>
    </div>
  );
}
