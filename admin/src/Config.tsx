import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';

interface AppConfig {
  showTestBadges: boolean;
  loginTestInfo: string;
  releaseTag: string;
}

const defaults: AppConfig = {
  showTestBadges: true,
  loginTestInfo: 'For testing use mail: test@test.com password: Test1234',
  releaseTag: 'Beta',
};

export default function Config() {
  const [config, setConfig] = useState<AppConfig>(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'app'), snap => {
      const data = snap.data();
      if (!data) return;
      setConfig({
        showTestBadges: data.showTestBadges !== false,
        loginTestInfo: typeof data.loginTestInfo === 'string' ? data.loginTestInfo : defaults.loginTestInfo,
        releaseTag: typeof data.releaseTag === 'string' ? data.releaseTag : defaults.releaseTag,
      });
    });
  }, []);

  const save = async (partial: Partial<AppConfig>) => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'app'), partial, { merge: true });
    } catch (err) {
      alert('Fejl: ' + (err as Error).message);
    }
    setSaving(false);
  };

  return (
    <div className="config">
      <h2>App-konfiguration</h2>
      <p className="config-desc">Disse indstillinger påvirker appen i realtid for alle brugere.</p>

      <div className="config-grid">
        <div className="config-item">
          <label>Test-badges</label>
          <button
            className="config-toggle"
            onClick={() => save({ showTestBadges: !config.showTestBadges })}
            disabled={saving}
          >
            {config.showTestBadges ? 'TIL' : 'FRA'}
          </button>
        </div>

        <div className="config-item">
          <label>Login testinfo</label>
          <code className="config-code">test@test.com password: Test1234</code>
          <input
            className="config-input config-input-wide"
            value={config.loginTestInfo}
            onChange={e => setConfig(c => ({ ...c, loginTestInfo: e.target.value }))}
            onBlur={() => save({ loginTestInfo: config.loginTestInfo })}
            placeholder="Tom = skjult"
            disabled={saving}
          />
        </div>

        <div className="config-item">
          <label>Release-tag</label>
          <select
            className="config-select"
            value={config.releaseTag}
            onChange={e => save({ releaseTag: e.target.value })}
            disabled={saving}
          >
            <option value="Beta">Beta</option>
            <option value="Alfa">Alfa</option>
            <option value="">Ingen</option>
          </select>
        </div>
      </div>

      <h2 style={{ marginTop: 32 }}>Store-beskrivelse</h2>
      <p className="config-desc">Play Store / App Store beskrivelse — klik for at kopiere.</p>
      <StoreDescription />
    </div>
  );
}

const STORE_DESCRIPTION = `Røket — Meet people nearby

Røket is a social app that connects you with people close to you. See who's nearby on an interactive grid, start a conversation, and meet new people.

Features:

- Grid of nearby users, sorted by distance
- Real-time online status
- Direct messages with text and photos
- Profile pictures and photo gallery
- Optional display of gender, sexuality, and age
- Precise or approximate distance display
- Dark and light mode
- Optional 12- or 24-hour time format
- Distance in km/m or miles/ft

Røket is free to download. For users aged 18 and over only.`;

function StoreDescription() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(STORE_DESCRIPTION).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="store-description" onClick={handleCopy} title="Klik for at kopiere">
      <pre>{STORE_DESCRIPTION}</pre>
      <span className="store-description-badge">{copied ? 'Kopieret!' : 'Klik for at kopiere'}</span>
    </div>
  );
}
