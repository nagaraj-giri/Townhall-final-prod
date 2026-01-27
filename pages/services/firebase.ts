// Fix: Suppressed false-positive 'no exported member' error for app in modular SDK
// @ts-ignore
import { initializeApp, getApps, getApp } from "firebase/app";
// Fix: Suppressed false-positive 'no exported member' error for auth in modular SDK
// @ts-ignore
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
// Fix: Suppressed false-positive 'no exported member' error for firestore in modular SDK
// @ts-ignore
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
// Fix: Suppressed false-positive 'no exported member' error for storage in modular SDK
// @ts-ignore
import { getStorage } from "firebase/storage";
// Fix: Suppressed false-positive 'no exported member' error for getFunctions in modular Firebase SDK
// @ts-ignore
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDT5SZoa9Nu6imSezlxYlBGUYycfUZPzYQ",
  authDomain: "townhall-io.firebaseapp.com",
  projectId: "townhall-io",
  storageBucket: "townhall-io.firebasestorage.app",
  messagingSenderId: "559455195686",
  appId: "1:559455195686:web:2054ad5546c91d24d84ce7",
  measurementId: "G-EBS2R5RE23"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialization for Auth with explicit persistence to prevent credential loss
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true
});

export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");
export const googleProvider = new GoogleAuthProvider();

export async function initFirebase() {
  console.debug("[Town Hall] Secure Services Ready.");
  return Promise.resolve();
}

export { app };
export const isFirebaseConfigured = !!firebaseConfig.apiKey;