import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocationPrecision = 'fine' | 'coarse' | 'denied' | 'never_ask_again';

class LocationService {
  // Request location permission and return precision level
  async requestLocationPermission(): Promise<LocationPrecision> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          return 'fine';
        }

        // Android 12+: brugeren kan vælge "Omtrentlig lokation"
        // Tjek altid coarse før vi konkluderer denied/never_ask_again
        const coarse = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        );
        if (coarse) {
          return 'coarse';
        }

        if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          return 'never_ask_again';
        }

        return 'denied';
      } catch (err) {
        console.warn(err);
        return 'denied';
      }
    }
    // iOS: request authorization explicitly
    const auth = await Geolocation.requestAuthorization('whenInUse');
    if (auth === 'granted') {
      await AsyncStorage.setItem('ios_location_granted', 'true');
      return 'fine';
    }
    if (auth === 'denied') return 'denied';
    return 'never_ask_again';
  }

  // Check current precision without requesting (non-intrusive)
  async checkCurrentPrecision(): Promise<LocationPrecision> {
    if (Platform.OS === 'ios') {
      // iOS: ingen PermissionsAndroid — brug AsyncStorage til at huske om tilladelse er givet
      const granted = await AsyncStorage.getItem('ios_location_granted');
      return granted === 'true' ? 'fine' : 'denied';
    }
    try {
      const fine = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      if (fine) return 'fine';

      const coarse = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      );
      if (coarse) return 'coarse';

      return 'denied';
    } catch {
      return 'denied';
    }
  }

  // Get current position
  async getCurrentPosition(): Promise<{latitude: number; longitude: number; precision: LocationPrecision} | null> {
    const precision = await this.requestLocationPermission();

    if (precision === 'denied' || precision === 'never_ask_again') {
      return null;
    }

    const getPosition = (highAccuracy: boolean): Promise<{latitude: number; longitude: number; precision: LocationPrecision} | null> =>
      new Promise((resolve) => {
        Geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              precision,
            });
          },
          (error) => {
            console.warn('Location error:', error);
            resolve(null);
          },
          {
            enableHighAccuracy: highAccuracy,
            timeout: 15000,
            maximumAge: 10000,
          },
        );
      });

    if (precision === 'fine') {
      const result = await getPosition(true);
      if (result) return result;
      return getPosition(false);
    }
    return getPosition(false);
  }

  // Watch position (updates when user moves)
  async watchPosition(
    onUpdate: (latitude: number, longitude: number) => void,
    onError?: (error: any) => void
  ): Promise<number | null> {
    // Tjek kun eksisterende permission — vis ikke dialog igen
    const precision = await this.checkCurrentPrecision();
    if (precision === 'denied') {
      if (onError) onError({ message: 'Location permission not granted.', code: 1 });
      return null;
    }

    return Geolocation.watchPosition(
      (position) => {
        onUpdate(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.error('Watch position error:', error);
        if (onError) onError(error);
      },
      {
        enableHighAccuracy: precision === 'fine',
        distanceFilter: 50, // Update every 50 meters
        interval: 10000, // Check every 10 seconds
        fastestInterval: 5000,
      }
    );
  }

  // Stop watching position
  clearWatch(watchId: number) {
    Geolocation.clearWatch(watchId);
  }
}

export default new LocationService();
