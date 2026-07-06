import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import { ContactRequestDoc } from '../contacts';

/**
 * Realtids-abonnement på alle kontakt-anmodninger hvor jeg er part —
 * keyed på pairId (doc-id). To listeners (from==mig / to==mig), fordi
 * Firestore ikke kan OR'e på tværs af felter i én query. Live-opdatering
 * betyder at "Anmodet" flipper til "I holder kontakten" i samme øjeblik
 * modparten accepterer, selv med modalen åben.
 */
export default function useContactRequests(
  myUid: string | null,
): Record<string, ContactRequestDoc> {
  const [requests, setRequests] = useState<Record<string, ContactRequestDoc>>({});

  useEffect(() => {
    if (!myUid) {
      setRequests({});
      return;
    }

    // De to retninger merges; hver listener ejer sit bidrag
    const byDirection: Record<'from' | 'to', Record<string, ContactRequestDoc>> = {
      from: {},
      to: {},
    };

    const publish = () => {
      setRequests({ ...byDirection.from, ...byDirection.to });
    };

    const listen = (field: 'from' | 'to') =>
      firestore()
        .collection('contactRequests')
        .where(field, '==', myUid)
        .onSnapshot(
          snap => {
            const next: Record<string, ContactRequestDoc> = {};
            snap.docs.forEach(doc => {
              next[doc.id] = doc.data() as ContactRequestDoc;
            });
            byDirection[field] = next;
            publish();
          },
          err => console.warn(`contactRequests(${field}) subscription error:`, err),
        );

    const unsubFrom = listen('from');
    const unsubTo = listen('to');
    return () => {
      unsubFrom();
      unsubTo();
    };
  }, [myUid]);

  return requests;
}
