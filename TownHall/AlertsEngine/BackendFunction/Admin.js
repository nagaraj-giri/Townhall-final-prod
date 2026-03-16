const admin = require('firebase-admin');
const { logger } = require("firebase-functions");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

/**
 * Creates in-app (bell-icon) notifications for all admins when a new RFQ is created.
 */
exports.onRFQCreate = onDocumentCreated("rfqs/{rfqId}", async (event) => {
  const rfq = event.data.data();
  const rfqId = event.params.rfqId;
  try {
    // 1. Get all admin users
    const adminsSnap = await admin.firestore().collection("users").where("role", "==", "ADMIN").get();
    if (adminsSnap.empty) {
      logger.warn("onRFQCreate: No admin users found to notify.");
      return;
    }

    // 2. Create a batch to write all notifications at once
    const batch = admin.firestore().batch();
    const title = '🚀 New Marketplace Query';
    const message = `${rfq.customerName || 'A customer'} posted: "${rfq.title}"`;
    const actionUrl = `/admin/rfq/${rfqId}`;

    adminsSnap.forEach(adminDoc => {
      const notifRef = admin.firestore().collection("notifications").doc();
      batch.set(notifRef, { id: notifRef.id, userId: adminDoc.id, title, message, type: 'URGENT', targetRole: 'ADMIN', actionUrl, isRead: false, timestamp: new Date().toISOString() });
    });

    // 3. Commit the batch
    await batch.commit();
    logger.log(`Successfully created bell-icon alerts for ${adminsSnap.size} admins for RFQ ${rfqId}.`);
  } catch (error) {
    logger.error('Error creating admin bell-icon alerts for new RFQ:', { rfqId, error });
  }
});

exports.onProviderRequestCreate = onDocumentCreated("provider_requests/{reqId}", async (event) => {
  const req = event.data.data();
  const message = {
    notification: {
      title: '🏪 New Provider Application',
      body: `${req.businessName} has applied for verification.`
    },
    data: {
      actionUrl: `/admin/provider-request/${req.id}`,
      type: 'ADMIN_ALERT'
    },
    topic: 'admin_alerts'
  };
  try {
    await admin.messaging().send(message);
    console.log('Successfully sent provider application alert to admin_alerts topic.');
  } catch (error) {
    console.error('Error sending provider application alert to admin_alerts topic:', error);
  }
});

exports.onUserCreate = onDocumentCreated("users/{userId}", async (event) => {
  const user = event.data.data();
  const role = user.role || 'CUSTOMER';

  // If a new admin is created, subscribe them to the alerts topic.
  if (role === 'ADMIN' && user.fcmTokens && user.fcmTokens.length > 0) {
    try {
      await admin.messaging().subscribeToTopic(user.fcmTokens, 'admin_alerts');
      console.log('Successfully subscribed new admin to admin_alerts topic.');
    } catch (error) {
      console.error('Error subscribing new admin to admin_alerts topic:', error);
    }
  }
});