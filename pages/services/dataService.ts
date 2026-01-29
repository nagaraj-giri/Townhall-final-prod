
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
} from "../../types";
import { EmailDispatcher } from "../../AlertsEngine/email_template/EmailDispatcher";
import { calculateDistance } from "../../LeadEngine/LeadMatcher";

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
  REVIEWS: 'reviews'
};

const SETTINGS_DOC_PATH = {
  LOGIC: ['settings', 'system_logic'],
  SITE: ['settings', 'site']
};

export const dataService = {
  init: async () => {
    if (!isFirebaseConfigured) return;
  },

  /**
   * AIRRA CORE: Index leads. This MUST complete before notifications fire.
   */
  indexLeadMatches: async (rfq: RFQ): Promise<number> => {
    console.debug(`[AIRRA] Indexing leads for: ${rfq.id}`);
    try {
      const q = query(
        collection(db, COLLECTIONS.USERS), 
        where('role', '==', UserRole.PROVIDER), 
        where('services', 'array-contains', rfq.service)
      );
      const snap = await getDocs(q);
      const providers = snap.docs.map(d => ({ ...d.data(), id: d.id } as User));
      const batch = writeBatch(db);
      let count = 0;
      
      for (const p of providers) {
        if (!p.location) continue;
        const dist = calculateDistance(rfq.lat, rfq.lng, p.location.lat, p.location.lng);
        // Hard system constraint: 15KM maximum global indexing
        if (dist <= 15) {
          const matchRef = doc(db, COLLECTIONS.RFQS, rfq.id, 'matches', p.id);
          batch.set(matchRef, {
            providerId: p.id, 
            providerName: p.name, 
            email: p.email, 
            distance: dist, 
            indexedAt: new Date().toISOString()
          });
          count++;
        }
      }
      if (count > 0) {
        await batch.commit();
        console.debug(`[AIRRA] Successfully indexed ${count} potential matches.`);
      }
      return count;
    } catch (err) { 
      console.error("[AIRRA] Indexing Error:", err); 
      return 0;
    }
  },

  /**
   * AIRRA CORE: Dispatch signals.
   */
  triggerLeadMatchingNotifications: async (rfq: RFQ) => {
    try {
      const radius = rfq.searchRadius || 3;
      const phaseLabel = radius <= 3 ? "Phase 1" : radius <= 8 ? "Phase 2" : "Phase 3";
      
      const config = await dataService.getEmailConfig();
      const triggerConfig = config.triggers?.["NEW_LEAD"] || { email: true, inApp: true };

      // Query the indexed matches for this specific phase radius
      const matchSnap = await getDocs(collection(db, COLLECTIONS.RFQS, rfq.id, 'matches'));
      const phaseMatched = matchSnap.docs
        .map(d => d.data())
        .filter(m => m.distance <= radius);
      
      if (phaseMatched.length === 0) {
        console.debug(`[AIRRA] No matches found for ${phaseLabel} within ${radius}KM`);
        return;
      }

      // 1. SYSTEM SIGNALS (Bell Tray + Ringtone Trigger)
      if (triggerConfig.inApp) {
        const batch = writeBatch(db);
        const timestamp = new Date().toISOString();
        phaseMatched.forEach(m => {
          const notifId = `lead_${rfq.id.slice(-4)}_${radius}km_${m.providerId.slice(-4)}_${Date.now()}`;
          batch.set(doc(db, COLLECTIONS.NOTIFS, notifId), {
            id: notifId, userId: m.providerId, title: `🎯 Lead Found: ${phaseLabel}`,
            message: `Lead match: "${rfq.title}" in ${rfq.locationName.split(',')[0]}.`,
            type: "INFO", isRead: false, timestamp: timestamp,
            targetRole: UserRole.PROVIDER, actionUrl: `/rfq/${rfq.id}`
          });
        });
        await batch.commit();
      }

      // 2. ATOMIC PHASE EMAIL
      if (triggerConfig.email) {
        const emails = phaseMatched.map(m => m.email).filter(e => !!e);
        if (emails.length > 0) {
          await EmailDispatcher.sendBulkPhasedEmail(emails, {
            title: rfq.title, location: rfq.locationName.split(',')[0], id: rfq.id, phaseLabel: phaseLabel
          }, rfq.id);
        }
      }
    } catch (err) { console.error("[AIRRA Dispatch] Critical Error:", err); }
  },

  sendTemplatedEmail: async (payload: { to: string[], message: { subject: string, html: string }, metadata?: any }) => {
    await addDoc(collection(db, COLLECTIONS.EMAILS), { 
      ...payload, 
      cc: ["nagaraj.giri@zohomail.app"],
      delivery: { startTime: new Date(), state: 'PENDING' } 
    });
  },

  saveRFQ: async (rfq: RFQ) => {
    const rfqRef = doc(db, COLLECTIONS.RFQS, rfq.id);
    const snap = await getDoc(rfqRef);
    const isNew = !snap.exists();
    await setDoc(rfqRef, rfq, { merge: true });
    
    // If it's a new post, run the AIRRA Lead Match immediately
    if (isNew) {
      await dataService.indexLeadMatches(rfq);
    }
  },

  getRFQs: async (): Promise<RFQ[]> => {
    const snap = await getDocs(collection(db, COLLECTIONS.RFQS));
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as RFQ));
  },

  deleteRFQ: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.RFQS, id));
  },

  getUserById: async (id: string): Promise<User | null> => {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as User) : null;
  },

  listenToUserById: (id: string, callback: (user: User | null) => void): Unsubscribe => {
    return onSnapshot(doc(db, COLLECTIONS.USERS, id), (s) => callback(s.exists() ? ({ ...s.data(), id: s.id } as User) : null));
  },

  deleteUser: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.USERS, id));
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
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const notif: AppNotification = { id, userId, title, message, timestamp: new Date().toISOString(), isRead: false, type, targetRole, actionUrl };
    await setDoc(doc(db, COLLECTIONS.NOTIFS, id), notif);
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

  getCategories: async (): Promise<ServiceCategory[]> => {
    const snap = await getDocs(collection(db, COLLECTIONS.CATS));
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as ServiceCategory));
  },

  saveCategories: async (categories: ServiceCategory[]) => {
    const batch = writeBatch(db);
    categories.forEach(cat => batch.set(doc(db, COLLECTIONS.CATS, cat.id), cat, { merge: true }));
    await batch.commit();
  },

  listenToCategories: (callback: (cats: ServiceCategory[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.CATS), (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as ServiceCategory))));
  },

  listenToRFQs: (callback: (rfqs: RFQ[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.RFQS), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as RFQ))));
  },

  listenToRFQById: (id: string, callback: (rfq: RFQ | null) => void): Unsubscribe => {
    return onSnapshot(doc(db, COLLECTIONS.RFQS, id), (s) => callback(s.exists() ? { ...s.data(), id: s.id } as RFQ : null));
  },

  listenToRFQMatches: (rfqId: string, callback: (matches: any[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.RFQS, rfqId, 'matches'), (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id }))));
  },

  listenToQuotesByRFQ: (rfqId: string, callback: (quotes: Quote[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.QUOTES), where('rfqId', '==', rfqId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as Quote))));
  },

  listenToQuotesByProvider: (providerId: string, callback: (quotes: Quote[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.QUOTES), where('providerId', '==', providerId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as Quote))));
  },

  getQuotes: async (): Promise<Quote[]> => {
    const snap = await getDocs(collection(db, COLLECTIONS.QUOTES));
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Quote));
  },

  listenToQuotes: (callback: (quotes: Quote[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.QUOTES), (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as Quote))));
  },

  getEmailConfig: async (): Promise<EmailConfig> => {
    const snap = await getDoc(doc(db, ...SETTINGS_DOC_PATH.LOGIC));
    if (snap.exists()) return snap.data() as EmailConfig;
    return { triggers: { "NEW_LEAD": { email: true, inApp: true } } };
  },

  saveEmailConfig: async (config: EmailConfig) => {
    await setDoc(doc(db, ...SETTINGS_DOC_PATH.LOGIC), config, { merge: true });
  },

  createAuditLog: async (params: any) => {
    const id = `log_${Date.now()}`;
    await setDoc(doc(db, COLLECTIONS.AUDIT_LOGS, id), { ...params, id, timestamp: new Date().toISOString() });
  },

  listenToAuditLogs: (callback: (logs: AuditLogEntry[]) => void, logLimit: number, startDate: string): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.AUDIT_LOGS), where('timestamp', '>=', startDate), orderBy('timestamp', 'desc'), limit(logLimit));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as AuditLogEntry))));
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

  uploadImage: async (file: File | Blob, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  },

  saveQuote: async (quote: Quote) => {
    const quoteRef = doc(db, COLLECTIONS.QUOTES, quote.id);
    await setDoc(quoteRef, quote, { merge: true });
    
    const rfqRef = doc(db, COLLECTIONS.RFQS, quote.rfqId);
    const rfqSnap = await getDoc(rfqRef);
    if (rfqSnap.exists()) {
      const rfq = rfqSnap.data() as RFQ;
      const newStatus = (rfq.status === 'OPEN') ? 'ACTIVE' : rfq.status;
      await updateDoc(rfqRef, { quotesCount: increment(1), status: newStatus });
    }
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

  sendAIRRAInsights: async (rfqId: string, providerId: string, reasoning: string, score: number) => {
    const matchRef = doc(db, COLLECTIONS.RFQS, rfqId, 'matches', providerId);
    await updateDoc(matchRef, { aiReasoning: reasoning, relevancyScore: score });
  },

  getSettings: async (): Promise<any> => {
    const snap = await getDoc(doc(db, ...SETTINGS_DOC_PATH.SITE));
    return snap.exists() ? snap.data() : null;
  },

  saveSettings: async (settings: any) => {
    await setDoc(doc(db, ...SETTINGS_DOC_PATH.SITE), settings, { merge: true });
  },

  getReviews: async (providerId: string): Promise<Review[]> => {
    const q = query(collection(db, COLLECTIONS.REVIEWS), where('providerId', '==', providerId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Review));
  },

  listenToReviewsByProvider: (providerId: string, callback: (reviews: Review[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.REVIEWS), where('providerId', '==', providerId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as Review))));
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

  saveProviderRequest: async (request: ProviderRequest) => {
    await setDoc(doc(db, COLLECTIONS.PROVIDER_REQUESTS, request.id), request);
  },

  getProviderRequestById: async (id: string): Promise<ProviderRequest | null> => {
    const snap = await getDoc(doc(db, COLLECTIONS.PROVIDER_REQUESTS, id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as ProviderRequest) : null;
  },

  updateProviderRequestStatus: async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await updateDoc(doc(db, COLLECTIONS.PROVIDER_REQUESTS, id), { status });
  }
};
