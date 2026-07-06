import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';

export interface UserProfileLite {
  id: string;
  displayName: string;
  avatarURL: string | null;
}

// Firestore documentId()-'in'-queries accepterer højst 10 værdier pr. query
export const PROFILE_CHUNK_SIZE = 10;

// Del en uid-liste op i query-venlige bidder (ren logik — unit-testes)
export function chunkUids(uids: string[], size: number = PROFILE_CHUNK_SIZE): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += size) {
    chunks.push(uids.slice(i, i + size));
  }
  return chunks;
}

// Session-cache: deltagerlister og afsender-rækker slår de samme profiler
// op igen og igen — cachen erstatter det udbredte N+1-mønster (én get pr.
// bruger pr. skærm). Profiler er stabile nok til session-levetid; skærme
// der skal have live data (fx egen profil) lytter selv.
const cache = new Map<string, UserProfileLite>();

function collectFromCache(uids: string[]): Record<string, UserProfileLite> {
  const result: Record<string, UserProfileLite> = {};
  uids.forEach(uid => {
    const hit = cache.get(uid);
    if (hit) result[uid] = hit;
  });
  return result;
}

/**
 * Batched opslag af letvægts-brugerprofiler (navn + avatar).
 *
 * Henter kun uids der ikke allerede er i session-cachen, i 'in'-queries af
 * 10 ad gangen. Slettede/ukendte brugere caches som tomme profiler, så de
 * ikke re-fetches — render-steder viser deres egen fallback (t.chatsUnknown).
 */
export default function useUserProfiles(uids: string[]): {
  profiles: Record<string, UserProfileLite>;
  loading: boolean;
} {
  // Stabil nøgle: samme mængde uids (uanset rækkefølge) → ingen re-fetch
  const key = [...uids].sort().join(',');

  const [profiles, setProfiles] = useState<Record<string, UserProfileLite>>(() =>
    collectFromCache(uids),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const wanted = key === '' ? [] : key.split(',');
    const missing = wanted.filter(uid => !cache.has(uid));

    if (missing.length === 0) {
      setProfiles(collectFromCache(wanted));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all(
      chunkUids(missing).map(chunk =>
        firestore()
          .collection('users')
          .where(firestore.FieldPath.documentId(), 'in', chunk)
          .get(),
      ),
    )
      .then(snaps => {
        snaps.forEach(snap =>
          snap.docs.forEach(doc => {
            const data = doc.data();
            cache.set(doc.id, {
              id: doc.id,
              displayName: data.displayName ?? '',
              avatarURL: data.avatarURL ?? null,
            });
          }),
        );
        // Uids uden dokument (slettede brugere): cache som tom profil,
        // ellers ville hver mount forsøge fetch igen
        missing.forEach(uid => {
          if (!cache.has(uid)) {
            cache.set(uid, { id: uid, displayName: '', avatarURL: null });
          }
        });
        if (!cancelled) {
          setProfiles(collectFromCache(wanted));
          setLoading(false);
        }
      })
      .catch(err => {
        console.warn('useUserProfiles fetch error:', err);
        if (!cancelled) {
          setProfiles(collectFromCache(wanted));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { profiles, loading };
}
