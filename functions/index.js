
const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const fcm = admin.messaging();

/**
 * EMAIL DISPATCHER
 * Writes to 'emails' collection for the 'Trigger Email from Firestore' extension.
 */
async function queueEmail(to, subject, html, text) {
  if (!to) return null;
  try {
    await db.collection('emails').add({
      to: to,
      message: {
        subject: subject,
        html: html,
        text: text || subject
      },
      delivery: {
        state: 'PENDING',
        startTime: new Date().toISOString()
      },
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EmailSystem] Error queuing email:', error);
  }
  return null;
}

/**
 * NOTIFICATION DISPATCHER (Bell Tray + FCM)
 */
async function notifyUser({userId, title, message, type = 'INFO', actionUrl = ''}) {
  if (!userId) return null;

  try {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
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
 * TRIGGER: User Updated -> Monitor Provider Service Changes
 * Detects if an administrator or system process modified a provider's specialized services.
 */
exports.onUserUpdated = functions.region('us-central1').firestore.document('users/{userId}').onUpdate(async (change, context) => {
  const before = change.before.data();
  const after = change.after.data();

  // Only proceed if the user is a Provider
  if (after.role !== 'PROVIDER') return null;

  // Detect changes in the 'services' array
  const oldServices = JSON.stringify(before.services || []);
  const newServices = JSON.stringify(after.services || []);

  if (oldServices !== newServices) {
    const providerEmail = after.email;
    const providerName = after.name;

    // 1. Notify the Provider
    await queueEmail(
      providerEmail,
      `Service Specialization Update - Town Hall UAE`,
      `<h3>🛠️ Your Service Profile was Updated</h3>
       <p>Hello ${providerName},</p>
       <p>An administrator has modified your authorized service categories on the platform.</p>
       <p><strong>Previous:</strong> ${before.services?.join(', ') || 'None'}</p>
       <p><strong>Updated:</strong> ${after.services?.join(', ') || 'None'}</p>
       <p>If you have questions regarding this change, please contact support.</p>
       <a href="https://townhall-io.web.app/#/profile" style="padding: 10px 20px; background: #5B3D9D; color: white; text-decoration: none; border-radius: 8px;">View Your Profile</a>`
    );

    // 2. Notify all Admins for the Audit Trail
    const admins = await db.collection('users').where('role', '==', 'ADMIN').get();
    const adminNotifs = admins.docs.map(doc => {
      const adminData = doc.data();
      return queueEmail(
        adminData.email,
        `System Alert: Provider Services Modified`,
        `<h3>🛡️ Admin Audit Alert</h3>
         <p>The service profile for <strong>${providerName}</strong> (ID: ${context.params.userId}) has been updated.</p>
         <ul>
           <li><strong>New Services:</strong> ${after.services?.join(', ') || 'None'}</li>
           <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
         </ul>
         <a href="https://townhall-io.web.app/#/admin/user/${context.params.userId}" style="padding: 10px 20px; background: #5B3D9D; color: white; text-decoration: none; border-radius: 8px;">Audit Provider Record</a>`
      );
    });

    await Promise.all(adminNotifs);
    console.log(`[Audit] Service update email dispatched for provider: ${after.name}`);
  }

  return null;
});

/**
 * TRIGGER: New User -> Notify Admins of New Registration
 */
exports.onUserCreated = functions.region('us-central1').firestore.document('users/{userId}').onCreate(async (snap) => {
  const newUser = snap.data();
  if (newUser.role !== 'CUSTOMER') return null;

  const admins = await db.collection('users').where('role', '==', 'ADMIN').get();
  
  const tasks = admins.docs.map(async (doc) => {
    const adminUser = doc.data();
    await notifyUser({
      userId: doc.id,
      title: '🎉 NEW CUSTOMER ONBOARDED',
      message: `${newUser.name} has just joined Town Hall UAE.`,
      type: 'INFO',
      actionUrl: `/admin/user/${snap.id}`
    });

    if (adminUser.email) {
      await queueEmail(
        adminUser.email,
        `Growth Alert: New Customer - ${newUser.name}`,
        `<h3>📈 Platform Growth Update</h3>
         <p>Hello Admin,</p>
         <p>A new customer has registered:</p>
         <ul><li><strong>Name:</strong> ${newUser.name}</li><li><strong>Email:</strong> ${newUser.email}</li></ul>
         <a href="https://townhall-io.web.app/#/admin/user/${snap.id}" style="padding: 10px 20px; background: #5B3D9D; color: white; text-decoration: none; border-radius: 8px;">View User Record</a>`
      );
    }
  });

  return Promise.all(tasks);
});

/**
 * TRIGGER: New Query -> Email & Notify Matching Providers
 */
exports.onRFQCreated = functions.region('us-central1').firestore.document('rfqs/{rfqId}').onCreate(async (snap) => {
  const rfq = snap.data();
  const displayLoc = (rfq.locationName || 'Dubai, UAE').split(',')[0];
  
  const providers = await db.collection('users')
    .where('role', '==', 'PROVIDER')
    .where('services', 'array-contains', rfq.service)
    .get();

  const tasks = providers.docs.map(async (doc) => {
    const provider = doc.data();
    await notifyUser({
      userId: doc.id,
      title: '🎯 NEW LEAD MATCHED',
      message: `A client needs "${rfq.title}" near ${displayLoc}.`,
      type: 'SUCCESS',
      actionUrl: `/rfq/${rfq.id}`
    });

    if (provider.email) {
      await queueEmail(
        provider.email,
        `New Lead: ${rfq.title} in ${displayLoc}`,
        `<h3>🎯 New Opportunity on Town Hall</h3>
         <p>Hello ${provider.name},</p>
         <p>A new request matching your services has been posted: "${rfq.title}" in ${rfq.locationName}.</p>
         <a href="https://townhall-io.web.app/#/rfq/${rfq.id}" style="padding: 10px 20px; background: #5B3D9D; color: white; text-decoration: none; border-radius: 8px;">View Lead Details</a>`
      );
    }
  });

  return Promise.all(tasks);
});

/**
 * TRIGGER: New Quote -> Email & Notify Customer
 */
exports.onQuoteCreated = functions.region('us-central1').firestore.document('quotes/{quoteId}').onCreate(async (snap) => {
  const quote = snap.data();
  const rfqSnap = await db.collection('rfqs').doc(quote.rfqId).get();
  if (!rfqSnap.exists) return null;
  
  const rfq = rfqSnap.data();
  const customerSnap = await db.collection('users').doc(rfq.customerId).get();
  const customer = customerSnap.exists ? customerSnap.data() : null;

  await notifyUser({
    userId: rfq.customerId,
    title: '💰 NEW QUOTE RECEIVED',
    message: `${quote.providerName} quoted ${quote.price} AED for your request.`,
    type: 'SUCCESS',
    actionUrl: `/rfq/${rfq.id}`
  });

  if (customer && customer.email) {
    await queueEmail(
      customer.email,
      `Quote Received: ${quote.price} AED for ${rfq.title}`,
      `<h3>💰 You have a new proposal!</h3>
       <p>Hello ${customer.name}, <strong>${quote.providerName}</strong> has submitted a quote.</p>
       <p style="font-size: 18px; font-weight: bold; color: #5B3D9D;">Price: ${quote.price} AED</p>
       <a href="https://townhall-io.web.app/#/rfq/${rfq.id}" style="padding: 10px 20px; background: #5B3D9D; color: white; text-decoration: none; border-radius: 8px;">Compare Proposals</a>`
    );
  }
  return null;
});

/**
 * TRIGGER: New Message -> Notify Recipient
 */
exports.onMessageCreated = functions.region('us-central1').firestore.document('chats/{roomId}/history/{msgId}').onCreate(async (snap, context) => {
  const msg = snap.data();
  const roomId = context.params.roomId;
  const participants = roomId.split('_');
  const recipientId = participants.find((id) => id !== msg.senderId);

  if (!recipientId) return null;

  const senderSnap = await db.collection('users').doc(msg.senderId).get();
  const senderName = senderSnap.exists ? senderSnap.data().name : 'Partner';

  await notifyUser({
    userId: recipientId,
    title: `💬 MESSAGE FROM ${senderName.toUpperCase()}`,
    message: msg.text.length > 50 ? `${msg.text.substring(0, 50)}...` : msg.text,
    type: 'INFO',
    actionUrl: `/messages/${msg.senderId}`
  });
  return null;
});

/**
 * TRIGGER: Provider Applied -> Notify Admins
 */
exports.onProviderRequest = functions.region('us-central1').firestore.document('provider_requests/{id}').onCreate(async (snap) => {
  const req = snap.data();
  const admins = await db.collection('users').where('role', '==', 'ADMIN').get();
  
  const tasks = admins.docs.map(async (doc) => {
    const adminUser = doc.data();
    await notifyUser({
      userId: doc.id,
      title: '🏪 NEW BUSINESS VERIFICATION',
      message: `${req.businessName} has applied to join Town Hall.`,
      type: 'URGENT',
      actionUrl: `/admin/provider-request/${snap.id}`
    });

    if (adminUser.email) {
      await queueEmail(
        adminUser.email,
        `Action Required: New Provider Application - ${req.businessName}`,
        `<h3>🛡️ Verification Queue Update</h3>
         <p>Entity: ${req.businessName}<br>Contact: ${req.contactPerson}</p>
         <a href="https://townhall-io.web.app/#/admin/provider-request/${snap.id}" style="padding: 10px 20px; background: #FF3B30; color: white; text-decoration: none; border-radius: 8px;">Review Application</a>`
      );
    }
  });

  return Promise.all(tasks);
});
