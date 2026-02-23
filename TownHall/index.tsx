import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const CURRENT_VERSION = '1.1.4';
const rootElement = document.getElementById('root');

if (rootElement) {
  // Version Control - Force refresh if client cache is stale
  const lastVersion = localStorage.getItem('townhall_build_version');
  if (lastVersion && lastVersion !== CURRENT_VERSION) {
    console.debug('[Versioning] New version detected. Force refreshing client...');
    localStorage.setItem('townhall_build_version', CURRENT_VERSION);
    window.location.reload();
  } else {
    localStorage.setItem('townhall_build_version', CURRENT_VERSION);
  }

  const root = ReactDOM.createRoot(rootElement);
  
  if ('serviceWorker' in navigator) {
    const registerSW = () => {
      navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: '/' })
        .then((registration) => {
          console.debug('[ServiceWorker] Active:', registration.scope);
          registration.update();
        })
        .catch((err) => {
          console.warn('[ServiceWorker] Registration failed:', err.message);
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
}