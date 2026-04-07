import { useState, useRef, useEffect } from 'react';
import translations, { Language } from '@shared/translations';
import './PhotoGalleryModal.css';

interface PhotoGalleryModalProps {
  visible: boolean;
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}

function getLang(): Language {
  return (localStorage.getItem('roket-language') as Language) || 'da';
}

export default function PhotoGalleryModal({ visible, photos, initialIndex = 0, onClose }: PhotoGalleryModalProps) {
  const t = translations[getLang()];
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible && scrollRef.current) {
      const el = scrollRef.current;
      el.scrollLeft = initialIndex * el.clientWidth;
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  // Close on Escape key
  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [visible, onClose]);

  if (!visible || photos.length === 0) return null;

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const w = el.clientWidth;
    if (w > 0) setCurrentIndex(Math.round(el.scrollLeft / w));
  };

  return (
    <div className="photo-gallery-overlay">
      <div className="photo-gallery-header">
        <button className="photo-gallery-close" onClick={onClose}>{'\u2715'}</button>
        {photos.length > 1 && (
          <span className="photo-gallery-counter">
            {t.photoGalleryTitle(currentIndex + 1, photos.length)}
          </span>
        )}
        <div className="photo-gallery-spacer" />
      </div>

      <div className="photo-gallery-scroll" ref={scrollRef} onScroll={handleScroll}>
        {photos.map((uri, i) => (
          <div key={i} className="photo-gallery-item">
            <img src={uri} alt="" />
          </div>
        ))}
      </div>

      {photos.length > 1 && (
        <div className="photo-gallery-dots">
          {photos.map((_, i) => (
            <div key={i} className={`photo-gallery-dot${i === currentIndex ? ' active' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}
