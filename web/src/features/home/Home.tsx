import { useState, useEffect, useCallback } from 'react';
import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc,
  serverTimestamp, GeoPoint, query, where, onSnapshot, type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Link, useNavigate } from 'react-router-dom';
import translations, { Language } from '@shared/translations';
import Fab from '../../components/Fab';
import { ProfileIcon, MessagesIcon, SettingsIcon } from '../../components/icons';
import MessagesSvg from '@shared/assets/messages.svg?react';
import { placeholderPic } from '../../utils/theme';
import CardCarousel from './CardCarousel';
import ProfilePreviewModal from './ProfilePreviewModal';
import './Home.css';

const INACTIVE_HOURS = 24;

interface UserProfile {
  id: string;
  displayName: string;
  photoURL?: string;
  photos?: string[];
  bio?: string;
  status?: string;
  age?: number;
  distance?: number;
  distanceMode?: string;
  lastSeen?: Date;
  datingOnly?: boolean;
  gender?: string;
  sexuality?: string;
}

function getLang(): Language {
  return (localStorage.getItem('roket-language') as Language) || 'da';
}

function getDistanceUnit(): 'km' | 'mi' {
  return (localStorage.getItem('roket-distanceUnit') as 'km' | 'mi') || 'km';
}

function getDistanceMode(): string {
  return localStorage.getItem('roket-distanceMode') || 'exact';
}

function getAge(birthday: { day: number; month: number; year: number }): number {
  const today = new Date();
  const birth = new Date(birthday.year, birthday.month - 1, birthday.day);
  let a = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
  return a;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distance: number | undefined, otherDistanceMode: string | undefined, t: any): string {
  if (distance == null) return '';
  const myMode = getDistanceMode();
  const unit = getDistanceUnit();
  if (myMode === 'hidden' || otherDistanceMode === 'hidden') return '';
  if (unit === 'mi') {
    const miles = distance * 0.621371;
    if ((myMode === 'fuzzy' || otherDistanceMode === 'fuzzy') && distance < 0.03) return t.distanceUnder100ft;
    if (miles < 1) return t.distanceFeet(Math.round(miles * 5280));
    return t.distanceMiles(miles.toFixed(1));
  }
  if ((myMode === 'fuzzy' || otherDistanceMode === 'fuzzy') && distance < 0.03) return t.distanceUnder30;
  if (distance < 1) return t.distanceMeters(Math.round(distance * 1000));
  return t.distanceKm(distance.toFixed(1).replace('.', ','));
}

function getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    // Fallback timeout in case geolocation hangs
    const fallback = setTimeout(() => resolve(null), 10000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(fallback); resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); },
      () => { clearTimeout(fallback); resolve(null); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

type GridColumns = 1 | 2 | 3 | 4;

function getGridColumns(): GridColumns {
  const v = parseInt(localStorage.getItem('roket-gridColumns') || '2', 10);
  return (v >= 1 && v <= 4 ? v : 2) as GridColumns;
}

// Module-level cache so user list survives navigation
const cache: {
  users: UserProfile[];
  timestamp: number;
} = { users: [], timestamp: 0 };
const CACHE_MAX_AGE = 60_000; // 1 minute

export default function Home() {
  const hasFreshCache = cache.users.length > 0 && (Date.now() - cache.timestamp < CACHE_MAX_AGE);
  const [users, setUsers] = useState<UserProfile[]>(hasFreshCache ? cache.users : []);
  const [loading, setLoading] = useState(!hasFreshCache);
  const [locationDenied, setLocationDenied] = useState(false);
  const [gridColumns, setGridColumnsState] = useState<GridColumns>(getGridColumns);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [unreadFromUsers, setUnreadFromUsers] = useState<Set<string>>(new Set());
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [previewUser, setPreviewUser] = useState<UserProfile | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [showLocationHow, setShowLocationHow] = useState(false);
  const navigate = useNavigate();
  const t = translations[getLang()];

  const setGridColumns = (cols: GridColumns) => {
    setGridColumnsState(cols);
    localStorage.setItem('roket-gridColumns', String(cols));
    // Sync to Firestore
    const uid = auth.currentUser?.uid;
    if (uid) setDoc(doc(db, 'users', uid), { settings: { gridColumns: String(cols) } }, { merge: true }).catch(() => {});
  };

  const updateLocationAndLoad = useCallback(async (force = false) => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }

    const position = await getCurrentPosition();
    if (position) {
      setLocationDenied(false);
      // Always update location + lastSeen
      Promise.all([
        setDoc(doc(db, 'userLocations', uid), {
          location: new GeoPoint(position.latitude, position.longitude),
          updatedAt: serverTimestamp(),
        }),
        setDoc(doc(db, 'users', uid), { lastSeen: serverTimestamp() }, { merge: true }),
      ]).catch(() => {});

      // Skip heavy user reload if cache is fresh
      if (!force && cache.users.length > 0 && (Date.now() - cache.timestamp < CACHE_MAX_AGE)) {
        setLoading(false);
        return;
      }

      await loadUsers(position);
    } else {
      deleteDoc(doc(db, 'userLocations', uid)).catch(() => {});
      setUsers([]);
      setLocationDenied(true);
      setLoading(false);
    }
  }, []);

  const loadUsers = async (myLocation: { latitude: number; longitude: number }) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      const currentUserDoc = await getDoc(doc(db, 'users', uid));
      const currentUserData = currentUserDoc.data();

      // Fetch ALL users — matchTag filtering removed for social discovery pivot
      const [usersSnapshot, locationsSnapshot] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'userLocations')),
      ]);

      const blockedUsers: string[] = currentUserData?.blockedUsers ?? [];

      const locationMap = new Map<string, { latitude: number; longitude: number }>();
      locationsSnapshot.forEach((d) => {
        const loc = d.data().location;
        if (loc) locationMap.set(d.id, { latitude: loc.latitude, longitude: loc.longitude });
      });

      const list: UserProfile[] = [];
      usersSnapshot.forEach((d) => {
        const data = d.data();
        const theirBlocked: string[] = data.blockedUsers ?? [];
        const theirLoc = locationMap.get(d.id);
        const lastSeenDate = data.lastSeen?.toDate?.();
        const isInactive = !lastSeenDate || (Date.now() - lastSeenDate.getTime() > INACTIVE_HOURS * 3600000);

        if (
          d.id !== uid &&
          theirLoc &&
          !isInactive &&
          !blockedUsers.includes(d.id) &&
          !theirBlocked.includes(uid) &&
          !data.banned &&
          !(data.suspendedUntil?.toDate?.() > new Date())
        ) {
          const distance = calculateDistance(
            myLocation.latitude, myLocation.longitude,
            theirLoc.latitude, theirLoc.longitude,
          );
          list.push({
            id: d.id,
            displayName: data.displayName,
            photoURL: data.photoURL,
            photos: data.photos ?? [],
            bio: data.bio || '',
            status: data.status || '',
            distance,
            distanceMode: data.distanceMode ?? 'exact',
            lastSeen: lastSeenDate,
            age: data.birthday && data.showAge !== false ? getAge(data.birthday) : undefined,
            datingOnly: data.datingOnly ?? false,
            gender: data.gender && data.showGender !== false ? data.gender : undefined,
            sexuality: data.sexuality && data.showSexuality !== false ? data.sexuality : undefined,
          });
        }
      });

      list.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
      cache.users = list;
      cache.timestamp = Date.now();
      setUsers(list);
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    updateLocationAndLoad();
  }, [updateLocationAndLoad]);

  // Check if user needs profile photo
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub: Unsubscribe = onSnapshot(doc(db, 'users', uid), (snap) => {
      const data = snap.data();
      setNeedsProfile(!data?.photoURL);
    });
    return () => unsub();
  }, []);

  // Listen for unread messages
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const q = query(collection(db, 'chats'), where('participants', 'array-contains', uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const unreadUserIds = new Set<string>();
      let total = 0;
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (!data.lastMessage || data.lastMessageSenderId === uid) return;
        const count = data.unreadCount?.[uid] ?? 0;
        if (count > 0) {
          const otherUserId = data.participants.find((id: string) => id !== uid);
          if (otherUserId) unreadUserIds.add(otherUserId);
          total += count;
        } else {
          const lastRead = data.lastRead?.[uid];
          const isUnread = !lastRead || (data.lastMessageTime && lastRead.toMillis() < data.lastMessageTime.toMillis());
          if (isUnread) {
            const otherUserId = data.participants.find((id: string) => id !== uid);
            if (otherUserId) unreadUserIds.add(otherUserId);
            total += 1;
          }
        }
      });
      setUnreadFromUsers(unreadUserIds);
      setTotalUnreadCount(total);
    });
    return () => unsub();
  }, []);

  // Re-fetch location when app comes back to foreground
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateLocationAndLoad(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [updateLocationAndLoad]);

  if (loading) return <div className="loading">{'Indlæser...'}</div>;

  return (
    <div className="page home-page">
      <nav className="navbar">
        <h1>Røket</h1>
        <img src="/logo-header.svg" alt="" className="navbar-logo" />
      </nav>

      {locationDenied ? (
        <div className="location-denied">
          <p className="location-denied-text">{t.homeLocationDenied}</p>
          <button className="location-denied-btn" onClick={() => window.location.reload()}>
            {t.homeEnableLocation}
          </button>
          <p className="location-denied-hint">{t.homeLocationHint}</p>
          <button className="location-denied-how" onClick={() => setShowLocationHow(!showLocationHow)}>
            {t.homeLocationHow}
          </button>
          {showLocationHow && (
            <div className="location-how-box">
              <p>{t.homeLocationHowAndroid}</p>
              <p>{t.homeLocationHowIOS}</p>
            </div>
          )}
        </div>
      ) : users.length === 0 ? (
        <div className="empty">{t.homeEmpty}</div>
      ) : (
        <div className="user-grid" data-cols={gridColumns} style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}>
          {users.map((user) => {
            const allPhotos = [user.photoURL, ...(user.photos || [])].filter(Boolean) as string[];
            return (
              <div key={user.id} className={'user-card' + (unreadFromUsers.has(user.id) ? ' has-unread' : '')}>
                <CardCarousel
                  photos={allPhotos}
                  fallbackSrc={placeholderPic()}
                  compact={gridColumns >= 3}
                  onClick={() => navigate(`/profile/${user.id}`)}
                  onLongPress={() => setPreviewUser(user)}
                />
                {(user.status || unreadFromUsers.has(user.id)) && (
                  <div className={'user-card-overlay' + (unreadFromUsers.has(user.id) ? ' unread' : '')}>
                    {user.status && <span className="user-status">{user.status}</span>}
                    {user.status && user.bio && gridColumns === 1 && <span className="user-bio">{user.bio}</span>}
                  </div>
                )}
                {unreadFromUsers.has(user.id) && gridColumns <= 2 && (
                  <div className="unread-badge" onClick={(e) => { e.stopPropagation(); const uid = auth.currentUser?.uid; if (!uid) return; const chatId = [uid, user.id].sort().join('_'); navigate(`/chat/${chatId}`, { state: { otherUserName: user.displayName, otherUserId: user.id } }); }}>
                    <MessagesSvg width={gridColumns === 1 ? 24 : 18} height={gridColumns === 1 ? 24 : 18} stroke="#fff" style={{ display: 'block' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showColumnPicker && (
        <div className="column-picker-backdrop" onClick={() => setShowColumnPicker(false)} />
      )}

      <ProfilePreviewModal
        visible={!!previewUser}
        user={previewUser}
        onClose={() => setPreviewUser(null)}
      />

      <Fab
        items={[
          { to: '/profile/me', icon: ProfileIcon, pulse: needsProfile },
          { to: '/chats', icon: MessagesIcon, badge: totalUnreadCount, unread: totalUnreadCount > 0 },
          { to: '/settings', icon: SettingsIcon, onLongPress: () => setShowColumnPicker(true) },
        ]}
        overlay={showColumnPicker ? (gradStyle: React.CSSProperties) => (
          <div className="column-picker" style={gradStyle}>
            {([1, 2, 3, 4] as const).map(col => (
              <button
                key={col}
                className={'column-picker-item' + (gridColumns === col ? ' active' : '')}
                onClick={() => { setGridColumns(col); setShowColumnPicker(false); }}
              >
                <div className="column-lines">
                  {Array.from({ length: col }).map((_, j) => (
                    <div key={j} className={'column-line' + (gridColumns === col ? ' active' : '')} />
                  ))}
                </div>
              </button>
            ))}
          </div>
        ) : undefined as any}
      />
    </div>
  );
}
