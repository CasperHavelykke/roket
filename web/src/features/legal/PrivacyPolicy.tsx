import translations, { Language } from '@shared/translations';
import { privacyPolicy } from '@shared/features/legal/texts';
import LegalPage from './LegalPage';

function getLang(): Language {
  return (localStorage.getItem('roket-language') as Language) || 'da';
}

export default function PrivacyPolicy() {
  const t = translations[getLang()];
  return <LegalPage title={t.settingsPrivacyPolicy} texts={privacyPolicy} />;
}
