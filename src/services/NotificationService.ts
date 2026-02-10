import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

class NotificationService {
  // Bed om tilladelse og gem FCM token i Firestore
  async initialize(): Promise<void> {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('Notification permission denied');
      return;
    }

    await this.saveFCMToken();

    // Opdater token hvis det fornyes
    messaging().onTokenRefresh(token => {
      this.saveToken(token);
    });
  }

  private async saveFCMToken(): Promise<void> {
    const token = await messaging().getToken();
    await this.saveToken(token);
  }

  private async saveToken(token: string): Promise<void> {
    const user = auth().currentUser;
    if (!user) return;

    await firestore().collection('users').doc(user.uid).update({
      fcmToken: token,
    });
  }

  // Lyt til notifikationer mens appen er i forgrunden
  onForegroundMessage(callback: (notification: any) => void): () => void {
    return messaging().onMessage(async remoteMessage => {
      callback(remoteMessage);
    });
  }

  // Hvad sker der når bruger trykker på en notifikation (baggrund)
  onNotificationOpenedApp(callback: (remoteMessage: any) => void): void {
    messaging().onNotificationOpenedApp(remoteMessage => {
      callback(remoteMessage);
    });
  }

  // Tjek om appen blev åbnet via en notifikation (lukket)
  async getInitialNotification(): Promise<any> {
    return await messaging().getInitialNotification();
  }
}

export default new NotificationService();
