import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '../../components/BackButton';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import translations, { Language } from '@shared/translations';
import './Feedback.css';

type Category = 'bug' | 'feature' | 'feedback';

function getLang(): Language {
  const v = localStorage.getItem('roket-language');
  return (['da', 'en', 'es', 'de', 'fr', 'pt'] as Language[]).includes(v as Language) ? (v as Language) : 'da';
}

export default function Feedback() {
  const navigate = useNavigate();
  const t = translations[getLang()];
  const user = auth.currentUser;

  const [category, setCategory] = useState<Category>('feedback');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const categories: { value: Category; label: string; emoji: string }[] = [
    { value: 'bug', label: t.feedbackCatBug, emoji: '!' },
    { value: 'feature', label: t.feedbackCatFeature, emoji: '+' },
    { value: 'feedback', label: t.feedbackCatFeedback, emoji: '?' },
  ];

  const placeholder =
    category === 'bug' ? t.feedbackPlaceholderBug
    : category === 'feature' ? t.feedbackPlaceholderFeature
    : t.feedbackPlaceholderFeedback;

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      alert(t.feedbackErrorEmpty);
      return;
    }
    if (!user) return;

    setSending(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        email: user.email,
        category,
        message: trimmed,
        platform: 'web',
        createdAt: serverTimestamp(),
      });
      alert(t.feedbackThanksMessage);
      navigate('/settings');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page">
      <nav className="navbar">
        <BackButton>{t.back}</BackButton>
        <h1>{t.feedbackTitle}</h1>
      </nav>

      <div className="feedback-content">
        <h3 className="section-title">{t.feedbackCategory}</h3>
        <div className="feedback-categories">
          {categories.map(cat => (
            <button
              key={cat.value}
              className={'feedback-cat-btn' + (category === cat.value ? ' active' : '')}
              onClick={() => setCategory(cat.value)}
            >
              <span className="feedback-cat-emoji">{cat.emoji}</span>
              <span className="feedback-cat-label">{cat.label}</span>
            </button>
          ))}
        </div>

        <h3 className="section-title">{t.feedbackMessage}</h3>
        <textarea
          className="feedback-textarea"
          placeholder={placeholder}
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={1000}
          rows={6}
        />
        <div className="feedback-charcount">{message.length}/1000</div>

        <button className="feedback-send" onClick={handleSend} disabled={sending}>
          {sending ? '...' : t.feedbackSend}
        </button>

        <div className="feedback-email">
          <span>{t.or}</span>
          <a href="mailto:support@roketapp.eu">support@roketapp.eu</a>
        </div>
      </div>
    </div>
  );
}
