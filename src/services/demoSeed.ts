import auth from '@react-native-firebase/auth';

// HTTP i stedet for onCall: mobilen har ikke functions-SDK'et (ny native
// pod). Gæster er anonymt auth'et, så alle har et ID-token at sende med.
const SEED_URL = 'https://us-central1-roket-ac4de.cloudfunctions.net/seedDemoEvents';

export type SeedDemoResult = 'ok' | 'not-empty' | 'rate-limited' | 'error';

// Opret 3 demo-aktiviteter omkring positionen ("Prøv appen"-knappen i
// drawerens tomme tilstand). Serveren håndhæver værnene (tomt område,
// rate-limit); klienten oversætter kun svaret til en brugervendt besked.
export async function seedDemoEvents(
  latitude: number,
  longitude: number,
): Promise<SeedDemoResult> {
  const user = auth().currentUser;
  if (!user) return 'error';

  try {
    const token = await user.getIdToken();
    const res = await fetch(SEED_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ lat: latitude, lng: longitude }),
    });
    if (res.ok) return 'ok';
    if (res.status === 409) return 'not-empty';
    if (res.status === 429) return 'rate-limited';
    return 'error';
  } catch (e) {
    console.warn('Demo seed failed:', e);
    return 'error';
  }
}
