// @ts-ignore
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, orderBy, writeBatch, increment, limit, addDoc } from "firebase/firestore";
// @ts-ignore
import type { Unsubscribe } from "firebase/firestore";
// @ts-ignore
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, isFirebaseConfigured } from "./firebase";
import { 
  User, 
  RFQ, 
  Quote, 
  Review, 
  AppNotification, 
  ServiceCategory, 
  UserRole,
  AuditLogEntry,
  EmailConfig,
  ProviderRequest 
} from "../types";

const COLLECTIONS = {
  USERS: 'users',
  RFQS: 'rfqs',
  QUOTES: 'quotes',
  NOTIFS: 'notifications',
  CATS: 'categories',
  EMAILS: 'emails', 
  AUDIT_LOGS: 'audit_logs',
  BROADCASTS: 'broadcasts',
  PROVIDER_REQUESTS: 'provider_requests',
  REVIEWS: 'reviews',
  MATCHES: 'matches' // Root collection
};

const SETTINGS_DOC_PATH = {
  LOGIC: ['settings', 'system_logic'],
  SITE: ['settings', 'site']
};

export const dataService = {
  init: async () => {
    if (!isFirebaseConfigured) return;
    try {
      await getDoc(doc(db, 'settings', 'site'));
    } catch (e) {
      console.debug("[Sync] Warming connection...");
    }
  },

  saveRFQ: async (rfq: RFQ) => {
    const rfqRef = doc(db, COLLECTIONS.RFQS, rfq.id);
    await setDoc(rfqRef, rfq, { merge: true });
  },

  getRFQs: async (): Promise<RFQ[]> => {
    const snap = await getDocs(collection(db, COLLECTIONS.RFQS));
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as RFQ));
  },

  getRFQById: async (id: string): Promise<RFQ | null> => {
    const snap = await getDoc(doc(db, COLLECTIONS.RFQS, id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as RFQ) : null;
  },

  listenToRFQs: (callback: (rfqs: RFQ[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.RFQS), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as RFQ))));
  },

  listenToRFQById: (id: string, callback: (rfq: RFQ | null) => void): Unsubscribe => {
    return onSnapshot(doc(db, COLLECTIONS.RFQS, id), (s) => callback(s.exists() ? { ...s.data(), id: s.id } as RFQ : null));
  },

  listenToRFQMatches: (rfqId: string, callback: (matches: any[]) => void): Unsubscribe => {
    // Relational query on root collection
    const q = query(collection(db, COLLECTIONS.MATCHES), where('rfqId', '==', rfqId), orderBy('distance', 'asc'));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id }))));
  },

  listenToMatchesByProvider: (providerId: string, callback: (matches: any[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.MATCHES), where('providerId', '==', providerId), orderBy('indexedAt', 'desc'));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id }))));
  },

  deleteRFQ: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.RFQS, id));
  },

  getQuotes: async (): Promise<Quote[]> => {
    const snap = await getDocs(collection(db, COLLECTIONS.QUOTES));
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Quote));
  },

  saveQuote: async (quote: Quote) => {
    await setDoc(doc(db, COLLECTIONS.QUOTES, quote.id), quote, { merge: true });
  },

  listenToQuotesByRFQ: (rfqId: string, callback: (quotes: Quote[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.QUOTES), where('rfqId', '==', rfqId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as Quote))));
  },

  listenToQuotesByProvider: (providerId: string, callback: (quotes: Quote[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.QUOTES), where('providerId', '==', providerId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as Quote))));
  },

  markQuoteAsAccepted: async (quoteId: string, rfqId: string) => {
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTIONS.QUOTES, quoteId), { status: 'ACCEPTED' });
    batch.update(doc(db, COLLECTIONS.RFQS, rfqId), { status: 'ACCEPTED', acceptedQuoteId: quoteId });
    await batch.commit();
  },

  markRFQCompleted: async (rfqId: string) => {
    await updateDoc(doc(db, COLLECTIONS.RFQS, rfqId), { status: 'COMPLETED' });
  },

  getUserById: async (id: string): Promise<User | null> => {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as User) : null;
  },

  listenToUserById: (id: string, callback: (user: User | null) => void): Unsubscribe => {
    return onSnapshot(doc(db, COLLECTIONS.USERS, id), (s) => callback(s.exists() ? ({ ...s.data(), id: s.id } as User) : null));
  },

  getUsers: async (): Promise<User[]> => {
    const snap = await getDocs(collection(db, COLLECTIONS.USERS));
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
  },

  listenToUsers: (callback: (users: User[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.USERS), (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as User))));
  },

  saveUser: async (user: User) => {
    await setDoc(doc(db, COLLECTIONS.USERS, user.id), user, { merge: true });
  },

  deleteUser: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.USERS, id));
  },

  createAuditLog: async (params: any) => {
    const id = `log_${Date.now()}`;
    const log: any = { id, timestamp: new Date().toISOString(), ...params };
    await setDoc(doc(db, COLLECTIONS.AUDIT_LOGS, id), log);
  },

  listenToAuditLogs: (callback: (logs: AuditLogEntry[]) => void, logLimit: number, startDate: string): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.AUDIT_LOGS), where('timestamp', '>=', startDate), orderBy('timestamp', 'desc'), limit(logLimit));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as AuditLogEntry))));
  },

  listenToNotifications: (userId: string, callback: (notifs: AppNotification[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.NOTIFS), where('userId', '==', userId), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as AppNotification))));
  },

  markAllNotificationsAsRead: async (userId: string) => {
    const q = query(collection(db, COLLECTIONS.NOTIFS), where('userId', '==', userId), where('isRead', '==', false));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { isRead: true }));
    await batch.commit();
  },

  markNotificationAsRead: async (id: string) => {
    await updateDoc(doc(db, COLLECTIONS.NOTIFS, id), { isRead: true });
  },

  createNotification: async (userId: string, title: string, message: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'URGENT', targetRole?: UserRole, actionUrl?: string) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const notif: AppNotification = { id, userId, title, message, timestamp: new Date().toISOString(), isRead: false, type, targetRole, actionUrl };
    await setDoc(doc(db, COLLECTIONS.NOTIFS, id), notif);
  },

  getCategories: async (): Promise<ServiceCategory[]> => {
    const snap = await getDocs(collection(db, COLLECTIONS.CATS));
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as ServiceCategory));
  },

  listenToCategories: (callback: (cats: ServiceCategory[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.CATS), (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as ServiceCategory))));
  },

  saveCategories: async (categories: ServiceCategory[]) => {
    const batch = writeBatch(db);
    categories.forEach(cat => batch.set(doc(db, COLLECTIONS.CATS, cat.id), cat, { merge: true }));
    await batch.commit();
  },

  getEmailConfig: async (): Promise<EmailConfig> => {
    const snap = await getDoc(doc(db, SETTINGS_DOC_PATH.LOGIC[0], SETTINGS_DOC_PATH.LOGIC[1]));
    if (snap.exists()) return snap.data() as EmailConfig;
    return { triggers: { "NEW_LEAD": { email: true, inApp: true } } };
  },

  saveEmailConfig: async (config: EmailConfig) => {
    await setDoc(doc(db, SETTINGS_DOC_PATH.LOGIC[0], SETTINGS_DOC_PATH.LOGIC[1]), config, { merge: true });
  },

  getSettings: async (): Promise<any> => {
    const snap = await getDoc(doc(db, SETTINGS_DOC_PATH.SITE[0], SETTINGS_DOC_PATH.SITE[1]));
    return snap.exists() ? snap.data() : null;
  },

  saveSettings: async (settings: any) => {
    await setDoc(doc(db, SETTINGS_DOC_PATH.SITE[0], SETTINGS_DOC_PATH.SITE[1]), settings, { merge: true });
  },

  listenToBroadcasts: (callback: (broadcasts: any[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.BROADCASTS), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id }))));
  },

  createBroadcast: async (title: string, message: string, targetRole: 'ALL' | 'CUSTOMER' | 'PROVIDER', actionUrl: string) => {
    const id = `broadcast_${Date.now()}`;
    const broadcastData = { id, title, message, targetRole, actionUrl, timestamp: new Date().toISOString(), sentToCount: 0, openedCount: 0 };
    await setDoc(doc(db, COLLECTIONS.BROADCASTS, id), broadcastData);
    const users = await dataService.getUsers();
    const batch = writeBatch(db);
    let count = 0;
    users.forEach(u => {
      if (targetRole === 'ALL' || u.role === targetRole) {
        const notifId = `notif_b_${id}_${u.id}`;
        batch.set(doc(db, COLLECTIONS.NOTIFS, notifId), { id: notifId, userId: u.id, title, message, type: "INFO", isRead: false, timestamp: new Date().toISOString(), targetRole: u.role, actionUrl });
        count++;
      }
    });
    batch.update(doc(db, COLLECTIONS.BROADCASTS, id), { sentToCount: count });
    await batch.commit();
  },

  listenToReviewsByProvider: (providerId: string, callback: (reviews: Review[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.REVIEWS), where('providerId', '==', providerId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as Review))));
  },

  getReviews: async (providerId: string): Promise<Review[]> => {
    const q = query(collection(db, COLLECTIONS.REVIEWS), where('providerId', '==', providerId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Review));
  },

  listenToAllReviews: (callback: (reviews: Review[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.REVIEWS), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as Review))));
  },

  deleteReview: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.REVIEWS, id));
  },

  logStorefrontView: async (providerId: string, customerId: string) => {
    await updateDoc(doc(db, COLLECTIONS.USERS, providerId), { profileViews: increment(1) });
  },

  sendTemplatedEmail: async (params: any) => {
    await addDoc(collection(db, COLLECTIONS.EMAILS), params);
  },

  getProviderRequestById: async (id: string): Promise<ProviderRequest | null> => {
    const snap = await getDoc(doc(db, COLLECTIONS.PROVIDER_REQUESTS, id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as ProviderRequest) : null;
  },

  updateProviderRequestStatus: async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await updateDoc(doc(db, COLLECTIONS.PROVIDER_REQUESTS, id), { status });
  },

  saveProviderRequest: async (request: ProviderRequest) => {
    await setDoc(doc(db, COLLECTIONS.PROVIDER_REQUESTS, request.id), request, { merge: true });
  },

  triggerLeadMatchingNotifications: async (rfq: RFQ) => {
    await updateDoc(doc(db, COLLECTIONS.RFQS, rfq.id), { 
      lastMatchTriggeredAt: new Date().toISOString() 
    });
  },

  uploadImage: async (file: File | Blob, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  },

  sendAIRRAInsights: async (rfqId: string, providerId: string, reasoning: string, score: number) => {
    // Targeting root collection using composite ID pattern from function
    const matchRef = doc(db, COLLECTIONS.MATCHES, `${rfqId}_${providerId}`);
    await setDoc(matchRef, { aiReasoning: reasoning, relevancyScore: score, rfqId }, { merge: true });
  }
};