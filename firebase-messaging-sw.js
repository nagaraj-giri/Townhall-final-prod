/**
 * Town Hall UAE - Firebase Messaging Service Worker (Production)
 */

importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

const PROD_URL = "https://town-hall-559455195686.us-west1.run.app/";

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
  console.log("[SW] Background message received:", payload);
  
  const notificationTitle = payload.notification?.title || "Town Hall UAE";
  const notificationOptions = {
    body: payload.notification?.body || "Update from your UAE Service Marketplace.",
    icon: "/logo192.png", 
    badge: "/badge.png",
    data: {
      // Construct absolute URL for the action
      actionUrl: payload.data?.actionUrl 
        ? (payload.data.actionUrl.startsWith('http') ? payload.data.actionUrl : `${PROD_URL}#${payload.data.actionUrl}`)
        : PROD_URL
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const actionUrl = event.notification.data?.actionUrl || PROD_URL;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if a tab with this URL is already open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(actionUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(actionUrl);
      }
    })
  );
});