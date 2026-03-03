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
  Platform,
  Pressable,
} from 'react-native';
import GradientView from '../components/GradientView';
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
import ProfilePreviewModal from '../components/ProfilePreviewModal';
import RoketLogo from '../assets/roket-logo-3.svg';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const BANNER_AD_ID = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : (Platform.select({
      android: 'ca-app-pub-3274880494665608/1274892218',
      ios: 'ca-app-pub-3274880494665608/3956537086',
    }) as string);

const AD_FIRST: Record<number, number> = { 1: 3, 2: 3, 3: 6, 4: 6 };
const AD_REPEAT: Record<number, number> = { 1: 6, 2: 6, 3: 12, 4: 12 };

type GridRow = { type: 'users'; users: User[]; key: string } | { type: 'ad'; key: string };

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
  datingOnly?: boolean;
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
  const { colors, isDark, t, distanceMode, distanceUnit, gridColumns, setGridColumns, showTestBadges } = useTheme();
  const insets = useSafeAreaInsets();
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
  const showPickerRef = useRef(false);
  const hoveredColRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonTopPageYRef = useRef(0);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadFromUsers, setUnreadFromUsers] = useState<Set<string>>(new Set());
  const [needsProfile, setNeedsProfile] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [showLocationDisclosure, setShowLocationDisclosure] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [previewUser, setPreviewUser] = useState<User | null>(null);
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
        setRefreshing(false);
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
        setRefreshing(false);
        return;
      }
      if (permResult === 'denied') {
        firestore().collection('userLocations').doc(currentUser.uid).delete().catch(() => {});
        setUsers([]);
        setLocationDenied(true);
        setLoading(false);
        setRefreshing(false);
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
      setRefreshing(false);
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
      const matchTag: string | undefined = currentUserData?.matchTag;

      // Hent brugere filtreret efter matchTag (eller alle som fallback)
      const usersQuery = matchTag
        ? firestore().collection('users')
            .where('visibleTo', 'array-contains', matchTag)
        : firestore().collection('users');

      const [usersSnapshot, locationsSnapshot] = await Promise.all([
        usersQuery.get(),
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
        if (doc.id !== currentUser.uid && theirLoc && !isInactive && !blockedUsers.includes(doc.id) && !theirBlockedUsers.includes(currentUser.uid) && !data.banned && !(data.suspendedUntil?.toDate?.() > new Date())) {
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
            datingOnly: data.datingOnly ?? false,
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
  const isCompact = numColumns >= 3;
  const isSingle = numColumns === 1;

  const fallbackSource = isDark ? require('../assets/missing-profile-pic.png') : require('../assets/missing-profile-pic-light.png');

  const gridRows = React.useMemo((): GridRow[] => {
    const visible = users.slice(0, visibleCount);
    const rows: GridRow[] = [];
    const firstAd = AD_FIRST[numColumns] || 3;
    const repeatAd = AD_REPEAT[numColumns] || 6;
    let nextAdAt = firstAd;
    let rowCount = 0;
    let adCount = 0;
    for (let i = 0; i < visible.length; i += numColumns) {
      if (rowCount >= nextAdAt) {
        adCount++;
        rows.push({ type: 'ad', key: `__ad_${adCount}__` });
        nextAdAt = rowCount + repeatAd;
      }
      rows.push({ type: 'users', users: visible.slice(i, i + numColumns), key: `row-${i}` });
      rowCount++;
    }
    return rows;
  }, [users, visibleCount, numColumns]);

  const serializeUser = (item: User) => ({
    ...item,
    lastSeen: item.lastSeen?.getTime(),
    distanceMode: item.distanceMode,
    age: item.age,
    gender: item.gender,
    sexuality: item.sexuality,
    photos: item.photos,
    testAccount: item.testAccount,
    datingOnly: item.datingOnly,
  });

  const renderUserCard = (item: User) => {
    const allPhotos = [item.photoURL, ...(item.photos || [])].filter(Boolean) as string[];

    const navigateToProfile = () => navigation.navigate('ProfileView', { user: serializeUser(item) });

    return (
    <View
      key={item.id}
      style={[styles.card, { width: cardWidth, maxWidth: cardWidth, margin: cardMargin, backgroundColor: colors.background }, isSingle && { aspectRatio: 1.2 }]}
    >
      <CardCarousel
        photos={allPhotos}
        width={cardWidth}
        fallbackSource={fallbackSource}
        compact={isCompact}
        onPress={navigateToProfile}
        onLongPress={() => setPreviewUser(item)}
      />
      <GradientView
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.cardOverlay}
        pointerEvents="none"
      >
        <Text style={[styles.cardName, isCompact && { fontSize: 12 }]} numberOfLines={1}>{item.displayName || ''}{item.displayName && item.age ? `, ${item.age}` : item.age ? `${item.age}` : ''}</Text>
        <Text style={[styles.cardDistance, isCompact && { fontSize: 10 }]}>{formatDistance(item.distance, item.distanceMode)}</Text>
      </GradientView>
      {isOnline(item.lastSeen) && (
        <View style={[styles.onlineDot, { backgroundColor: colors.online, borderColor: '#fff' }, isCompact && { width: 8, height: 8, borderRadius: 4, top: 5, right: 5 }]} />
      )}
      {showTestBadges && item.testAccount && !isCompact && (
        <View style={styles.testBadge}>
          <Text style={styles.testBadgeText}>{t.testAccount}</Text>
        </View>
      )}
      {unreadFromUsers.has(item.id) && (
        <>
          <View style={[styles.unreadBorder, { borderColor: colors.primaryBlue }]} pointerEvents="none" />
          {!isCompact && (
            <View
              style={[styles.messageBadge, { backgroundColor: colors.primaryBlue }, isSingle && styles.messageBadgeSingle]}
              onStartShouldSetResponder={() => true}
              onResponderRelease={() => navigation.navigate('Chat', {
                otherUser: { id: item.id, displayName: item.displayName, testAccount: item.testAccount },
              })}
            >
              <MessagesIcon width={isSingle ? 28 : 22} height={isSingle ? 28 : 22} stroke="#fff" />
            </View>
          )}
        </>
      )}
    </View>
  );
  };

  const renderGridRow = ({ item }: { item: GridRow }) => {
    if (item.type === 'ad') {
      return (
        <View style={styles.adBannerInline}>
          <BannerAd
            unitId={BANNER_AD_ID}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          />
        </View>
      );
    }
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
        {item.users.map(user => renderUserCard(user))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        {!showLocationDisclosure && (
          <>
            <ActivityIndicator size="large" color={colors.primaryRed} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t.homeLoadingText}</Text>
          </>
        )}
        {showLocationDisclosure && (
          <View style={styles.disclosureOverlay}>
            <View style={[styles.disclosureCard, { backgroundColor: colors.white }]}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📍</Text>
              <Text style={[styles.disclosureTitle, { color: colors.textPrimary }]}>{t.disclosureLocationTitle}</Text>
              <Text style={[styles.disclosureMessage, { color: colors.textSecondary }]}>{t.disclosureLocationMessage}</Text>
              <View style={styles.disclosureButtons}>
                <Pressable
                  style={({ pressed }) => [styles.disclosureBtn, { borderWidth: 1.5, borderColor: colors.inputBorder, opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => {
                    setShowLocationDisclosure(false);
                    locationDisclosureResolve.current?.(false);
                  }}
                >
                  <Text style={[styles.disclosureBtnText, { color: colors.textSecondary }]}>{t.cancel}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.disclosureBtn, { backgroundColor: colors.primaryBlue, opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => {
                    setShowLocationDisclosure(false);
                    locationDisclosureResolve.current?.(true);
                  }}
                >
                  <Text style={[styles.disclosureBtnText, { color: '#fff' }]}>{t.disclosureLocationAccept}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientView
        colors={[colors.primaryBlue, colors.primaryRed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Text style={[styles.headerTitle, { color: colors.textWhite }]}>Røket</Text>
        <RoketLogo width={28} height={28} />
      </GradientView>

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
                onPress={() => { Linking.openSettings(); }}
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
          data={gridRows}
          renderItem={renderGridRow}
          keyExtractor={item => item.key}
          extraData={showTestBadges}
          contentContainerStyle={[styles.grid, { padding: gridPadding, paddingBottom: gridPadding + insets.bottom }]}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
      {showColumnPicker && (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { showPickerRef.current = false; setShowColumnPicker(false); }} />
      )}
      {(() => {
        const fabSize = 64;
        const fabGap = 10;
        const fabGroupLeft = screenWidth - 32 - (3 * fabSize + 2 * fabGap);
        const PICKER_ITEM_H = 48;
        // Distance from button top to first picker item (bottom-most):
        // 6px gap (bottom:62 - button:56) + 1.5px border + 10px paddingBottom = 17.5
        const PICKER_OFFSET = 17.5;

        const getHoveredCol = (pageY: number): number | null => {
          const distAbove = buttonTopPageYRef.current - pageY - PICKER_OFFSET;
          if (distAbove < 0 || distAbove >= 4 * PICKER_ITEM_H) return null;
          // Items bottom-to-top: 4, 3, 2, 1
          return 4 - Math.floor(distAbove / PICKER_ITEM_H);
        };

        const fabButtons = [
          { icon: <ProfileIcon width={30} height={30} stroke="#fff" />, onPress: () => navigation.navigate('MyProfile'), badge: needsProfile && <View style={styles.fabBadgeRed} /> },
          { icon: <MessagesIcon width={30} height={30} stroke="#fff" />, onPress: () => navigation.navigate('ChatsList'), badge: hasUnread && <View style={styles.fabBadgeBlue} /> },
          { icon: <SettingsIcon width={30} height={30} stroke="#fff" />, onPress: () => navigation.navigate('Settings'), badge: null },
        ];

        return (
          <View style={[styles.fab, { bottom: insets.bottom + 24 }]}>
            {fabButtons.map((btn, i) => {
              const btnLeft = fabGroupLeft + i * (fabSize + fabGap);

              if (i === 2) {
                return (
                  <View key={i}>
                    {showColumnPicker && (
                      <GradientView
                        colors={[colors.primaryBlue, colors.primaryRed]}
                        start={{ x: -btnLeft / fabSize, y: 0 }}
                        end={{ x: (screenWidth - btnLeft) / fabSize, y: 0 }}
                        style={styles.columnPicker}
                      >
                        {([1, 2, 3, 4] as const).map(col => {
                          const isHighlighted = hoveredColumn === col || (hoveredColumn === null && gridColumns === col);
                          return (
                            <TouchableOpacity
                              key={col}
                              activeOpacity={0.7}
                              onPress={() => { setGridColumns(col); showPickerRef.current = false; setShowColumnPicker(false); }}
                              style={styles.columnPickerItem}
                            >
                              <View style={styles.columnLines}>
                                {Array.from({ length: col }).map((_, j) => (
                                  <View key={j} style={[styles.columnLine, isHighlighted && styles.columnLineActive]} />
                                ))}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </GradientView>
                    )}
                    <View
                      onStartShouldSetResponder={() => true}
                      onMoveShouldSetResponder={() => true}
                      onResponderGrant={(e) => {
                        // Capture button top: pageY minus where on the button the finger landed
                        buttonTopPageYRef.current = e.nativeEvent.pageY - e.nativeEvent.locationY;
                        longPressTimerRef.current = setTimeout(() => {
                          showPickerRef.current = true;
                          setShowColumnPicker(true);
                        }, 300);
                      }}
                      onResponderMove={(e) => {
                        if (!showPickerRef.current) return;
                        const col = getHoveredCol(e.nativeEvent.pageY);
                        if (col !== hoveredColRef.current) {
                          hoveredColRef.current = col;
                          setHoveredColumn(col);
                        }
                      }}
                      onResponderRelease={() => {
                        if (longPressTimerRef.current) {
                          clearTimeout(longPressTimerRef.current);
                          longPressTimerRef.current = null;
                        }
                        if (showPickerRef.current && hoveredColRef.current) {
                          setGridColumns(hoveredColRef.current as any);
                          showPickerRef.current = false;
                          setShowColumnPicker(false);
                        } else if (!showPickerRef.current) {
                          navigation.navigate('Settings');
                        }
                        hoveredColRef.current = null;
                        setHoveredColumn(null);
                      }}
                      onResponderTerminate={() => {
                        if (longPressTimerRef.current) {
                          clearTimeout(longPressTimerRef.current);
                          longPressTimerRef.current = null;
                        }
                        showPickerRef.current = false;
                        setShowColumnPicker(false);
                        hoveredColRef.current = null;
                        setHoveredColumn(null);
                      }}
                      style={styles.fabShadow}
                    >
                      <GradientView
                        colors={[colors.primaryBlue, colors.primaryRed]}
                        start={{ x: -btnLeft / fabSize, y: 0 }}
                        end={{ x: (screenWidth - btnLeft) / fabSize, y: 0 }}
                        style={styles.fabButton}
                      >
                        {btn.icon}
                      </GradientView>
                    </View>
                  </View>
                );
              }

              return (
                <View key={i}>
                  <TouchableOpacity onPress={btn.onPress} activeOpacity={0.8} style={styles.fabShadow}>
                    <GradientView
                      colors={[colors.primaryBlue, colors.primaryRed]}
                      start={{ x: -btnLeft / fabSize, y: 0 }}
                      end={{ x: (screenWidth - btnLeft) / fabSize, y: 0 }}
                      style={styles.fabButton}
                    >
                      {btn.icon}
                    </GradientView>
                    {btn.badge}
                  </TouchableOpacity>
                </View>
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
      <ProfilePreviewModal
        visible={!!previewUser}
        user={previewUser}
        onClose={() => setPreviewUser(null)}
        onViewProfile={() => {
          if (!previewUser) return;
          const u = serializeUser(previewUser);
          setPreviewUser(null);
          navigation.navigate('ProfileView', { user: u });
        }}
        onSendMessage={() => {
          if (!previewUser) return;
          const { id, displayName, testAccount } = previewUser;
          setPreviewUser(null);
          navigation.navigate('Chat', { otherUser: { id, displayName, testAccount } });
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
    right: 32,
    flexDirection: 'row',
    gap: 10,
  },
  fabShadow: {
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  fabBadgeRed: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E63946',
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  fabBadgeBlue: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4A90FF',
    shadowColor: '#4A90FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
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
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
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
  unreadBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderRadius: 14,
    zIndex: 5,
  },
  messageBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  messageBadgeSingle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    bottom: 10,
    right: 10,
  },
  messageBadgeCompact: {
    width: 22,
    height: 22,
    borderRadius: 11,
    bottom: 5,
    right: 5,
  },
  columnPicker: {
    position: 'absolute',
    bottom: 70,
    left: 0,
    width: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingTop: 4,
    paddingBottom: 10,
  },
  columnPickerItem: {
    height: 48,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  columnLines: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnLine: {
    width: 2.5,
    height: 18,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  columnLineActive: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  adBannerInline: {
    alignItems: 'center',
    marginVertical: 4,
  },
  disclosureOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    zIndex: 100,
  },
  disclosureCard: {
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  disclosureTitle: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  disclosureMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  disclosureButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  disclosureBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  disclosureBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
