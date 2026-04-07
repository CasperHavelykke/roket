import { useState, useRef, useCallback, memo, type ImgHTMLAttributes } from 'react';
import './CardCarousel.css';

const preventMenu = (e: React.SyntheticEvent) => e.preventDefault();

function FadeImg(props: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      {...props}
      style={{ opacity: 0, transition: 'opacity 0.15s ease', ...props.style }}
      onLoad={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '1'; }}
      onContextMenu={preventMenu}
      ref={(el) => { if (el?.complete) el.style.opacity = '1'; }}
    />
  );
}

interface CardCarouselProps {
  photos: string[];
  fallbackSrc: string;
  compact?: boolean;
  onClick?: () => void;
  onLongPress?: () => void;
}

export default memo(function CardCarousel({ photos, fallbackSrc, compact, onClick, onLongPress }: CardCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const didMove = useRef(false);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const w = el.clientWidth;
    if (w > 0) setCurrentIndex(Math.round(el.scrollLeft / w));
  }, []);

  const cancelTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(() => {
    didLongPress.current = false;
    didMove.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      onLongPress?.();
    }, 500);
  }, [onLongPress]);

  const handleTouchMove = useCallback(() => {
    didMove.current = true;
    cancelTimer();
  }, [cancelTimer]);

  const handleTouchEnd = useCallback(() => {
    cancelTimer();
  }, [cancelTimer]);

  const handleClick = useCallback(() => {
    if (!didLongPress.current && !didMove.current) onClick?.();
  }, [onClick]);

  if (photos.length === 0) {
    return (
      <div
        className="card-carousel-single"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        <FadeImg src={fallbackSrc} alt="" draggable={false} />
      </div>
    );
  }

  if (photos.length === 1) {
    return (
      <div
        className="card-carousel-single"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        <FadeImg src={photos[0]} alt="" draggable={false} />
      </div>
    );
  }

  return (
    <div className="card-carousel">
      <div
        className="card-carousel-scroll"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {photos.map((uri, i) => (
          <div
            key={i}
            className="card-carousel-slide"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={handleClick}
          >
            <FadeImg src={uri} alt="" draggable={false} />
          </div>
        ))}
      </div>
      {!compact && (
        <div className="card-carousel-dots">
          {photos.map((_, i) => (
            <div key={i} className={`card-carousel-dot${i === currentIndex ? ' active' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
});
