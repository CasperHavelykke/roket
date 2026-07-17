import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

class NotificationService {
  // Bed om tilladelse og gem FCM token i Firestore
  async initialize(): Promise<void> {
    // Android 13+ kræver eksplicit POST_NOTIFICATIONS permission
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('Android notification permission denied');
        return;
      }
    }

    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('Notification permission denied');
      return;
    }

    await this.saveFCMToken();

    // Opdater token hvis det fornyes — registrér KUN én refresh-listener,
    // uanset hvor mange gange initialize() kaldes (den blev før stablet
    // ved hvert kald og lækkede)
    if (!this.tokenRefreshRegistered) {
      this.tokenRefreshRegistered = true;
      messaging().onTokenRefresh(token => {
        this.saveToken(token);
      });
    }
  }

  private tokenRefreshRegistered = false;

  private async saveFCMToken(): Promise<void> {
    try {
      // iOS kræver at enheden registreres for remote messages før getToken()
      if (Platform.OS === 'ios') {
        await messaging().registerDeviceForRemoteMessages();
      }
      const token = await messaging().getToken();
      await this.saveToken(token);
    } catch (err) {
      // iOS-simulatorer understøtter ikke APNs/push — ignorér stille
      console.log('FCM token kunne ikke hentes:', err);
    }
  }

  private async saveToken(token: string): Promise<void> {
    const user = auth().currentUser;
    if (!user) return;

    // PII-privat: tokenet bor i private-subcollectionen (kun ejer + staff
    // kan læse) — ikke på det offentligt læsbare bruger-doc. Functions
    // læser private/push først med fallback til legacy-feltet (v1.1.9).
    await firestore()
      .collection('users')
      .doc(user.uid)
      .collection('private')
      .doc('push')
      .set({ fcmToken: token, updatedAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
  }

  // Lyt til notifikationer mens appen er i forgrunden
  onForegroundMessage(callback: (notification: any) => void): () => void {
    return messaging().onMessage(async remoteMessage => {
      callback(remoteMessage);
    });
  }

  // Hvad sker der når bruger trykker på en notifikation (baggrund).
  // Returnerer unsubscribe — SKAL ryddes op af kalderen. Effekten i
  // App.tsx re-kører ved hvert authState-skift (login/logout), så uden
  // oprydning stabler den én native listener pr. cyklus → tap navigerer
  // N gange.
  onNotificationOpenedApp(callback: (remoteMessage: any) => void): () => void {
    return messaging().onNotificationOpenedApp(remoteMessage => {
      callback(remoteMessage);
    });
  }

  // Tjek om appen blev åbnet via en notifikation (lukket)
  async getInitialNotification(): Promise<any> {
    return await messaging().getInitialNotification();
  }
}

export default new NotificationService();
