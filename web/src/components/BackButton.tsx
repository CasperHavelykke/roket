import { useNavigate } from 'react-router-dom';

export default function BackButton({ className = 'back', children }: { className?: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <a className={className} onClick={() => navigate(-1)} style={{ cursor: 'pointer' }}>
      {children}
    </a>
  );
}
