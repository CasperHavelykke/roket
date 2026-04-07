import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LogoMenu.css';

interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  to?: string;
}

export default function LogoMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  return (
    <div className="logo-menu-wrap" ref={menuRef}>
      <img
        src="/logo-simpel.svg"
        alt=""
        className="navbar-logo"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{ cursor: 'pointer' }}
      />
      {open && (
        <div className="logo-menu-dropdown">
          {items.map((item, i) => (
            <button
              key={i}
              className="logo-menu-item"
              onClick={() => {
                setOpen(false);
                if (item.to) navigate(item.to);
                if (item.onClick) item.onClick();
              }}
            >
              {item.icon && <span className="logo-menu-icon">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
