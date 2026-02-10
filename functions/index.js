const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

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

    const fcmToken = recipientDoc.data()?.fcmToken;
    const senderName = senderDoc.data()?.displayName ?? 'Nogen';

    if (!fcmToken) return; // Modtager har ikke notifikationer aktiveret

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
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'chat_messages',
          sound: 'default',
        },
      },
    });
  }
);
