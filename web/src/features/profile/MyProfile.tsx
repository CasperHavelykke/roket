import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../../components/BackButton';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import translations, { Language } from '@shared/translations';
import { placeholderPic } from '../../utils/theme';
import PhotoGalleryModal from './PhotoGalleryModal';
import './MyProfile.css';

export default function MyProfile() {
  const lang = (localStorage.getItem('roket-language') as Language) || 'da';
  const t = translations[lang];
  const currentUser = auth.currentUser;

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [sexuality, setSexuality] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [distanceMode, setDistanceMode] = useState<string | null>(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const genderLabels: Record<string, string> = {
    male: t.genderMale, female: t.genderFemale, nonbinary: t.genderNonBinary,
    trans: t.genderTrans,
  };
  const sexualityLabels: Record<string, string> = {
    straight: t.sexualityStraight, gay: t.sexualityGay, bisexual: t.sexualityBisexual,
    pansexual: t.sexualityPansexual, other: t.sexualityOther,
  };

  const formatLastSeen = (lastSeenMs: number): string => {
    const diff = Date.now() - lastSeenMs;
    if (diff < 24 * 60 * 60 * 1000) return '';
    return t.profileLastSeenDays(Math.floor(diff / 86400000));
  };

  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
      const data = snap.data();
      if (!data) return;
      setDisplayName(data.displayName ?? '');
      setBio(data.bio ?? '');
      setStatus(data.status ?? '');
      setPhotoURL(data.photoURL ?? null);
      if (data.birthday && data.showAge !== false) {
        const today = new Date();
        const birth = new Date(data.birthday.year, data.birthday.month - 1, data.birthday.day);
        let a = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
        setAge(a);
      } else {
        setAge(null);
      }
      setGender(data.gender && data.showGender !== false ? data.gender : null);
      setSexuality(data.sexuality && data.showSexuality !== false ? data.sexuality : null);
      setPhotos(data.photos ?? []);
      setLastSeen(data.lastSeen?.toMillis?.() ?? null);
      setDistanceMode(data.distanceMode ?? null);
    });
    getDoc(doc(db, 'userLocations', currentUser.uid)).then(snap => {
      setLocationGranted(snap.exists());
    }).catch(() => {});
  }, [currentUser]);

  if (!currentUser) return null;

  const allPhotos = photoURL ? [photoURL, ...photos] : [];

  const handleScroll = () => {
    if (!carouselRef.current) return;
    const el = carouselRef.current;
    const width = el.clientWidth;
    const index = Math.round(el.scrollLeft / width);
    setCurrentPhotoIndex(index);
  };

  return (
    <div className="page profile-page" style={{ paddingTop: 0 }}>
      <div className="profile-topbar">
        <BackButton className="profile-back">{t.myProfileBack}</BackButton>
      </div>

      <div className="myprofile-content">
        <div className="myprofile-photo-container">
          {allPhotos.length > 1 ? (
            <div className="myprofile-photo-carousel">
              <div
                className="myprofile-carousel-scroll"
                ref={carouselRef}
                onScroll={handleScroll}
              >
                {allPhotos.map((uri, i) => (
                  <img key={i} src={uri} alt="" onClick={() => { setGalleryIndex(i); setGalleryOpen(true); }} style={{ cursor: 'pointer' }} />
                ))}
              </div>
              <div className="myprofile-photo-count">
                {currentPhotoIndex + 1}/{allPhotos.length}
              </div>
            </div>
          ) : (
            <img
              src={photoURL || placeholderPic()}
              alt=""
              className="myprofile-single-photo"
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

        <div className="myprofile-info">
          {status ? (
            <div className="myprofile-name">{status}</div>
          ) : null}

          {lastSeen !== null && formatLastSeen(lastSeen) !== '' && (
            <div className="myprofile-online offline">
              {formatLastSeen(lastSeen)}
            </div>
          )}

          {bio && (
            <div className={'myprofile-bio-section' + (status || (lastSeen !== null && formatLastSeen(lastSeen) !== '') ? ' has-divider' : '')}>
              <div className="myprofile-bio">{bio}</div>
            </div>
          )}

          <div className="myprofile-secondary-info">
            <span className="myprofile-secondary-name">{displayName || ''}{displayName && age ? `, ${age}` : age ? `${age}` : ''}</span>
            {locationGranted && distanceMode && distanceMode !== 'hidden' && (() => {
              const unit = (localStorage.getItem('roket-distanceUnit') as 'km' | 'mi') || 'km';
              const text = distanceMode === 'fuzzy'
                ? (unit === 'mi' ? t.distanceUnder100ft : t.distanceUnder30)
                : (unit === 'mi' ? t.distanceFeet(0) : t.distanceMeters(0));
              return <span className="myprofile-secondary-distance">{'\uD83D\uDCCD'} {text}</span>;
            })()}
          </div>
        </div>

        <div className="myprofile-edit-wrap">
          {!photoURL && <div className="myprofile-edit-pulse" />}
          <Link to="/profile/edit" className="myprofile-edit-btn">
            {t.myProfileEdit}
          </Link>
        </div>
      </div>
    </div>
  );
}
