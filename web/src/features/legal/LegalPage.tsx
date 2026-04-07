import React from 'react';
import BackButton from '../../components/BackButton';
import translations, { Language } from '@shared/translations';
import './LegalPage.css';

function getLang(): Language {
  return (localStorage.getItem('roket-language') as Language) || 'da';
}

function formatLegalText(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(<ul key={key++}>{listItems.map((li, i) => <li key={i}>{li}</li>)}</ul>);
      listItems = [];
    }
    inList = false;
  };

  for (const line of lines) {
    const isListItem = /^[-•]\s/.test(line);
    if (!isListItem && inList) flushList();

    if (/^#\s+/.test(line)) {
      elements.push(<h3 key={key++}>{line.replace(/^#\s+/, '')}</h3>);
    } else if (isListItem) {
      inList = true;
      listItems.push(line.replace(/^[-•]\s+/, ''));
    } else if (line.trim() !== '') {
      elements.push(<p key={key++}>{line}</p>);
    }
  }
  flushList();
  return elements;
}

interface LegalPageProps {
  title: string;
  texts: Record<string, string>;
}

export default function LegalPage({ title, texts }: LegalPageProps) {
  const lang = getLang();
  const t = translations[lang];
  const text = texts[lang] || texts['en'] || '';

  return (
    <div className="page legal-page">
      <nav className="navbar">
        <BackButton>{t.back}</BackButton>
        <h1>{title}</h1>
      </nav>
      <div className="legal-content">
        {formatLegalText(text)}
      </div>
    </div>
  );
}
