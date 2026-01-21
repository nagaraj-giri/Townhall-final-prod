import { getMessaging, getToken, onMessage, isSupported, Messaging } from "firebase/messaging";
import { app } from "../../pages/services/firebase";
import { dataService } from "../../pages/services/dataService";
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
      // Step 1: Request Browser Permission
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // Step 2: Get Service Worker registration
        const registration = await navigator.serviceWorker.ready;
        
        // Step 3: Retrieve FCM Token
        const token = await getToken(messaging, { 
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration
        });
        
        if (token) {
          const currentTokens = user.fcmTokens || [];
          if (!currentTokens.includes(token)) {
            // Keep only last 3 tokens to prevent doc size bloat
            const updatedTokens = [...new Set([token, ...currentTokens])].slice(0, 3);
            
            // Sync to Firestore so Backend Functions can find this device
            await dataService.saveUser({
              ...user,
              fcmTokens: updatedTokens
            });
            console.debug("[PushService] Secure Link Established:", user.name);
          }
        }
      }
    } catch (error) {
      console.warn("[PushService] Device handshake failed:", error);
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