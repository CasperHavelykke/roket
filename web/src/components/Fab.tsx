import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Fab.css';

interface FabItem {
  to: string;
  icon: React.ReactNode;
  badge?: number;
}

export default function Fab({ items }: { items: FabItem[] }) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [gradStyles, setGradStyles] = useState<React.CSSProperties[]>([]);

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
        <Link to={item.to} key={i} className="fab-btn" style={gradStyles[i]}>
          {item.icon}
          {item.badge && item.badge > 0 ? (
            <span className="fab-badge">{item.badge > 9 ? '9+' : item.badge}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
