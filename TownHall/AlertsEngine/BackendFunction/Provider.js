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

// Triggered when a new RFQ is posted or discovery range expands
exports.onNewLeadMatched = async (snap) => {
  const rfq = snap.data();
  const db = admin.firestore();
  const serviceRequired = rfq.service;

  // Query verified providers who specialize in this specific service stream
  const providersQuery = await db.collection('users')
    .where('role', '==', 'PROVIDER')
    .where('isVerified', '==', true)
    .where('services', 'array-contains', serviceRequired)
    .get();

  if (providersQuery.empty) return null;

  const tasks = [];

  for (const doc of providersQuery.docs) {
    const p = doc.data();
    const providerId = doc.id;

    // 1. In-App Notification
    tasks.push(createNotification(
      providerId, 
      '🎯 NEW LEAD: Discovery Match', 
      `A new request for "${rfq.title}" is available in ${rfq.locationName}.`, 
      'INFO', 
      `/rfq/${rfq.id}`
    ));

    // 2. Email Dispatch
    if (p.email) {
      tasks.push(db.collection('emails').add({
        to: p.email,
        message: {
          subject: `🎯 New Lead Match: ${rfq.service}`,
          html: `
            <h3>New Opportunity Found</h3>
            <p>A customer in <strong>${rfq.locationName}</strong> is looking for ${rfq.service}.</p>
            <p>Title: ${rfq.title}</p>
            <a href="https://townhall.sbs/#/rfq/${rfq.id}">Submit Your Bid Now</a>
          `
        }
      }));
    }

    // 3. System Push (FCM)
    if (p.fcmTokens && p.fcmTokens.length > 0) {
      const payload = {
        notification: {
          title: '🎯 New Lead Match',
          body: `${rfq.title} in ${rfq.locationName}`
        },
        data: {
          actionUrl: `/rfq/${rfq.id}`,
          type: 'LEAD_MATCH'
        }
      };

      tasks.push(
        admin.messaging().sendEachForMulticast({
          tokens: p.fcmTokens,
          ...payload
        }).catch(err => console.error(`FCM failed for provider ${providerId}:`, err))
      );
    }
  }

  return Promise.all(tasks);
};

exports.onQuoteAccepted = async (change) => {
  const newData = change.after.data();
  const prevData = change.before.data();
  
  // Real-time alert when a provider wins a bid
  if (newData.status === 'ACCEPTED' && prevData.status !== 'ACCEPTED') {
    const providerDoc = await admin.firestore().collection('users').doc(newData.providerId).get();
    const provider = providerDoc.exists ? providerDoc.data() : null;

    // In-App
    await createNotification(
      newData.providerId, 
      '🏆 CONGRATULATIONS: You are Hired!', 
      `Your proposal for "${newData.rfqId}" was accepted. Start chatting now.`, 
      'SUCCESS', 
      `/messages/${newData.customerId}`
    );

    // Push Notification
    if (provider && provider.fcmTokens && provider.fcmTokens.length > 0) {
      await admin.messaging().sendEachForMulticast({
        tokens: provider.fcmTokens,
        notification: {
          title: '🏆 You are Hired!',
          body: `The client has accepted your proposal for query ${newData.rfqId}.`
        },
        data: { actionUrl: `/messages/${newData.customerId}` }
      });
    }
  }
};