import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import translations, { Language } from '@shared/translations';
import { placeholderPic } from '../../utils/theme';
import { auth } from '../../firebase';
import MessageSvg from '@shared/assets/message.svg?react';
import { getStatusTag } from '@shared/statusTags';
import './ProfilePreviewModal.css';

interface PreviewUser {
  id: string;
  displayName: string;
  bio?: string;
  status?: string;
  statusTag?: string | null;
  photoURL?: string;
  photos?: string[];
  distance?: number;
  distanceMode?: string;
  lastSeen?: Date;
  age?: number;
  gender?: string;
  sexuality?: string;
}

interface ProfilePreviewModalProps {
  visible: boolean;
  user: PreviewUser | null;
  onClose: () => void;
}

function getLang(): Language {
  return (localStorage.getItem('roket-language') as Language) || 'da';
}

function getDistanceUnit(): 'km' | 'mi' {
  return (localStorage.getItem('roket-distanceUnit') as 'km' | 'mi') || 'km';
}

function getDistanceMode(): string {
  return localStorage.getItem('roket-distanceMode') || 'exact';
}

export default function ProfilePreviewModal({ visible, user, onClose }: ProfilePreviewModalProps) {
  const navigate = useNavigate();
  const t = translations[getLang()];
  const [photoIndex, setPhotoIndex] = useState(0);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const [btnStyles, setBtnStyles] = useState<React.CSSProperties[]>([]);

  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => {
      const container = buttonsRef.current;
      if (!container) return;
      const card = container.closest('.preview-card') as HTMLElement;
      if (!card) return;
      const cardRect = card.getBoundingClientRect();
      const btns = container.querySelectorAll<HTMLElement>('.preview-action-btn');
      const styles: React.CSSProperties[] = [];
      btns.forEach((btn) => {
        const btnLeft = btn.getBoundingClientRect().left - cardRect.left;
        styles.push({
          backgroundImage: 'linear-gradient(90deg, var(--primaryBlue), var(--primaryRed))',
          backgroundSize: `${cardRect.width}px 100%`,
          backgroundPositionX: `${-btnLeft}px`,
        });
      });
      setBtnStyles(styles);
    });
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  if (!visible || !user) return null;

  const allPhotos = [user.photoURL, ...(user.photos || [])].filter(Boolean) as string[];
  const isOnline = user.lastSeen ? Date.now() - user.lastSeen.getTime() < 5 * 60 * 1000 : false;

  const formatLastSeen = (): string => {
    if (!user.lastSeen) return '';
    const diff = Date.now() - user.lastSeen.getTime();
    if (diff < 5 * 60 * 1000) return t.profileOnlineNow;
    if (diff < 60 * 60 * 1000) return t.profileLastSeenMinutes(Math.floor(diff / 60000));
    if (diff < 24 * 60 * 60 * 1000) return t.profileLastSeenHours(Math.floor(diff / 3600000));
    return t.profileLastSeenDays(Math.floor(diff / 86400000));
  };

  const formatDistance = (): string => {
    const d = user.distance;
    if (d == null) return '';
    const myMode = getDistanceMode();
    const unit = getDistanceUnit();
    if (myMode === 'hidden' || user.distanceMode === 'hidden') return '';
    if (unit === 'mi') {
      const miles = d * 0.621371;
      if ((myMode === 'fuzzy' || user.distanceMode === 'fuzzy') && d < 0.03) return t.distanceUnder100ft;
      if (miles < 1) return t.distanceFeet(Math.round(miles * 5280));
      return t.distanceMiles(miles.toFixed(1));
    }
    if ((myMode === 'fuzzy' || user.distanceMode === 'fuzzy') && d < 0.03) return t.distanceUnder30;
    if (d < 1) return t.distanceMeters(Math.round(d * 1000));
    return t.distanceKm(d.toFixed(1).replace('.', ','));
  };

  const genderLabels: Record<string, string> = {
    male: t.genderMale, female: t.genderFemale, nonbinary: t.genderNonBinary, trans: t.genderTrans,
  };
  const sexualityLabels: Record<string, string> = {
    straight: t.sexualityStraight, gay: t.sexualityGay, bisexual: t.sexualityBisexual,
    pansexual: t.sexualityPansexual, other: t.sexualityOther,
  };

  const distStr = formatDistance();

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const w = el.clientWidth;
    if (w > 0) setPhotoIndex(Math.round(el.scrollLeft / w));
  };

  const handleViewProfile = () => {
    onClose();
    navigate(`/profile/${user.id}`);
  };

  const handleSendMessage = () => {
    onClose();
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const chatId = [uid, user.id].sort().join('_');
    navigate(`/chat/${chatId}`, { state: { otherUserName: user.displayName, otherUserId: user.id } });
  };

  return (
    <div className="preview-overlay">
      <div className="preview-overlay-bg" onClick={onClose} />
      <div className="preview-card">
        {/* Header: thumbnail (clickable to profile) + status */}
        <div className="preview-header">
          <img
            src={allPhotos.length > 0 ? allPhotos[0] : placeholderPic()}
            alt=""
            className="preview-thumbnail"
            onClick={handleViewProfile}
            style={{ cursor: 'pointer' }}
          />
          <div className="preview-header-text">
            {(() => {
              const tag = getStatusTag(user.statusTag);
              return tag ? (
                <div className="preview-tag-pill">
                  <span className="preview-tag-emoji">{tag.emoji}</span>
                  <span>{String((t as any)[`tag${tag.id.charAt(0).toUpperCase() + tag.id.slice(1)}`] ?? tag.id)}</span>
                </div>
              ) : null;
            })()}
            {user.status && (
              <div className="preview-status-text">{user.status}</div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="preview-info">
          <div className={`preview-bio${!user.bio ? ' empty' : ''}`}>
            {user.bio || t.profileNoBio}
          </div>

          <button className="preview-send-btn" onClick={handleSendMessage}>
            <MessageSvg width={20} height={20} stroke="#fff" />
            <span>{t.profileSendMessage}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
