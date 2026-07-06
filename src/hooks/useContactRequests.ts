import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { ContactRequestDoc } from '../contacts';

/**
 * Realtids-abonnement på alle kontakt-anmodninger hvor jeg er part —
 * keyed på pairId (doc-id). To listeners (from==mig / to==mig), fordi
 * Firestore ikke kan OR'e på tværs af felter i én query.
 *
 * VIGTIGT: gen-binder selv ved auth-skift (onAuthStateChanged). Hooken
 * lever i EventDetailModal, som er permanent mounted i MapHome — ved
 * logout dræbes lytterne af permission-denied (anonyme må ikke læse),
 * og ved re-login med SAMME konto ville en uid-dep aldrig ændre sig,
 * så de døde lyttere blev hængende. Auth-lytteren dækker alle tilfælde.
 */
export default function useContactRequests(): Record<string, ContactRequestDoc> {
  const [requests, setRequests] = useState<Record<string, ContactRequestDoc>>({});

  useEffect(() => {
    let unsubFrom: (() => void) | null = null;
    let unsubTo: (() => void) | null = null;

    const detach = () => {
      if (unsubFrom) { unsubFrom(); unsubFrom = null; }
      if (unsubTo) { unsubTo(); unsubTo = null; }
    };

    const unsubAuth = auth().onAuthStateChanged(user => {
      detach();
      if (!user || user.isAnonymous) {
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
          .where(field, '==', user.uid)
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

      unsubFrom = listen('from');
      unsubTo = listen('to');
    });

    return () => {
      unsubAuth();
      detach();
    };
  }, []);

  return requests;
}
