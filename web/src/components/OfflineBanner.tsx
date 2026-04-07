import { useState, useEffect } from 'react';
import translations, { Language } from '@shared/translations';
import './OfflineBanner.css';

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online) return null;

  const lang = (localStorage.getItem('roket-language') as Language) || 'da';
  const t = translations[lang];

  return (
    <div className="offline-banner">
      {t.noConnection}
    </div>
  );
}
