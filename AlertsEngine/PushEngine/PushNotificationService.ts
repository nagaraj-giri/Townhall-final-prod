
import { getMessaging, getToken, onMessage, isSupported, Messaging } from "firebase/messaging";
import { app } from "../../pages/services/firebase";
import { dataService } from "../../pages/services/dataService";
import { User } from "../../types";

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
    console.debug("[PushService] Secure context required for Messaging.");
  }
  return null;
}

export const pushNotificationService = {
  init: async (user: User) => {
    const messaging = await getSafeMessaging();
    if (!messaging) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const token = await getToken(messaging, { 
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration
        });
        
        if (token) {
          const currentTokens = user.fcmTokens || [];
          if (!currentTokens.includes(token)) {
            const updatedTokens = [...new Set([token, ...currentTokens])].slice(0, 5);
            // Push token to user document
            await dataService.saveUser({
              ...user,
              fcmTokens: updatedTokens
            });
            console.debug("[PushService] Token synced to Firestore for:", user.id);
          }
        }
      }
    } catch (error) {
      console.warn("[PushService] Registration failed:", error);
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
