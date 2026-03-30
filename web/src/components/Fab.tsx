import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Fab.css';

interface FabItem {
  to: string;
  icon: React.ReactNode;
  badge?: number;
  onLongPress?: () => void;
}

export default function Fab({ items, overlay }: { items: FabItem[]; overlay?: (gradStyle: React.CSSProperties) => React.ReactNode }) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [gradStyles, setGradStyles] = useState<React.CSSProperties[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const update = () => {
      const group = groupRef.current;
      if (!group) return;
      const page = group.closest('.page') as HTMLElement;
      if (!page) return;
      const pageRect = page.getBoundingClientRect();
      const buttons = group.querySelectorAll<HTMLElement>('.fab-btn');
      const styles: React.CSSProperties[] = [];
      buttons.forEach((btn) => {
        const btnLeft = btn.getBoundingClientRect().left - pageRect.left;
        styles.push({
          backgroundImage: 'linear-gradient(90deg, var(--primaryBlue), var(--primaryRed))',
          backgroundSize: `${pageRect.width}px 100%`,
          backgroundPositionX: `${-btnLeft}px`,
        });
      });
      setGradStyles(styles);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div className="fab-group" ref={groupRef}>
      {items.map((item, i) => (
        item.onLongPress ? (
          <LongPressButton
            key={i}
            to={item.to}
            icon={item.icon}
            badge={item.badge}
            style={gradStyles[i]}
            onLongPress={item.onLongPress}
            navigate={navigate}
            overlay={overlay ? overlay(gradStyles[i] || {}) : undefined}
          />
        ) : (
          <Link to={item.to} key={i} className="fab-btn" style={gradStyles[i]}>
            {item.icon}
            {item.badge && item.badge > 0 ? (
              <span className="fab-badge">{item.badge > 9 ? '9+' : item.badge}</span>
            ) : null}
          </Link>
        )
      ))}
    </div>
  );
}

function LongPressButton({ to, icon, badge, style, onLongPress, navigate, overlay }: {
  to: string;
  icon: React.ReactNode;
  badge?: number;
  style?: React.CSSProperties;
  onLongPress: () => void;
  navigate: ReturnType<typeof useNavigate>;
  overlay?: React.ReactNode;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const handleStart = useCallback(() => {
    didLongPress.current = false;
    timerRef.current = setTimeout(() => {
      didLongPress.current = true;
      onLongPress();
    }, 300);
  }, [onLongPress]);

  const handleEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!didLongPress.current) {
      navigate(to);
    }
  }, [navigate, to]);

  const handleCancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      {overlay}
      <div
        className="fab-btn"
        style={style}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
        onTouchCancel={handleCancel}
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={handleCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {icon}
        {badge && badge > 0 ? (
          <span className="fab-badge">{badge > 9 ? '9+' : badge}</span>
        ) : null}
      </div>
    </div>
  );
}
