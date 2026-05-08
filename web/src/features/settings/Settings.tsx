import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '../../components/BackButton';
import LogoMenu from '../../components/LogoMenu';
import RoketStars from '@shared/assets/roket-logo-stars-only.svg?react';
import { signOut, sendPasswordResetEmail } from 'firebase/auth';
import { clearFCMToken } from '../../services/NotificationService';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
    await clearFCMToken();
    await signOut(auth);
    navigate('/login');
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
    <div className="page settings-page">
      <nav className="navbar">
        <BackButton>{t.back}</BackButton>
        <h1>{t.settingsTitle}</h1>
        <Link to="/settings/feedback" style={{ marginLeft: 'auto' }}>
          <img src="/logo-simpel.svg" alt="" className="navbar-logo" />
        </Link>
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
          <Link to="/legal/community-guidelines" className="settings-row">
            <span>{t.settingsGuidelines}</span><span className="row-arrow">→</span>
          </Link>
          <Link to="/legal/privacy-policy" className="settings-row">
            <span>{t.settingsPrivacyPolicy}</span><span className="row-arrow">→</span>
          </Link>
          <Link to="/legal/terms-conditions" className="settings-row">
            <span>{t.settingsTerms}</span><span className="row-arrow">→</span>
          </Link>
          <Link to="/legal/child-safety" className="settings-row last">
            <span>{t.settingsChildSafety}</span><span className="row-arrow">→</span>
          </Link>
        </div>

        <h3 className="section-title">{t.settingsSupport}</h3>
        <div className="settings-card">
          <Link to="/settings/feedback" className="settings-row gradient-row last">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><RoketStars width={20} height={20} /> {t.settingsFeedback}</span><span className="row-arrow">→</span>
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
          <Link to="/settings/delete" className="settings-row last">
            <span className="text-dark-red">{t.settingsDeleteAccount}</span><span className="row-arrow">→</span>
          </Link>
        </div>

        <p className="copyright">&copy; 2026 Røket</p>
      </div>
    </div>
  );
}
