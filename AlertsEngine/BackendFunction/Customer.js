const admin = require('firebase-admin');

async function createNotification(userId, title, message, type = 'INFO', actionUrl = '') {
  const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  return admin.firestore().collection('notifications').doc(id).set({
    id, userId, title, message, type, isRead: false, timestamp: new Date().toISOString(), actionUrl, targetRole: 'CUSTOMER'
  });
}

exports.onQuoteCreate = async (snap) => {
  const quote = snap.data();
  const rfqDoc = await admin.firestore().collection('rfqs').doc(quote.rfqId).get();
  if (!rfqDoc.exists) return;
  return createNotification(rfqDoc.data().customerId, '💰 New Quote', `${quote.providerName} sent a price.`, 'SUCCESS', `/rfq/${quote.rfqId}`);
};