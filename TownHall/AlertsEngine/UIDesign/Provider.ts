import { AppNotification } from '../../types';

export const handleProviderAlert = (
  notif: AppNotification, 
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
) => {
  if (notif.title.includes('Opportunity') || notif.title.includes('Lead')) {
    showToast(`🎯 NEW LEAD: ${notif.message}`, 'success');
  } else if (notif.title.includes('Hired') || notif.title.includes('Accepted')) {
    showToast(`🏆 HIRED! ${notif.message}`, 'success');
  } else if (notif.title.includes('Message')) {
    showToast(`💬 MESSAGE: ${notif.message}`, 'info');
  } else {
    showToast(notif.title, 'info');
  }
};