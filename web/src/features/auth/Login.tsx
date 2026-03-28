import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import translations from '@shared/translations';
import SignUp from './SignUp';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');

  const lang = (navigator.language?.slice(0, 2) || 'en') as keyof typeof translations;
  const t = translations[lang] || translations.en;

  if (isSignUp) {
    return <SignUp onSwitchToLogin={() => setIsSignUp(false)} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="page login-page">
      <img src="/logo.svg" alt="Røket" className="login-logo" />
      <form onSubmit={handleSubmit}>
        <h1>{t.loginWelcome}</h1>
        <input
          type="email"
          placeholder={t.loginEmailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder={t.loginPasswordPlaceholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit">{t.loginButton}</button>
        <button type="button" className="link" onClick={() => setIsSignUp(true)}>
          {t.loginNoAccount}
        </button>
      </form>
    </div>
  );
}
