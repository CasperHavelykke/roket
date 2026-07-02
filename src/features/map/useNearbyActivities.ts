import { useEffect, useMemo, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';
import type { Region } from 'react-native-maps';
import { EventDoc, eventFromData } from '../../events';
import { regionToQuery } from './mapQuery';

// Loft pr. geohash-range-query — beskytter mod ubegrænsede læsninger i tætte
// områder. Rammes loftet, meldes `truncated`, så UI kan reagere (fx bede
// brugeren zoome ind). En viewport-query består typisk af 4-9 ranges.
export const BOUND_QUERY_LIMIT = 100;

export interface NearbyActivitiesState {
  activities: EventDoc[];
  loading: boolean;
  zoomedOut: boolean;
  truncated: boolean;
}

/**
 * Realtids-abonnement på aktiviteter i kortets viewport.
 *
 * Viewporten oversættes til en snappet geo-query (se mapQuery.ts), som kun
 * ændrer sig ved meningsfulde pan/zoom — små bevægelser genbruger de
 * eksisterende lyttere. Selve søgningen er geohash-prefix-ranges
 * (geofire-common); da cellerne er firkantede og søgningen rund,
 * efterfiltreres på reel afstand. Udløbne events filtreres klient-side
 * (server-side sletning håndteres af TTL/backend, Fase 6).
 */
export default function useNearbyActivities(region: Region | null): NearbyActivitiesState {
  const query = useMemo(() => (region ? regionToQuery(region) : null), [region]);
  const queryKey = query ? query.key : null;

  const [activities, setActivities] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    if (!query || query.zoomedOut) {
      setActivities([]);
      setTruncated(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const center: [number, number] = [query.centerLat, query.centerLng];
    const radiusM = query.radiusM;
    const bounds = geohashQueryBounds(center, radiusM);

    // Merge-strategi: hver range-query "ejer" sit bidrag af dokumenter.
    // Ved et nyt snapshot udskiftes hele boundens bidrag — så dokumenter
    // der forsvinder fra serveren også forsvinder fra kortet.
    const contributions = new Map<number, Map<string, EventDoc>>();
    const truncatedBounds = new Set<number>();
    const arrived = new Set<number>();

    const publish = () => {
      const merged = new Map<string, EventDoc>();
      contributions.forEach(byId => byId.forEach((ev, id) => merged.set(id, ev)));

      const now = Date.now();
      const list = [...merged.values()].filter(
        ev =>
          ev.expiresAt.getTime() > now &&
          // geofire's distanceBetween returnerer kilometer
          distanceBetween([ev.location.latitude, ev.location.longitude], center) * 1000 <= radiusM,
      );

      setActivities(list);
      setTruncated(truncatedBounds.size > 0);
      if (arrived.size === bounds.length) {
        setLoading(false);
      }
    };

    const unsubs = bounds.map(([start, end], i) =>
      firestore()
        .collection('events')
        .orderBy('geohash')
        .startAt(start)
        .endAt(end)
        .limit(BOUND_QUERY_LIMIT)
        .onSnapshot(
          snap => {
            const byId = new Map<string, EventDoc>();
            snap.docs.forEach(doc => byId.set(doc.id, eventFromData(doc.id, doc.data())));
            contributions.set(i, byId);
            if (snap.docs.length >= BOUND_QUERY_LIMIT) {
              truncatedBounds.add(i);
            } else {
              truncatedBounds.delete(i);
            }
            arrived.add(i);
            publish();
          },
          err => {
            // En fejlet bound må aldrig efterlade kortet i evig loading
            console.warn('useNearbyActivities bound error:', err);
            contributions.set(i, new Map());
            arrived.add(i);
            publish();
          },
        ),
    );

    return () => unsubs.forEach(u => u());
    // Bevidst kun queryKey: `query` er et nyt objekt pr. render, men to
    // regioner der snapper ens giver samme key — og så må effekten ikke re-køre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  return {
    activities,
    loading,
    zoomedOut: query?.zoomedOut ?? false,
    truncated,
  };
}
