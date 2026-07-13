import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { geohashForLocation } from 'geofire-common';

/**
 * Nærved-notifikationer via FCM geohash-topics (privacy-model 2026-07):
 * enheden abonnerer på topic'et for sin egen geohash-celle, og serveren
 * publicerer nye aktiviteter til cellerne omkring aktiviteten. Positionen
 * bruges KUN lokalt til at vælge cellen — der uploades intet, og Røkets
 * database indeholder ingen brugerlokationer.
 *
 * Celle-niveau 5 ≈ 4,9 × 4,9 km ved ækvator (~2,8 km bred i Danmark).
 * VIGTIGT: serverens celle-beregning (functions) SKAL bruge samme
 * geofire-encoding og præcision, ellers matcher topic-navnene ikke.
 */
export const NEARBY_CELL_PRECISION = 5;

const CELL_STORAGE_KEY = '@roket_nearby_cell';

export const nearbyTopicForCell = (cell: string) => `nearby-${cell}`;

/**
 * Abonnér på cellen for positionen og afmeld en evt. tidligere celle.
 * Idempotent — kaldes trygt ved hver app-start/foreground (self-heal:
 * geninstallation og token-rotation kan nulstille FCM-abonnementer,
 * og et gen-abonnement på samme celle er harmløst).
 */
export async function subscribeToNearbyCell(latitude: number, longitude: number): Promise<void> {
  const cell = geohashForLocation([latitude, longitude], NEARBY_CELL_PRECISION);
  const prev = await AsyncStorage.getItem(CELL_STORAGE_KEY);
  if (prev && prev !== cell) {
    await messaging().unsubscribeFromTopic(nearbyTopicForCell(prev)).catch(() => {});
  }
  await messaging().subscribeToTopic(nearbyTopicForCell(cell));
  await AsyncStorage.setItem(CELL_STORAGE_KEY, cell);
}

/**
 * Afmeld helt (opt-out og logout). Topic-abonnementer følger ENHEDEN
 * (FCM-tokenet), ikke kontoen — glemmes dette ved logout, bliver enheden
 * ved med at få nærved-pushes for den tidligere brugers tilvalg.
 */
export async function unsubscribeFromNearby(): Promise<void> {
  const prev = await AsyncStorage.getItem(CELL_STORAGE_KEY);
  if (!prev) return;
  await messaging().unsubscribeFromTopic(nearbyTopicForCell(prev)).catch(() => {});
  await AsyncStorage.removeItem(CELL_STORAGE_KEY);
}
