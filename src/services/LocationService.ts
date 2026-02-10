import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform, Alert } from 'react-native';

class LocationService {
  // Request location permission
  async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Roket Location Permission',
            message: 'Roket needs access to your location to show nearby people',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // iOS handles permissions differently
  }

  // Get current position
  async getCurrentPosition(): Promise<{latitude: number; longitude: number} | null> {
    const hasPermission = await this.requestLocationPermission();
    
    if (!hasPermission) {
      Alert.alert(
        'Permission Denied',
        'Location permission is required to use Roket'
      );
      return null;
    }

    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Location error:', error);
          Alert.alert('Location Error', error.message);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  }

  // Watch position (updates when user moves)
  watchPosition(
    onUpdate: (latitude: number, longitude: number) => void,
    onError?: (error: any) => void
  ): number | null {
    return Geolocation.watchPosition(
      (position) => {
        onUpdate(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.error('Watch position error:', error);
        if (onError) onError(error);
      },
      {
        enableHighAccuracy: true,
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
