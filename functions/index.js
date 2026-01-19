
const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const fcm = admin.messaging();

/**
 * UTILITY: Centralized notification creator + Push Dispatcher.
 */
async function createNotification({ userId, title, message, type = 'INFO', actionUrl = '', role = 'USER' }) {
  const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  // 1. Save to Firestore for in-app history
  await db.collection('notifications').doc(id).set({
    id,
    userId,
    title,
    message,
    type,
    isRead: false,
    timestamp: new Date().toISOString(),
    actionUrl,
    targetRole: role
  });

  // 2. Dispatch Real Push Notification via FCM
  const userDoc = await db.collection('users').doc(userId).get();
  if (userDoc.exists) {
    const userData = userDoc.data();
    const tokens = userData.fcmTokens || [];
    
    if (tokens.length > 0) {
      const payload = {
        notification: {
          title: title,
          body: message
        },
        data: {
          actionUrl: actionUrl,
          click_action: "FLUTTER_NOTIFICATION_CLICK" // Standard key for some frameworks, but actionUrl is our custom logic
        }
      };

      try {
        const response = await fcm.sendToDevice(tokens, payload);
        // Optional: Cleanup invalid tokens
        response.results.forEach((result, index) => {
          const error = result.error;
          if (error) {
            console.error('Failure sending notification to', tokens[index], error);
            if (error.code === 'messaging/invalid-registration-token' || 
                error.code === 'messaging/registration-token-not-registered') {
              // Token is invalid, should be removed from DB
            }
          }
        });
      } catch (e) {
        console.error("FCM dispatch error:", e);
      }
    }
  }
}

// 1. ADMIN NOTIFICATIONS
exports.onProviderRequestCreated = functions.firestore.document('provider_requests/{reqId}').onCreate(async (snap) => {
  const req = snap.data();
  const admins = await db.collection('users').where('role', '==', 'ADMIN').get();
  
  return Promise.all(admins.docs.map(doc => 
    createNotification({
      userId: doc.id,
      title: "🏪 New Verification Request",
      message: `${req.businessName} applied for verification.`,
      type: 'URGENT',
      actionUrl: `https://townhall-io.web.app/#/admin/provider-request/${req.id}`,
      role: 'ADMIN'
    })
  ));
});

// 2. PROVIDER NOTIFICATIONS (LEADS & HIRING)
exports.onRFQCreated = functions.firestore.document('rfqs/{rfqId}').onCreate(async (snap) => {
  const rfq = snap.data();
  
  const providers = await db.collection('users')
    .where('role', '==', 'PROVIDER')
    .where('services', 'array-contains', rfq.service)
    .get();
    
  return Promise.all(providers.docs.map(doc => 
    createNotification({
      userId: doc.id,
      title: "🎯 NEW LEAD MATCHED",
      message: `Project for "${rfq.title}" near ${rfq.locationName.split(',')[0]}.`,
      type: 'SUCCESS',
      actionUrl: `https://townhall-io.web.app/#/rfq/${rfq.id}`,
      role: 'PROVIDER'
    })
  ));
});

exports.onQuoteAccepted = functions.firestore.document('rfqs/{rfqId}').onUpdate(async (change) => {
  const newData = change.after.data();
  const prevData = change.before.data();

  if (newData.status === 'ACCEPTED' && prevData.status !== 'ACCEPTED' && newData.acceptedQuoteId) {
    const quoteSnap = await db.collection('quotes').doc(newData.acceptedQuoteId).get();
    if (quoteSnap.exists) {
      const quote = quoteSnap.data();
      return createNotification({
        userId: quote.providerId,
        title: "🏆 YOU'VE BEEN HIRED!",
        message: `Your quote for "${newData.title}" was accepted by the client.`,
        type: 'SUCCESS',
        actionUrl: `https://townhall-io.web.app/#/rfq/${newData.id}`,
        role: 'PROVIDER'
      });
    }
  }
  return null;
});

// 3. CUSTOMER NOTIFICATIONS
exports.onQuoteCreated = functions.firestore.document('quotes/{quoteId}').onCreate(async (snap) => {
  const quote = snap.data();
  const rfqSnap = await db.collection('rfqs').doc(quote.rfqId).get();
  
  if (!rfqSnap.exists) return null;
  const rfq = rfqSnap.data();

  return createNotification({
    userId: rfq.customerId,
    title: "💰 New Price Proposal",
    message: `${quote.providerName} sent a quote for ${quote.price} AED.`,
    type: 'SUCCESS',
    actionUrl: `https://townhall-io.web.app/#/rfq/${quote.rfqId}`,
    role: 'CUSTOMER'
  });
});

// 4. CHAT NOTIFICATIONS
exports.onChatMessageCreated = functions.firestore.document('chats/{roomId}/history/{msgId}').onCreate(async (snap, context) => {
  const msg = snap.data();
  const roomId = context.params.roomId;
  const participants = roomId.split('_');
  const recipientId = participants.find(id => id !== msg.senderId);

  if (!recipientId) return null;

  const senderSnap = await db.collection('users').doc(msg.senderId).get();
  const senderName = senderSnap.exists ? senderSnap.data().name : 'User';

  return createNotification({
    userId: recipientId,
    title: `💬 New Message from ${senderName}`,
    message: msg.text.length > 50 ? `${msg.text.substring(0, 50)}...` : msg.text,
    type: 'INFO',
    actionUrl: `https://townhall-io.web.app/#/messages/${msg.senderId}`,
    role: 'USER'
  });
});
