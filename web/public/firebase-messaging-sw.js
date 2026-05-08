importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDMxb4MFwfswAOPvgyZaLb5p6TMwz6BdLE',
  authDomain: 'roket-ac4de.firebaseapp.com',
  projectId: 'roket-ac4de',
  storageBucket: 'roket-ac4de.firebasestorage.app',
  messagingSenderId: '1004023349474',
  appId: '1:1004023349474:web:ce6b478bed7d49fe385ebb',
});

const messaging = firebase.messaging();

// Background push handler
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(title || 'Røket', {
    body: body || '',
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    data,
    tag: data.chatId || 'default',
  });
});

// Handle notification click — open chat
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  const url = chatId ? `/chat/${chatId}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});
