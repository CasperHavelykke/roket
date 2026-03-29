import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import translations from '@shared/translations';
import './SignUp.css';

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
  const lang = (navigator.language?.slice(0, 2) || 'en') as keyof typeof translations;
  const t = translations[lang] || translations.en;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
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
      localStorage.setItem('@roket_birthday', JSON.stringify({ day, month, year }));
      await createUserWithEmailAndPassword(auth, email, password);
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
          <input
            type="number"
            placeholder="MM"
            value={birthMonth}
            onChange={(e) => setBirthMonth(e.target.value)}
            min={1}
            max={12}
            className="birthday-input"
          />
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
