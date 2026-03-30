import translations, { Language } from '@shared/translations';
import { termsConditions } from '@shared/features/legal/texts';
import LegalPage from './LegalPage';

function getLang(): Language {
  return (localStorage.getItem('roket-language') as Language) || 'da';
}

export default function TermsConditions() {
  const t = translations[getLang()];
  return <LegalPage title={t.settingsTerms} texts={termsConditions} />;
}
