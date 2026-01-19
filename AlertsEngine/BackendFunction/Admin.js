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
    targetRole: 'ADMIN'
  });
}

exports.onRFQCreate = async (snap) => {
  const rfq = snap.data();
  const admins = await admin.firestore().collection('users').where('role', '==', 'ADMIN').get();
  return Promise.all(admins.docs.map(doc => 
    createNotification(
      doc.id, 
      '🚀 New Marketplace Query', 
      `${rfq.customerName || 'A customer'} posted: "${rfq.title}"`, 
      'URGENT', 
      `/rfq/${rfq.id}`
    )
  ));
};

exports.onProviderRequestCreate = async (snap) => {
  const req = snap.data();
  const admins = await admin.firestore().collection('users').where('role', '==', 'ADMIN').get();
  return Promise.all(admins.docs.map(doc => 
    createNotification(
      doc.id, 
      '🏪 New Provider Application', 
      `${req.businessName} has applied for verification.`, 
      'URGENT', 
      `/admin/provider-request/${req.id}`
    )
  ));
};

exports.onUserCreate = async (snap) => {
  const user = snap.data();
  const role = user.role || 'CUSTOMER';

  // Don't notify if the user being created is an admin
  if (role === 'ADMIN') return null;

  const admins = await admin.firestore().collection('users').where('role', '==', 'ADMIN').get();
  const roleLabel = role === 'PROVIDER' ? 'Provider' : 'Customer';

  return Promise.all(admins.docs.map(doc => 
    createNotification(
      doc.id, 
      '👤 New User Registered', 
      `${user.name || 'A new user'} joined the platform as a ${roleLabel}.`, 
      'INFO', 
      `/admin/user/${user.id}`
    )
  ));
};