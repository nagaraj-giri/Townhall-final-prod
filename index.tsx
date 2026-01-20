import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  
  // Register Service Worker for Push Notifications (FCM)
  if ('serviceWorker' in navigator) {
    const registerSW = () => {
      // Standard production registration for Cloud Run
      // Ensure firebase-messaging-sw.js is in your public/dist folder
      navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: '/' })
        .then((registration) => {
          console.debug('[ServiceWorker] Production registration active:', registration.scope);
        })
        .catch((err) => {
          // Log errors for debugging production deployment issues
          console.warn('[ServiceWorker] Push registration failed:', err.message);
        });
    };

    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
    }
  }

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Critical: Root element not found in DOM.");
}