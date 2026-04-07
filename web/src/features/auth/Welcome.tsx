import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import translations, { Language } from '@shared/translations';
import MessagesSvg from '@shared/assets/messages.svg?react';
import PinMapWhiteSvg from '@shared/assets/pin-map-white.svg?react';
import ProfileSvg from '@shared/assets/profile.svg?react';
import './Welcome.css';

function getLang(): Language {
  return (localStorage.getItem('roket-language') as Language) || 'da';
}

const pages = [
  { type: 'logo' as const, titleKey: 'welcomeTitle', descKey: 'welcomeSubtitle' },
  { type: 'messages' as const, titleKey: 'welcomeFeatureTitle', descKey: 'welcomeFeatureDesc' },
  { type: 'distance' as const, titleKey: 'welcomeDistanceTitle', descKey: 'welcomeDistanceDesc' },
  { type: 'guidelines' as const, titleKey: 'welcomeGuidelinesTitle', descKey: 'welcomeGuidelinesDesc' },
];

function SlideIcon({ type }: { type: string }) {
  if (type === 'logo') {
    return <img src="/logo.svg" alt="" className="welcome-logo-icon" />;
  }
  return (
    <div className="welcome-icon-circle">
      {type === 'messages' && <MessagesSvg width={48} height={48} stroke="#fff" />}
      {type === 'distance' && <PinMapWhiteSvg width={48} height={48} />}
      {type === 'guidelines' && <ProfileSvg width={48} height={48} stroke="#fff" />}
    </div>
  );
}

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
        <div className="welcome-icon">
          <SlideIcon type={page.type} />
        </div>
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
