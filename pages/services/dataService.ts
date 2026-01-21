
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  writeBatch,
  increment,
  limit
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, isFirebaseConfigured } from "./firebase";
import { 
  User, 
  RFQ, 
  Quote, 
  Review, 
  AppNotification, 
  ProviderRequest, 
  ServiceCategory, 
  UserRole,
  AuditLogEntry
} from "../../types";

const COLLECTIONS = {
  USERS: 'users',
  RFQS: 'rfqs',
  QUOTES: 'quotes',
  NOTIFS: 'notifications',
  CATS: 'categories',
  BANNERS: 'banners',
  SETTINGS: 'settings',
  REVIEWS: 'reviews',
  PROVIDER_REQUESTS: 'provider_requests',
  BROADCASTS: 'broadcasts',
  AUDIT: 'audit_logs'
};

export const dataService = {
  init: async () => {
    if (!isFirebaseConfigured) return;
    getDoc(doc(db, COLLECTIONS.SETTINGS, 'global')).catch(() => {});
  },

  // USER OPS
  getUserById: async (id: string): Promise<User | null> => {
    try {
      const docSnap = await getDoc(doc(db, COLLECTIONS.USERS, id));
      if (docSnap.exists()) {
        const data = docSnap.data() as User;
        return { ...data, id: docSnap.id };
      }
      return null;
    } catch (err) { return null; }
  },

  saveUser: async (user: User) => {
    try { await setDoc(doc(db, COLLECTIONS.USERS, user.id), user, { merge: true }); } 
    catch (e) {}
  },

  getUsers: async (): Promise<User[]> => {
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
      return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
    } catch (err) { return []; }
  },

  listenToUsers: (callback: (users: User[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.USERS), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User)));
    });
  },

  deleteUser: async (id: string) => {
    try { await deleteDoc(doc(db, COLLECTIONS.USERS, id)); } catch (e) {}
  },

  // RFQ OPS
  getRFQs: async (): Promise<RFQ[]> => {
    try {
      const q = query(collection(db, COLLECTIONS.RFQS), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as RFQ));
    } catch (err) { return []; }
  },

  listenToRFQs: (callback: (rfqs: RFQ[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.RFQS), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as RFQ)));
    });
  },

  listenToRFQById: (id: string, callback: (rfq: RFQ | null) => void): Unsubscribe => {
    return onSnapshot(doc(db, COLLECTIONS.RFQS, id), (snapshot) => {
      callback(snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as RFQ) : null);
    });
  },

  getRFQById: async (id: string): Promise<RFQ | null> => {
    try {
      const docSnap = await getDoc(doc(db, COLLECTIONS.RFQS, id));
      return docSnap.exists() ? ({ ...docSnap.data(), id: docSnap.id } as RFQ) : null;
    } catch (err) { return null; }
  },

  saveRFQ: async (rfq: RFQ) => {
    try { await setDoc(doc(db, COLLECTIONS.RFQS, rfq.id), rfq, { merge: true }); }
    catch (e) {}
  },

  deleteRFQ: async (id: string) => {
    try { await deleteDoc(doc(db, COLLECTIONS.RFQS, id)); } catch (e) {}
  },

  // QUOTE OPS
  getQuotes: async (): Promise<Quote[]> => {
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.QUOTES));
      return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Quote));
    } catch (err) { return []; }
  },

  listenToQuotes: (callback: (quotes: Quote[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.QUOTES), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Quote)));
    });
  },

  getQuotesByRFQ: async (rfqId: string): Promise<Quote[]> => {
    try {
      const q = query(collection(db, COLLECTIONS.QUOTES), where('rfqId', '==', rfqId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Quote));
    } catch (err) { return []; }
  },

  listenToQuotesByRFQ: (rfqId: string, callback: (quotes: Quote[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.QUOTES), where('rfqId', '==', rfqId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Quote)));
    });
  },

  saveQuote: async (quote: Quote) => {
    try {
      const batch = writeBatch(db);
      const quoteRef = doc(db, COLLECTIONS.QUOTES, quote.id);
      const rfqRef = doc(db, COLLECTIONS.RFQS, quote.rfqId);
      
      const quoteSnap = await getDoc(quoteRef);
      const rfqSnap = await getDoc(rfqRef);
      
      batch.set(quoteRef, quote, { merge: true });

      if (rfqSnap.exists()) {
        const rfqData = rfqSnap.data() as RFQ;
        const updates: any = {};
        
        // Only increment if it's a new quote
        if (!quoteSnap.exists()) {
          updates.quotesCount = increment(1);
        }
        
        // Flip status to ACTIVE if the first quote arrives
        if (rfqData.status === 'OPEN') {
          updates.status = 'ACTIVE';
        }
        
        if (Object.keys(updates).length > 0) {
          batch.update(rfqRef, updates);
        }
      }
      
      await batch.commit();
    } catch (e) {
      console.error("[DataService] Failed to save quote:", e);
      throw e;
    }
  },

  // NOTIFS
  getNotifications: async (userId: string): Promise<AppNotification[]> => {
    try {
      const q = query(collection(db, COLLECTIONS.NOTIFS), where('userId', '==', userId), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AppNotification));
    } catch (err) { return []; }
  },

  listenToNotifications: (userId: string, callback: (notifs: AppNotification[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.NOTIFS), where('userId', '==', userId), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AppNotification)));
    });
  },

  markNotificationAsRead: async (notifId: string) => {
    try { await updateDoc(doc(db, COLLECTIONS.NOTIFS, notifId), { isRead: true }); } catch (e) {}
  },

  markAllNotificationsAsRead: async (userId: string) => {
    try {
      const q = query(collection(db, COLLECTIONS.NOTIFS), where('userId', '==', userId), where('isRead', '==', false));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => batch.update(d.ref, { isRead: true }));
      await batch.commit();
    } catch (e) {}
  },

  // BROADCAST OPS
  createBroadcast: async (title: string, message: string, targetRole: 'ALL' | 'CUSTOMER' | 'PROVIDER', actionUrl: string = '/') => {
    const users = await dataService.getUsers();
    const recipients = users.filter(u => targetRole === 'ALL' || u.role === targetRole);
    const broadcastId = `bcast_${Date.now()}`;
    const batch = writeBatch(db);

    const masterRef = doc(db, COLLECTIONS.BROADCASTS, broadcastId);
    batch.set(masterRef, {
      id: broadcastId,
      title,
      message,
      targetRole,
      actionUrl,
      timestamp: new Date().toISOString(),
      sentToCount: recipients.length
    });

    recipients.forEach(u => {
      const notifId = `broadcast_${broadcastId}_${u.id}`;
      const notifRef = doc(db, COLLECTIONS.NOTIFS, notifId);
      batch.set(notifRef, {
        id: notifId,
        broadcastId: broadcastId,
        userId: u.id,
        title: `📢 ${title}`,
        message,
        timestamp: new Date().toISOString(),
        isRead: false,
        type: 'INFO',
        targetRole: u.role,
        actionUrl: actionUrl || '/'
      });
    });

    await batch.commit();
  },

  getBroadcasts: async (): Promise<any[]> => {
    try {
      const q = query(collection(db, COLLECTIONS.BROADCASTS), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    } catch (err) { return []; }
  },

  listenToBroadcasts: (callback: (broadcasts: any[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.BROADCASTS), orderBy('timestamp', 'desc'));
    return onSnapshot(q, async (snapshot) => {
      const baseBroadcasts = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      
      const enriched = await Promise.all(baseBroadcasts.map(async (b) => {
        try {
          const nQuery = query(
            collection(db, COLLECTIONS.NOTIFS), 
            where('broadcastId', '==', b.id), 
            where('isRead', '==', true)
          );
          const nSnapshot = await getDocs(nQuery);
          return { ...b, openedCount: nSnapshot.size };
        } catch (e) {
          return { ...b, openedCount: 0 };
        }
      }));
      
      callback(enriched);
    });
  },

  // REVIEWS
  getAllReviews: async (): Promise<Review[]> => {
    try {
      const q = query(collection(db, COLLECTIONS.REVIEWS), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Review));
    } catch (err) { return []; }
  },

  listenToAllReviews: (callback: (reviews: Review[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.REVIEWS), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Review)));
    });
  },

  deleteReview: async (id: string) => {
    try { await deleteDoc(doc(db, COLLECTIONS.REVIEWS, id)); } catch (e) {}
  },

  getReviews: async (providerId: string): Promise<Review[]> => {
    try {
      const q = query(collection(db, COLLECTIONS.REVIEWS), where('providerId', '==', providerId), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Review));
    } catch (err) { return []; }
  },

  getReviewByRFQ: async (rfqId: string): Promise<Review | null> => {
    try {
      const q = query(collection(db, COLLECTIONS.REVIEWS), where('rfqId', '==', rfqId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) return ({ ...querySnapshot.docs[0].data(), id: querySnapshot.docs[0].id } as Review);
      return null;
    } catch (err) { return null; }
  },

  listenToReviewsByProvider: (providerId: string, callback: (reviews: Review[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.REVIEWS), where('providerId', '==', providerId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Review)));
    });
  },

  saveReview: async (review: Review) => {
    try { await setDoc(doc(db, COLLECTIONS.REVIEWS, review.id), review, { merge: true }); }
    catch (e) {}
  },

  // SYSTEM OPS
  getCategories: async (): Promise<ServiceCategory[]> => {
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.CATS));
      return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ServiceCategory));
    } catch (err) { return []; }
  },

  listenToCategories: (callback: (cats: ServiceCategory[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.CATS), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ServiceCategory)));
    });
  },

  saveCategories: async (categories: ServiceCategory[]) => {
    try {
      const batch = writeBatch(db);
      categories.forEach(cat => batch.set(doc(db, COLLECTIONS.CATS, cat.id), cat, { merge: true }));
      await batch.commit();
    } catch (e) {}
  },

  getSettings: async (): Promise<any> => {
    try {
      const docSnap = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'global'));
      return docSnap.exists() ? docSnap.data() : { siteName: 'Town Hall UAE' };
    } catch (err) { return { siteName: 'Town Hall UAE' }; }
  },

  saveSettings: async (settings: any) => {
    try { await setDoc(doc(db, COLLECTIONS.SETTINGS, 'global'), settings, { merge: true }); }
    catch (e) {}
  },

  getBanners: async (): Promise<any[]> => {
    try {
      const snapshot = await getDocs(collection(db, COLLECTIONS.BANNERS));
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
    } catch (e) { return []; }
  },

  saveBanners: async (banners: any[]) => {
    try {
      const batch = writeBatch(db);
      banners.forEach(b => { if (b.id) batch.set(doc(db, COLLECTIONS.BANNERS, b.id), b, { merge: true }); });
      await batch.commit();
    } catch (e) {}
  },

  listenToProviderRequests: (callback: (requests: ProviderRequest[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.PROVIDER_REQUESTS), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProviderRequest)));
    });
  },

  saveProviderRequest: async (request: ProviderRequest) => {
    try { await setDoc(doc(db, COLLECTIONS.PROVIDER_REQUESTS, request.id), request, { merge: true }); }
    catch (e) {}
  },

  getProviderRequestById: async (id: string): Promise<ProviderRequest | null> => {
    try {
      const docSnap = await getDoc(doc(db, COLLECTIONS.PROVIDER_REQUESTS, id));
      return docSnap.exists() ? ({ ...docSnap.data(), id: docSnap.id } as ProviderRequest) : null;
    } catch (err) { return null; }
  },

  updateProviderRequestStatus: async (id: string, status: string) => {
    try { await updateDoc(doc(db, COLLECTIONS.PROVIDER_REQUESTS, id), { status }); } catch (e) {}
  },

  // AUDIT LOGS
  listenToAuditLogs: (callback: (logs: AuditLogEntry[]) => void, logLimit: number = 20, startDate?: string): Unsubscribe => {
    let q;
    if (startDate) {
      q = query(
        collection(db, COLLECTIONS.AUDIT), 
        where('timestamp', '>=', startDate),
        orderBy('timestamp', 'desc'),
        limit(logLimit)
      );
    } else {
      q = query(
        collection(db, COLLECTIONS.AUDIT), 
        orderBy('timestamp', 'desc'),
        limit(logLimit)
      );
    }
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditLogEntry)));
    });
  },

  uploadImage: async (file: File | Blob, path: string): Promise<string> => {
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (err) { throw err; }
  },
};
