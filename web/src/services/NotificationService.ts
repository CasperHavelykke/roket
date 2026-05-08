import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { auth, db } from '../firebase';

// VAPID key from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
const VAPID_KEY = 'BKEsb4ArnQakZl4f8yufYwxr3hSU2aijm__oaB7AkubS9WNhM9IoKo_K6QJ6bM0U6fceQtZJnvBLeoc-3-ntTNY';

let messaging: ReturnType<typeof getMessaging> | null = null;

function getMessagingInstance() {
  if (messaging) return messaging;
  // getMessaging needs the default app
  const app = getApps()[0];
  if (!app) return null;
  try {
    messaging = getMessaging(app);
    return messaging;
  } catch {
    // Messaging not supported (e.g. iOS EU PWA)
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (!('serviceWorker' in navigator)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  await saveFCMToken();
  return true;
}

export async function saveFCMToken(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const msg = getMessagingInstance();
  if (!msg) return;

  try {
    // Register the FCM service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await updateDoc(doc(db, 'users', user.uid), { fcmToken: token });
    }
  } catch (err) {
    console.error('Failed to get FCM token:', err);
  }
}

export function onForegroundMessage(callback: (payload: any) => void): () => void {
  const msg = getMessagingInstance();
  if (!msg) return () => {};
  return onMessage(msg, callback);
}

export async function clearFCMToken(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await updateDoc(doc(db, 'users', user.uid), { fcmToken: '' });
  } catch {}
}
