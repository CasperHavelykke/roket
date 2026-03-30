import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import translations, { Language } from '@shared/translations';
import './Welcome.css';

function getLang(): Language {
  return (localStorage.getItem('roket-language') as Language) || 'da';
}

const pages = [
  { icon: '🚀', titleKey: 'welcomeTitle', descKey: 'welcomeSubtitle' },
  { icon: '💬', titleKey: 'welcomeFeatureTitle', descKey: 'welcomeFeatureDesc' },
  { icon: '📍', titleKey: 'welcomeDistanceTitle', descKey: 'welcomeDistanceDesc' },
  { icon: '🛡️', titleKey: 'welcomeGuidelinesTitle', descKey: 'welcomeGuidelinesDesc' },
] as const;

export default function Welcome() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();
  const t = translations[getLang()] as any;

  const isLast = currentIndex === pages.length - 1;
  const page = pages[currentIndex];

  const goNext = () => {
    if (isLast) {
      navigate('/profile/setup');
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <div className="welcome-page">
      <div className="welcome-slide">
        <div className="welcome-icon">{page.icon}</div>
        <h1>{t[page.titleKey]}</h1>
        <p>{t[page.descKey]}</p>
      </div>

      <div className="welcome-footer">
        <div className="welcome-dots">
          {pages.map((_, i) => (
            <div key={i} className={'welcome-dot' + (i === currentIndex ? ' active' : '')} />
          ))}
        </div>

        <button className="welcome-next" onClick={goNext}>
          {isLast ? t.welcomeGetStarted : t.welcomeNext}
        </button>

        {!isLast && (
          <button className="welcome-skip" onClick={() => navigate('/profile/setup')}>
            {t.welcomeSkip}
          </button>
        )}
      </div>
    </div>
  );
}
