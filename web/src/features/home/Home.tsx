import { useState, useEffect, useCallback } from 'react';
import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc,
  serverTimestamp, GeoPoint, query, where,
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Link } from 'react-router-dom';
import translations, { Language } from '@shared/translations';
import Fab from '../../components/Fab';
import { ProfileIcon, MessagesIcon, SettingsIcon } from '../../components/icons';
import { placeholderPic } from '../../utils/theme';
import './Home.css';

const INACTIVE_HOURS = 72;

interface UserProfile {
  id: string;
  displayName: string;
  photoURL?: string;
  photos?: string[];
  bio?: string;
  age?: number;
  distance?: number;
  distanceMode?: string;
  lastSeen?: Date;
  datingOnly?: boolean;
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
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  });
}

type GridColumns = 1 | 2 | 3 | 4;

function getGridColumns(): GridColumns {
  const v = parseInt(localStorage.getItem('roket-gridColumns') || '2', 10);
  return (v >= 1 && v <= 4 ? v : 2) as GridColumns;
}

export default function Home() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);
  const [gridColumns, setGridColumnsState] = useState<GridColumns>(getGridColumns);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const t = translations[getLang()];

  const setGridColumns = (cols: GridColumns) => {
    setGridColumnsState(cols);
    localStorage.setItem('roket-gridColumns', String(cols));
    // Sync to Firestore
    const uid = auth.currentUser?.uid;
    if (uid) setDoc(doc(db, 'users', uid), { settings: { gridColumns: String(cols) } }, { merge: true }).catch(() => {});
  };

  const updateLocationAndLoad = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const position = await getCurrentPosition();
    if (position) {
      setLocationDenied(false);
      await Promise.all([
        setDoc(doc(db, 'userLocations', uid), {
          location: new GeoPoint(position.latitude, position.longitude),
          updatedAt: serverTimestamp(),
        }),
        setDoc(doc(db, 'users', uid), { lastSeen: serverTimestamp() }, { merge: true }),
      ]).catch(() => {});

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
      const [currentUserDoc, usersSnapshot, locationsSnapshot] = await Promise.all([
        getDoc(doc(db, 'users', uid)),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'userLocations')),
      ]);

      const currentUserData = currentUserDoc.data();
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
            distance,
            distanceMode: data.distanceMode ?? 'exact',
            lastSeen: lastSeenDate,
            age: data.birthday && data.showAge !== false ? getAge(data.birthday) : undefined,
            datingOnly: data.datingOnly ?? false,
          });
        }
      });

      list.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
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

  // Re-fetch location when app comes back to foreground
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateLocationAndLoad();
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
        <div className="empty">
          <p>{t.homeLocationDenied}</p>
          <button className="location-btn" onClick={updateLocationAndLoad}>
            {t.homeEnableLocation}
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="empty">{t.homeEmpty}</div>
      ) : (
        <div className="user-grid" data-cols={gridColumns} style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}>
          {users.map((user) => {
            const dist = formatDistance(user.distance, user.distanceMode, t);
            const isOnline = user.lastSeen && (Date.now() - user.lastSeen.getTime() < 5 * 60 * 1000);
            return (
              <Link to={`/profile/${user.id}`} key={user.id} className="user-card">
                <img
                  src={user.photoURL || placeholderPic()}
                  alt={user.displayName}
                />
                <div className="user-card-info">
                  <span className="user-name">
                    {user.displayName}{user.age ? `, ${user.age}` : ''}
                  </span>
                  {dist && <span className="user-distance">{dist}</span>}
                </div>
                {isOnline && <div className="online-dot" />}
              </Link>
            );
          })}
        </div>
      )}

      {showColumnPicker && (
        <div className="column-picker-backdrop" onClick={() => setShowColumnPicker(false)} />
      )}

      <Fab
        items={[
          { to: '/profile/me', icon: ProfileIcon },
          { to: '/chats', icon: MessagesIcon },
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
