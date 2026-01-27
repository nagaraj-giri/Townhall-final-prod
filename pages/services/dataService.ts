import { 
  // Fix: Suppressed false-positive 'no exported member' error for firestore in modular SDK
  // @ts-ignore
  collection, 
  // @ts-ignore
  doc, 
  // @ts-ignore
  getDoc, 
  // @ts-ignore
  getDocs, 
  // @ts-ignore
  setDoc, 
  // @ts-ignore
  updateDoc, 
  // @ts-ignore
  deleteDoc, 
  // @ts-ignore
  query, 
  // @ts-ignore
  where, 
  // @ts-ignore
  onSnapshot, 
  // @ts-ignore
  orderBy,
  // @ts-ignore
  writeBatch,
  // @ts-ignore
  increment,
  // @ts-ignore
  limit,
  // @ts-ignore
  addDoc
} from "firebase/firestore";
// Fix: Suppressed false-positive 'no exported member' error for Unsubscribe type
// @ts-ignore
import type { Unsubscribe } from "firebase/firestore";
// Fix: Suppressed false-positive 'no exported member' error for storage in modular SDK
// @ts-ignore
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
  EMAILS: 'emails', // Standard collection for Email Extension
  AUDIT_LOGS: 'audit_logs',
  BROADCASTS: 'broadcasts'
};

export const dataService = {
  init: async () => {
    if (!isFirebaseConfigured) return;
  },

  // --- IDENTITY & ANALYTICS ---

  logStorefrontView: async (providerId: string, viewerId: string) => {
    if (providerId === viewerId) return;
    try {
      const providerRef = doc(db, COLLECTIONS.USERS, providerId);
      await updateDoc(providerRef, {
        profileViews: increment(1)
      });
      await dataService.createNotification(
        providerId,
        "👀 Storefront Viewed",
        "A potential customer is currently viewing your profile and reviews.",
        "INFO",
        UserRole.PROVIDER
      );
    } catch (e) {}
  },

  deleteUser: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.USERS, id));
  },

  // --- NOTIFICATION & EMAIL CORE ---

  sendEmail: async (to: string, subject: string, bodyHtml: string) => {
    try {
      await addDoc(collection(db, COLLECTIONS.EMAILS), {
        to: [to],
        message: { subject, html: bodyHtml },
        timestamp: new Date().toISOString()
      });
    } catch (e) {}
  },

  // Fix: New method for templated dispatch using the standard format requested
  sendTemplatedEmail: async (payload: { toUids: string[], template: any }) => {
    try {
      // In a production setup, the Email extension uses 'toUids' to resolve email addresses
      await addDoc(collection(db, COLLECTIONS.EMAILS), {
        ...payload,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("Failed to enqueue templated email", e);
    }
  },

  testEmailTrigger: async () => {
    await addDoc(collection(db, COLLECTIONS.EMAILS), {
      to: ['test@townhall.ae'],
      message: { 
        subject: 'SMTP Handshake Test', 
        html: '<p>Testing connection to SMTP gateway.</p>' 
      },
      timestamp: new Date().toISOString()
    });
  },

  getLastEmailStatus: async (): Promise<any> => {
    const q = query(collection(db, COLLECTIONS.EMAILS), orderBy('timestamp', 'desc'), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data() as any;
    return data.delivery || { state: 'PENDING' };
  },

  createNotification: async (userId: string, title: string, message: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'URGENT', targetRole: UserRole, actionUrl?: string) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    await setDoc(doc(db, COLLECTIONS.NOTIFS, id), {
      id, userId, title, message, type, isRead: false, timestamp: new Date().toISOString(), targetRole, actionUrl
    });
  },

  createBroadcast: async (title: string, message: string, target: 'ALL' | 'CUSTOMER' | 'PROVIDER', actionUrl: string) => {
    const broadcastId = `bcast_${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    await setDoc(doc(db, COLLECTIONS.BROADCASTS, broadcastId), {
      id: broadcastId,
      title,
      message,
      targetRole: target,
      actionUrl,
      timestamp,
      sentToCount: 0,
      openedCount: 0
    });

    let userQuery;
    if (target === 'ALL') {
      userQuery = collection(db, COLLECTIONS.USERS);
    } else {
      userQuery = query(collection(db, COLLECTIONS.USERS), where('role', '==', target));
    }
    
    const usersSnap = await getDocs(userQuery);
    const batch = writeBatch(db);
    
    usersSnap.docs.forEach(uDoc => {
      const notifId = `notif_bc_${broadcastId}_${uDoc.id}`;
      const notifRef = doc(db, COLLECTIONS.NOTIFS, notifId);
      const userData = uDoc.data() as any;
      batch.set(notifRef, {
        id: notifId,
        userId: uDoc.id,
        title,
        message,
        type: 'INFO',
        isRead: false,
        timestamp,
        targetRole: userData.role,
        actionUrl
      });
    });
    
    await updateDoc(doc(db, COLLECTIONS.BROADCASTS, broadcastId), {
      sentToCount: usersSnap.size
    });
    
    await batch.commit();
  },

  listenToBroadcasts: (callback: (history: any[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.BROADCASTS), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (s: any) => callback(s.docs.map((d: any) => ({ ...d.data(), id: d.id }))));
  },

  // --- WORKFLOW TRANSITIONS (RFQ Lifecycle) ---

  getRFQById: async (id: string): Promise<RFQ | null> => {
    const snap = await getDoc(doc(db, COLLECTIONS.RFQS, id));
    return snap.exists() ? ({ ...snap.data() as any, id: snap.id } as RFQ) : null;
  },

  saveRFQ: async (rfq: RFQ) => {
    const rfqRef = doc(db, COLLECTIONS.RFQS, rfq.id);
    const snap = await getDoc(rfqRef);
    const isNew = !snap.exists();
    
    await setDoc(rfqRef, rfq, { merge: true });

    if (isNew) {
      // Integration with Template System: Customer Acknowledge
      const { EmailDispatcher } = await import('../../AlertsEngine/email_template/EmailDispatcher');
      await EmailDispatcher.send(
        [rfq.customerId], 
        'QUERY_LIVE', 
        { id: rfq.idDisplay, title: rfq.title, location: rfq.locationName }
      );

      // Admin Alert: New query posted
      const admins = (await dataService.getUsers()).filter(u => u.role === UserRole.ADMIN);
      await EmailDispatcher.send(
        admins.map(a => a.id),
        'NEW_USER_ADMIN', // Reuse style or extend for queries
        { name: rfq.customerName || 'Customer', email: '---', role: 'RFQ_POSTED', location: rfq.locationName }
      );

      admins.forEach(a => {
        dataService.createNotification(a.id, "🚀 New Query Posted", `Customer posted: ${rfq.title}`, "INFO", UserRole.ADMIN, `/rfq/${rfq.id}`);
      });
    }
  },

  deleteRFQ: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.RFQS, id));
  },

  updateRFQStatus: async (rfqId: string, status: RFQ['status'], actor: User) => {
    const rfqRef = doc(db, COLLECTIONS.RFQS, rfqId);
    const rfqSnap = await getDoc(rfqRef);
    if (!rfqSnap.exists()) return;
    const rfq = rfqSnap.data() as RFQ;

    await updateDoc(rfqRef, { status });

    await dataService.createAuditLog({
      admin: actor,
      title: `RFQ ${rfq.idDisplay} transitioned to ${status}`,
      type: "WORKFLOW_TRANSITION",
      severity: "LOW",
      icon: "swap_horiz",
      iconBg: "bg-blue-500",
      eventId: rfqId
    });

    if (status === 'COMPLETED' || status === 'CANCELED') {
      await dataService.createNotification(
        rfq.customerId,
        status === 'COMPLETED' ? "🎉 Project Finished" : "🚫 Query Canceled",
        `Your query ${rfq.idDisplay} has been marked as ${status.toLowerCase()}.`,
        status === 'COMPLETED' ? "SUCCESS" : "INFO",
        UserRole.CUSTOMER
      );
    }

    if (status === 'COMPLETED' && rfq.acceptedQuoteId) {
      const quoteSnap = await getDoc(doc(db, COLLECTIONS.QUOTES, rfq.acceptedQuoteId));
      if (quoteSnap.exists()) {
        const quote = quoteSnap.data() as Quote;
        await dataService.createNotification(
          quote.providerId,
          "✅ Client marked project as Completed",
          `Well done! "${rfq.title}" is now finished. Check your ratings soon.`,
          "SUCCESS",
          UserRole.PROVIDER
        );
      }
    }
  },

  // --- QUOTES & REVIEWS ---

  getQuotes: async (): Promise<Quote[]> => {
    const snap = await getDocs(collection(db, COLLECTIONS.QUOTES));
    return snap.docs.map(doc => ({ ...doc.data() as any, id: doc.id } as Quote));
  },

  listenToQuotes: (callback: (quotes: Quote[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.QUOTES), (s: any) => callback(s.docs.map((d: any) => ({ ...d.data() as any, id: d.id } as Quote))));
  },

  markQuoteAsAccepted: async (quoteId: string, rfqId: string) => {
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTIONS.QUOTES, quoteId), { status: 'ACCEPTED' });
    batch.update(doc(db, COLLECTIONS.RFQS, rfqId), { status: 'ACCEPTED', acceptedQuoteId: quoteId });
    await batch.commit();

    const rfqSnap = await getDoc(doc(db, COLLECTIONS.RFQS, rfqId));
    const quoteSnap = await getDoc(doc(db, COLLECTIONS.QUOTES, quoteId));
    
    if (rfqSnap.exists() && quoteSnap.exists()) {
      const rfq = rfqSnap.data() as RFQ;
      const quote = quoteSnap.data() as Quote;
      
      await dataService.createNotification(rfq.customerId, "🤝 Expert Hired", `You have accepted ${quote.providerName}'s bid. Opening secure chat...`, "SUCCESS", UserRole.CUSTOMER);
      await dataService.createNotification(quote.providerId, "🏆 Bid Accepted!", `Great news! A client accepted your proposal for ${rfq.title}.`, "SUCCESS", UserRole.PROVIDER, `/chat/${rfq.customerId}`);

      // Integration with Template System: Provider Win Notification
      const { EmailDispatcher } = await import('../../AlertsEngine/email_template/EmailDispatcher');
      await EmailDispatcher.send([quote.providerId], 'BID_WON', { title: rfq.title, customerName: rfq.customerName || 'A Customer' });
    }
  },

  saveQuote: async (quote: Quote) => {
    const batch = writeBatch(db);
    const quoteRef = doc(db, COLLECTIONS.QUOTES, quote.id);
    const rfqRef = doc(db, COLLECTIONS.RFQS, quote.rfqId);
    
    batch.set(quoteRef, quote, { merge: true });
    batch.update(rfqRef, { quotesCount: increment(1), status: 'ACTIVE' });
    await batch.commit();

    const rfqSnap = await getDoc(rfqRef);
    if (rfqSnap.exists()) {
      const rfq = rfqSnap.data() as RFQ;
      await dataService.createNotification(
        rfq.customerId,
        "💰 New Proposal Received",
        `${quote.providerName} quoted AED ${quote.price} for your request.`,
        "SUCCESS",
        UserRole.CUSTOMER,
        `/rfq/${rfq.id}`
      );
    }
  },

  getReviews: async (providerId: string): Promise<Review[]> => {
    const q = query(collection(db, COLLECTIONS.REVIEWS), where('providerId', '==', providerId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ ...doc.data() as any, id: doc.id } as Review));
  },

  submitReview: async (review: Review, providerId: string) => {
    await setDoc(doc(db, COLLECTIONS.REVIEWS, review.id), review);
    
    await dataService.createNotification(
      providerId,
      "⭐ Client Rated You",
      `You received a ${review.rating}-star rating! View details in your storefront.`,
      "SUCCESS",
      UserRole.PROVIDER,
      "/storefront"
    );

    const admins = (await dataService.getUsers()).filter(u => u.role === UserRole.ADMIN);
    admins.forEach(a => {
       dataService.createNotification(a.id, "📢 Review Posted", `Rating of ${review.rating} stars given to Provider ${providerId}`, "INFO", UserRole.ADMIN);
    });
  },

  listenToReviewsByProvider: (providerId: string, callback: (reviews: Review[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.REVIEWS), where('providerId', '==', providerId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s: any) => callback(s.docs.map((d: any) => ({ ...d.data() as any, id: d.id } as Review))));
  },

  listenToAllReviews: (callback: (reviews: Review[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.REVIEWS), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s: any) => callback(s.docs.map((d: any) => ({ ...d.data() as any, id: d.id } as Review))));
  },

  deleteReview: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.REVIEWS, id));
  },

  // --- CORE DATA ACCESS ---

  getUserById: async (id: string): Promise<User | null> => {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, id));
    return snap.exists() ? ({ ...snap.data() as any, id: snap.id } as User) : null;
  },

  listenToUserById: (id: string, callback: (user: User | null) => void): Unsubscribe => {
    return onSnapshot(doc(db, COLLECTIONS.USERS, id), (s: any) => callback(s.exists() ? ({ ...s.data() as any, id: s.id } as User) : null));
  },

  saveUser: async (user: User) => {
    await setDoc(doc(db, COLLECTIONS.USERS, user.id), user, { merge: true });
  },

  getUsers: async (): Promise<User[]> => {
    const snap = await getDocs(collection(db, COLLECTIONS.USERS));
    return snap.docs.map(doc => ({ ...doc.data() as any, id: doc.id } as User));
  },

  listenToUsers: (callback: (users: User[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.USERS), (s: any) => callback(s.docs.map((d: any) => ({ ...d.data() as any, id: d.id } as User))));
  },

  getRFQs: async (): Promise<RFQ[]> => {
    const q = query(collection(db, COLLECTIONS.RFQS), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ ...doc.data() as any, id: doc.id } as RFQ));
  },

  listenToRFQs: (callback: (rfqs: RFQ[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.RFQS), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s: any) => callback(s.docs.map((d: any) => ({ ...d.data() as any, id: d.id } as RFQ))));
  },

  listenToRFQById: (id: string, callback: (rfq: RFQ | null) => void): Unsubscribe => {
    return onSnapshot(doc(db, COLLECTIONS.RFQS, id), (s: any) => callback(s.exists() ? ({ ...s.data() as any, id: s.id } as RFQ) : null));
  },

  listenToRFQMatches: (rfqId: string, callback: (matches: any[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.RFQS, rfqId, 'matches'), (s: any) => callback(s.docs.map((d: any) => ({ ...d.data() as any, id: d.id }))));
  },

  getQuotesByRFQ: async (rfqId: string): Promise<Quote[]> => {
    const q = query(collection(db, COLLECTIONS.QUOTES), where('rfqId', '==', rfqId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ ...doc.data() as any, id: doc.id } as Quote));
  },

  listenToQuotesByRFQ: (rfqId: string, callback: (quotes: Quote[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.QUOTES), where('rfqId', '==', rfqId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s: any) => callback(s.docs.map((d: any) => ({ ...d.data() as any, id: d.id } as Quote))));
  },

  listenToNotifications: (userId: string, callback: (notifs: AppNotification[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.NOTIFS), where('userId', '==', userId), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (s: any) => callback(s.docs.map((d: any) => ({ ...d.data() as any, id: d.id } as AppNotification))));
  },

  markNotificationAsRead: async (id: string) => {
    await updateDoc(doc(db, COLLECTIONS.NOTIFS, id), { isRead: true });
  },

  markAllNotificationsAsRead: async (userId: string) => {
    const q = query(collection(db, COLLECTIONS.NOTIFS), where('userId', '==', userId), where('isRead', '==', false));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { isRead: true }));
    await batch.commit();
  },

  getCategories: async (): Promise<ServiceCategory[]> => {
    const snap = await getDocs(collection(db, COLLECTIONS.CATS));
    return snap.docs.map(doc => ({ ...doc.data() as any, id: doc.id } as ServiceCategory));
  },

  saveCategories: async (categories: ServiceCategory[]) => {
    const batch = writeBatch(db);
    for (const cat of categories) {
      batch.set(doc(db, COLLECTIONS.CATS, cat.id), cat, { merge: true });
    }
    await batch.commit();
  },

  listenToCategories: (callback: (cats: ServiceCategory[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.CATS), (s: any) => callback(s.docs.map((d: any) => ({ ...d.data() as any, id: d.id } as ServiceCategory))));
  },

  getSettings: async (): Promise<any> => {
    const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'global'));
    return snap.exists() ? snap.data() : { siteName: 'Town Hall UAE' };
  },

  saveSettings: async (settings: any) => {
    await setDoc(doc(db, COLLECTIONS.SETTINGS, 'global'), settings, { merge: true });
  },

  listenToProviderRequests: (callback: (requests: ProviderRequest[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.PROVIDER_REQUESTS), (s: any) => callback(s.docs.map((d: any) => ({ ...d.data() as any, id: d.id } as ProviderRequest))));
  },

  getProviderRequestById: async (id: string): Promise<ProviderRequest | null> => {
    const snap = await getDoc(doc(db, COLLECTIONS.PROVIDER_REQUESTS, id));
    return snap.exists() ? ({ ...snap.data() as any, id: snap.id } as ProviderRequest) : null;
  },

  saveProviderRequest: async (req: ProviderRequest) => {
    await setDoc(doc(db, COLLECTIONS.PROVIDER_REQUESTS, req.id), req, { merge: true });
  },

  updateProviderRequestStatus: async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await updateDoc(doc(db, COLLECTIONS.PROVIDER_REQUESTS, id), { status });
  },

  createAuditLog: async (params: any) => {
    const id = `log_${Date.now()}`;
    await setDoc(doc(db, COLLECTIONS.AUDIT_LOGS, id), { ...params, id, timestamp: new Date().toISOString() });
  },

  listenToAuditLogs: (callback: (logs: AuditLogEntry[]) => void, logLimit: number, startDate: string): Unsubscribe => {
    const q = query(
      collection(db, COLLECTIONS.AUDIT_LOGS),
      where('timestamp', '>=', startDate),
      orderBy('timestamp', 'desc'),
      limit(logLimit)
    );
    return onSnapshot(q, (s: any) => callback(s.docs.map((d: any) => ({ ...d.data(), id: d.id } as AuditLogEntry))));
  },

  uploadImage: async (file: File | Blob, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  },
};