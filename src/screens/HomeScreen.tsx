import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import LocationService from '../services/LocationService';

interface User {
  id: string;
  displayName: string;
  bio: string;
  photoURL: string | null;
  location: {
    latitude: number;
    longitude: number;
  };
  distance?: number;
  lastSeen?: Date;
}

const isOnline = (lastSeen?: Date): boolean => {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() < 5 * 60 * 1000; // 5 minutter
};

export default function HomeScreen({ navigation }: any) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    updateLocationAndLoad();

    // Hold lokation opdateret mens brugeren er på HomeScreen
    watchIdRef.current = LocationService.watchPosition(
      async (latitude, longitude) => {
        const currentUser = auth().currentUser;
        if (!currentUser) return;
        await firestore().collection('users').doc(currentUser.uid).update({
          location: new firestore.GeoPoint(latitude, longitude),
        });
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        LocationService.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const updateLocationAndLoad = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    const position = await LocationService.getCurrentPosition();
    if (position) {
      await firestore().collection('users').doc(currentUser.uid).update({
        location: new firestore.GeoPoint(position.latitude, position.longitude),
        lastSeen: firestore.FieldValue.serverTimestamp(),
      }).catch(() => {}); // Ignorer fejl hvis doc ikke eksisterer endnu
    }

    loadUsers();
  };

  const loadUsers = async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      // Hent current user's location først
      const currentUserDoc = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .get();

      const currentUserData = currentUserDoc.data();
      if (!currentUserData?.location) {
        console.log('No location for current user');
        setLoading(false);
        return;
      }

      const myLocation = {
        latitude: currentUserData.location.latitude,
        longitude: currentUserData.location.longitude,
      };
      const blockedUsers: string[] = currentUserData.blockedUsers ?? [];

      // Hent alle andre brugere
      const snapshot = await firestore()
        .collection('users')
        .where(firestore.FieldPath.documentId(), '!=', currentUser.uid)
        .get();

      const usersData: User[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.location && !blockedUsers.includes(doc.id)) {
          const distance = calculateDistance(
            myLocation.latitude,
            myLocation.longitude,
            data.location.latitude,
            data.location.longitude
          );

          usersData.push({
            id: doc.id,
            displayName: data.displayName,
            bio: data.bio || '',
            photoURL: data.photoURL,
            location: {
              latitude: data.location.latitude,
              longitude: data.location.longitude,
            },
            distance: distance,
            lastSeen: data.lastSeen?.toDate?.() ?? undefined,
          });
        }
      });

      // Sortér efter afstand
      usersData.sort((a, b) => (a.distance || 0) - (b.distance || 0));

      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    updateLocationAndLoad();
  };

  // Haversine formel til at beregne afstand mellem to koordinater
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Jordens radius i km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  };

  const toRad = (degrees: number): number => {
    return degrees * (Math.PI / 180);
  };

  const formatDistance = (distance?: number): string => {
    if (!distance) return '';
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m away`;
    }
    return `${distance.toFixed(1)}km away`;
  };

  const renderUserCard = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ProfileView', {
        user: { ...item, lastSeen: item.lastSeen?.getTime() },
      })}
    >
      <View style={styles.avatarContainer}>
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {item.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {isOnline(item.lastSeen) && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.name} numberOfLines={1}>
          {item.displayName}
        </Text>
        {item.bio ? (
          <Text style={styles.bio} numberOfLines={2}>
            {item.bio}
          </Text>
        ) : null}
        <Text style={styles.distance}>{formatDistance(item.distance)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Finding people nearby...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Roket 🚀</Text>
          <Text style={styles.headerSubtitle}>
            {users.length} {users.length === 1 ? 'person' : 'people'} nearby
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.chatsButton}
            onPress={() => navigation.navigate('MyProfile')}
          >
            <Text style={styles.chatsButtonText}>👤</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.chatsButton}
            onPress={() => navigation.navigate('ChatsList')}
          >
            <Text style={styles.chatsButtonText}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.chatsButton}
            onPress={() => auth().signOut()}
          >
            <Text style={styles.chatsButtonText}>⎋</Text>
          </TouchableOpacity>
        </View>
      </View>

      {users.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No people nearby yet 😔</Text>
          <Text style={styles.emptySubtext}>
            Be the first in your area!
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserCard}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#667eea',
    padding: 20,
    paddingTop: 50,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  chatsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatsButtonText: {
    fontSize: 22,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyText: {
    fontSize: 20,
    color: '#666',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  grid: {
    padding: 10,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 5,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 180,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },
  cardContent: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  bio: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  distance: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
    marginTop: 'auto',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
