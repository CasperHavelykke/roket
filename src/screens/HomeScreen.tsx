import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Linking,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import LocationService from '../services/LocationService';
import { useTheme } from '../theme';
import DisclosureModal from '../components/DisclosureModal';
import SettingsIcon from '../assets/settings.svg';
import ProfileIcon from '../assets/profile.svg';
import MessagesIcon from '../assets/messages.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CardCarousel from '../components/CardCarousel';
import RoketLogo from '../assets/roket-logo-3.svg';

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
  distanceMode?: string;
  age?: number;
  gender?: string;
  sexuality?: string;
  photos?: string[];
  testAccount?: boolean;
}

const INACTIVE_HOURS = 24; // Skjul profiler der ikke har været online i X timer

const isOnline = (lastSeen?: Date): boolean => {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() < 5 * 60 * 1000; // 5 minutter
};

const getAge = (birthday: { day: number; month: number; year: number }): number => {
  const today = new Date();
  const birth = new Date(birthday.year, birthday.month - 1, birthday.day);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

export default function HomeScreen({ navigation }: any) {
  const { colors, isDark, t, distanceMode, distanceUnit, gridColumns } = useTheme();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadFromUsers, setUnreadFromUsers] = useState<Set<string>>(new Set());
  const [needsProfile, setNeedsProfile] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [showLocationDisclosure, setShowLocationDisclosure] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const numColumns = (gridColumns >= 1 && gridColumns <= 4) ? gridColumns : 2;
  const locationDisclosureResolve = useRef<((v: boolean) => void) | null>(null);

  // Tjek om bruger mangler profil (intet displayName)
  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    const unsubscribe = firestore()
      .collection('users')
      .doc(currentUser.uid)
      .onSnapshot(doc => {
        const data = doc.data();
        setNeedsProfile(!data?.photoURL);
      });

    return () => unsubscribe();
  }, []);

  // Lyt efter ulæste beskeder
  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    const unsubscribe = firestore()
      .collection('chats')
      .where('participants', 'array-contains', currentUser.uid)
      .onSnapshot(snapshot => {
        const unreadUserIds = new Set<string>();
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (!data.lastMessage || data.lastMessageSenderId === currentUser.uid) return;
          const lastRead = data.lastRead?.[currentUser.uid];
          const isUnread = !lastRead || (data.lastMessageTime && lastRead.toMillis() < data.lastMessageTime.toMillis());
          if (isUnread) {
            const otherUserId = data.participants.find((id: string) => id !== currentUser.uid);
            if (otherUserId) unreadUserIds.add(otherUserId);
          }
        });
        setHasUnread(unreadUserIds.size > 0);
        setUnreadFromUsers(unreadUserIds);
      });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    updateLocationAndLoad();
  }, []);

  const requestLocationDisclosure = (): Promise<boolean> => {
    return new Promise(resolve => {
      locationDisclosureResolve.current = resolve;
      setShowLocationDisclosure(true);
    });
  };

  const updateLocationAndLoad = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    // Tjek om lokationstilladelse allerede er givet
    const currentPrecision = await LocationService.checkCurrentPrecision();
    if (currentPrecision === 'denied') {
      const accepted = await requestLocationDisclosure();
      if (!accepted) {
        // Slet gammel lokation så brugeren ikke vises for andre
        firestore().collection('userLocations').doc(currentUser.uid).delete().catch(() => {});
        setUsers([]);
        setLocationDenied(true);
        setLoading(false);
        return;
      }

      // Anmod OS om tilladelse
      const permResult = await LocationService.requestLocationPermission();
      if (permResult === 'never_ask_again') {
        // Android viser ikke dialogen — åbn indstillinger direkte
        Linking.openSettings();
        firestore().collection('userLocations').doc(currentUser.uid).delete().catch(() => {});
        setUsers([]);
        setLocationDenied(true);
        setLoading(false);
        return;
      }
      if (permResult === 'denied') {
        firestore().collection('userLocations').doc(currentUser.uid).delete().catch(() => {});
        setUsers([]);
        setLocationDenied(true);
        setLoading(false);
        return;
      }
    }

    const position = await LocationService.getCurrentPosition();
    if (position) {
      setLocationDenied(false);
      await Promise.all([
        firestore().collection('userLocations').doc(currentUser.uid).set({
          location: new firestore.GeoPoint(position.latitude, position.longitude),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        }),
        firestore().collection('users').doc(currentUser.uid).update({
          lastSeen: firestore.FieldValue.serverTimestamp(),
        }),
      ]).catch(() => {});
    } else {
      // Geolocation fejlede (timeout el.lign.)
      firestore().collection('userLocations').doc(currentUser.uid).delete().catch(() => {});
      setUsers([]);
      setLocationDenied(true);
      setLoading(false);
      return;
    }

    loadUsers();
  };

  const loadUsers = async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      // Hent current user's profil og lokation
      const [currentUserDoc, myLocDoc] = await Promise.all([
        firestore().collection('users').doc(currentUser.uid).get(),
        firestore().collection('userLocations').doc(currentUser.uid).get(),
      ]);

      const currentUserData = currentUserDoc.data();
      const myLocData = myLocDoc.data();
      if (!myLocData?.location) {
        console.log('No location for current user');
        setLoading(false);
        return;
      }

      const myLocation = {
        latitude: myLocData.location.latitude,
        longitude: myLocData.location.longitude,
      };
      const blockedUsers: string[] = currentUserData?.blockedUsers ?? [];

      // Hent alle andre brugere og deres lokationer
      const [usersSnapshot, locationsSnapshot] = await Promise.all([
        firestore().collection('users')
          .where(firestore.FieldPath.documentId(), '!=', currentUser.uid)
          .get(),
        firestore().collection('userLocations').get(),
      ]);

      // Byg lokation-map
      const locationMap = new Map<string, { latitude: number; longitude: number }>();
      locationsSnapshot.forEach(doc => {
        const loc = doc.data().location;
        if (loc) locationMap.set(doc.id, { latitude: loc.latitude, longitude: loc.longitude });
      });

      const usersData: User[] = [];

      usersSnapshot.forEach(doc => {
        const data = doc.data();
        const theirBlockedUsers: string[] = data.blockedUsers ?? [];
        const theirLoc = locationMap.get(doc.id);
        const lastSeenDate = data.lastSeen?.toDate?.();
        const isInactive = !lastSeenDate || (Date.now() - lastSeenDate.getTime() > INACTIVE_HOURS * 60 * 60 * 1000);
        if (theirLoc && !isInactive && !blockedUsers.includes(doc.id) && !theirBlockedUsers.includes(currentUser.uid) && !data.banned && !(data.suspendedUntil?.toDate?.() > new Date())) {
          const distance = calculateDistance(
            myLocation.latitude,
            myLocation.longitude,
            theirLoc.latitude,
            theirLoc.longitude
          );

          usersData.push({
            id: doc.id,
            displayName: data.displayName,
            bio: data.bio || '',
            photoURL: data.photoURL,
            location: theirLoc,
            distance: distance,
            lastSeen: data.lastSeen?.toDate?.() ?? undefined,
            distanceMode: data.distanceMode ?? 'exact',
            age: data.birthday && data.showAge !== false ? getAge(data.birthday) : undefined,
            gender: data.gender && data.showGender !== false ? data.gender : undefined,
            sexuality: data.sexuality && data.showSexuality !== false ? data.sexuality : undefined,
            photos: data.photos ?? [],
            testAccount: data.testAccount ?? false,
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
    setVisibleCount(12);
    updateLocationAndLoad();
  };

  const onEndReached = useCallback(() => {
    if (visibleCount < users.length) {
      setVisibleCount(prev => Math.min(prev + 12, users.length));
    }
  }, [visibleCount, users.length]);

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

  const formatDistance = (distance?: number, otherDistanceMode?: string): string => {
    if (distance == null) return '';
    if (distanceMode === 'hidden' || otherDistanceMode === 'hidden') return '';
    if (distanceUnit === 'mi') {
      const miles = distance * 0.621371;
      if ((distanceMode === 'fuzzy' || otherDistanceMode === 'fuzzy') && distance < 0.03) {
        return t.distanceUnder100ft;
      }
      if (miles < 1) {
        return t.distanceFeet(Math.round(miles * 5280));
      }
      return t.distanceMiles(miles.toFixed(1));
    }
    if ((distanceMode === 'fuzzy' || otherDistanceMode === 'fuzzy') && distance < 0.03) {
      return t.distanceUnder30;
    }
    if (distance < 1) {
      return t.distanceMeters(Math.round(distance * 1000));
    }
    return t.distanceKm(distance.toFixed(1).replace('.', ','));
  };

  const cardMargin = numColumns >= 4 ? 2 : numColumns >= 3 ? 3 : 5;
  const gridPadding = cardMargin;
  const cardWidth = (screenWidth - gridPadding * 2 - numColumns * cardMargin * 2) / numColumns;
  const isCompact = numColumns >= 4;
  const isSingle = numColumns === 1;

  const fallbackSource = isDark ? require('../assets/missing-profile-pic.png') : require('../assets/missing-profile-pic-light.png');

  const renderUserCard = ({ item }: { item: User }) => {
    const allPhotos = [item.photoURL, ...(item.photos || [])].filter(Boolean) as string[];

    const navigateToProfile = () => navigation.navigate('ProfileView', {
      user: { ...item, lastSeen: item.lastSeen?.getTime(), distanceMode: item.distanceMode, age: item.age, gender: item.gender, sexuality: item.sexuality, photos: item.photos, testAccount: item.testAccount },
    });

    return (
    <View
      style={[styles.card, { width: cardWidth, maxWidth: cardWidth, margin: cardMargin }, isSingle && { aspectRatio: 1.2 }, unreadFromUsers.has(item.id) && { borderWidth: 3, borderColor: colors.primaryBlue }]}
    >
      <CardCarousel
        photos={allPhotos}
        width={cardWidth}
        fallbackSource={fallbackSource}
        compact={isCompact}
        onPress={navigateToProfile}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.cardOverlay}
        pointerEvents="none"
      >
        <Text style={[styles.cardName, isCompact && { fontSize: 12 }]} numberOfLines={1}>{item.displayName || ''}{item.displayName && item.age ? `, ${item.age}` : item.age ? `${item.age}` : ''}</Text>
        <Text style={[styles.cardDistance, isCompact && { fontSize: 10 }]}>{formatDistance(item.distance, item.distanceMode)}</Text>
      </LinearGradient>
      {isOnline(item.lastSeen) && (
        <View style={[styles.onlineDot, { backgroundColor: colors.online, borderColor: '#fff' }, isCompact && { width: 8, height: 8, borderRadius: 4, top: 5, right: 5 }]} />
      )}
      {item.testAccount && !isCompact && (
        <View style={styles.testBadge}>
          <Text style={styles.testBadgeText}>{t.testAccount}</Text>
        </View>
      )}
      {unreadFromUsers.has(item.id) && !isCompact && (
        <View style={styles.messageBadge}>
          <MessagesIcon width={14} height={14} stroke="#fff" />
        </View>
      )}
    </View>
  );
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primaryRed} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t.homeLoadingText}</Text>
        <DisclosureModal
          visible={showLocationDisclosure}
          icon="📍"
          title={t.disclosureLocationTitle}
          message={t.disclosureLocationMessage}
          acceptLabel={t.disclosureLocationAccept}
          cancelLabel={t.cancel}
          onAccept={() => {
            setShowLocationDisclosure(false);
            locationDisclosureResolve.current?.(true);
          }}
          onCancel={() => {
            setShowLocationDisclosure(false);
            locationDisclosureResolve.current?.(false);
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primaryBlue, colors.primaryRed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.headerTitle, { color: colors.textWhite }]}>Røket</Text>
          <RoketLogo width={28} height={28} />
        </View>
      </LinearGradient>

      {users.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.centerContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {locationDenied ? (
            <>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.homeLocationDenied}</Text>
              <TouchableOpacity
                style={[styles.enableLocationButton, { backgroundColor: colors.primaryBlue }]}
                onPress={() => updateLocationAndLoad()}
              >
                <Text style={styles.enableLocationText}>{t.homeEnableLocation}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.homeEmpty}</Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                {t.homeEmptySubtext}
              </Text>
            </>
          )}
        </ScrollView>
      ) : (
        <FlatList
          key={`grid-${numColumns}`}
          data={users.slice(0, visibleCount)}
          renderItem={renderUserCard}
          keyExtractor={item => item.id}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? { justifyContent: 'center' } : undefined}
          contentContainerStyle={[styles.grid, { padding: gridPadding, paddingBottom: gridPadding + insets.bottom }]}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
      {(() => {
        const fabSize = 56;
        const fabGap = 10;
        const fabGroupLeft = screenWidth - 16 - (3 * fabSize + 2 * fabGap);
        return (
          <View style={[styles.fab, { bottom: insets.bottom + 16 }]}>
            {[
              { icon: <ProfileIcon width={26} height={26} stroke="#fff" />, onPress: () => navigation.navigate('MyProfile'), badge: needsProfile && <View style={styles.fabBadgeRed} />, unread: needsProfile },
              { icon: <MessagesIcon width={26} height={26} stroke="#fff" />, onPress: () => navigation.navigate('ChatsList'), badge: hasUnread && <View style={styles.fabBadgeBlue} />, unread: hasUnread },
              { icon: <SettingsIcon width={26} height={26} stroke="#fff" />, onPress: () => navigation.navigate('Settings'), badge: null, unread: false },
            ].map((btn, i) => {
              const btnLeft = fabGroupLeft + i * (fabSize + fabGap);
              return (
                <TouchableOpacity key={i} onPress={btn.onPress} activeOpacity={0.8} style={styles.fabShadow}>
                  <LinearGradient
                    colors={[colors.primaryBlue, colors.primaryRed]}
                    start={{ x: -btnLeft / fabSize, y: 0 }}
                    end={{ x: (screenWidth - btnLeft) / fabSize, y: 0 }}
                    style={[styles.fabButton, btn.unread && styles.fabButtonUnread]}
                  >
                    {btn.icon}
                    {btn.badge}
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })()}
      <DisclosureModal
        visible={showLocationDisclosure}
        icon="📍"
        title={t.disclosureLocationTitle}
        message={t.disclosureLocationMessage}
        acceptLabel={t.disclosureLocationAccept}
        cancelLabel={t.cancel}
        onAccept={() => {
          setShowLocationDisclosure(false);
          locationDisclosureResolve.current?.(true);
        }}
        onCancel={() => {
          setShowLocationDisclosure(false);
          locationDisclosureResolve.current?.(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    gap: 10,
  },
  fabShadow: {
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  fabButtonUnread: {
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  fabBadgeRed: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E63946',
    borderWidth: 2,
    borderColor: '#fff',
  },
  fabBadgeBlue: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4A90FF',
    borderWidth: 2,
    borderColor: '#fff',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.9,
    marginTop: 5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
  },
  enableLocationButton: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  enableLocationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  grid: {
    padding: 10,
  },
  card: {
    margin: 5,
    borderRadius: 14,
    overflow: 'hidden',
    aspectRatio: 0.75,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 30,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  cardDistance: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  onlineDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  testBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  testBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  messageBadge: {
    position: 'absolute',
    bottom: 52,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(67, 97, 238, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  messageBadgeCompact: {
    width: 18,
    height: 18,
    borderRadius: 9,
    bottom: 36,
    left: 5,
  },
});
