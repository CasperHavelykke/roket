import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import translations, { Language } from '@shared/translations';
import './SignUp.css';

const monthsByLang: Record<string, string[]> = {
  da: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
  fr: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
  pt: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
};

const placeholdersByLang: Record<string, string> = {
  da: 'Måned', en: 'Month', es: 'Mes', de: 'Monat', fr: 'Mois', pt: 'Mês',
};

function getAge(day: number, month: number, year: number): number {
  const today = new Date();
  const birth = new Date(year, month - 1, day);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function daysInMonth(month: number, year: number): number {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

export default function SignUp({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const lang = ((localStorage.getItem('roket-language') || navigator.language?.slice(0, 2) || 'en') as Language);
  const t = translations[lang] || translations.en;
  const months = monthsByLang[lang] || monthsByLang.en;
  const monthPlaceholder = placeholdersByLang[lang] || placeholdersByLang.en;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password || !confirmPassword) {
      setError(t.signupErrorEmpty);
      return;
    }

    const day = parseInt(birthDay, 10);
    const month = parseInt(birthMonth, 10);
    const year = parseInt(birthYear, 10);

    if (!day || !month || !year || day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) {
      setError(t.signupErrorNoBirthday);
      return;
    }

    if (day > daysInMonth(month, year)) {
      setError(t.signupErrorNoBirthday);
      return;
    }

    if (getAge(day, month, year) < 18) {
      setError(t.signupErrorTooYoung);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.signupErrorMismatch);
      return;
    }

    if (password.length < 6) {
      setError(t.signupErrorShort);
      return;
    }

    if (!acceptedPrivacy) {
      setError(t.signupErrorNoPrivacy);
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        displayName: '',
        bio: '',
        status: '',
        statusTag: null,
        email: cred.user.email,
        createdAt: serverTimestamp(),
        photoURL: null,
        lastSeen: serverTimestamp(),
        distanceMode: 'exact',
        birthday: { day, month, year },
        showAge: true,
        gender: '',
        showGender: false,
        sexuality: '',
        showSexuality: false,
        photos: [],
        matchTag: 'all',
        visibleTo: ['all'],
        datingOnly: false,
        setupComplete: true,
      });
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError(t.signupErrorInUse);
      } else if (err.code === 'auth/invalid-email') {
        setError(t.signupErrorInvalidEmail);
      } else {
        setError(t.signupError);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <img src="/logo.svg" alt="Røket" className="signup-logo" />
      <form onSubmit={handleSignUp}>
        <h1>{t.signupTitle}</h1>
        <input
          type="email"
          placeholder={t.signupEmailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder={t.signupPasswordPlaceholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder={t.signupConfirmPlaceholder}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <label className="birthday-label">{t.signupBirthday}</label>
        <div className="birthday-row">
          <input
            type="number"
            placeholder="DD"
            value={birthDay}
            onChange={(e) => setBirthDay(e.target.value)}
            min={1}
            max={31}
            className="birthday-input"
          />
          <button
            type="button"
            className={'month-picker-btn' + (birthMonth ? ' selected' : '')}
            onClick={() => setShowMonthPicker(!showMonthPicker)}
          >
            {birthMonth ? months[parseInt(birthMonth, 10) - 1] : monthPlaceholder}
          </button>
          <input
            type="number"
            placeholder="YYYY"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            min={1900}
            max={new Date().getFullYear()}
            className="birthday-input"
          />
        </div>
        <div className={'month-grid-wrapper' + (showMonthPicker ? ' open' : '')}>
          <div className="month-grid">
            {months.map((m, i) => (
              <button
                key={i}
                type="button"
                className={'month-grid-item' + (birthMonth === String(i + 1) ? ' active' : '')}
                onClick={() => { setBirthMonth(String(i + 1)); setShowMonthPicker(false); }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <label className="privacy-label">
          <input
            type="checkbox"
            checked={acceptedPrivacy}
            onChange={(e) => setAcceptedPrivacy(e.target.checked)}
          />
          <span>
            {t.signupAcceptPrivacy}
            <a href="https://roketapp.eu/legal.html" target="_blank" rel="noopener noreferrer">
              {t.signupPrivacyLink}
            </a>
            {t.signupAnd}
            <a href="https://roketapp.eu/legal.html" target="_blank" rel="noopener noreferrer">
              {t.signupTermsLink}
            </a>
          </span>
        </label>

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? '...' : t.signupButton}
        </button>
        <button type="button" className="link" onClick={onSwitchToLogin}>
          {t.signupHasAccount}
        </button>
      </form>
    </div>
  );
}
