import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Fab.css';

interface FabItem {
  to: string;
  icon: React.ReactNode;
  badge?: number;
  pulse?: boolean;
  unread?: boolean;
  onLongPress?: () => void;
}

export default function Fab({ items, overlay }: { items: FabItem[]; overlay?: (gradStyle: React.CSSProperties) => React.ReactNode }) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [gradStyles, setGradStyles] = useState<React.CSSProperties[]>([]);
  const [gradOffsets, setGradOffsets] = useState<{ btnLeft: number; pageWidth: number }[]>([]);
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
      const offsets: { btnLeft: number; pageWidth: number }[] = [];
      buttons.forEach((btn) => {
        const btnLeft = btn.getBoundingClientRect().left - pageRect.left;
        styles.push({
          backgroundImage: 'linear-gradient(90deg, var(--primaryBlue), var(--primaryRed))',
          backgroundSize: `${pageRect.width}px 100%`,
          backgroundPositionX: `${-btnLeft}px`,
        });
        offsets.push({ btnLeft, pageWidth: pageRect.width });
      });
      setGradStyles(styles);
      setGradOffsets(offsets);
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
          <Link to={item.to} key={i} className={'fab-btn' + (item.unread ? ' fab-btn-unread' : '')} style={item.unread ? undefined : gradStyles[i]}>
            {item.pulse && <div className="fab-pulse-ring" />}
            {item.unread ? (() => {
              const o = gradOffsets[i];
              const svgW = 56;
              const x1 = o ? (-o.btnLeft / o.pageWidth) * svgW / (30 / svgW) : 0;
              const x2 = o ? ((o.pageWidth - o.btnLeft) / o.pageWidth) * svgW / (30 / svgW) : svgW;
              return <svg viewBox="0 0 56 51" width="30" height="30" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                  <linearGradient id={`fabGrad${i}`} gradientUnits="userSpaceOnUse" x1={-o?.btnLeft * (56/30) || 0} y1="0" x2={((o?.pageWidth || 600) - (o?.btnLeft || 0)) * (56/30)} y2="0">
                    <stop offset="0" stopColor="var(--primaryBlue)" />
                    <stop offset="1" stopColor="var(--primaryRed)" />
                  </linearGradient>
                </defs>
                <g transform="matrix(1,0,0,1,-23.75,-23.3627)" stroke={`url(#fabGrad${i})`}>
                  <path d="M37.233,54.46L56.796,54.46C60.799,54.46 64.049,51.21 64.049,47.207L64.049,32.7C64.049,28.696 60.799,25.446 56.796,25.446L33.087,25.446C29.084,25.446 25.833,28.696 25.833,32.7L25.833,59.685L37.233,54.46Z" strokeWidth="4.17"/>
                  <g transform="matrix(-1,0,0,1,102.886,12.0038)">
                    <path d="M32.025,25.553C28.522,26.04 25.833,29.059 25.833,32.7L25.833,59.685L37.233,54.46L56.796,54.46C60.093,54.46 62.879,52.255 63.727,49.232" strokeWidth="4.17"/>
                  </g>
                  <path d="M34.041,37.557L47.694,37.557" strokeWidth="4.17"/>
                  <g transform="matrix(1.5,0,0,1.5,-17.0203,-11.0865)">
                    <path d="M34.041,37.557L47.694,37.557" strokeWidth="2.78"/>
                  </g>
                </g>
              </svg>;
            })() : item.icon}
            {item.badge && item.badge > 0 ? (
              <span className={item.unread ? 'fab-badge fab-badge-gradient' : 'fab-badge'} style={item.unread ? gradStyles[i] : undefined}>{item.badge > 9 ? '9+' : item.badge}</span>
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
    }, 400);
  }, [onLongPress]);

  const handleEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
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
        onClick={handleClick}
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
