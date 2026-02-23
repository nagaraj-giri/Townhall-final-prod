const admin = require('firebase-admin');

async function createNotification(userId, title, message, type = 'INFO', actionUrl = '') {
  const id = `notif_msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  return admin.firestore().collection('notifications').doc(id).set({
    id, 
    userId, 
    title, 
    message, 
    type, 
    isRead: false, 
    timestamp: new Date().toISOString(), 
    actionUrl, 
    targetRole: 'USER'
  });
}

exports.onNewMessage = async (snap, context) => {
  const msg = snap.data();
  const roomId = context.params.roomId;
  
  // roomId is standardized as uid1_uid2
  const participants = roomId.split('_');
  const recipientId = participants.find(id => id !== msg.senderId);

  if (!recipientId) return null;

  const senderDoc = await admin.firestore().collection('users').doc(msg.senderId).get();
  const senderName = senderDoc.exists ? senderDoc.data().name : 'Partner';

  return createNotification(
    recipientId,
    `💬 New Message from ${senderName}`,
    msg.text.length > 50 ? `${msg.text.substring(0, 50)}...` : msg.text,
    'INFO',
    `/messages/${msg.senderId}`
  );
};