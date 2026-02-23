const admin = require('firebase-admin');

async function createNotification(userId, title, message, type = 'INFO', actionUrl = '') {
  const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  return admin.firestore().collection('notifications').doc(id).set({
    id, userId, title, message, type, isRead: false, timestamp: new Date().toISOString(), actionUrl, targetRole: 'CUSTOMER'
  });
}

exports.onQuoteCreate = async (snap) => {
  const quote = snap.data();
  const db = admin.firestore();
  
  // 1. Fetch Contextual Data
  const rfqDoc = await db.collection('rfqs').doc(quote.rfqId).get();
  if (!rfqDoc.exists) return;
  
  const rfq = rfqDoc.data();
  const customerDoc = await db.collection('users').doc(rfq.customerId).get();
  if (!customerDoc.exists) return;
  
  const customer = customerDoc.data();

  // 2. In-App Alert
  await createNotification(
    rfq.customerId, 
    '💰 New Quote Received', 
    `${quote.providerName} sent a price for "${rfq.title}".`, 
    'SUCCESS', 
    `/rfq/${quote.rfqId}`
  );

  // 3. Email Trigger (Trigger Email Extension)
  await db.collection('emails').add({
    to: customer.email,
    message: {
      subject: `💰 New Quote for ${rfq.title}`,
      html: `
        <p><strong>${quote.providerName}</strong> has submitted a bid for your request.</p>
        <p>Bid Amount: <strong>AED ${quote.price}</strong></p>
        <a href="https://townhall.sbs/#/rfq/${rfq.id}">View Proposal</a>
      `
    },
    metadata: { rfqId: rfq.id, quoteId: quote.id }
  });

  // 4. System Push (FCM)
  if (customer.fcmTokens && customer.fcmTokens.length > 0) {
    const payload = {
      notification: {
        title: '💰 New Quote Received',
        body: `${quote.providerName} bid AED ${quote.price} for your request.`
      },
      data: {
        actionUrl: `/rfq/${quote.rfqId}`,
        type: 'NEW_QUOTE'
      }
    };
    
    try {
      await admin.messaging().sendEachForMulticast({
        tokens: customer.fcmTokens,
        ...payload
      });
    } catch (err) {
      console.error("FCM dispatch failed for customer:", err);
    }
  }
};