import BackButton from '../../components/BackButton';
import translations, { Language } from '@shared/translations';
import './ChildSafety.css';

function getLang(): Language {
  return (localStorage.getItem('roket-language') as Language) || 'da';
}

export default function ChildSafety() {
  const t = translations[getLang()];

  const rules = [
    t.childSafetyRule1,
    t.childSafetyRule2,
    t.childSafetyRule3,
    t.childSafetyRule4,
  ];

  return (
    <div className="page legal-page">
      <nav className="navbar">
        <BackButton>{t.back}</BackButton>
        <h1>{t.childSafetyTitle}</h1>
      </nav>
      <div className="legal-content">
        <div className="legal-card">
          <h3 className="text-red">{t.childSafetyZeroTolerance}</h3>
          <p>{t.childSafetyIntro}</p>
        </div>

        <div className="legal-card">
          <h3>{t.childSafetyProhibitedTitle}</h3>
          {rules.map((rule, i) => (
            <div key={i} className="rule-row">
              <span className="bullet text-red">•</span>
              <span>{rule}</span>
            </div>
          ))}
        </div>

        <div className="legal-card">
          <h3>{t.childSafetyMeasuresTitle}</h3>
          <p className="text-secondary">{t.childSafetyMeasuresText}</p>
        </div>

        <div className="legal-card">
          <h3>{t.childSafetyReportTitle}</h3>
          <p className="text-secondary">{t.childSafetyReportText}</p>
          <a href="mailto:support@roketapp.eu" className="contact-btn">support@roketapp.eu</a>
        </div>

        <p className="legal-footer">{t.childSafetyFooter}</p>
      </div>
    </div>
  );
}
