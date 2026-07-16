const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const v1 = require('firebase-functions/v1');
const { auth } = v1;
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { getStorage } = require('firebase-admin/storage');
const vision = require('@google-cloud/vision');
const crypto = require('crypto');

initializeApp();
const visionClient = new vision.ImageAnnotatorClient();



// Hjælpefunktion: byg download-URL med token fra Storage metadata
async function getDownloadURL(bucket, filePath) {
  const [metadata] = await bucket.file(filePath).getMetadata();
  const token = metadata.metadata?.firebaseStorageDownloadTokens;
  const encoded = encodeURIComponent(filePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encoded}?alt=media${token ? `&token=${token}` : ''}`;
}

// Hjælpefunktion: slå en brugers FCM-token op. PII-migreringen 2026-07
// flyttede tokenet til users/{uid}/private/push (kun ejer+staff kan læse);
// fallback til legacy-feltet på bruger-doc'et, som v1.1.9-klienter stadig
// skriver. `userData` kan gives med for at spare doc-læsningen i fallback.
async function getFcmToken(db, uid, userData = null) {
  try {
    const priv = await db.collection('users').doc(uid)
      .collection('private').doc('push').get();
    const token = priv.data()?.fcmToken;
    if (token) return token;
  } catch (_) {}
  if (userData !== null) return userData?.fcmToken || null;
  try {
    const doc = await db.collection('users').doc(uid).get();
    return doc.data()?.fcmToken || null;
  } catch (_) {
    return null;
  }
}

// Hjælpefunktion: send push-notifikation til alle admins
async function notifyAdmin(title, body) {
  const db = getFirestore();
  const snapshot = await db.collection('users')
    .where('admin', '==', true)
    .get();

  if (snapshot.empty) return;

  const tokens = (
    await Promise.all(snapshot.docs.map(doc => getFcmToken(db, doc.id, doc.data())))
  ).filter(Boolean);

  if (tokens.length === 0) return;

  const message = {
    notification: { title, body },
    android: {
      priority: 'high',
      notification: { channelId: 'chat_messages', sound: 'default' },
    },
    apns: {
      payload: { aps: { sound: 'default' } },
    },
  };

  await Promise.all(tokens.map(token =>
    getMessaging().send({ ...message, token }).catch(() => {})
  ));
}

// Trigger: når en ny besked oprettes i chats/{chatId}/messages/{messageId}
exports.sendChatNotification = onDocumentCreated(
  'chats/{chatId}/messages/{messageId}',
  async event => {
    const messageData = event.data.data();
    const { chatId } = event.params;

    const senderId = messageData.senderId;
    const messageText = messageData.text || '📷 Foto';

    // System-beskeder ("X forlod chatten" m.m.) skal ikke pushes
    if (messageData.system) return;

    const db = getFirestore();
    const chatDoc = await db.collection('chats').doc(chatId).get();
    const chatData = chatDoc.data();

    if (!chatData) return;

    const senderDoc = await db.collection('users').doc(senderId).get();
    const senderData = senderDoc.data();
    const senderName = senderData?.displayName ?? 'Nogen';
    const senderPhoto = senderData?.photoURL ?? '';

    const androidApns = {
      android: {
        priority: 'high',
        notification: {
          channelId: 'chat_messages',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    };

    // Event-gruppechat: send til ALLE deltagere undtagen afsenderen.
    // (Før gik pushen kun til én vilkårlig deltager, og payload'en manglede
    // eventChatId — så et tap åbnede en forkert 1:1-chat.)
    if (chatData.eventId) {
      const recipients = (chatData.participants ?? []).filter(id => id !== senderId);
      if (recipients.length === 0) return;

      // Ulæst-tæller for grupper bor HER: klienten kan kun nemt tælle op
      // for én modpart (1:1), så serveren tæller op for alle modtagere.
      // ChatScreen nulstiller sit eget felt når chatten åbnes.
      const increments = {};
      recipients.forEach(id => {
        increments[`unreadCount.${id}`] = FieldValue.increment(1);
      });
      await chatDoc.ref.update(increments).catch(err =>
        console.warn('Group unreadCount increment failed:', err),
      );

      const recipientDocs = await Promise.all(
        recipients.map(id => db.collection('users').doc(id).get()),
      );

      // Diagnostik (F6-lektien): stille filter-stier SKAL logge tal
      let sent = 0;
      let noToken = 0;
      let blocked = 0;
      await Promise.all(recipientDocs.map(async docSnap => {
        const rData = docSnap.data();
        const token = await getFcmToken(db, docSnap.id, rData);
        if (!token) { noToken++; return; }
        if ((rData?.blockedUsers ?? []).includes(senderId)) { blocked++; return; }
        try {
          sent++;
          await getMessaging().send({
            token,
            notification: {
              title: chatData.eventTitle || senderName,
              body: `${senderName}: ${messageText}`,
            },
            data: {
              chatId,
              eventChatId: chatId,
              eventTitle: chatData.eventTitle ?? '',
              senderId,
              senderName,
              senderPhoto,
              message: messageText,
            },
            ...androidApns,
          });
        } catch (err) {
          console.error('Group push failed for', docSnap.id, err);
        }
      }));
      console.log(`Group push ${chatId}: ${sent} sent, ${noToken} no token, ${blocked} blocked (of ${recipients.length})`);
      return;
    }

    // 1:1 / connection-chat: én modtager
    const recipientId = chatData.participants.find(id => id !== senderId);
    if (!recipientId) return;

    const recipientDoc = await db.collection('users').doc(recipientId).get();
    const recipientData = recipientDoc.data();
    const fcmToken = await getFcmToken(db, recipientId, recipientData);

    if (!fcmToken) {
      console.log(`1:1 push ${chatId}: skipped — recipient ${recipientId} has no token`);
      return;
    }

    // Tjek om modtageren har blokeret afsenderen
    const blockedUsers = recipientData?.blockedUsers ?? [];
    if (blockedUsers.includes(senderId)) {
      console.log(`1:1 push ${chatId}: skipped — sender blocked`);
      return;
    }

    await getMessaging().send({
      token: fcmToken,
      notification: {
        title: senderName,
        body: messageText,
      },
      data: {
        chatId,
        senderId,
        senderName,
        senderPhoto,
        message: messageText,
      },
      ...androidApns,
    });
  }
);

// Hold kontakten (Pivot 2.0): anmodning oprettet → push til modtageren.
// Bevidst ingen senderId/senderName i payload — et tap skal blot åbne
// appen, ikke navigere til en chat der ikke findes endnu.
exports.onContactRequestCreated = onDocumentCreated(
  'contactRequests/{pairId}',
  async event => {
    const data = event.data.data();
    if (!data || data.status !== 'pending') return;

    const db = getFirestore();
    const [toDoc, fromDoc] = await Promise.all([
      db.collection('users').doc(data.to).get(),
      db.collection('users').doc(data.from).get(),
    ]);

    if ((toDoc.data()?.blockedUsers ?? []).includes(data.from)) return;

    const fromName = fromDoc.data()?.displayName ?? 'Nogen';

    // Gen-anmodning efter brud: skriv systembesked + bump lastMessage så
    // samtalen dukker op igen i modtagerens liste (clearedBy-mekanikken)
    const chatRef = db.collection('chats').doc(event.params.pairId);
    const chatSnap = await chatRef.get();
    const isReconnect = chatSnap.exists && !!chatSnap.data().disconnectedBy;
    if (isReconnect) {
      const sysText = `${fromName} vil gerne holde kontakten igen`;
      await chatRef.collection('messages').add({
        senderId: data.from,
        text: sysText,
        timestamp: FieldValue.serverTimestamp(),
        system: true,
      });
      await chatRef.update({
        lastMessage: sysText.slice(0, 500),
        lastMessageTime: FieldValue.serverTimestamp(),
        lastMessageSenderId: data.from,
      }).catch(err => console.warn('Reconnect lastMessage bump failed:', err));
    }

    const token = await getFcmToken(db, data.to, toDoc.data());
    if (!token) {
      console.log(`Contact request push skipped — recipient ${data.to} has no token`);
      return;
    }

    await getMessaging().send({
      token,
      notification: {
        title: fromName,
        body: isReconnect
          ? `${fromName} vil gerne holde kontakten igen`
          : `${fromName} vil gerne holde kontakten`,
      },
      // Gen-anmodning: Acceptér/Blokér bor i chatten → senderId/senderName
      // lader det eksisterende tap-flow åbne 1:1-chatten. Første anmodning:
      // tap åbner aktivitetens detalje (deltagerlisten).
      data: isReconnect
        ? { senderId: data.from, senderName: fromName }
        : { type: 'contactRequest', eventId: data.eventId ?? '' },
      android: {
        priority: 'high',
        notification: { channelId: 'chat_messages', sound: 'default' },
      },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  }
);

// Connection-chats: "slet samtalen" er et BRUD med fortrydelsesret.
// Klienten må kun sætte to flag (reglerne håndhæver det):
//   disconnectedBy = egen uid  → blødt brud: samtykke + beskeder slettes,
//     modparten får en systembesked og kan anmode igen
//   wipeBy = egen uid          → fuldt farvel (kun efter brud): chat,
//     beskeder og evt. gen-anmodning slettes helt for begge
// Selve oprydningen sker her — klienten må ikke slette andres beskeder,
// og beskederne SKAL væk (chat-id'et er deterministisk, så gamle beskeder
// ville spøge hvis parret nogensinde forbandt igen).
exports.onConnectionEnded = onDocumentUpdated(
  'chats/{chatId}',
  async event => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (!before || !after || after.type !== 'connection') return;

    const db = getFirestore();
    const chatRef = event.data.after.ref;
    const { chatId } = event.params;

    const deleteAllMessages = async () => {
      const msgs = await chatRef.collection('messages').get();
      const docs = msgs.docs;
      for (let i = 0; i < docs.length; i += 450) {
        const batch = db.batch();
        docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      return docs.length;
    };

    // Fuldt farvel
    if (after.wipeBy && !before.wipeBy) {
      await db.collection('contactRequests').doc(chatId).delete().catch(() => {});
      const n = await deleteAllMessages();
      await chatRef.delete().catch(() => {});
      console.log(`Connection ${chatId} wiped by ${after.wipeBy} (${n} messages)`);
      return;
    }

    // Blødt brud
    if (after.disconnectedBy && !before.disconnectedBy) {
      const uid = after.disconnectedBy;
      await db.collection('contactRequests').doc(chatId).delete().catch(() => {});
      const n = await deleteAllMessages();

      const name = (await db.collection('users').doc(uid).get()).data()?.displayName || 'Din kontakt';
      // Hardcoded dansk som appens øvrige server-tekster
      const sysText = `${name} har slettet samtalen`;
      await chatRef.collection('messages').add({
        senderId: uid,
        text: sysText,
        timestamp: FieldValue.serverTimestamp(),
        system: true,
      });
      await chatRef.update({
        [`clearedBy.${uid}`]: FieldValue.serverTimestamp(),
        lastMessage: sysText.slice(0, 500),
        lastMessageTime: FieldValue.serverTimestamp(),
        lastMessageSenderId: uid,
        unreadCount: {},
      });
      console.log(`Connection ${chatId} disconnected by ${uid} (${n} messages deleted)`);
    }
  }
);

// Slettes et EVENT (aflysning fra skaberen, admin-sletning), kaskaderer
// serveren til gruppechatten — klienten må (korrekt) ikke selv slette
// chat-docs, og den gamle klient-flow efterlod chatten forældreløs.
// onChatDeleted nedenfor tager beskeder + billeder derfra.
exports.onEventDeleted = onDocumentDeleted('events/{eventId}', async event => {
  const chatId = event.data?.data()?.chatId;
  if (!chatId) return;
  await getFirestore().collection('chats').doc(chatId).delete().catch(() => {});
});

// Slettes et chat-DOC (aflysning fra klienten, admin-sletning), rydder
// denne trigger beskederne + chat-billederne i Storage — klienter kan
// ikke slette subcollections, så uden den lå beskederne forældreløst
// for evigt (GDPR/omkostning). Flows der allerede sletter beskederne
// FØR chat-doc'et (cleanupExpiredEvents, onUserDeleted, onConnectionEnded-
// wipe) gør den til en billig no-op.
exports.onChatDeleted = onDocumentDeleted('chats/{chatId}', async event => {
  const db = getFirestore();
  const chatId = event.params.chatId;
  const messagesRef = db.collection('chats').doc(chatId).collection('messages');

  let deleted = 0;
  for (;;) {
    const snap = await messagesRef.limit(450).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
  }

  const bucket = getStorage().bucket();
  const [imageFiles] = await bucket
    .getFiles({ prefix: `chatImages/${chatId}/` })
    .catch(() => [[]]);
  for (const file of imageFiles) {
    await file.delete().catch(() => {});
  }

  if (deleted > 0 || imageFiles.length > 0) {
    console.log(`onChatDeleted ${chatId}: ${deleted} beskeder, ${imageFiles.length} billeder ryddet`);
  }
});

// Hold kontakten: accept → push til den oprindelige afsender.
// senderId/senderName i payload → det eksisterende tap-flow åbner
// parrets nye connection-chat direkte.
exports.onContactRequestAccepted = onDocumentUpdated(
  'contactRequests/{pairId}',
  async event => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (!before || !after) return;
    if (before.status !== 'pending' || after.status !== 'accepted') return;

    const db = getFirestore();

    // Genforbindelse efter slet: ryd disconnectedBy server-side (kun serveren
    // må røre feltet — ellers kunne en klient låse chatten op udenom accept)
    const chatRef = db.collection('chats').doc(event.params.pairId);
    const chatSnap = await chatRef.get();
    if (chatSnap.exists && chatSnap.data().disconnectedBy) {
      await chatRef.update({ disconnectedBy: FieldValue.delete() }).catch(err =>
        console.warn('Clear disconnectedBy failed:', err),
      );
    }

    const [fromDoc, toDoc] = await Promise.all([
      db.collection('users').doc(after.from).get(),
      db.collection('users').doc(after.to).get(),
    ]);

    const token = await getFcmToken(db, after.from, fromDoc.data());
    if (!token) return;

    const accepterName = toDoc.data()?.displayName ?? 'Nogen';
    await getMessaging().send({
      token,
      notification: {
        title: accepterName,
        body: `${accepterName} har accepteret — I holder nu kontakten`,
      },
      data: { senderId: after.to, senderName: accepterName },
      android: {
        priority: 'high',
        notification: { channelId: 'chat_messages', sound: 'default' },
      },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  }
);

// Trigger: ny rapport oprettet
exports.notifyOnReport = onDocumentCreated(
  'reports/{reportId}',
  async event => {
    const report = event.data.data();
    const db = getFirestore();

    const [reporterDoc, reportedDoc] = await Promise.all([
      db.collection('users').doc(report.reporterId).get(),
      db.collection('users').doc(report.reportedUserId).get(),
    ]);

    const reporterName = reporterDoc.data()?.displayName ?? 'Ukendt';
    const reportedName = reportedDoc.data()?.displayName ?? 'Ukendt';

    const isMessageReport = !!report.messageId;
    const title = isMessageReport
      ? `⚠️ Besked rapporteret: ${reportedName}`
      : `⚠️ Rapport: ${reportedName}`;
    const body = isMessageReport
      ? `${reporterName} har rapporteret en besked fra ${reportedName}.${report.messageText ? ` Tekst: "${report.messageText}"` : ''}${report.messageImageURL ? ' (billede vedhæftet)' : ''}`
      : `${reporterName} har rapporteret ${reportedName}. ${report.message || ''}`;

    await notifyAdmin(title, body);
  }
);

// Trigger: ny feedback oprettet
exports.notifyOnFeedback = onDocumentCreated(
  'feedback/{feedbackId}',
  async event => {
    const feedback = event.data.data();
    const db = getFirestore();

    const userDoc = await db.collection('users').doc(feedback.userId).get();
    const userName = userDoc.data()?.displayName ?? 'Ukendt';

    await notifyAdmin(
      `💬 Feedback: ${feedback.category ?? 'Generelt'}`,
      `Fra ${userName}: ${feedback.message || '(ingen besked)'}`
    );
  }
);

// Trigger: bruger modereret (advarsel, suspendering, ban)
// Sender push-notifikation til brugeren
exports.onUserModerated = onDocumentUpdated(
  'users/{userId}',
  async event => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    const oldWarnings = before?.warnings || 0;
    const newWarnings = after?.warnings || 0;
    const wasBanned = before?.banned || false;
    const isBanned = after?.banned || false;
    const oldSuspended = before?.suspendedUntil?.toDate?.()?.getTime() || 0;
    const newSuspended = after?.suspendedUntil?.toDate?.()?.getTime() || 0;

    let title = '';
    let body = '';

    if (!wasBanned && isBanned) {
      title = 'Konto deaktiveret';
      body = 'Din konto er blevet permanent deaktiveret for overtrædelse af retningslinjerne.';
    } else if (newSuspended > oldSuspended && newSuspended > Date.now()) {
      const until = new Date(newSuspended);
      const dateStr = until.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
      title = 'Konto suspenderet';
      body = `Din konto er midlertidigt suspenderet indtil ${dateStr}.`;
    } else if (newWarnings > oldWarnings) {
      title = 'Advarsel modtaget';
      body = `Du har modtaget en advarsel for overtrædelse af retningslinjerne. Du har nu ${newWarnings} advarsl${newWarnings === 1 ? '' : 'er'}.`;
    } else {
      return; // Ingen moderation-ændring
    }

    // Token slås først op NÅR vi ved der skal sendes (helperen læser
    // private/push med fallback til legacy-feltet)
    const fcmToken = await getFcmToken(getFirestore(), event.params.userId, after);
    if (!fcmToken) return;

    try {
      await getMessaging().send({
        token: fcmToken,
        notification: { title, body },
        data: { type: 'moderation' },
        android: {
          priority: 'high',
          notification: { channelId: 'chat_messages', sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default' } },
        },
      });
    } catch (err) {
      console.error('Failed to send moderation notification:', err);
    }
  }
);

// Pivot 2.0: onUserWriteMatchTags + computeVisibleTo er FJERNET —
// gender/sexuality-baseret matchTag/visibleTo-beregning har ingen
// forbrugere (grid'et henter alle brugere, og dating-matching findes
// ikke i aktivitets-modellen). Felterne ryddes i F7-backfillen.

// Trigger: bruger slettet fra Auth — ryd op i al data
exports.onUserDeleted = auth.user().onDelete(async (user) => {
  const db = getFirestore();
  const uid = user.uid;
  const bucket = getStorage().bucket();

  // Hjælper: slet en chat helt — beskeder (i 450-batches, grænsen er 500),
  // selve chat-doc'et og chat-billeder i Storage
  const deleteChatDeep = async (chatId) => {
    const chatRef = db.collection('chats').doc(chatId);
    const messagesSnapshot = await chatRef.collection('messages').get();
    const docs = messagesSnapshot.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = db.batch();
      docs.slice(i, i + 450).forEach(msg => batch.delete(msg.ref));
      await batch.commit();
    }
    await chatRef.delete().catch(() => {});
    const [chatImageFiles] = await bucket.getFiles({ prefix: `chatImages/${chatId}/` }).catch(() => [[]]);
    for (const file of chatImageFiles) {
      await file.delete().catch(() => {});
    }
  };

  // 1. Slet bruger-profil inkl. PII-privat subcollection (email/birthday/token)
  await db.collection('users').doc(uid).collection('private').get()
    .then(snap => Promise.all(snap.docs.map(d => d.ref.delete())))
    .catch(() => {});
  await db.collection('users').doc(uid).delete().catch(() => {});

  // 2. Slet bruger-lokation
  await db.collection('userLocations').doc(uid).delete().catch(() => {});

  // 3. Slet brugerens EGNE events helt (inkl. gruppechat) — en aktivitet
  //    uden vært er død, og privatlivspolitikken lover sletningen
  const ownEventsSnapshot = await db.collection('events')
    .where('creatorId', '==', uid)
    .get();
  for (const eventDoc of ownEventsSnapshot.docs) {
    const chatId = eventDoc.data().chatId;
    if (chatId) await deleteChatDeep(chatId);
    await eventDoc.ref.delete().catch(() => {});
  }

  // 4. Andres events: fjern kun brugeren fra deltagerlisten
  const joinedEventsSnapshot = await db.collection('events')
    .where('participantIds', 'array-contains', uid)
    .get();
  for (const doc of joinedEventsSnapshot.docs) {
    await doc.ref.update({ participantIds: FieldValue.arrayRemove(uid) }).catch(() => {});
  }

  // 5. Chats: event-gruppechats tilhører de ANDRE deltagere — dem forlader
  //    brugeren kun (før pivotet var alle chats 1:1, så alt blev slettet;
  //    det ville nu nuke fælles gruppechats). 1:1- og connection-chats
  //    slettes helt som hidtil.
  const chatsSnapshot = await db.collection('chats')
    .where('participants', 'array-contains', uid)
    .get();
  for (const chatDoc of chatsSnapshot.docs) {
    if (chatDoc.data().eventId) {
      await chatDoc.ref.update({ participants: FieldValue.arrayRemove(uid) }).catch(() => {});
    } else {
      await deleteChatDeep(chatDoc.id);
    }
  }

  // 6. Slet kontakt-anmodninger hvor brugeren er part
  for (const field of ['from', 'to']) {
    const requestsSnapshot = await db.collection('contactRequests')
      .where(field, '==', uid)
      .get();
    for (const doc of requestsSnapshot.docs) {
      await doc.ref.delete().catch(() => {});
    }
  }

  // 7. Slet feedback
  const feedbackSnapshot = await db.collection('feedback')
    .where('userId', '==', uid)
    .get();
  for (const doc of feedbackSnapshot.docs) {
    await doc.ref.delete();
  }

  // 5. Slet rapporter fra brugeren
  const reportsSnapshot = await db.collection('reports')
    .where('reporterId', '==', uid)
    .get();
  for (const doc of reportsSnapshot.docs) {
    await doc.ref.delete();
  }

  // 6. Slet flaggedContent for brugeren
  const flaggedSnapshot = await db.collection('flaggedContent')
    .where('senderId', '==', uid)
    .get();
  for (const doc of flaggedSnapshot.docs) {
    await doc.ref.delete();
  }

  // 10. Slet billeder fra Storage — avataren (Pivot 2.0's eneste billede)
  //     plus de gamle grid-stier (levn indtil F7e-backfillen har ryddet dem)
  const filesToDelete = [
    `profileAvatars/${uid}.jpg`,
    `profilePhotos/${uid}.jpg`,
    ...Array.from({ length: 5 }, (_, i) => `profilePhotos/${uid}_extra_${i}.jpg`),
  ];
  for (const filePath of filesToDelete) {
    await bucket.file(filePath).delete().catch(() => {});
  }

  // Slet feedback-billeder
  const feedbackImagesSnapshot = await db.collection('feedback')
    .where('userId', '==', uid)
    .get();
  for (const doc of feedbackImagesSnapshot.docs) {
    if (doc.data().imageURL) {
      await bucket.file(`feedbackImages/${doc.id}.jpg`).delete().catch(() => {});
    }
  }
});

// Trigger: nyt billede uploadet til Storage — kør SafeSearch moderation
// Bruger v1 storage trigger (direkte Cloud Storage integration, ingen Eventarc)
exports.moderateUploadedImage = v1
  .region('us-east1')
  .runWith({ timeoutSeconds: 120 })
  .storage.bucket('roket-ac4de.firebasestorage.app')
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    console.log(`moderateUploadedImage triggered for: ${filePath}`);
    const bucket = getStorage().bucket('roket-ac4de.firebasestorage.app');
    const db = getFirestore();

    // Ignorer feedback-billeder (kun admin ser dem)
    if (filePath.startsWith('feedbackImages/')) return;

    const isProfilePhoto = filePath.startsWith('profilePhotos/');
    const isChatImage = filePath.startsWith('chatImages/');
    if (!isProfilePhoto && !isChatImage) {
      console.log(`Ignoring file (not profile/chat): ${filePath}`);
      return;
    }

    // Kør SafeSearch på billedet
    const gcsUri = `gs://roket-ac4de.firebasestorage.app/${filePath}`;
    console.log(`Running SafeSearch on: ${gcsUri}`);
    let safeSearch;
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Vision API timeout (30s)')), 30000)
      );
      const [result] = await Promise.race([
        visionClient.safeSearchDetection(gcsUri),
        timeoutPromise,
      ]);
      safeSearch = result.safeSearchAnnotation;
      console.log('SafeSearch result:', JSON.stringify(safeSearch));
    } catch (err) {
      console.error('Vision API error:', err.message || err);
      // Ved fejl: flag chat-billeder så de ikke sidder fast på loading
      if (isChatImage) {
        await flagChatImageOnError(db, bucket, filePath, 'vision_api_error');
      }
      return;
    }
    if (!safeSearch) {
      console.log('No safeSearch annotation returned');
      if (isChatImage) {
        await flagChatImageOnError(db, bucket, filePath, 'no_safesearch_result');
      }
      return;
    }

    const scores = {
      adult: safeSearch.adult,
      violence: safeSearch.violence,
      racy: safeSearch.racy,
      spoof: safeSearch.spoof,
      medical: safeSearch.medical,
    };

    if (isProfilePhoto) {
      console.log('Handling as profile photo');
      await handleProfilePhotoModeration(db, bucket, filePath, scores);
    } else if (isChatImage) {
      console.log('Handling as chat image');
      await handleChatImageModeration(db, bucket, filePath, scores);
    }
    console.log('moderateUploadedImage completed');
  }
);

// Profilbillede-moderation: slet hvis NSFW
async function handleProfilePhotoModeration(db, bucket, filePath, scores) {
  const isNSFW =
    scores.adult === 'VERY_LIKELY' ||
    scores.violence === 'VERY_LIKELY';

  if (!isNSFW) return;

  // Slet filen fra Storage
  await bucket.file(filePath).delete().catch(() => {});

  // Parse uid fra sti: profilePhotos/{uid}.jpg eller profilePhotos/{uid}_extra_{N}.jpg
  const fileName = filePath.replace('profilePhotos/', '');
  const uid = fileName.split('.')[0].split('_extra_')[0];

  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) return;

  const userData = userDoc.data();
  const isExtraPhoto = fileName.includes('_extra_');

  // Byg Storage URL til sammenligning
  const encodedPath = encodeURIComponent(filePath);
  const storageURL = `https://firebasestorage.googleapis.com/v0/b/roket-ac4de.firebasestorage.app/o/${encodedPath}`;

  const updates = {
    photoRejected: true,
    photoRejectedAt: FieldValue.serverTimestamp(),
  };

  if (isExtraPhoto) {
    // Fjern URL fra photos array
    const photos = userData.photos || [];
    updates.photos = photos.filter(url => !url.includes(encodedPath));
  } else {
    // Hovedfoto — sæt photoURL til null
    updates.photoURL = null;
  }

  await userRef.update(updates);

  // Opret flaggedContent doc til admin audit trail
  let imageURL;
  try { imageURL = await getDownloadURL(bucket, filePath); } catch { imageURL = `${storageURL}?alt=media`; }
  await db.collection('flaggedContent').add({
    type: 'profile_photo',
    status: 'resolved',
    imageURL,
    storagePath: filePath,
    senderId: uid,
    safeSearchScores: scores,
    createdAt: FieldValue.serverTimestamp(),
    resolvedAt: FieldValue.serverTimestamp(),
    resolvedAction: 'auto_deleted',
  });

  // Send push-notifikation til brugeren
  const fcmToken = await getFcmToken(db, uid, userData);
  if (fcmToken) {
    try {
      await getMessaging().send({
        token: fcmToken,
        notification: {
          title: 'Billede fjernet',
          body: 'Dit profilbillede blev fjernet fordi det overtræder vores retningslinjer.',
        },
        android: {
          priority: 'high',
          notification: { channelId: 'chat_messages', sound: 'default' },
        },
        apns: { payload: { aps: { sound: 'default' } } },
      });
    } catch (err) {
      console.error('Failed to send photo rejection notification:', err);
    }
  }

  // Notificér admin
  const displayName = userData.displayName || 'Ukendt';
  await notifyAdmin(
    '🚫 Profilbillede afvist',
    `${displayName}s profilbillede blev automatisk fjernet (adult: ${scores.adult}, violence: ${scores.violence})`
  );
}

// Fallback: flag chat-billede når Vision API fejler, så det ikke sidder fast på loading
async function flagChatImageOnError(db, bucket, filePath, reason) {
  const parts = filePath.replace('chatImages/', '').split('/');
  const chatId = parts[0];
  const messageId = parts[1]?.replace('.jpg', '');
  if (!chatId || !messageId) return;

  const msgRef = db.collection('chats').doc(chatId).collection('messages').doc(messageId);
  const msgDoc = await msgRef.get();
  if (!msgDoc.exists) return;

  await msgRef.update({ moderated: true, flagged: true, flaggedReason: reason });

  const msgData = msgDoc.data();
  const imageURL = await getDownloadURL(bucket, filePath);
  await db.collection('flaggedContent').add({
    type: 'chat_image',
    status: 'pending',
    imageURL,
    storagePath: filePath,
    senderId: msgData.senderId,
    chatId,
    messageId,
    safeSearchScores: null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

// Chat-billede-moderation: flag hvis NSFW (slet IKKE)
async function handleChatImageModeration(db, bucket, filePath, scores) {
  // Parse chatId og messageId fra sti: chatImages/{chatId}/{messageId}.jpg
  const parts = filePath.replace('chatImages/', '').split('/');
  const chatId = parts[0];
  const messageId = parts[1]?.replace('.jpg', '');
  if (!chatId || !messageId) return;

  const msgRef = db.collection('chats').doc(chatId).collection('messages').doc(messageId);
  const msgDoc = await msgRef.get();
  if (!msgDoc.exists) return;

  const HIGH = ['LIKELY', 'VERY_LIKELY'];
  const isFlagged =
    HIGH.includes(scores.adult) ||
    HIGH.includes(scores.violence) ||
    HIGH.includes(scores.racy);

  if (!isFlagged) {
    // Godkendt — markér som modereret
    await msgRef.update({ moderated: true });
    return;
  }

  const msgData = msgDoc.data();
  const senderId = msgData.senderId;

  // Flag beskeden og markér som modereret
  const flagReasons = [];
  if (HIGH.includes(scores.adult)) flagReasons.push('adult');
  if (HIGH.includes(scores.violence)) flagReasons.push('violence');
  if (HIGH.includes(scores.racy)) flagReasons.push('racy');

  await msgRef.update({
    moderated: true,
    flagged: true,
    flaggedReason: flagReasons.join(', '),
  });

  // Hent billed-URL med download-token
  const imageURL = await getDownloadURL(bucket, filePath);

  // Opret flaggedContent doc til admin review
  await db.collection('flaggedContent').add({
    type: 'chat_image',
    status: 'pending',
    imageURL,
    storagePath: filePath,
    senderId,
    chatId,
    messageId,
    safeSearchScores: scores,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Notificér admin
  const senderDoc = await db.collection('users').doc(senderId).get();
  const senderName = senderDoc.data()?.displayName || 'Ukendt';
  await notifyAdmin(
    '⚠️ Chatbillede flagget',
    `${senderName} sendte et billede der blev flagget (${flagReasons.join(', ')})`
  );
}

// Scheduled: slet chat-billeder ældre end 24 timer fra Storage + Firestore
// Bruger collectionGroup query — kræver et collection group index på 'messages' feltet 'imageURL' (Ascending)
// Ryd forældreløse gæstekonti: hver logout efterlader en anonym auth-bruger
// uden Firestore-data. Standard Firebase Auth har ikke Identity Platforms
// auto-delete-toggle, så vi fejer selv. VIGTIGT: deleteUsers (bulk) trigger
// IKKE onUserDeleted — bevidst, gæster har intet at rydde op efter.
const ANONYMOUS_MAX_AGE_DAYS = 30;

exports.cleanupAnonymousUsers = onSchedule('every 24 hours', async () => {
  const authAdmin = getAuth();
  const cutoff = Date.now() - ANONYMOUS_MAX_AGE_DAYS * 24 * 3600 * 1000;

  const stale = [];
  let pageToken;
  do {
    const page = await authAdmin.listUsers(1000, pageToken);
    page.users.forEach(user => {
      const isAnonymous = user.providerData.length === 0;
      const createdAt = new Date(user.metadata.creationTime).getTime();
      if (isAnonymous && createdAt < cutoff) stale.push(user.uid);
    });
    pageToken = page.pageToken;
  } while (pageToken);

  if (stale.length === 0) {
    console.log('Anonymous cleanup: nothing to delete');
    return;
  }

  let deleted = 0;
  let failed = 0;
  for (let i = 0; i < stale.length; i += 1000) {
    const result = await authAdmin.deleteUsers(stale.slice(i, i + 1000));
    deleted += result.successCount;
    failed += result.failureCount;
  }
  console.log(`Anonymous cleanup: ${deleted} deleted, ${failed} failed (older than ${ANONYMOUS_MAX_AGE_DAYS} days)`);
});

exports.cleanupExpiredChatImages = onSchedule('every 60 minutes', async () => {
  const db = getFirestore();
  const bucket = getStorage().bucket();
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
  let cleaned = 0;

  // Hent kun beskeder der har et billede (collectionGroup søger på tværs af
  // alle chats). LOFT pr. kørsel: jobbet kører hver time, og uden limit
  // scannede det ALLE billed-beskeder app-wide hver gang. Udløbne billeder
  // forlader resultatsættet (imageURL nulstilles), så mængden er selv-
  // rensende — loftet begrænser kun én kørsel, ikke hvad der nås over tid.
  const snapshot = await db.collectionGroup('messages')
    .where('imageURL', '!=', null)
    .limit(300)
    .get();

  for (const msgDoc of snapshot.docs) {
    const data = msgDoc.data();
    if (data.deleted) continue;

    const msgTime = data.timestamp?.toDate?.() || null;
    if (!msgTime || msgTime >= cutoff) continue;

    // Sti: chats/{chatId}/messages/{messageId}
    const chatId = msgDoc.ref.parent.parent.id;

    await bucket.file(`chatImages/${chatId}/${msgDoc.id}.jpg`).delete().catch(() => {});
    await msgDoc.ref.update({ imageURL: null, imageExpired: true });
    cleaned++;
  }

  console.log(`Cleaned up ${cleaned} expired chat images`);
});

// Pivot 2.0: præcis auto-slet af udløbne events (event + gruppechat +
// beskeder + chat-billeder). Firestore TTL sletter først "inden for ~24
// timer" — for upræcist til chat-indhold der er lovet væk efter grace-
// perioden. Kører hvert 15. minut; connection-chats har ingen expiresAt
// og røres aldrig.
exports.cleanupExpiredEvents = onSchedule('every 15 minutes', async () => {
  const db = getFirestore();
  const bucket = getStorage().bucket();
  const now = new Date();
  let cleaned = 0;

  // Cap pr. kørsel — en kø af gamle events må ikke time funktionen ud;
  // resten tages af næste kørsel om 15 min
  const snapshot = await db.collection('events')
    .where('expiresAt', '<', now)
    .limit(50)
    .get();

  for (const eventDoc of snapshot.docs) {
    const data = eventDoc.data();
    const chatId = data.chatId;

    try {
      if (chatId) {
        // Beskeder i batches (batch-grænsen er 500)
        const chatRef = db.collection('chats').doc(chatId);
        const messagesSnapshot = await chatRef.collection('messages').get();
        const docs = messagesSnapshot.docs;
        for (let i = 0; i < docs.length; i += 450) {
          const batch = db.batch();
          docs.slice(i, i + 450).forEach(msg => batch.delete(msg.ref));
          await batch.commit();
        }
        await chatRef.delete().catch(() => {});

        // Chat-billeder i Storage
        const [chatImageFiles] = await bucket
          .getFiles({ prefix: `chatImages/${chatId}/` })
          .catch(() => [[]]);
        for (const file of chatImageFiles) {
          await file.delete().catch(() => {});
        }
      }

      await eventDoc.ref.delete();
      cleaned++;
    } catch (err) {
      console.error(`Failed to clean up event ${eventDoc.id}:`, err);
    }
  }

  if (cleaned > 0) console.log(`Cleaned up ${cleaned} expired events`);
});

// Pivot 2.0: opt-in "notificér mig om aktiviteter i nærheden".
// Pull-model med opt-in push (bevidst IKKE auto-invitering — uopfordret
// kontakt i skala blev fravalgt i designet).
//
// TOPIC-MODEL (privacy 2026-07): serveren gemmer INGEN brugerlokationer.
// Klienter abonnerer selv på FCM-topic'et for deres geohash-celle
// (nearby-<celle>, niveau 5 — SKAL matche NearbyTopics.ts), og her
// publiceres til alle celler, der skærer 10 km-cirklen om aktiviteten.
// Konsekvenser: præcisionen er celle-granulær (garanteret dækning inden
// for 10 km, frynse op til ~13-15 km), skaberens selv-push filtreres
// client-side i foreground (skaberen er i appen ved oprettelse), og
// blokerede brugere kan ikke ekskluderes i background. Teksten er
// engelsk for alle (topic-beskeder kan ikke variere pr. modtager).
const NEARBY_RADIUS_KM = 10;
const NEARBY_CELL_PRECISION = 5;
// Celle-dimensioner ved niveau 5 (25 bits: 13 lng + 12 lat)
const CELL_LAT_DEG = 180 / Math.pow(2, 12);
const CELL_LNG_DEG = 360 / Math.pow(2, 13);
// Halv celle-diagonal med margen (km) — niveau 5 er maks ~4,9×4,9 km
const CELL_HALF_DIAG_KM = 3.5;

const { geohashForLocation } = require('geofire-common');

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Alle geohash-celler (niveau 5) hvis areal kan skære cirklen: gennemløb
// celle-GITTERET i cirklens bounding box og medtag celler hvis centrum
// ligger inden for radius + halv celle-diagonal. Ingen inden for radius
// misses; frynsen uden for er celle-granulær.
function cellsCoveringCircle(lat, lng, radiusKm) {
  const latRadiusDeg = radiusKm / 111.32 + CELL_LAT_DEG;
  const lngRadiusDeg =
    radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180)) + CELL_LNG_DEG;
  // Snap startpunktet til celle-gitteret og gå i hele celle-skridt
  const startLat =
    Math.floor((lat - latRadiusDeg) / CELL_LAT_DEG) * CELL_LAT_DEG + CELL_LAT_DEG / 2;
  const startLng =
    Math.floor((lng - lngRadiusDeg) / CELL_LNG_DEG) * CELL_LNG_DEG + CELL_LNG_DEG / 2;
  const cells = new Set();
  for (let cLat = startLat; cLat <= lat + latRadiusDeg; cLat += CELL_LAT_DEG) {
    for (let cLng = startLng; cLng <= lng + lngRadiusDeg; cLng += CELL_LNG_DEG) {
      if (haversineKm(lat, lng, cLat, cLng) <= radiusKm + CELL_HALF_DIAG_KM) {
        cells.add(geohashForLocation([cLat, cLng], NEARBY_CELL_PRECISION));
      }
    }
  }
  return [...cells];
}

exports.onEventCreatedNotifyNearby = onDocumentCreated(
  'events/{eventId}',
  async event => {
    const data = event.data.data();
    if (!data?.location) return;

    const cells = cellsCoveringCircle(
      data.location.latitude,
      data.location.longitude,
      NEARBY_RADIUS_KM,
    );

    const messages = cells.map(cell => ({
      topic: `nearby-${cell}`,
      notification: {
        title: 'New activity nearby',
        body: data.title,
      },
      // creatorId: så klienten kan droppe skaberens egen push i foreground.
      // Ingen navigations-felter — tap åbner appen, og aktiviteten ligger
      // lige der på kortet.
      data: {
        type: 'nearbyEvent',
        eventId: event.params.eventId,
        creatorId: data.creatorId ?? '',
      },
      android: {
        priority: 'high',
        notification: { channelId: 'chat_messages', sound: 'default' },
      },
      apns: { payload: { aps: { sound: 'default' } } },
    }));

    const result = await getMessaging().sendEach(messages);
    // Diagnostik (F6-lektien): sends til tomme topics lykkes også — tallet
    // her siger kun "publiceret", ikke "modtaget af N brugere"
    console.log(
      `Nearby topic publish for event ${event.params.eventId}: ` +
      `${cells.length} cells, ${result.successCount} ok, ${result.failureCount} failed`,
    );
    if (result.failureCount > 0) {
      result.responses.forEach((r, i) => {
        if (!r.success) console.error(`Publish failed for ${messages[i].topic}:`, r.error);
      });
    }
  }
);

// Cleanup: Slet resolved feedback ældre end 90 dage (inkl. billeder fra Storage)
exports.cleanupResolvedFeedback = onSchedule('every 24 hours', async () => {
  const db = getFirestore();
  const bucket = getStorage().bucket();
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  let cleaned = 0;

  const snapshot = await db.collection('feedback')
    .where('status', '==', 'resolved')
    .get();

  for (const feedbackDoc of snapshot.docs) {
    const data = feedbackDoc.data();
    const resolvedAt = data.resolvedAt?.toDate?.() || null;
    if (!resolvedAt || resolvedAt >= cutoff) continue;

    // Slet billede fra Storage hvis det findes
    if (data.imageURL) {
      await bucket.file(`feedbackImages/${feedbackDoc.id}.jpg`).delete().catch(() => {});
    }

    await feedbackDoc.ref.delete();
    cleaned++;
  }

  console.log(`Cleaned up ${cleaned} resolved feedback items`);
});

// Admin: Opret testbruger med Auth-konto + Firestore-profil
exports.adminCreateUser = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('permission-denied', 'Kun admin kan oprette brugere.');
  }
  const callerDoc = await getFirestore().collection('users').doc(request.auth.uid).get();
  if (!callerDoc.exists || !callerDoc.data().admin) {
    throw new HttpsError('permission-denied', 'Kun admin kan oprette brugere.');
  }

  const { email, password, displayName, bio, birthday, gender, sexuality, showAge, showGender, showSexuality, testAccount, profilePhotoBase64, extraPhotosBase64 } = request.data;

  if (!email || !password || !displayName || !birthday) {
    throw new HttpsError('invalid-argument', 'email, password, displayName og birthday er påkrævet.');
  }

  const db = getFirestore();
  const bucket = getStorage().bucket();

  // 1. Opret Auth-bruger
  let userRecord;
  try {
    userRecord = await getAuth().createUser({ email, password, displayName });
  } catch (err) {
    throw new HttpsError('already-exists', `Kunne ikke oprette bruger: ${err.message}`);
  }

  const uid = userRecord.uid;

  // 2. Upload billeder hvis medsendt
  let photoURL = null;
  const photos = [];

  if (profilePhotoBase64) {
    const buffer = Buffer.from(profilePhotoBase64, 'base64');
    const filePath = `profilePhotos/${uid}.jpg`;
    const token = crypto.randomUUID();
    const file = bucket.file(filePath);
    await file.save(buffer, { metadata: { contentType: 'image/jpeg', metadata: { firebaseStorageDownloadTokens: token } } });
    photoURL = await getDownloadURL(bucket, filePath);
  }

  if (extraPhotosBase64 && Array.isArray(extraPhotosBase64)) {
    for (let i = 0; i < extraPhotosBase64.length; i++) {
      if (!extraPhotosBase64[i]) continue;
      const buffer = Buffer.from(extraPhotosBase64[i], 'base64');
      const filePath = `profilePhotos/${uid}_extra_${i}.jpg`;
      const token = crypto.randomUUID();
      const file = bucket.file(filePath);
      await file.save(buffer, { metadata: { contentType: 'image/jpeg', metadata: { firebaseStorageDownloadTokens: token } } });
      const url = await getDownloadURL(bucket, filePath);
      photos.push(url);
    }
  }

  // 3. Opret Firestore-profil — PII (email/birthday) i privat subcollection
  // ligesom app-signups (2026-07-migreringen)
  await db.collection('users').doc(uid).set({
    displayName,
    bio: bio || '',
    createdAt: FieldValue.serverTimestamp(),
    photoURL,
    lastSeen: FieldValue.serverTimestamp(),
    showAge: showAge ?? true,
    gender: gender || null,
    showGender: showGender ?? true,
    sexuality: sexuality || null,
    showSexuality: showSexuality ?? true,
    photos,
    testAccount: testAccount ?? true,
  });
  await db.collection('users').doc(uid).collection('private').doc('profile').set({
    email,
    birthday,
    createdAt: FieldValue.serverTimestamp(),
  });

  // 4. Opret en dummy lokation (København centrum) så de vises på kortet
  await db.collection('userLocations').doc(uid).set({
    location: new (require('firebase-admin/firestore').GeoPoint)(55.6761, 12.5683),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Admin created user ${uid} (${email}) with ${photos.length + (photoURL ? 1 : 0)} photos`);
  return { success: true, userId: uid };
});

// Admin: Slet bruger og al tilhørende data
exports.adminDeleteUser = onCall(async (request) => {
  // Verificér at kalderen er admin
  if (!request.auth?.uid) {
    throw new HttpsError('permission-denied', 'Kun admin kan slette brugere.');
  }
  const callerDoc = await getFirestore().collection('users').doc(request.auth.uid).get();
  if (!callerDoc.exists || !callerDoc.data().admin) {
    throw new HttpsError('permission-denied', 'Kun admin kan slette brugere.');
  }

  const uid = request.data.userId;
  if (!uid || typeof uid !== 'string') {
    throw new HttpsError('invalid-argument', 'userId er påkrævet.');
  }

  const db = getFirestore();
  const bucket = getStorage().bucket();
  const results = [];

  // 1. Slet bruger-profil inkl. PII-privat subcollection (email/birthday/token)
  await db.collection('users').doc(uid).collection('private').get()
    .then(snap => Promise.all(snap.docs.map(d => d.ref.delete())))
    .catch(() => {});
  await db.collection('users').doc(uid).delete().catch(() => {});
  results.push('profil slettet');

  // 2. Slet bruger-lokation
  await db.collection('userLocations').doc(uid).delete().catch(() => {});
  results.push('lokation slettet');

  // Hjælper: slet en chat helt (beskeder i 450-batches + chat-billeder)
  const deleteChatDeep = async (chatId) => {
    const chatRef = db.collection('chats').doc(chatId);
    const messagesSnapshot = await chatRef.collection('messages').get();
    const docs = messagesSnapshot.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = db.batch();
      docs.slice(i, i + 450).forEach(msg => batch.delete(msg.ref));
      await batch.commit();
    }
    await chatRef.delete().catch(() => {});
    try {
      const [chatImageFiles] = await bucket.getFiles({ prefix: `chatImages/${chatId}/` });
      for (const file of chatImageFiles) {
        await file.delete().catch(() => {});
      }
    } catch { /* ignore */ }
  };

  // 3a. Brugerens egne events slettes helt (inkl. gruppechat)
  const ownEventsSnapshot = await db.collection('events')
    .where('creatorId', '==', uid)
    .get();
  for (const eventDoc of ownEventsSnapshot.docs) {
    const chatId = eventDoc.data().chatId;
    if (chatId) await deleteChatDeep(chatId);
    await eventDoc.ref.delete().catch(() => {});
  }
  results.push(`${ownEventsSnapshot.size} egne events slettet`);

  // 3b. Andres events: fjern kun brugeren fra deltagerlisten
  const joinedEventsSnapshot = await db.collection('events')
    .where('participantIds', 'array-contains', uid)
    .get();
  for (const d of joinedEventsSnapshot.docs) {
    await d.ref.update({ participantIds: FieldValue.arrayRemove(uid) }).catch(() => {});
  }

  // 3c. Chats: gruppechats forlades kun (de tilhører de andre deltagere);
  //     1:1- og connection-chats slettes helt
  const chatsSnapshot = await db.collection('chats')
    .where('participants', 'array-contains', uid)
    .get();
  for (const chatDoc of chatsSnapshot.docs) {
    if (chatDoc.data().eventId) {
      await chatDoc.ref.update({ participants: FieldValue.arrayRemove(uid) }).catch(() => {});
    } else {
      await deleteChatDeep(chatDoc.id);
    }
  }
  results.push(`${chatsSnapshot.size} chats håndteret`);

  // 3d. Slet kontakt-anmodninger hvor brugeren er part
  for (const field of ['from', 'to']) {
    const requestsSnapshot = await db.collection('contactRequests')
      .where(field, '==', uid)
      .get();
    for (const d of requestsSnapshot.docs) {
      await d.ref.delete().catch(() => {});
    }
  }

  // 4. Slet feedback + feedback-billeder
  const feedbackSnapshot = await db.collection('feedback')
    .where('userId', '==', uid)
    .get();
  for (const d of feedbackSnapshot.docs) {
    if (d.data().imageURL) {
      await bucket.file(`feedbackImages/${d.id}.jpg`).delete().catch(() => {});
    }
    await d.ref.delete();
  }
  results.push(`${feedbackSnapshot.size} feedback slettet`);

  // 5. Slet rapporter fra brugeren
  const reportsSnapshot = await db.collection('reports')
    .where('reporterId', '==', uid)
    .get();
  for (const d of reportsSnapshot.docs) {
    await d.ref.delete();
  }
  results.push(`${reportsSnapshot.size} rapporter slettet`);

  // 6. Slet flaggedContent for brugeren
  const flaggedSnapshot = await db.collection('flaggedContent')
    .where('senderId', '==', uid)
    .get();
  for (const d of flaggedSnapshot.docs) {
    await d.ref.delete();
  }
  results.push(`${flaggedSnapshot.size} flaggedContent slettet`);

  // 7. Slet profil- og feedback-billeder fra Storage — avataren plus de
  //    gamle grid-stier (levn indtil F7e-backfillen har ryddet dem)
  const filesToDelete = [
    `profileAvatars/${uid}.jpg`,
    `profilePhotos/${uid}.jpg`,
    ...Array.from({ length: 5 }, (_, i) => `profilePhotos/${uid}_extra_${i}.jpg`),
  ];
  for (const filePath of filesToDelete) {
    await bucket.file(filePath).delete().catch(() => {});
  }
  results.push('billeder slettet');

  // 8. Slet Auth-brugeren
  try {
    await getAuth().deleteUser(uid);
    results.push('auth slettet');
  } catch (err) {
    results.push(`auth fejl: ${err.message}`);
  }

  console.log(`Admin deleted user ${uid}: ${results.join(', ')}`);
  return { success: true, details: results };
});
