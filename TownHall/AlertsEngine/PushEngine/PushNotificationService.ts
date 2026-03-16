
// Fix: Suppressed false-positive 'no exported member' error for messaging in modular SDK
// @ts-ignore
import { getMessaging, getToken, onMessage, isSupported, Messaging } from "firebase/messaging";
import { app } from "../../services/firebase";
import { dataService } from "../../services/dataService";
import { User } from "../../types";

/**
 * PRODUCTION ACTION:
 * Replace this VAPID_KEY with the one from: 
 * Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
 */
const VAPID_KEY = "BD7l9kcaB-dGH72DMAC3ALczvOIH3mn7QVklG2V2xwNeBFbc9qz1xDKYy_K7g3LhLj9j0Ib9-zAQUNTGMoEjOos"; 

let messagingInstance: Messaging | null = null;

async function getSafeMessaging(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  try {
    const supported = await isSupported();
    if (supported && typeof window !== 'undefined' && window.isSecureContext) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (error) {
    console.debug("[PushService] Secure context or browser support missing.");
  }
  return null;
}

export const pushNotificationService = {
  init: async (user: User) => {
    const messaging = await getSafeMessaging();
    if (!messaging) return;

    try {
      // Step 1: Check permission status
      const permission = Notification.permission;
      if (permission === 'granted') {
        await pushNotificationService.registerToken(user);
      }
    } catch (error) {
      console.warn("[PushService] Device handshake failed:", error);
    }
  },

  requestPermission: async (user: User): Promise<boolean> => {
    const messaging = await getSafeMessaging();
    if (!messaging) return false;

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await pushNotificationService.registerToken(user);
        return true;
      }
      return false;
    } catch (error) {
      console.error("[PushService] Permission request failed:", error);
      return false;
    }
  },

  registerToken: async (user: User) => {
    const messaging = await getSafeMessaging();
    if (!messaging) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const token = await getToken(messaging, { 
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
      });
      
      if (token) {
        const currentTokens = user.fcmTokens || [];
        if (!currentTokens.includes(token)) {
          const updatedTokens = [...new Set([token, ...currentTokens])].slice(0, 3);
          await dataService.saveUser({
            ...user,
            fcmTokens: updatedTokens
          });
          console.debug("[PushService] Secure Link Established:", user.name);
        }
      }
    } catch (error) {
      console.warn("[PushService] Token registration failed:", error);
    }
  },

  listenForForegroundMessages: (onMessageReceived: (payload: any) => void) => {
    let unsubscribe = () => {};
    getSafeMessaging().then(messaging => {
      if (messaging) {
        unsubscribe = onMessage(messaging, (payload) => {
          onMessageReceived(payload);
        });
      }
    });
    return () => unsubscribe();
  }
};
