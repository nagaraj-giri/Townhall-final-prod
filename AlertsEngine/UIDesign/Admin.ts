import { AppNotification } from '../../types';

export const handleAdminAlert = (
  notif: AppNotification, 
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
) => {
  const isNewQuery = notif.title.includes('Query');
  const isUrgent = notif.type === 'URGENT' || notif.title.includes('Application');
  const isNewUser = notif.title.includes('User Joined');

  if (isNewUser) {
    // Unique celebratory success for community growth
    showToast(`🎉 WELCOME: ${notif.message}`, 'success');
  } else if (isNewQuery) {
    // Premium treatment for potential revenue activities
    showToast(`🚀 MARKETPLACE: ${notif.message}`, 'success');
  } else if (isUrgent) {
    showToast(`⚡ ${notif.title.toUpperCase()}: ${notif.message}`, 'error');
  } else if (notif.type === 'WARNING') {
    showToast(`⚠️ SYSTEM: ${notif.message}`, 'info');
  } else {
    showToast(`${notif.title}: ${notif.message}`, 'info');
  }
};