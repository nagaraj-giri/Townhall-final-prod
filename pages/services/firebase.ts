import * as firebaseApp from "firebase/app";
import * as firebaseAuth from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const { initializeApp, getApps, getApp } = firebaseApp as any;
const { getAuth, GoogleAuthProvider } = firebaseAuth as any;

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

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "europe-west1");

export const googleProvider = new GoogleAuthProvider();

export async function initFirebase() {
  console.debug("[Town Hall] Firebase Modular Services Connected.");
  return Promise.resolve();
}

export { app };
export const isFirebaseConfigured = !!firebaseConfig.apiKey;