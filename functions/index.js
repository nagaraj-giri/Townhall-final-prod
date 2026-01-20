const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const fcm = admin.messaging();

/**
 * Dispatcher: Writes to Firestore (Bell Tray) and sends FCM Push
 */
async function notifyUser({userId, title, message, type = 'INFO', actionUrl = ''}) {
  if (!userId) return null;

  try {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    // 1. Create document for the Bell Icon Tray
    await db.collection('notifications').doc(notifId).set({
      id: notifId,
      userId: userId,
      title: title,
      message: message,
      type: type,
      isRead: false,
      timestamp: new Date().toISOString(),
      actionUrl: actionUrl
    });

    // 2. Send System Push Notification via FCM
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      const tokens = userData.fcmTokens || [];
      if (tokens.length > 0) {
        const payload = {
          notification: {title, body: message},
          data: {actionUrl},
          tokens: tokens
        };
        await fcm.sendEachForMulticast(payload);
      }
    }
  } catch (error) {
    console.error(`[NotificationSystem] Error for user ${userId}:`, error);
  }
  return null;
}

/**
 * TRIGGER: New Query -> Notify Matching Providers
 */
exports.onRFQCreated = functions.firestore.document('rfqs/{rfqId}').onCreate(async (snap) => {
  const rfq = snap.data();
  const displayLoc = (rfq.locationName || 'Dubai, UAE').split(',')[0];
  
  const providers = await db.collection('users')
    .where('role', '==', 'PROVIDER')
    .where('services', 'array-contains', rfq.service)
    .get();

  const notifications = providers.docs.map((doc) => 
    notifyUser({
      userId: doc.id,
      title: '🎯 NEW LEAD MATCHED',
      message: `A client needs "${rfq.title}" near ${displayLoc}.`,
      type: 'SUCCESS',
      actionUrl: `/rfq/${rfq.id}`
    })
  );

  return Promise.all(notifications);
});

/**
 * TRIGGER: New Quote -> Notify Customer
 */
exports.onQuoteCreated = functions.firestore.document('quotes/{quoteId}').onCreate(async (snap) => {
  const quote = snap.data();
  const rfqSnap = await db.collection('rfqs').doc(quote.rfqId).get();
  if (!rfqSnap.exists) return null;
  
  const rfq = rfqSnap.data();
  return notifyUser({
    userId: rfq.customerId,
    title: '💰 NEW QUOTE RECEIVED',
    message: `${quote.providerName} quoted ${quote.price} AED for your request.`,
    type: 'SUCCESS',
    actionUrl: `/rfq/${rfq.id}`
  });
});

/**
 * TRIGGER: New Message -> Notify Recipient
 */
exports.onMessageCreated = functions.firestore.document('chats/{roomId}/history/{msgId}').onCreate(async (snap, context) => {
  const msg = snap.data();
  const roomId = context.params.roomId;
  const participants = roomId.split('_');
  const recipientId = participants.find((id) => id !== msg.senderId);

  if (!recipientId) return null;

  const senderSnap = await db.collection('users').doc(msg.senderId).get();
  const senderName = senderSnap.exists ? senderSnap.data().name : 'Partner';

  return notifyUser({
    userId: recipientId,
    title: `💬 MESSAGE FROM ${senderName.toUpperCase()}`,
    message: msg.text.length > 50 ? `${msg.text.substring(0, 50)}...` : msg.text,
    type: 'INFO',
    actionUrl: `/messages/${msg.senderId}`
  });
});

/**
 * TRIGGER: Provider Applied -> Notify Admins
 */
exports.onProviderRequest = functions.firestore.document('provider_requests/{id}').onCreate(async (snap) => {
  const req = snap.data();
  const admins = await db.collection('users').where('role', '==', 'ADMIN').get();
  
  const notifications = admins.docs.map((doc) => 
    notifyUser({
      userId: doc.id,
      title: '🏪 NEW BUSINESS VERIFICATION',
      message: `${req.businessName} has applied to join Town Hall.`,
      type: 'URGENT',
      actionUrl: `/admin/provider-request/${snap.id}`
    })
  );

  return Promise.all(notifications);
});