import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import translations, { Language } from '@shared/translations';
import './MyProfile.css';

export default function MyProfile() {
  const lang = (localStorage.getItem('roket-language') as Language) || 'da';
  const t = translations[lang];
  const currentUser = auth.currentUser;

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [sexuality, setSexuality] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
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
    if (diff < 5 * 60 * 1000) return t.profileOnlineNow;
    if (diff < 60 * 60 * 1000) return t.profileLastSeenMinutes(Math.floor(diff / 60000));
    if (diff < 24 * 60 * 60 * 1000) return t.profileLastSeenHours(Math.floor(diff / 3600000));
    return t.profileLastSeenDays(Math.floor(diff / 86400000));
  };

  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
      const data = snap.data();
      if (!data) return;
      setDisplayName(data.displayName ?? '');
      setBio(data.bio ?? '');
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
    });
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
    <div className="page" style={{ paddingTop: 0 }}>
      <div className="myprofile-back">
        <Link to="/">{t.myProfileBack}</Link>
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
                  <img key={i} src={uri} alt="" />
                ))}
              </div>
              <div className="myprofile-photo-count">
                {currentPhotoIndex + 1}/{allPhotos.length}
              </div>
            </div>
          ) : (
            <img
              src={photoURL || '/missing-profile-pic.png'}
              alt=""
              className="myprofile-single-photo"
            />
          )}
        </div>

        <div className="myprofile-info">
          <div className="myprofile-name">
            {displayName || ''}{displayName && age ? `, ${age}` : age ? `${age}` : ''}
          </div>

          {lastSeen !== null && (
            <div className={`myprofile-online ${Date.now() - lastSeen < 5 * 60 * 1000 ? 'online' : 'offline'}`}>
              {Date.now() - lastSeen < 5 * 60 * 1000 ? '\u25CF ' : '\u25CB '}
              {formatLastSeen(lastSeen)}
            </div>
          )}

          {(gender || sexuality) && (
            <div className="myprofile-details-row">
              {gender && (
                <span className="myprofile-chip">{genderLabels[gender] ?? gender}</span>
              )}
              {sexuality && (
                <span className="myprofile-chip">{sexualityLabels[sexuality] ?? sexuality}</span>
              )}
            </div>
          )}

          {bio ? (
            <div className="myprofile-bio-section">
              <div className="myprofile-bio-label">{t.myProfileAbout}</div>
              <div className="myprofile-bio">{bio}</div>
            </div>
          ) : (
            <div className="myprofile-bio-section">
              <div className="myprofile-bio-empty">{t.myProfileNoBio}</div>
            </div>
          )}
        </div>

        <Link to="/profile/edit" className="myprofile-edit-btn">
          {t.myProfileEdit}
        </Link>
      </div>
    </div>
  );
}
