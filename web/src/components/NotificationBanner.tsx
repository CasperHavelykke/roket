import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import translations, { Language } from '@shared/translations';
import './NotificationBanner.css';

interface NotificationData {
  senderName: string;
  senderId: string;
  chatId: string;
  message: string;
  senderPhoto?: string;
}

export default function NotificationBanner() {
  const [data, setData] = useState<NotificationData | null>(null);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  const lang = (localStorage.getItem('roket-language') as Language) || 'da';
  const t = translations[lang];

  useEffect(() => {
    // Listen for foreground notification events dispatched from App.tsx
    const handler = (e: CustomEvent<NotificationData>) => {
      setData(e.detail);
      setVisible(true);
      setTimeout(() => setVisible(false), 4000);
    };
    window.addEventListener('roket-notification', handler as EventListener);
    return () => window.removeEventListener('roket-notification', handler as EventListener);
  }, []);

  if (!visible || !data) return null;

  const handleClick = () => {
    setVisible(false);
    navigate(`/chat/${data.chatId}`);
  };

  return (
    <div className="notification-banner" onClick={handleClick}>
      <img
        className="notification-avatar"
        src={data.senderPhoto || '/missing-profile-pic.png'}
        alt=""
      />
      <div className="notification-text">
        <span className="notification-name">{data.senderName}</span>
        <span className="notification-message">{data.message}</span>
      </div>
      <span className="notification-label">{t.notificationNewMessage}</span>
    </div>
  );
}
