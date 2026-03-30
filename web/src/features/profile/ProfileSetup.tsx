import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import translations, { Language } from '@shared/translations';
import './ProfileSetup.css';

type SimpleGender = 'male' | 'female' | '';
type Attraction = 'men' | 'women' | 'both' | '';

function getLang(): Language {
  return (localStorage.getItem('roket-language') as Language) || 'da';
}

function deriveSexuality(g: 'male' | 'female', a: 'men' | 'women' | 'both'): string {
  if (a === 'both') return 'bisexual';
  if (g === 'male') return a === 'men' ? 'gay' : 'straight';
  return a === 'women' ? 'gay' : 'straight';
}

const ALL_BASE_TAGS = [
  'male_straight', 'male_gay', 'male_bisexual',
  'female_straight', 'female_gay', 'female_bisexual',
];

export default function ProfileSetup() {
  const navigate = useNavigate();
  const t = translations[getLang()];
  const user = auth.currentUser;

  const [gender, setGender] = useState<SimpleGender>('');
  const [attraction, setAttraction] = useState<Attraction>('');
  const [datingOnly, setDatingOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleComplete = async () => {
    if (!user) return;
    if (!gender) { setError(t.setupErrorNoGender); return; }
    if (!attraction) { setError(t.setupErrorNoAttraction); return; }

    setLoading(true);
    setError('');

    const sexuality = deriveSexuality(gender, attraction);
    const matchTag = `${gender}_${sexuality}`;
    const visibleTo = datingOnly
      ? ALL_BASE_TAGS.filter(tag => {
          const [g, s] = tag.split('_');
          if (gender === 'male') return (g === 'female' && (s === 'straight' || s === 'bisexual')) || (g === 'male' && (s === 'gay' || s === 'bisexual'));
          return (g === 'male' && (s === 'straight' || s === 'bisexual')) || (g === 'female' && (s === 'gay' || s === 'bisexual'));
        })
      : ALL_BASE_TAGS;

    try {
      await setDoc(doc(db, 'users', user.uid), {
        gender,
        sexuality,
        matchTag,
        visibleTo,
        datingOnly,
        setupComplete: true,
      }, { merge: true });

      navigate('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <div className="setup-content">
        <img src="/logo.svg" alt="" className="setup-logo" />
        <h1>{t.setupTitle}</h1>
        <p className="setup-subtitle">{t.setupSubtitle}</p>

        <div className="setup-card">
          <h3>{t.setupGenderQuestion}</h3>
          <div className="setup-options">
            <button
              className={'setup-option' + (gender === 'male' ? ' active' : '')}
              onClick={() => setGender('male')}
            >{t.setupAttractionMen}</button>
            <button
              className={'setup-option' + (gender === 'female' ? ' active' : '')}
              onClick={() => setGender('female')}
            >{t.setupAttractionWomen}</button>
          </div>

          <h3>{t.setupAttractionQuestion}</h3>
          <div className="setup-options">
            <button
              className={'setup-option' + (attraction === 'men' ? ' active' : '')}
              onClick={() => setAttraction('men')}
            >{t.setupAttractionMen}</button>
            <button
              className={'setup-option' + (attraction === 'women' ? ' active' : '')}
              onClick={() => setAttraction('women')}
            >{t.setupAttractionWomen}</button>
            <button
              className={'setup-option' + (attraction === 'both' ? ' active' : '')}
              onClick={() => setAttraction('both')}
            >{t.setupAttractionBoth}</button>
          </div>

          <label className="setup-toggle">
            <span>{t.setupDatingOnlyPre}<strong>{t.setupDatingOnlyEmphasis}</strong>{t.setupDatingOnlyPost}</span>
            <input type="checkbox" checked={datingOnly} onChange={e => setDatingOnly(e.target.checked)} />
          </label>

          <p className="setup-privacy">{t.setupPrivacyNote}</p>
        </div>

        {error && <p className="error">{error}</p>}

        <button className="setup-complete" onClick={handleComplete} disabled={loading}>
          {loading ? '...' : t.setupComplete}
        </button>
      </div>
    </div>
  );
}
