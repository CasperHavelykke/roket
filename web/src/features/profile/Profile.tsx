import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import BackButton from '../../components/BackButton';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import translations, { Language } from '@shared/translations';
import MessagesSvg from '@shared/assets/messages.svg?react';
import { placeholderPic } from '../../utils/theme';
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
  }, [userId]);

  const openChat = () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !userId) return;
    const chatId = [uid, userId].sort().join('_');
    navigate(`/chat/${chatId}`, { state: { otherUserName: profile?.displayName, otherUserId: userId } });
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
    if (diff < 5 * 60 * 1000) return t.profileOnlineNow;
    if (diff < 60 * 60 * 1000) return t.profileLastSeenMinutes(Math.floor(diff / 60000));
    if (diff < 24 * 60 * 60 * 1000) return t.profileLastSeenHours(Math.floor(diff / 3600000));
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
      </div>

      <div className="profile-photo-container">
        {allPhotos.length > 1 ? (
          <div className="profile-carousel">
            <div className="profile-carousel-scroll" ref={carouselRef} onScroll={handleScroll}>
              {allPhotos.map((url, i) => (
                <img key={i} src={url} alt="" />
              ))}
            </div>
            <div className="profile-photo-count">{currentPhotoIndex + 1}/{allPhotos.length}</div>
          </div>
        ) : (
          <img
            src={profile.photoURL || placeholderPic()}
            alt=""
            className="profile-single-photo"
          />
        )}
      </div>

      <div className="profile-info-card">
        <h2 className="profile-name">
          {profile.displayName}{age ? `, ${age}` : ''}
        </h2>

        {lastSeenMs && (
          <p className={'profile-status' + (isOnline ? ' online' : ' offline')}>
            {isOnline ? '● ' : '○ '}{formatLastSeen()}
          </p>
        )}

        {dist && <p className="profile-distance">📍 {dist}</p>}

        {(gender || sexuality) && (
          <div className="profile-chips">
            {gender && <span className="profile-chip">{genderLabels[gender] ?? gender}</span>}
            {sexuality && <span className="profile-chip">{sexualityLabels[sexuality] ?? sexuality}</span>}
          </div>
        )}

        {profile.bio ? (
          <div className="profile-bio-section">
            <span className="profile-bio-label">{t.profileAbout}</span>
            <p className="profile-bio-text">{profile.bio}</p>
          </div>
        ) : (
          <div className="profile-bio-section">
            <p className="profile-bio-empty">{t.profileNoBio}</p>
          </div>
        )}
      </div>

      {!fromChat && (
        <button className="profile-message-fab" onClick={openChat}>
          <MessagesSvg width={30} height={30} stroke="#fff" />
        </button>
      )}
    </div>
  );
}
