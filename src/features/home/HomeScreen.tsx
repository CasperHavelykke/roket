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
  Animated,
} from 'react-native';
import GradientView from '../../components/GradientView';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import LocationService from '../../services/LocationService';
import { useTheme } from '../../theme';
import DisclosureModal from '../../components/DisclosureModal';
import { MapPin as PinMapIcon, Settings as SettingsIcon, User as ProfileIcon, MessagesSquare as MessagesIcon, Plus as PlusIcon, Calendar as CalendarIcon, Mail as MailIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaskedView from '@react-native-masked-view/masked-view';
import CardCarousel from './CardCarousel';
import ProfilePreviewModal from './ProfilePreviewModal';
import RoketLogo from '../../assets/roket-logo-3.svg';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { STATUS_TAGS, StatusTagId, getStatusTag } from '../../statusTags';
import CreateEventModal from '../events/CreateEventModal';
import EventCard from '../events/EventCard';
import EventDetailModal from '../events/EventDetailModal';
import { EventDoc } from '../../events';
import TagIcon from '../../components/TagIcon';

const BANNER_AD_ID = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : (Platform.select({
      android: 'ca-app-pub-3274880494665608/1274892218',
      ios: 'ca-app-pub-3274880494665608/3956537086',
    }) as string);

const AD_FIRST: Record<number, number> = { 1: 3, 2: 3, 3: 6, 4: 6 };
const AD_REPEAT: Record<number, number> = { 1: 6, 2: 6, 3: 12, 4: 12 };

type GridCell = { kind: 'user'; user: User } | { kind: 'event'; event: EventDoc };
type GridRow =
  | { type: 'users'; users: User[]; key: string }
  | { type: 'ad'; key: string }
  | { type: 'events'; events: EventDoc[]; key: string }
  | { type: 'mixed'; cells: GridCell[]; key: string };

interface User {
  id: string;
  displayName: string;
  bio: string;
  status?: string;
  statusTag?: StatusTagId | null;
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
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [activeFilter, setActiveFilter] = useState<StatusTagId | null>(null);
  const [eventsFilterActive, setEventsFilterActive] = useState(false);
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [previewEvent, setPreviewEvent] = useState<EventDoc | null>(null);
  const [userLocationCoords, setUserLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showLocationDisclosure, setShowLocationDisclosure] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [previewUser, setPreviewUser] = useState<User | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const numColumns = (gridColumns >= 1 && gridColumns <= 4) ? gridColumns : 2;
  const locationDisclosureResolve = useRef<((v: boolean) => void) | null>(null);

  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!needsProfile) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.delay(200),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [needsProfile]);

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
        let total = 0;
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (!data.lastMessage || data.lastMessageSenderId === currentUser.uid) return;
          const count = data.unreadCount?.[currentUser.uid] ?? 0;
          if (count > 0) {
            const otherUserId = data.participants.find((id: string) => id !== currentUser.uid);
            if (otherUserId) unreadUserIds.add(otherUserId);
            total += count;
          } else {
            // Fallback: tjek lastRead for chats uden unreadCount (eksisterende chats)
            const lastRead = data.lastRead?.[currentUser.uid];
            const isUnread = !lastRead || (data.lastMessageTime && lastRead.toMillis() < data.lastMessageTime.toMillis());
            if (isUnread) {
              const otherUserId = data.participants.find((id: string) => id !== currentUser.uid);
              if (otherUserId) unreadUserIds.add(otherUserId);
              total += 1;
            }
          }
        });
        setHasUnread(unreadUserIds.size > 0);
        setUnreadFromUsers(unreadUserIds);
        setTotalUnreadCount(total);
      });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    updateLocationAndLoad();
  }, []);

  // Lyt på events i nærheden
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('events')
      .where('expiresAt', '>', firestore.Timestamp.now())
      .onSnapshot(snap => {
        const list: EventDoc[] = [];
        snap.docs.forEach(doc => {
          const data = doc.data();
          list.push({
            id: doc.id,
            creatorId: data.creatorId,
            title: data.title,
            description: data.description ?? '',
            meetingPlace: data.meetingPlace ?? '',
            location: {
              latitude: data.location?.latitude ?? 0,
              longitude: data.location?.longitude ?? 0,
            },
            time: data.time?.toDate?.() ?? new Date(),
            maxParticipants: data.maxParticipants ?? null,
            participantIds: data.participantIds ?? [],
            tag: data.tag ?? null,
            chatId: data.chatId,
            createdAt: data.createdAt?.toDate?.() ?? new Date(),
            expiresAt: data.expiresAt?.toDate?.() ?? new Date(),
          });
        });
        setEvents(list);
      }, err => console.warn('Events subscription error:', err));

    return () => unsubscribe();
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

    // Vent på at notification disclosure er færdig (undgå to modaler samtidigt)
    const notifShown = await AsyncStorage.getItem('@roket_notif_disclosure_shown');
    if (!notifShown) {
      await new Promise<void>(resolve => {
        const check = setInterval(async () => {
          const shown = await AsyncStorage.getItem('@roket_notif_disclosure_shown');
          if (shown) { clearInterval(check); resolve(); }
        }, 300);
        // Timeout efter 15 sek hvis notification flow aldrig fuldfører
        setTimeout(() => { clearInterval(check); resolve(); }, 15000);
      });
    }

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
      setUserLocationCoords({ latitude: position.latitude, longitude: position.longitude });
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

      // Fetch ALL users — matchTag filtering removed for social discovery pivot
      const [usersSnapshot, locationsSnapshot] = await Promise.all([
        firestore().collection('users').get(),
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
            status: data.status || '',
            statusTag: data.statusTag ?? null,
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

  const fallbackSource = isDark ? require('../../assets/missing-profile-pic.png') : require('../../assets/missing-profile-pic-light.png');

  const filteredUsers = React.useMemo(() => {
    if (!activeFilter) return users;
    return users.filter(u => u.statusTag === activeFilter);
  }, [users, activeFilter]);

  const gridRows = React.useMemo((): GridRow[] => {
    const rows: GridRow[] = [];

    if (eventsFilterActive) {
      const eventsByDistance = userLocationCoords
        ? [...events].map(ev => ({
            ev,
            distance: calculateDistance(
              userLocationCoords.latitude,
              userLocationCoords.longitude,
              ev.location.latitude,
              ev.location.longitude,
            ),
          })).sort((a, b) => a.distance - b.distance).map(x => x.ev)
        : events;
      for (let i = 0; i < eventsByDistance.length; i += numColumns) {
        rows.push({ type: 'events', events: eventsByDistance.slice(i, i + numColumns), key: `events-${i}` });
      }
      return rows;
    }

    // Beregn distance for events og merge dem med users sorteret efter distance
    const tagFilteredEvents = activeFilter ? events.filter(ev => ev.tag === activeFilter) : events;
    const eventsWithDistance = userLocationCoords
      ? tagFilteredEvents.map(ev => ({
          ...ev,
          distance: calculateDistance(
            userLocationCoords.latitude,
            userLocationCoords.longitude,
            ev.location.latitude,
            ev.location.longitude
          ),
        }))
      : tagFilteredEvents.map(ev => ({ ...ev, distance: 999999 }));

    type SortedCell = GridCell & { distance: number };
    const cells: SortedCell[] = [
      ...filteredUsers.slice(0, visibleCount).map(u => ({ kind: 'user' as const, user: u, distance: u.distance ?? 999999 })),
      ...eventsWithDistance.map(e => ({ kind: 'event' as const, event: e, distance: e.distance ?? 999999 })),
    ];
    cells.sort((a, b) => a.distance - b.distance);

    const firstAd = AD_FIRST[numColumns] || 3;
    const repeatAd = AD_REPEAT[numColumns] || 6;
    let nextAdAt = firstAd;
    let rowCount = 0;
    let adCount = 0;

    for (let i = 0; i < cells.length; i += numColumns) {
      if (rowCount >= nextAdAt) {
        adCount++;
        rows.push({ type: 'ad', key: `__ad_${adCount}__` });
        nextAdAt = rowCount + repeatAd;
      }
      const rowCells = cells.slice(i, i + numColumns).map(c => c.kind === 'user'
        ? ({ kind: 'user', user: c.user } as GridCell)
        : ({ kind: 'event', event: c.event } as GridCell));
      rows.push({ type: 'mixed', cells: rowCells, key: `row-${i}` });
      rowCount++;
    }
    return rows;
  }, [filteredUsers, visibleCount, numColumns, eventsFilterActive, events, userLocationCoords, activeFilter]);

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
    status: item.status,
  });

  const renderUserCard = (item: User) => {
    const allPhotos = item.photoURL ? [item.photoURL, ...(item.photos || [])] : [];

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
        isSingle={isSingle}
        onPress={navigateToProfile}
        onLongPress={() => setPreviewUser(item)}
      />
      {(item.status || unreadFromUsers.has(item.id)) && (
        <View style={[styles.cardOverlay, !item.status && { backgroundColor: 'transparent' }, unreadFromUsers.has(item.id) && { backgroundColor: 'rgba(67,97,238,0.5)' }]} pointerEvents="none">
          {item.status ? (
            <>
              <Text style={[styles.cardName, isCompact && { fontSize: 12 }, isSingle && { fontSize: 22, lineHeight: 28 }]} numberOfLines={3}>{item.status}</Text>
              {isSingle && item.bio ? (
                <Text style={styles.cardBio}>{item.bio}</Text>
              ) : null}
            </>
          ) : null}
        </View>
      )}
      {item.statusTag && (
        <View style={[styles.tagBadge, isCompact && styles.tagBadgeCompact]} pointerEvents="none">
          <TagIcon tag={item.statusTag} size={isCompact ? 14 : 18} color="#fff" />
        </View>
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
              style={[styles.messageBadge, { backgroundColor: '#fff' }, isSingle && styles.messageBadgeSingle]}
              onStartShouldSetResponder={() => true}
              onResponderRelease={() => navigation.navigate('Chat', {
                otherUser: { id: item.id, displayName: item.displayName, testAccount: item.testAccount },
              })}
            >
              <MailIcon size={isSingle ? 28 : 22} color={colors.primaryBlue} />
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
    // Beregn absolut X-position for gradient der spænder fra skærmkant til skærmkant.
    // Baseret på faktisk antal celler i rækken — flex-containeren centrerer dem.
    const cellOuterWidth = cardWidth + 2 * cardMargin;
    const cardLeftAt = (colIdx: number, rowCellCount: number) => {
      const rowWidth = rowCellCount * cellOuterWidth;
      const rowLeft = (screenWidth - rowWidth) / 2;
      return rowLeft + colIdx * cellOuterWidth + cardMargin;
    };

    const renderEventCard = (ev: EventDoc, colIdx: number, rowCellCount: number) => (
      <View key={`e-${ev.id}`} style={[styles.card, { width: cardWidth, maxWidth: cardWidth, margin: cardMargin }, isSingle && { aspectRatio: 1.2 }]}>
        <EventCard
          event={ev}
          width={cardWidth}
          compact={isCompact}
          tiny={numColumns === 4}
          isSingle={isSingle}
          cardLeft={cardLeftAt(colIdx, rowCellCount)}
          screenWidth={screenWidth}
          onPress={() => setPreviewEvent(ev)}
        />
      </View>
    );

    if (item.type === 'mixed') {
      const cellCount = item.cells.length;
      return (
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          {item.cells.map((cell, i) => {
            if (cell.kind === 'user') {
              return <React.Fragment key={`u-${cell.user.id}`}>{renderUserCard(cell.user)}</React.Fragment>;
            }
            return renderEventCard(cell.event, i, cellCount);
          })}
        </View>
      );
    }
    if (item.type === 'events') {
      const cellCount = item.events.length;
      return (
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          {item.events.map((ev, i) => renderEventCard(ev, i, cellCount))}
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
        <ActivityIndicator size="large" color={colors.primaryRed} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t.homeLoadingText}</Text>
        <DisclosureModal
          visible={showLocationDisclosure}
          icon={<PinMapIcon size={48} />}
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryRed} />
          }
        >
          {locationDenied ? (
            <>
              <Text style={[styles.emptyText, { color: colors.textSecondary, paddingHorizontal: 40, fontWeight: '400' }]}>{t.homeLocationDenied}</Text>
              <TouchableOpacity
                style={[styles.enableLocationButton, { backgroundColor: colors.primaryBlue }]}
                onPress={() => { Linking.openSettings(); }}
                activeOpacity={0.7}
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryRed} />
          }
          ListHeaderComponent={
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterBarContent}
              style={[styles.filterBar, { backgroundColor: colors.background, marginHorizontal: -gridPadding }]}
            >
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.card },
                  activeFilter === null && !eventsFilterActive && { backgroundColor: colors.primaryBlue },
                ]}
                onPress={() => { setActiveFilter(null); setEventsFilterActive(false); }}
              >
                <Text style={[styles.filterChipText, { color: colors.textPrimary }, activeFilter === null && !eventsFilterActive && { color: '#fff' }]}>
                  {t.tagAll}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.card },
                  eventsFilterActive && { backgroundColor: colors.primaryBlue },
                ]}
                onPress={() => { setEventsFilterActive(!eventsFilterActive); setActiveFilter(null); }}
              >
                <CalendarIcon size={14} color={eventsFilterActive ? '#fff' : colors.textPrimary} />
                <Text style={[styles.filterChipText, { color: colors.textPrimary }, eventsFilterActive && { color: '#fff' }]}>
                  {t.tagEvents}
                </Text>
              </TouchableOpacity>
              {STATUS_TAGS.map(tag => {
                const isActive = activeFilter === tag.id;
                const labelKey = `tag${tag.id.charAt(0).toUpperCase() + tag.id.slice(1)}` as keyof typeof t;
                return (
                  <TouchableOpacity
                    key={tag.id}
                    style={[
                      styles.filterChip,
                      { backgroundColor: colors.card },
                      isActive && { backgroundColor: colors.primaryBlue },
                    ]}
                    onPress={() => setActiveFilter(isActive ? null : tag.id)}
                  >
                    <TagIcon tag={tag.id} size={14} color={isActive ? '#fff' : colors.textPrimary} />
                    <Text style={[styles.filterChipText, { color: colors.textPrimary }, isActive && { color: '#fff' }]}>
                      {String(t[labelKey] ?? tag.id)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
          { icon: <ProfileIcon size={30} color="#fff" />, onPress: () => navigation.navigate('MyProfile'), badge: needsProfile && <Animated.View style={[styles.fabPulseRing, { opacity: pulseAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.8, 0] }), transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.4] }) }] }]} /> },
          { icon: <MessagesIcon size={30} color="#fff" />, onPress: () => navigation.navigate('ChatsList'), badge: hasUnread ? (btnLeft: number) => (
            <GradientView
              colors={[colors.primaryBlue, colors.primaryRed]}
              start={{ x: -btnLeft / 20, y: 0 }}
              end={{ x: (screenWidth - btnLeft) / 20, y: 0 }}
              style={styles.fabUnreadBadge}
            >
              <Text style={styles.fabUnreadBadgeText}>{totalUnreadCount > 9 ? '9+' : totalUnreadCount}</Text>
            </GradientView>
          ) : null, inverted: hasUnread },
          { icon: <SettingsIcon size={30} color="#fff" />, onPress: () => navigation.navigate('Settings'), badge: null },
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
                    {btn.inverted ? (
                      <View style={[styles.fabButton, { backgroundColor: '#fff' }]}>
                        <MaskedView
                          style={{ width: 30, height: 30 }}
                          maskElement={<MessagesIcon size={30} color="#000" />}
                        >
                          <GradientView
                            colors={[colors.primaryBlue, colors.primaryRed]}
                            start={{ x: -btnLeft / fabSize, y: 0 }}
                            end={{ x: (screenWidth - btnLeft) / fabSize, y: 0 }}
                            style={{ flex: 1 }}
                          />
                        </MaskedView>
                      </View>
                    ) : (
                      <GradientView
                        colors={[colors.primaryBlue, colors.primaryRed]}
                        start={{ x: -btnLeft / fabSize, y: 0 }}
                        end={{ x: (screenWidth - btnLeft) / fabSize, y: 0 }}
                        style={styles.fabButton}
                      >
                        {btn.icon}
                      </GradientView>
                    )}
                    {typeof btn.badge === 'function' ? btn.badge(btnLeft) : btn.badge}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        );
      })()}
      <DisclosureModal
        visible={showLocationDisclosure}
        icon={<PinMapIcon size={48} />}
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
      <CreateEventModal
        visible={showCreateEvent}
        onClose={() => setShowCreateEvent(false)}
        userLocation={userLocationCoords}
      />
      <EventDetailModal
        visible={!!previewEvent}
        event={previewEvent}
        onClose={() => setPreviewEvent(null)}
        onOpenChat={(chatId, eventTitle) => {
          setPreviewEvent(null);
          navigation.navigate('Chat', { otherUser: { id: chatId, displayName: eventTitle, testAccount: false }, eventChatId: chatId, eventTitle });
        }}
      />
      {eventsFilterActive && (() => {
        const createFabSize = 64;
        const createBtnLeft = screenWidth - 32 - createFabSize;
        return (
          <TouchableOpacity
            style={[styles.fabShadow, styles.createEventFab, { bottom: insets.bottom + (showColumnPicker ? 314 : 100) }]}
            activeOpacity={0.8}
            onPress={() => setShowCreateEvent(true)}
          >
            <GradientView
              colors={[colors.primaryBlue, colors.primaryRed]}
              start={{ x: -createBtnLeft / createFabSize, y: 0 }}
              end={{ x: (screenWidth - createBtnLeft) / createFabSize, y: 0 }}
              style={styles.fabButton}
            >
              <PlusIcon size={30} color="#fff" />
            </GradientView>
          </TouchableOpacity>
        );
      })()}
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
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabButton: {
    width: 61,
    height: 61,
    borderRadius: 31,
    ...Platform.select({ android: { overflow: 'hidden' as const } }),
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabPulseRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 35,
    borderWidth: 2.5,
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
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 22,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  cardBio: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
  tagBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagBadgeCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
    top: 6,
    right: 6,
  },
  tagBadgeText: {
    fontSize: 16,
  },
  filterBar: {
  },
  filterBarContent: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    minHeight: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  filterChipEmoji: {
    fontSize: 14,
    marginRight: 5,
    lineHeight: 18,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    includeFontPadding: false,
    marginLeft: 5,
  },
  createEventFab: {
    position: 'absolute',
    right: 32,
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
    ...Platform.select({ android: { overflow: 'hidden' as const } }),
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
  fabUnreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  fabUnreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
});
