import { Link } from 'react-router-dom';
import './Fab.css';

interface FabItem {
  to: string;
  icon: React.ReactNode;
  badge?: number;
}

export default function Fab({ items }: { items: FabItem[] }) {
  return (
    <div className="fab-group">
      {items.map((item, i) => (
        <Link to={item.to} key={i} className="fab-btn">
          {item.icon}
          {item.badge && item.badge > 0 ? (
            <span className="fab-badge">{item.badge > 9 ? '9+' : item.badge}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
