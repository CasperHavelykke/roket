const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require('firebase-functions/v2/firestore');
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

// Hjælpefunktion: send push-notifikation til alle admins
async function notifyAdmin(title, body) {
  const db = getFirestore();
  const snapshot = await db.collection('users')
    .where('admin', '==', true)
    .get();

  if (snapshot.empty) return;

  const tokens = snapshot.docs
    .map(doc => doc.data().fcmToken)
    .filter(Boolean);

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

    // Hent chat-dokumentet for at finde modtager
    const db = getFirestore();
    const chatDoc = await db.collection('chats').doc(chatId).get();
    const chatData = chatDoc.data();

    if (!chatData) return;

    // Find modtageren (den der IKKE sendte beskeden)
    const recipientId = chatData.participants.find(id => id !== senderId);
    if (!recipientId) return;

    // Hent modtagerens FCM token og afsenderens navn
    const [recipientDoc, senderDoc] = await Promise.all([
      db.collection('users').doc(recipientId).get(),
      db.collection('users').doc(senderId).get(),
    ]);

    const recipientData = recipientDoc.data();
    const senderData = senderDoc.data();
    const fcmToken = recipientData?.fcmToken;
    const senderName = senderData?.displayName ?? 'Nogen';
    const senderPhoto = senderData?.photoURL ?? '';

    if (!fcmToken) return; // Modtager har ikke notifikationer aktiveret

    // Tjek om modtageren har blokeret afsenderen
    const blockedUsers = recipientData?.blockedUsers ?? [];
    if (blockedUsers.includes(senderId)) return;

    // Send notifikationen
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
    const fcmToken = after?.fcmToken;
    if (!fcmToken) return;

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

// Hjælpefunktion: beregn visibleTo-array baseret på køn, seksualitet og dating-mode
const ALL_BASE_TAGS = [
  'male_straight', 'male_gay', 'male_bisexual',
  'female_straight', 'female_gay', 'female_bisexual',
];

const DATING_COMPATIBLE_MAP = {
  male_straight: ['female_straight', 'female_bisexual'],
  male_gay: ['male_gay', 'male_bisexual'],
  male_bisexual: ['male_gay', 'male_bisexual', 'female_straight', 'female_bisexual'],
  female_straight: ['male_straight', 'male_bisexual'],
  female_gay: ['female_gay', 'female_bisexual'],
  female_bisexual: ['male_straight', 'male_bisexual', 'female_gay', 'female_bisexual'],
};

function computeVisibleTo(baseTag, datingOnly) {
  const compatible = DATING_COMPATIBLE_MAP[baseTag] || [];
  if (datingOnly) {
    // Kun synlig for dating-kompatible brugere (begge modes)
    return compatible.flatMap(tag => [`${tag}_friends`, `${tag}_dating`]);
  }
  // Synlig for ALLE friends-brugere + kompatible dating-brugere
  return [...ALL_BASE_TAGS.map(tag => `${tag}_friends`), ...compatible.map(tag => `${tag}_dating`)];
}

// Trigger: bruger oprettet/opdateret — beregn matchTag og visibleTo
exports.onUserWriteMatchTags = onDocumentWritten(
  'users/{userId}',
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();

    if (!after) return; // Slettet bruger

    const { gender, sexuality, datingOnly } = after;

    // Skip hvis intet relevant ændrede sig (forhindrer uendelig loop)
    if (before &&
        before.gender === gender &&
        before.sexuality === sexuality &&
        before.datingOnly === datingOnly) return;

    // Kræver begge felter for at beregne
    if (!gender || !sexuality) return;

    const baseTag = `${gender}_${sexuality}`;
    const matchTag = `${baseTag}_${datingOnly ? 'dating' : 'friends'}`;
    const visibleTo = computeVisibleTo(baseTag, datingOnly);

    await event.data.after.ref.update({ matchTag, visibleTo });
  }
);

// Trigger: bruger slettet fra Auth — ryd op i al data
exports.onUserDeleted = auth.user().onDelete(async (user) => {
  const db = getFirestore();
  const uid = user.uid;
  const bucket = getStorage().bucket();

  // 1. Slet bruger-profil
  await db.collection('users').doc(uid).delete().catch(() => {});

  // 2. Slet bruger-lokation
  await db.collection('userLocations').doc(uid).delete().catch(() => {});

  // 3. Slet chats og deres beskeder (subcollections)
  const chatsSnapshot = await db.collection('chats')
    .where('participants', 'array-contains', uid)
    .get();

  for (const chatDoc of chatsSnapshot.docs) {
    const chatId = chatDoc.id;
    // Slet alle beskeder i chatten
    const messagesSnapshot = await chatDoc.ref.collection('messages').get();
    const batch = db.batch();
    messagesSnapshot.docs.forEach(msg => batch.delete(msg.ref));
    batch.delete(chatDoc.ref);
    await batch.commit();

    // Slet chat-billeder fra Storage
    const [chatImageFiles] = await bucket.getFiles({ prefix: `chatImages/${chatId}/` }).catch(() => [[]]);
    for (const file of chatImageFiles) {
      await file.delete().catch(() => {});
    }
  }

  // 4. Slet feedback
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

  // 7. Slet billeder fra Storage
  const filesToDelete = [
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
      const [result] = await visionClient.safeSearchDetection(gcsUri);
      safeSearch = result.safeSearchAnnotation;
      console.log('SafeSearch result:', JSON.stringify(safeSearch));
    } catch (err) {
      console.error('Vision API error:', err.message || err);
      return;
    }
    if (!safeSearch) {
      console.log('No safeSearch annotation returned');
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
  const fcmToken = userData.fcmToken;
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
exports.cleanupExpiredChatImages = onSchedule('every 60 minutes', async () => {
  const db = getFirestore();
  const bucket = getStorage().bucket();
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
  let cleaned = 0;

  // Hent kun beskeder der har et billede (collectionGroup søger på tværs af alle chats)
  const snapshot = await db.collectionGroup('messages')
    .where('imageURL', '!=', null)
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

  // 3. Opret Firestore-profil
  await db.collection('users').doc(uid).set({
    displayName,
    bio: bio || '',
    email,
    createdAt: FieldValue.serverTimestamp(),
    photoURL,
    lastSeen: FieldValue.serverTimestamp(),
    distanceMode: 'exact',
    birthday,
    showAge: showAge ?? true,
    gender: gender || null,
    showGender: showGender ?? true,
    sexuality: sexuality || null,
    showSexuality: showSexuality ?? true,
    photos,
    testAccount: testAccount ?? true,
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

  // 1. Slet bruger-profil
  await db.collection('users').doc(uid).delete().catch(() => {});
  results.push('profil slettet');

  // 2. Slet bruger-lokation
  await db.collection('userLocations').doc(uid).delete().catch(() => {});
  results.push('lokation slettet');

  // 3. Slet chats, beskeder og chat-billeder
  const chatsSnapshot = await db.collection('chats')
    .where('participants', 'array-contains', uid)
    .get();

  for (const chatDoc of chatsSnapshot.docs) {
    const chatId = chatDoc.id;
    const messagesSnapshot = await chatDoc.ref.collection('messages').get();
    const batch = db.batch();
    messagesSnapshot.docs.forEach(msg => batch.delete(msg.ref));
    batch.delete(chatDoc.ref);
    await batch.commit();

    // Slet chat-billeder fra Storage
    try {
      const [chatImageFiles] = await bucket.getFiles({ prefix: `chatImages/${chatId}/` });
      for (const file of chatImageFiles) {
        await file.delete().catch(() => {});
      }
    } catch { /* ignore */ }
  }
  results.push(`${chatsSnapshot.size} chats slettet`);

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

  // 7. Slet profil- og feedback-billeder fra Storage
  const filesToDelete = [
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
