import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '../../components/BackButton';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';
import translations, { Language } from '@shared/translations';
import { placeholderPic } from '../../utils/theme';
import './EditProfile.css';

export default function EditProfile() {
  const lang = (localStorage.getItem('roket-language') as Language) || 'da';
  const t = translations[lang];
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const [displayName, setDisplayName] = useState('');
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
  const [datingOnly, setDatingOnly] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const extraPhotoInputRef = useRef<HTMLInputElement>(null);
  const MAX_EXTRA_PHOTOS = 5;

  const genderLabel = (key: string) => {
    const map: Record<string, string> = { male: t.genderMale, female: t.genderFemale, nonbinary: t.genderNonBinary, trans: t.genderTrans };
    return map[key] ?? '';
  };
  const sexualityLabel = (key: string) => {
    const map: Record<string, string> = { straight: t.sexualityStraight, gay: t.sexualityGay, bisexual: t.sexualityBisexual };
    return map[key] ?? '';
  };

  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
      const data = snap.data();
      if (!data) return;
      setDisplayName(data.displayName ?? '');
      setBio(data.bio ?? '');
      setPhotoURL(data.photoURL ?? null);
      setShowAge(data.showAge !== false);
      setHasBirthday(!!data.birthday);
      setGender(data.gender ?? '');
      setShowGender(data.showGender !== false);
      setSexuality(data.sexuality ?? '');
      setShowSexuality(data.showSexuality !== false);
      setPhotos(data.photos ?? []);
      setDatingOnly(data.datingOnly ?? false);
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
      alert(error.message);
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
      setPhotoURL(null);
    } catch (error: any) {
      alert(error.message);
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
      alert(error.message);
    } finally {
      setUploadingExtra(false);
    }
  };

  const handleRemoveExtraPhoto = async (index: number) => {
    if (!confirm(t.delete + '?')) return;
    setUploadingExtra(true);
    try {
      const updated = photos.filter((_, i) => i !== index);
      await updateDoc(doc(db, 'users', currentUser.uid), { photos: updated });
      setPhotos(updated);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploadingExtra(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        displayName: displayName.trim(),
        bio: bio.trim(),
        showAge,
        showGender,
        showSexuality,
        datingOnly,
      });
      navigate('/profile/me');
    } catch (error: any) {
      alert(error.message);
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

      <div className="editprofile-content">
        <div className="editprofile-photo-container" onClick={() => photoInputRef.current?.click()}>
          <img
            src={photoURL || placeholderPic()}
            alt=""
            className="editprofile-photo"
          />
          {uploading && (
            <div className="editprofile-photo-uploading">...</div>
          )}
          <div className="editprofile-edit-badge">
            {'\uD83D\uDCF7'}
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
          <div className="editprofile-label">{t.editProfileNameLabel}</div>
          <input
            className="editprofile-input"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder={t.editProfileNamePlaceholder}
            maxLength={50}
            autoCorrect="off"
          />

          <div className="editprofile-label">{t.editProfileBioLabel}</div>
          <textarea
            className="editprofile-input editprofile-bio-input"
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder={t.editProfileBioPlaceholder}
            maxLength={200}
          />
          <div className="editprofile-charcount">{bio.length}/200</div>

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
        </div>

        {gender !== '' && (
          <div className="editprofile-toggle-section">
            <div className="editprofile-toggle-value">{t.editProfileGender}: {genderLabel(gender)}</div>
            <div className="editprofile-toggle-row">
              <div className="editprofile-toggle-info">
                <div className="editprofile-label" style={{ marginBottom: 0 }}>{t.editProfileShowGender}</div>
                <div className="editprofile-toggle-desc">{t.editProfileShowGenderDesc}</div>
              </div>
              <label className="editprofile-switch">
                <input type="checkbox" checked={showGender} onChange={e => setShowGender(e.target.checked)} />
                <span className="editprofile-switch-slider" />
              </label>
            </div>
          </div>
        )}

        {sexuality !== '' && (
          <div className="editprofile-toggle-section">
            <div className="editprofile-toggle-value">{t.editProfileSexuality}: {sexualityLabel(sexuality)}</div>
            <div className="editprofile-toggle-row">
              <div className="editprofile-toggle-info">
                <div className="editprofile-label" style={{ marginBottom: 0 }}>{t.editProfileShowSexuality}</div>
                <div className="editprofile-toggle-desc">{t.editProfileShowSexualityDesc}</div>
              </div>
              <label className="editprofile-switch">
                <input type="checkbox" checked={showSexuality} onChange={e => setShowSexuality(e.target.checked)} />
                <span className="editprofile-switch-slider" />
              </label>
            </div>
          </div>
        )}

        <div className="editprofile-toggle-section">
          <div className="editprofile-toggle-row no-border">
            <div className="editprofile-toggle-info">
              <div className="editprofile-label" style={{ marginBottom: 0 }}>{t.editProfileDatingOnly}</div>
              <div className="editprofile-toggle-desc">{t.editProfileDatingOnlyDesc}</div>
            </div>
            <label className="editprofile-switch">
              <input type="checkbox" checked={datingOnly} onChange={e => setDatingOnly(e.target.checked)} />
              <span className="editprofile-switch-slider" />
            </label>
          </div>
        </div>

        <button
          className="editprofile-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '...' : t.editProfileSave}
        </button>
      </div>
    </div>
  );
}
