import { getMessaging, getToken, onMessage, isSupported, Messaging } from "firebase/messaging";
import { app } from "../../pages/services/firebase";
import { dataService } from "../../pages/services/dataService";
import { User } from "../../types";

// NOTE: Replace this with your actual public VAPID key from Firebase Console 
const VAPID_KEY = "BDpQG-x-qY6k5C7uL9N0H8vG7F6eD5c4B3a2Z1y0X9w8V7u6T5s4R3q2P1o0N9m8L7k6J5"; 

// Production App URL provided for notification registration
const PROD_URL = "https://town-hall-559455195686.us-west1.run.app/";

let messagingInstance: Messaging | null = null;

async function getSafeMessaging(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  
  try {
    const supported = await isSupported();
    if (supported && typeof window !== 'undefined') {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (error) {
    console.warn("[PushService] Firebase Messaging is not supported in this environment.");
  }
  return null;
}

export const pushNotificationService = {
  /**
   * Initializes push notifications for the current user.
   * Requests permission and syncs the FCM token to the user's Firestore record.
   */
  init: async (user: User) => {
    const messaging = await getSafeMessaging();
    if (!messaging) return;

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // Production requirement: Wait for explicit service worker registration
        const registration = await navigator.serviceWorker.ready;
        const token = await getToken(messaging, { 
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration
        });
        
        if (token) {
          const currentTokens = user.fcmTokens || [];
          
          if (!currentTokens.includes(token)) {
            // Keep a maximum of 5 tokens per user to manage multiple device logins
            const updatedTokens = [token, ...currentTokens.filter(t => t !== token)].slice(0, 5);
            
            await dataService.saveUser({
              ...user,
              fcmTokens: updatedTokens
            });
            console.debug("[PushService] Device token synced to production profile.");
          }
        }
      } else {
        console.warn("[PushService] Permission not granted for notifications.");
      }
    } catch (error) {
      console.error("[PushService] Initialization error:", error);
    }
  },

  /**
   * Listens for messages when the app is active in the foreground.
   */
  listenForForegroundMessages: (onMessageReceived: (payload: any) => void) => {
    let unsubscribe = () => {};
    
    getSafeMessaging().then(messaging => {
      if (messaging) {
        unsubscribe = onMessage(messaging, (payload) => {
          console.debug("[PushService] Foreground message intercepted:", payload);
          onMessageReceived(payload);
        });
      }
    });

    return () => unsubscribe();
  },

  /**
   * Returns the app base URL for notification actions
   */
  getAppUrl: () => PROD_URL
};