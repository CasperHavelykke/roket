import { useState, useRef } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';
import translations, { Language } from '@shared/translations';
import './ProfileSetup.css';

function getLang(): Language {
  return (localStorage.getItem('roket-language') as Language) || 'da';
}

const AVATAR_GRADIENTS = [
  { label: 'blue', color1: '#4A90D9', color2: '#357ABD' },
  { label: 'red', color1: '#D94A4A', color2: '#BD3535' },
  { label: 'purple', color1: '#9B59B6', color2: '#8E44AD' },
];

const PersonSvg = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" fill="white" />
    <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" fill="white" />
  </svg>
);

const PersonSvgLarge = () => (
  <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" fill="white" />
    <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" fill="white" />
  </svg>
);

export default function ProfileSetup() {
  const t = translations[getLang()];
  const lang = getLang();
  const user = auth.currentUser;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [selectedStatusChip, setSelectedStatusChip] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [needsBirthday, setNeedsBirthday] = useState(false);
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const monthsByLang: Record<string, string[]> = {
    da: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    fr: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
    pt: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  };
  const placeholders: Record<string, { day: string; month: string; year: string }> = {
    da: { day: 'Dag', month: 'Måned', year: 'År' },
    en: { day: 'Day', month: 'Month', year: 'Year' },
    es: { day: 'Día', month: 'Mes', year: 'Año' },
    de: { day: 'Tag', month: 'Monat', year: 'Jahr' },
    fr: { day: 'Jour', month: 'Mois', year: 'Année' },
    pt: { day: 'Dia', month: 'Mês', year: 'Ano' },
  };
  const monthNames = monthsByLang[lang] || monthsByLang.en;
  const ph = placeholders[lang] || placeholders.en;

  const statusOptions = [t.setupStatusOption1, t.setupStatusOption2, t.setupStatusOption3];

  useState(() => {
    const stored = localStorage.getItem('@roket_birthday');
    if (!stored) setNeedsBirthday(true);
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setSelectedAvatar(null);
    e.target.value = '';
  };

  const handleSelectAvatar = (label: string) => {
    setSelectedAvatar(label);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSelectStatusChip = (index: number) => {
    if (selectedStatusChip === index) {
      setSelectedStatusChip(null);
      setStatus('');
    } else {
      setSelectedStatusChip(index);
      setStatus(statusOptions[index]);
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    // Read birthday from localStorage or from form input
    let birthday: { day: number; month: number; year: number } | null = null;
    try {
      const stored = localStorage.getItem('@roket_birthday');
      if (stored) birthday = JSON.parse(stored);
    } catch {}

    if (!birthday && needsBirthday) {
      const d = parseInt(birthDay, 10);
      const m = parseInt(birthMonth, 10);
      const y = parseInt(birthYear, 10);
      if (!d || !m || !y || d < 1 || d > 31 || m < 1 || m > 12 || y < 1900) {
        setError(t.signupErrorNoBirthday); setLoading(false); return;
      }
      // Age check
      const today = new Date();
      const birth = new Date(y, m - 1, d);
      let age = today.getFullYear() - birth.getFullYear();
      const mDiff = today.getMonth() - birth.getMonth();
      if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--;
      if (age < 18) { setError(t.signupErrorTooYoung); setLoading(false); return; }
      birthday = { day: d, month: m, year: y };
    }

    if (!birthday) { setError(t.signupErrorNoBirthday); setLoading(false); return; }

    try {
      let uploadedPhotoURL: string | null = null;

      if (photoFile) {
        try {
          const storageRef = ref(storage, `profilePhotos/${user.uid}.jpg`);
          await uploadBytes(storageRef, photoFile);
          uploadedPhotoURL = await getDownloadURL(storageRef);
        } catch (e) {
          console.warn('Photo upload failed, continuing without photo:', e);
        }
      }

      await setDoc(doc(db, 'users', user.uid), {
        displayName: '',
        bio: '',
        status: status.trim(),
        email: user.email,
        createdAt: serverTimestamp(),
        photoURL: uploadedPhotoURL,
        lastSeen: serverTimestamp(),
        distanceMode: 'exact',
        ...(birthday ? { birthday } : {}),
        showAge: true,
        gender: '',
        showGender: false,
        sexuality: '',
        showSexuality: false,
        photos: [],
        matchTag: 'all',
        visibleTo: ['all'],
        datingOnly: false,
        setupComplete: true,
      }, { merge: true });

      localStorage.removeItem('@roket_birthday');
      window.location.href = '/';
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <div className="setup-content">
        <div className="setup-form">
          <img src="/logo.svg" alt="" className="setup-logo" />
          <h1>{t.setupTitle}</h1>
          <p className="setup-subtitle">{t.setupSubtitle}</p>

          {/* Profile Photo Section */}
          <div className="setup-photo-section">
            <div
              className="setup-photo-preview"
              onClick={() => photoInputRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="" className="setup-photo-img" />
              ) : selectedAvatar ? (
                <div className={`setup-avatar-preview setup-avatar-${selectedAvatar}`}>
                  <PersonSvgLarge />
                </div>
              ) : (
                <div className="setup-photo-placeholder">
                  <PersonSvgLarge />
                </div>
              )}
            </div>

            <button
              className="setup-upload-btn"
              type="button"
              onClick={() => photoInputRef.current?.click()}
            >
              {t.setupUploadPhoto}
            </button>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="setup-photo-input"
              onChange={handlePhotoSelect}
            />

          </div>

          {/* Status Section */}
          <h3 className="setup-label">{t.setupStatusLabel}</h3>
          <input
            className="setup-status-input"
            value={status}
            onChange={e => { setStatus(e.target.value); setSelectedStatusChip(null); }}
            placeholder={t.setupStatusLabel}
            maxLength={80}
          />
          <div className="setup-status-chips">
            {statusOptions.map((opt, i) => (
              <button
                key={i}
                type="button"
                className={`setup-status-chip${selectedStatusChip === i ? ' selected' : ''}`}
                onClick={() => handleSelectStatusChip(i)}
              >
                {opt}
              </button>
            ))}
          </div>

          {/* Birthday Section (conditional) */}
          {needsBirthday && (
            <>
              <h3 className="setup-label">{t.signupBirthday}</h3>
              <div className="setup-birthday-row">
                <input
                  className="setup-birthday-input"
                  placeholder={ph.day}
                  value={birthDay}
                  onChange={e => setBirthDay(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                  maxLength={2}
                  inputMode="numeric"
                />
                <button
                  className={'setup-month-picker' + (birthMonth ? ' has-value' : '')}
                  onClick={() => setShowMonthPicker(!showMonthPicker)}
                  type="button"
                >
                  {birthMonth ? monthNames[parseInt(birthMonth, 10) - 1] : ph.month}
                </button>
                <input
                  className="setup-birthday-input"
                  placeholder={ph.year}
                  value={birthYear}
                  onChange={e => setBirthYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  maxLength={4}
                  inputMode="numeric"
                />
              </div>
              <div className={'setup-month-grid-wrap' + (showMonthPicker ? ' open' : '')}>
                <div className="setup-month-grid">
                  {monthNames.map((m, i) => (
                    <button
                      key={i}
                      className={'setup-month-option' + (parseInt(birthMonth, 10) === i + 1 ? ' selected' : '')}
                      onClick={() => { setBirthMonth(String(i + 1)); setShowMonthPicker(false); }}
                      type="button"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && <p className="setup-error">{error}</p>}
        </div>

        <div className="setup-footer">
          <button className="setup-complete" onClick={handleComplete} disabled={loading}>
            {loading ? '...' : t.setupComplete}
          </button>
        </div>
      </div>
    </div>
  );
}
