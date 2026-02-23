/**
 * Town Hall UAE - Firebase Messaging Service Worker (Production)
 */

importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDT5SZoa9Nu6imSezlxYlBGUYycfUZPzYQ",
  authDomain: "townhall-io.firebaseapp.com",
  projectId: "townhall-io",
  storageBucket: "townhall-io.firebasestorage.app",
  messagingSenderId: "559455195686",
  appId: "1:559455195686:web:2054ad5546c91d24d84ce7"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || "Town Hall Alert";
  const notificationOptions = {
    body: payload.notification?.body || "Check your dashboard for updates.",
    icon: "/favicon.ico", 
    badge: "/favicon.ico",
    data: {
      actionUrl: payload.data?.actionUrl || '/'
    }
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const actionUrl = event.notification.data?.actionUrl || '/';
  const targetUrl = `${self.location.origin}/#${actionUrl}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});