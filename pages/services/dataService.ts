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
  writeBatch
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
  UserRole 
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
  PROVIDER_REQUESTS: 'provider_requests'
};

export const dataService = {
  init: async () => {
    if (!isFirebaseConfigured) {
      console.warn("[DataService] Cloud Services key missing. App will run in limited mode.");
      return;
    }
    try {
      await getDoc(doc(db, COLLECTIONS.SETTINGS, 'global'));
      console.log("[DataService] Connected to Firestore (Modular).");
    } catch (err: any) {
      console.error("[DataService] Connection Error:", err.message);
    }
  },

  // USER OPS
  getUserById: async (id: string): Promise<User | null> => {
    try {
      const docSnap = await getDoc(doc(db, COLLECTIONS.USERS, id));
      if (docSnap.exists()) {
        const data = docSnap.data() as User;
        return {
          ...data,
          services: Array.isArray(data.services) ? data.services : [],
          categories: Array.isArray(data.categories) ? data.categories : [],
          gallery: Array.isArray(data.gallery) ? data.gallery : []
        };
      }
      return null;
    } catch (err) { return null; }
  },

  saveUser: async (user: User) => {
    try { await setDoc(doc(db, COLLECTIONS.USERS, user.id), user, { merge: true }); } 
    catch (e) { console.error("Save User Error:", e); }
  },

  getUsers: async (): Promise<User[]> => {
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
      return querySnapshot.docs.map(doc => doc.data() as User);
    } catch (err) { return []; }
  },

  listenToUsers: (callback: (users: User[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.USERS), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as User));
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
      return querySnapshot.docs.map(doc => doc.data() as RFQ);
    } catch (err) { return []; }
  },

  listenToRFQs: (callback: (rfqs: RFQ[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.RFQS), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as RFQ));
    });
  },

  listenToRFQById: (id: string, callback: (rfq: RFQ | null) => void): Unsubscribe => {
    return onSnapshot(doc(db, COLLECTIONS.RFQS, id), (snapshot) => {
      callback(snapshot.exists() ? (snapshot.data() as RFQ) : null);
    });
  },

  getRFQById: async (id: string): Promise<RFQ | null> => {
    try {
      const docSnap = await getDoc(doc(db, COLLECTIONS.RFQS, id));
      return docSnap.exists() ? (docSnap.data() as RFQ) : null;
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
      return querySnapshot.docs.map(doc => doc.data() as Quote);
    } catch (err) { return []; }
  },

  listenToQuotes: (callback: (quotes: Quote[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.QUOTES), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Quote));
    });
  },

  getQuotesByRFQ: async (rfqId: string): Promise<Quote[]> => {
    try {
      const q = query(collection(db, COLLECTIONS.QUOTES), where('rfqId', '==', rfqId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as Quote);
    } catch (err) { return []; }
  },

  listenToQuotesByRFQ: (rfqId: string, callback: (quotes: Quote[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.QUOTES), where('rfqId', '==', rfqId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(d => d.data() as Quote));
    });
  },

  saveQuote: async (quote: Quote) => {
    try {
      await setDoc(doc(db, COLLECTIONS.QUOTES, quote.id), quote, { merge: true });
      
      // Update RFQ count and status automatically
      const rfqRef = doc(db, COLLECTIONS.RFQS, quote.rfqId);
      const rfqSnap = await getDoc(rfqRef);
      
      if (rfqSnap.exists()) {
        const rfqData = rfqSnap.data() as RFQ;
        const qCountQuery = query(collection(db, COLLECTIONS.QUOTES), where('rfqId', '==', quote.rfqId));
        const quotesSnapshot = await getDocs(qCountQuery);
        
        const updates: any = { quotesCount: quotesSnapshot.size };
        
        // TRANSITION: OPEN -> ACTIVE upon first quote
        if (rfqData.status === 'OPEN' && quotesSnapshot.size > 0) {
          updates.status = 'ACTIVE';
        }
        
        await updateDoc(rfqRef, updates);
      }
    } catch (e) {
      console.error("Error saving quote/updating RFQ status:", e);
    }
  },

  // NOTIFS
  getNotifications: async (userId: string): Promise<AppNotification[]> => {
    try {
      const q = query(collection(db, COLLECTIONS.NOTIFS), where('userId', '==', userId), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as AppNotification);
    } catch (err) { return []; }
  },

  listenToNotifications: (userId: string, callback: (notifs: AppNotification[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.NOTIFS), where('userId', '==', userId), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as AppNotification));
    });
  },

  markNotificationAsRead: async (notifId: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.NOTIFS, notifId), { isRead: true });
    } catch (e) {}
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

  // SYSTEM
  getCategories: async (): Promise<ServiceCategory[]> => {
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.CATS));
      return querySnapshot.docs.map(doc => doc.data() as ServiceCategory);
    } catch (err) { return []; }
  },

  listenToCategories: (callback: (cats: ServiceCategory[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.CATS), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as ServiceCategory));
    });
  },

  saveCategories: async (categories: ServiceCategory[]) => {
    try {
      const batch = writeBatch(db);
      categories.forEach(cat => batch.set(doc(db, COLLECTIONS.CATS, cat.id), cat, { merge: true }));
      await batch.commit();
    } catch (e) {}
  },

  deleteCategory: async (id: string) => {
    try { await deleteDoc(doc(db, COLLECTIONS.CATS, id)); } catch (e) {}
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

  getRFQsForProvider: async (provider: User): Promise<RFQ[]> => {
    const all = await dataService.getRFQs();
    if (!provider.services || provider.services.length === 0) return [];
    return all.filter(r => provider.services!.includes(r.service) && (r.status === 'OPEN' || r.status === 'ACTIVE'));
  },
  
  getReviews: async (providerId: string): Promise<Review[]> => {
    try {
      const q = query(collection(db, COLLECTIONS.REVIEWS), where('providerId', '==', providerId), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as Review);
    } catch (err) { return []; }
  },

  getReviewByRFQ: async (rfqId: string): Promise<Review | null> => {
    try {
      const q = query(collection(db, COLLECTIONS.REVIEWS), where('rfqId', '==', rfqId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) return querySnapshot.docs[0].data() as Review;
      return null;
    } catch (err) { return null; }
  },

  listenToReviewsByProvider: (providerId: string, callback: (reviews: Review[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.REVIEWS), where('providerId', '==', providerId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Review));
    });
  },

  saveReview: async (review: Review) => {
    try { await setDoc(doc(db, COLLECTIONS.REVIEWS, review.id), review, { merge: true }); }
    catch (e) {}
  },

  getBanners: async (): Promise<any[]> => {
    try {
      const snapshot = await getDocs(collection(db, COLLECTIONS.BANNERS));
      return snapshot.docs.map(d => d.data());
    } catch (e) { return []; }
  },

  listenToBanners: (callback: (banners: any[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.BANNERS), (snapshot) => {
      callback(snapshot.docs.map(d => d.data()));
    });
  },

  saveBanners: async (banners: any[]) => {
    try {
      const batch = writeBatch(db);
      banners.forEach(banner => batch.set(doc(db, COLLECTIONS.BANNERS, banner.id), banner, { merge: true }));
      await batch.commit();
    } catch (e) {}
  },

  deleteBanner: async (id: string) => {
    try { await deleteDoc(doc(db, COLLECTIONS.BANNERS, id)); } catch (e) {}
  },

  listenToProviderRequests: (callback: (requests: ProviderRequest[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.PROVIDER_REQUESTS), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as ProviderRequest));
    });
  },

  saveProviderRequest: async (request: ProviderRequest) => {
    try { await setDoc(doc(db, COLLECTIONS.PROVIDER_REQUESTS, request.id), request, { merge: true }); }
    catch (e) {}
  },

  getProviderRequestById: async (id: string): Promise<ProviderRequest | null> => {
    try {
      const docSnap = await getDoc(doc(db, COLLECTIONS.PROVIDER_REQUESTS, id));
      return docSnap.exists() ? (docSnap.data() as ProviderRequest) : null;
    } catch (err) { return null; }
  },

  updateProviderRequestStatus: async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.PROVIDER_REQUESTS, id), { status });
    } catch (e) {}
  },

  uploadImage: async (file: File | Blob, path: string): Promise<string> => {
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (err) {
      throw err;
    }
  },
};