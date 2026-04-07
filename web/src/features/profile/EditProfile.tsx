import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '../../components/BackButton';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';
import translations, { Language } from '@shared/translations';
import { placeholderPic } from '../../utils/theme';
import getFirebaseError from '../../utils/getFirebaseError';
import CameraIcon from '@shared/assets/camera.svg?react';
import './EditProfile.css';

export default function EditProfile() {
  const lang = (localStorage.getItem('roket-language') as Language) || 'da';
  const t = translations[lang];
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAge, setShowAge] = useState(true);
  const [hasBirthday, setHasBirthday] = useState(false);
  const [gender, setGender] = useState('');
  const [showGender, setShowGender] = useState(true);
  const [sexuality, setSexuality] = useState('');
  const [showSexuality, setShowSexuality] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoRejected, setPhotoRejected] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const extraPhotoInputRef = useRef<HTMLInputElement>(null);
  const MAX_EXTRA_PHOTOS = 5;

  const genderLabel = (key: string) => {
    const map: Record<string, string> = { male: t.genderMale, female: t.genderFemale, nonbinary: t.genderNonBinary, trans: t.genderTrans };
    return map[key] ?? '';
  };
  const sexualityLabel = (key: string) => {
    const map: Record<string, string> = { straight: t.sexualityStraight, gay: t.sexualityGay, bisexual: t.sexualityBisexual, pansexual: t.sexualityPansexual, other: t.sexualityOther };
    return map[key] ?? '';
  };

  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
      const data = snap.data();
      if (!data) return;
      setDisplayName(data.displayName ?? '');
      setStatus(data.status ?? '');
      setBio(data.bio ?? '');
      setPhotoURL(data.photoURL ?? null);
      setShowAge(data.showAge !== false);
      setHasBirthday(!!data.birthday);
      setGender(data.gender ?? '');
      setShowGender(data.showGender !== false);
      setSexuality(data.sexuality ?? '');
      setShowSexuality(data.showSexuality !== false);
      setPhotos(data.photos ?? []);
      if (data.photoRejected) {
        setPhotoRejected(true);
        updateDoc(doc(db, 'users', currentUser.uid), { photoRejected: false }).catch(() => {});
      }
    });
  }, [currentUser]);

  if (!currentUser) return null;

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const storageRef = ref(storage, `profilePhotos/${currentUser.uid}.jpg`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: url });
      setPhotoURL(url);
    } catch (error: any) {
      alert(getFirebaseError(error, t));
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadPhoto(file);
    e.target.value = '';
  };

  const handleRemovePhoto = async () => {
    setUploading(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: null });
      deleteObject(ref(storage, `profilePhotos/${currentUser.uid}.jpg`)).catch(() => {});
      setPhotoURL(null);
    } catch (error: any) {
      alert(getFirebaseError(error, t));
    } finally {
      setUploading(false);
    }
  };

  const handleExtraPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || photos.length >= MAX_EXTRA_PHOTOS) return;
    e.target.value = '';

    setUploadingExtra(true);
    try {
      const index = photos.length;
      const storageRef = ref(storage, `profilePhotos/${currentUser.uid}_extra_${index}.jpg`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const updated = [...photos, url];
      await updateDoc(doc(db, 'users', currentUser.uid), { photos: updated });
      setPhotos(updated);
    } catch (error: any) {
      alert(getFirebaseError(error, t));
    } finally {
      setUploadingExtra(false);
    }
  };

  const handleRemoveExtraPhoto = async (index: number) => {
    if (!confirm(t.delete + '?')) return;
    setUploadingExtra(true);
    try {
      const removedUrl = photos[index];
      const updated = photos.filter((_, i) => i !== index);
      await updateDoc(doc(db, 'users', currentUser.uid), { photos: updated });
      if (removedUrl) deleteObject(ref(storage, removedUrl)).catch(() => {});
      setPhotos(updated);
    } catch (error: any) {
      alert(getFirebaseError(error, t));
    } finally {
      setUploadingExtra(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        displayName: displayName.trim(),
        status: status.trim(),
        bio: bio.trim(),
        showAge,
        showGender,
        showSexuality,
      });
      navigate(-1);
    } catch (error: any) {
      alert(getFirebaseError(error, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <nav className="navbar">
        <BackButton>{'\u2190'}</BackButton>
        <h1>{t.editProfileTitle}</h1>
      </nav>

      {photoRejected && (
        <div className="editprofile-rejected-banner">
          Dit billede blev fjernet fordi det overtræder vores retningslinjer. Upload venligst et passende billede.
        </div>
      )}

      <div className="editprofile-content">
        <div className="editprofile-photo-container" onClick={() => photoInputRef.current?.click()}>
          <svg className="editprofile-progress-ring" viewBox="0 0 134 134">
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--primaryBlue)" />
                <stop offset="1" stopColor="var(--primaryRed)" />
              </linearGradient>
            </defs>
            <circle className="editprofile-progress-bg" cx="67" cy="67" r="65.25" />
            <circle
              className="editprofile-progress-fill"
              cx="67" cy="67" r="65.25"
              stroke="url(#ringGrad)"
              strokeDasharray={2 * Math.PI * 65.25}
              strokeDashoffset={2 * Math.PI * 65.25 * (1 - ((photoURL ? 1 : 0) + (status.trim() ? 1 : 0) + (bio.trim() ? 1 : 0)) / 3)}
            />
          </svg>
          <img
            src={photoURL || placeholderPic()}
            alt=""
            className="editprofile-photo"
          />
          {uploading && (
            <div className="editprofile-photo-uploading">...</div>
          )}
          <div className={'editprofile-edit-badge' + (!photoURL ? ' pulse' : '')}>
            <CameraIcon width={16} height={16} />
          </div>
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="editprofile-photo-input"
          onChange={handlePhotoSelect}
        />

        <div className="editprofile-photo-hint">{t.editProfilePhotoHint}</div>
        <div className="editprofile-photo-guideline">{t.photoGuideline}</div>

        {photoURL && (
          <div className="editprofile-photo-actions">
            <button onClick={() => photoInputRef.current?.click()}>{t.editProfileChangePhoto}</button>
            <button className="remove" onClick={handleRemovePhoto}>{t.editProfileRemovePhoto}</button>
          </div>
        )}

        <div className="editprofile-extras">
          <div className="editprofile-extras-label">
            {t.editProfilePhotos} <span style={{ fontWeight: 400 }}>({t.editProfilePhotosDesc(photos.length, MAX_EXTRA_PHOTOS)})</span>
          </div>
          {!photoURL && photos.length > 0 && (
            <div className="editprofile-extras-hint">{t.editProfilePhotosHidden}</div>
          )}
          <div className="editprofile-extras-grid">
            {photos.map((url, i) => (
              <div key={i} className="editprofile-extra-slot">
                <img src={url} alt="" />
                <button className="editprofile-extra-remove" onClick={() => handleRemoveExtraPhoto(i)}>{'\u2715'}</button>
              </div>
            ))}
            {photos.length < MAX_EXTRA_PHOTOS && (
              <div
                className="editprofile-extra-add"
                onClick={() => !uploadingExtra && extraPhotoInputRef.current?.click()}
              >
                <span className="editprofile-extra-add-icon">+</span>
                <span className="editprofile-extra-add-label">{t.editProfileAddPhoto}</span>
              </div>
            )}
          </div>
          <input
            ref={extraPhotoInputRef}
            type="file"
            accept="image/*"
            className="editprofile-photo-input"
            onChange={handleExtraPhotoSelect}
          />
        </div>

        <div className="editprofile-form">
          <div className="editprofile-label">{t.editProfileStatusLabel}</div>
          <div className="editprofile-input-wrap">
            {!status.trim() && <div className="editprofile-input-glow" />}
            <input
              className={'editprofile-input' + (!status.trim() ? ' editprofile-input-pulse' : '')}
              value={status}
              onChange={e => setStatus(e.target.value)}
              placeholder={t.editProfileStatusPlaceholder}
              maxLength={80}
              autoCorrect="off"
            />
          </div>
          <div className="editprofile-charcount">{status.length}/80</div>

          <div className="editprofile-label">{t.editProfileBioLabel}</div>
          <div className="editprofile-input-wrap">
            {!bio.trim() && <div className="editprofile-input-glow" />}
            <textarea
              className={'editprofile-input editprofile-bio-input' + (!bio.trim() ? ' editprofile-input-pulse' : '')}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder={t.editProfileBioPlaceholder}
              maxLength={200}
            />
          </div>
          <div className="editprofile-charcount">{bio.length}/200</div>
          <div className="editprofile-divider" />

          <div className="editprofile-label">{t.editProfileNameLabel}</div>
          <div className="editprofile-input-wrap">
            <input
              className="editprofile-input"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder={t.editProfileNamePlaceholder}
              maxLength={50}
              autoCorrect="off"
            />
          </div>

          {hasBirthday && (
            <div className="editprofile-toggle-section">
              <div className="editprofile-toggle-row no-border">
                <div className="editprofile-toggle-info">
                  <div className="editprofile-label" style={{ marginBottom: 0 }}>{t.editProfileShowAge}</div>
                  <div className="editprofile-toggle-desc">{t.editProfileShowAgeDesc}</div>
                </div>
                <label className="editprofile-switch">
                  <input type="checkbox" checked={showAge} onChange={e => setShowAge(e.target.checked)} />
                  <span className="editprofile-switch-slider" />
                </label>
              </div>
            </div>
          )}

          <div className="editprofile-label">{t.settingsDistance}</div>
          <div className="editprofile-distance-row">
            {([['exact', t.settingsDistanceExact], ['fuzzy', t.settingsDistanceFuzzy], ['hidden', t.settingsDistanceHidden]] as const).map(([val, label]) => (
              <button
                key={val}
                className={'editprofile-distance-btn' + ((localStorage.getItem('roket-distanceMode') || 'exact') === val ? ' active' : '')}
                onClick={() => {
                  localStorage.setItem('roket-distanceMode', val);
                  const uid = auth.currentUser?.uid;
                  if (uid) {
                    setDoc(doc(db, 'users', uid), { distanceMode: val, settings: { distanceMode: val } }, { merge: true }).catch(() => {});
                  }
                  // Force re-render
                  setShowAge(v => v);
                }}
              >{label}</button>
            ))}
          </div>

        </div>

        <button
          className="editprofile-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <span className="editprofile-save-spinner" /> : t.editProfileSave}
        </button>
      </div>
    </div>
  );
}
