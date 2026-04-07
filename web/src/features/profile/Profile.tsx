import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import BackButton from '../../components/BackButton';
import { doc, getDoc, updateDoc, addDoc, collection, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import translations, { Language } from '@shared/translations';
import MessageSvg from '@shared/assets/message.svg?react';
import MessagesSvg from '@shared/assets/messages.svg?react';
import { placeholderPic } from '../../utils/theme';
import PhotoGalleryModal from './PhotoGalleryModal';
import './Profile.css';

function getLang(): Language {
  return (localStorage.getItem('roket-language') as Language) || 'da';
}

function getDistanceUnit(): 'km' | 'mi' {
  return (localStorage.getItem('roket-distanceUnit') as 'km' | 'mi') || 'km';
}

function getDistanceMode(): string {
  return localStorage.getItem('roket-distanceMode') || 'exact';
}

interface UserData {
  displayName: string;
  photoURL?: string;
  photos?: string[];
  bio?: string;
  status?: string;
  birthday?: { day: number; month: number; year: number };
  showAge?: boolean;
  gender?: string;
  showGender?: boolean;
  sexuality?: string;
  showSexuality?: boolean;
  lastSeen?: any;
  distanceMode?: string;
}

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [distance, setDistance] = useState<number | undefined>();
  const [hasConversation, setHasConversation] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [reportText, setReportText] = useState('');
  const carouselRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const loc = useLocation();
  const fromChat = !!(loc.state as any)?.fromChat;
  const t = translations[getLang()];

  useEffect(() => {
    if (!userId) return;
    const uid = auth.currentUser?.uid;
    const loads: Promise<any>[] = [getDoc(doc(db, 'users', userId))];
    if (uid) {
      loads.push(getDoc(doc(db, 'userLocations', uid)));
      loads.push(getDoc(doc(db, 'userLocations', userId)));
    }
    Promise.all(loads).then(([userSnap, myLocSnap, theirLocSnap]) => {
      if (userSnap.exists()) setProfile(userSnap.data() as UserData);
      if (myLocSnap?.exists() && theirLocSnap?.exists()) {
        const myLoc = myLocSnap.data().location;
        const theirLoc = theirLocSnap.data().location;
        if (myLoc && theirLoc) {
          const R = 6371;
          const toRad = (d: number) => d * (Math.PI / 180);
          const dLat = toRad(theirLoc.latitude - myLoc.latitude);
          const dLon = toRad(theirLoc.longitude - myLoc.longitude);
          const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(myLoc.latitude)) * Math.cos(toRad(theirLoc.latitude)) *
            Math.sin(dLon / 2) ** 2;
          setDistance(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        }
      }
      setLoading(false);
    });
    // Check if conversation exists
    if (uid && userId) {
      const chatId = [uid, userId].sort().join('_');
      getDoc(doc(db, 'chats', chatId)).then(snap => {
        setHasConversation(snap.exists() && !!snap.data()?.lastMessage);
      });
    }
  }, [userId]);

  const openChat = () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !userId) return;
    const chatId = [uid, userId].sort().join('_');
    navigate(`/chat/${chatId}`, { state: { otherUserName: profile?.displayName, otherUserId: userId } });
  };

  const handleBlock = async () => {
    setShowMenu(false);
    const uid = auth.currentUser?.uid;
    if (!uid || !userId || !profile) return;
    if (!confirm(t.profileBlockConfirm(profile.displayName))) return;
    await Promise.all([
      updateDoc(doc(db, 'users', uid), { blockedUsers: arrayUnion(userId) }),
      addDoc(collection(db, 'blocks'), {
        blockerId: uid,
        blockedUserId: userId,
        createdAt: serverTimestamp(),
        status: 'pending',
      }),
    ]);
    navigate(-1);
  };

  const handleReport = () => {
    setShowMenu(false);
    setReportText('');
    setShowReportModal(true);
  };

  const handleSendReport = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !userId) return;
    setShowReportModal(false);
    await addDoc(collection(db, 'reports'), {
      reporterId: uid,
      reportedUserId: userId,
      message: reportText.trim() || null,
      createdAt: serverTimestamp(),
    });
    setReportText('');
  };

  if (loading) return <div className="loading">{t.ok}...</div>;
  if (!profile) return <div className="page"><p className="empty">{t.error}</p></div>;

  const allPhotos = profile.photoURL ? [profile.photoURL, ...(profile.photos ?? [])] : [];
  const age = profile.birthday && profile.showAge !== false
    ? (() => { const today = new Date(); const b = new Date(profile.birthday!.year, profile.birthday!.month - 1, profile.birthday!.day); let a = today.getFullYear() - b.getFullYear(); const m = today.getMonth() - b.getMonth(); if (m < 0 || (m === 0 && today.getDate() < b.getDate())) a--; return a; })()
    : undefined;
  const gender = profile.gender && profile.showGender !== false ? profile.gender : undefined;
  const sexuality = profile.sexuality && profile.showSexuality !== false ? profile.sexuality : undefined;
  const lastSeenMs = profile.lastSeen?.toDate?.()?.getTime();
  const isOnline = lastSeenMs && (Date.now() - lastSeenMs < 5 * 60 * 1000);

  const genderLabels: Record<string, string> = { male: t.genderMale, female: t.genderFemale, nonbinary: t.genderNonBinary, trans: t.genderTrans };
  const sexualityLabels: Record<string, string> = { straight: t.sexualityStraight, gay: t.sexualityGay, bisexual: t.sexualityBisexual, pansexual: t.sexualityPansexual, other: t.sexualityOther };

  const formatDist = (): string => {
    if (distance == null) return '';
    const myMode = getDistanceMode();
    const otherMode = profile.distanceMode ?? 'exact';
    if (myMode === 'hidden' || otherMode === 'hidden') return '';
    const unit = getDistanceUnit();
    if (unit === 'mi') {
      const miles = distance * 0.621371;
      if ((myMode === 'fuzzy' || otherMode === 'fuzzy') && distance < 0.03) return t.distanceUnder100ft;
      if (miles < 1) return t.distanceFeet(Math.round(miles * 5280));
      return t.distanceMiles(miles.toFixed(1));
    }
    if ((myMode === 'fuzzy' || otherMode === 'fuzzy') && distance < 0.03) return t.distanceUnder30;
    if (distance < 1) return t.distanceMeters(Math.round(distance * 1000));
    return t.distanceKm(distance.toFixed(1).replace('.', ','));
  };

  const formatLastSeen = (): string => {
    if (!lastSeenMs) return '';
    const diff = Date.now() - lastSeenMs;
    if (diff < 24 * 60 * 60 * 1000) return '';
    return t.profileLastSeenDays(Math.floor(diff / 86400000));
  };

  const handleScroll = () => {
    if (!carouselRef.current) return;
    const el = carouselRef.current;
    const w = el.clientWidth;
    setCurrentPhotoIndex(Math.round(el.scrollLeft / w));
  };

  const dist = formatDist();

  return (
    <div className="page profile-page">
      <div className="profile-topbar">
        <BackButton className="profile-back">{t.profileBack}</BackButton>
        <button className="profile-more-btn" onClick={() => setShowMenu(!showMenu)}>⋮</button>
      </div>

      {showMenu && (
        <>
          <div className="profile-menu-overlay" onClick={() => setShowMenu(false)} />
          <div className="profile-menu-card">
            <button className="profile-menu-option profile-menu-block" onClick={handleBlock}>
              {t.profileBlock(profile.displayName)}
            </button>
            <div className="profile-menu-divider" />
            <button className="profile-menu-option" onClick={handleReport}>
              {t.profileReport(profile.displayName)}
            </button>
            <div className="profile-menu-divider" />
            <button className="profile-menu-option profile-menu-cancel" onClick={() => setShowMenu(false)}>
              {t.cancel}
            </button>
          </div>
        </>
      )}

      <div className="profile-photo-container">
        {allPhotos.length > 1 ? (
          <div className="profile-carousel">
            <div className="profile-carousel-scroll" ref={carouselRef} onScroll={handleScroll}>
              {allPhotos.map((url, i) => (
                <img key={i} src={url} alt="" onClick={() => { setGalleryIndex(i); setGalleryOpen(true); }} style={{ cursor: 'pointer' }} />
              ))}
            </div>
            <div className="profile-photo-count">{currentPhotoIndex + 1}/{allPhotos.length}</div>
          </div>
        ) : (
          <img
            src={profile.photoURL || placeholderPic()}
            alt=""
            className="profile-single-photo"
            onClick={() => { if (allPhotos.length > 0) { setGalleryIndex(0); setGalleryOpen(true); } }}
            style={allPhotos.length > 0 ? { cursor: 'pointer' } : undefined}
          />
        )}
      </div>

      <PhotoGalleryModal
        visible={galleryOpen}
        photos={allPhotos}
        initialIndex={galleryIndex}
        onClose={() => setGalleryOpen(false)}
      />

      <div className="profile-info-card">
        {profile.status && (
          <h2 className="profile-name">{profile.status}</h2>
        )}

        {formatLastSeen() && (
          <p className="profile-status offline">
            {formatLastSeen()}
          </p>
        )}

        {profile.bio && (
          <div className={'profile-bio-section' + (profile.status || formatLastSeen() ? ' has-divider' : '')}>
            <p className="profile-bio-text">{profile.bio}</p>
          </div>
        )}

        <div className="profile-secondary-info">
          <span className="profile-secondary-name">{profile.displayName || ''}{profile.displayName && age ? `, ${age}` : age ? `${age}` : ''}</span>
          {dist && <span className="profile-secondary-distance">📍 {dist}</span>}
        </div>
      </div>

      {!fromChat && (
        <button className="profile-message-fab" onClick={openChat}>
          {hasConversation
            ? <MessagesSvg width={30} height={30} stroke="#fff" />
            : <MessageSvg width={30} height={30} stroke="#fff" />
          }
        </button>
      )}

      {showReportModal && (
        <div className="profile-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="profile-modal-title">{t.profileReportConfirm(profile.displayName)}</h3>
            <p className="profile-modal-desc">{t.profileReportDescription}</p>
            <textarea
              className="profile-modal-input"
              placeholder={t.profileReportPlaceholder}
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              rows={4}
            />
            <div className="profile-modal-buttons">
              <button className="profile-modal-btn profile-modal-cancel" onClick={() => setShowReportModal(false)}>
                {t.cancel}
              </button>
              <button className="profile-modal-btn profile-modal-send" onClick={handleSendReport}>
                {t.profileReportSend}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
