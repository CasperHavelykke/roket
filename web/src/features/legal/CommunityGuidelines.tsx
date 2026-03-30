import BackButton from '../../components/BackButton';
import translations, { Language } from '@shared/translations';
import './LegalPage.css';

function getLang(): Language {
  return (localStorage.getItem('roket-language') as Language) || 'da';
}

export default function CommunityGuidelines() {
  const t = translations[getLang()];

  const rules = [
    t.guideline1,
    t.guideline2,
    t.guideline3,
    t.guideline4,
    t.guideline5,
    t.guideline6,
    t.guideline7,
    t.guideline8,
  ];

  return (
    <div className="page legal-page">
      <nav className="navbar">
        <BackButton>{t.back}</BackButton>
        <h1>{t.settingsGuidelines}</h1>
        <img src="/logo-simpel.svg" alt="" className="navbar-logo" />
      </nav>
      <div className="legal-content">
        <p>{t.guidelinesIntro}</p>
        <ul>
          {rules.map((rule, i) => (
            <li key={i}>{rule}</li>
          ))}
        </ul>
        <p>{t.guidelinesConsequence}</p>
      </div>
    </div>
  );
}
