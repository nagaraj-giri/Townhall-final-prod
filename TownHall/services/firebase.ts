
// @ts-ignore
import { initializeApp, getApps, getApp } from "firebase/app";
// @ts-ignore
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { 
  // @ts-ignore
  initializeFirestore, 
  // @ts-ignore
  persistentLocalCache, 
  // @ts-ignore
  persistentSingleTabManager,
  // @ts-ignore
  getFirestore
} from "firebase/firestore";
// @ts-ignore
import { getStorage } from "firebase/storage";
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

// Singleton pattern for App initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let dbInstance;
try {
  /**
   * Town Hall Resilience Strategy:
   * 1. experimentalAutoDetectLongPolling: Automatically switches to long-polling if WebSockets are blocked by environment proxies.
   * 2. persistentLocalCache: Provides offline support; using persistentSingleTabManager for reliability in single-view contexts.
   */
  // Fix: Removed invalid property 'useFetchStreams' from settings and cast 'app' to any to resolve modular vs compat type mismatch.
  dbInstance = initializeFirestore(app as any, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager({})
    }),
    experimentalAutoDetectLongPolling: true
  });
} catch (e: any) {
  console.warn("[Firebase] Standard init failed, falling back to basic Firestore", e.message);
  // Fix: Consistently cast 'app' to any to resolve type mismatch issues.
  dbInstance = getFirestore(app as any);
}

export const db = dbInstance;
// Fix: Consistently cast 'app' to any to resolve type mismatch issues.
export const auth = getAuth(app as any);
setPersistence(auth, browserLocalPersistence).catch(console.warn);

// Fix: Consistently cast 'app' to any to resolve type mismatch issues.
export const storage = getStorage(app as any);
// Fix: Consistently cast 'app' to any to resolve type mismatch issues.
export const functions = getFunctions(app as any, "us-central1");
export const googleProvider = new GoogleAuthProvider();

export { app };
export const isFirebaseConfigured = !!firebaseConfig.apiKey;
