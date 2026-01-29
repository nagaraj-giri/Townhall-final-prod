
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
  persistentMultipleTabManager,
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

// Singleton pattern for Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Safe Firestore initialization
let dbInstance;
try {
  // Attempt standard initialization with UAE-optimized settings
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalForceLongPolling: true
  });
} catch (e: any) {
  // Fallback to getFirestore if already initialized (prevents "Service already exists" error)
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.warn);

export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");
export const googleProvider = new GoogleAuthProvider();

export { app };
export const isFirebaseConfigured = !!firebaseConfig.apiKey;
