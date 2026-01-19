
const admin = require('firebase-admin');

async function createNotification(userId, title, message, type = 'INFO', actionUrl = '') {
  const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  return admin.firestore().collection('notifications').doc(id).set({
    id, 
    userId, 
    title, 
    message, 
    type, 
    isRead: false, 
    timestamp: new Date().toISOString(), 
    actionUrl, 
    targetRole: 'PROVIDER'
  });
}

// Triggered when a new RFQ is posted in the marketplace
exports.onNewLeadMatched = async (snap) => {
  const rfq = snap.data();
  const serviceRequired = rfq.service;

  // Query providers who have this service in their specialized list
  const providersQuery = await admin.firestore()
    .collection('users')
    .where('role', '==', 'PROVIDER')
    .where('services', 'array-contains', serviceRequired)
    .get();

  if (providersQuery.empty) return null;

  return Promise.all(providersQuery.docs.map(doc => 
    createNotification(
      doc.id, 
      '🎯 NEW LEAD: Discovery Match', 
      `A new request for "${rfq.title}" is available in ${rfq.locationName}.`, 
      'INFO', 
      `/rfq/${rfq.id}`
    )
  ));
};

exports.onQuoteAccepted = async (change) => {
  const newData = change.after.data();
  const prevData = change.before.data();
  
  // Real-time alert when a provider wins a bid
  if (newData.status === 'ACCEPTED' && prevData.status !== 'ACCEPTED') {
    return createNotification(
      newData.providerId, 
      '🏆 CONGRATULATIONS: You are Hired!', 
      `Your proposal for "${newData.rfqId}" was accepted. Start chatting now.`, 
      'SUCCESS', 
      `/messages`
    );
  }
};
