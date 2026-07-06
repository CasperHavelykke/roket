import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

// "Hold kontakten" (Pivot 2.0): varige 1:1-forbindelser kan KUN opstå mellem
// deltagere i samme aktivitet. Anmodning + accept — med auto-accept hvis
// modparten allerede har anmodet. Håndhæves af Firestore-reglerne; denne
// service er blot den pæne klient-side vej.

export type ContactStatus =
  | 'none' // ingen anmodning mellem parret
  | 'pending_sent' // jeg har anmodet, afventer modpart
  | 'pending_received' // modparten har anmodet mig — jeg kan acceptere
  | 'connected'; // accepteret — varig connection-chat findes

export interface ContactRequestDoc {
  from: string;
  to: string;
  eventId: string;
  status: 'pending' | 'accepted';
}

// Deterministisk doc-id for et bruger-par — samme format som 1:1 chatId,
// så connection-chatten og anmodningen deler id (reglerne udnytter det:
// chat-oprettelse kan slå anmodningen op via sit eget chatId).
export function contactPairId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

// Ren logik: oversæt et anmodnings-dokument til status set fra `myUid`
export function statusForRequest(
  data: ContactRequestDoc | null,
  myUid: string,
): ContactStatus {
  if (!data) return 'none';
  if (data.status === 'accepted') return 'connected';
  return data.from === myUid ? 'pending_sent' : 'pending_received';
}

// Opret den varige connection-chat (genbruger 1:1-infrastrukturen; ingen
// expiresAt = undtaget fra auto-slet). merge: parret kan have en gammel
// 1:1-chat fra grid-æraen med samme deterministiske id.
async function createConnectionChat(myUid: string, otherUid: string, eventId: string): Promise<void> {
  const chatId = contactPairId(myUid, otherUid);
  await firestore().collection('chats').doc(chatId).set(
    {
      participants: [myUid, otherUid],
      type: 'connection',
      connectionEventId: eventId,
      createdAt: firestore.FieldValue.serverTimestamp(),
      lastMessage: '',
      lastMessageTime: firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * "Hold kontakten"-tap: anmod — eller acceptér hvis modparten allerede har
 * anmodet (auto-accept-semantikken). Returnerer den nye status til UI'et.
 */
export async function requestOrAcceptContact(
  myUid: string,
  otherUid: string,
  eventId: string,
): Promise<ContactStatus> {
  const pairId = contactPairId(myUid, otherUid);
  const ref = firestore().collection('contactRequests').doc(pairId);

  const snap = await ref.get();
  const existing = snap.exists() ? (snap.data() as ContactRequestDoc) : null;

  if (!existing) {
    try {
      await ref.set({
        from: myUid,
        to: otherUid,
        eventId,
        status: 'pending',
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      return 'pending_sent';
    } catch (err) {
      // Race: modparten oprettede lige før os → genlæs og fald igennem
      // til accept-grenen nedenfor
      const retry = await ref.get();
      if (!retry.exists()) throw err;
      return acceptIfPendingReceived(ref, retry.data() as ContactRequestDoc, myUid, otherUid);
    }
  }

  return acceptIfPendingReceived(ref, existing, myUid, otherUid);
}

async function acceptIfPendingReceived(
  ref: FirebaseFirestoreTypes.DocumentReference,
  data: ContactRequestDoc,
  myUid: string,
  otherUid: string,
): Promise<ContactStatus> {
  if (data.status === 'accepted') return 'connected';
  if (data.from === myUid) return 'pending_sent'; // allerede anmodet — no-op

  // Modparten har anmodet mig → acceptér (kun status-feltet, jf. reglerne)
  await ref.update({ status: 'accepted' });
  await createConnectionChat(myUid, otherUid, data.eventId);
  return 'connected';
}
