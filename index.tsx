import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  
  // Register Service Worker for Push Notifications
  if ('serviceWorker' in navigator) {
    const registerSW = () => {
      // Use a relative path which is more resilient in sandboxed environments
      navigator.serviceWorker.register('./firebase-messaging-sw.js')
        .then((registration) => {
          console.debug('[ServiceWorker] Registration successful with scope: ', registration.scope);
        })
        .catch((err) => {
          // "Invalid state" errors are common in iframes/previews and can be ignored as non-fatal
          if (err.message && err.message.includes('invalid state')) {
            console.warn('[ServiceWorker] Registration skipped: Document is in an invalid state (common in preview environments).');
          } else {
            console.error('[ServiceWorker] Registration failed: ', err);
          }
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