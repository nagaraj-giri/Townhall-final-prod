import { AppNotification } from '../../types';

export const handleCustomerAlert = (
  notif: AppNotification, 
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
) => {
  if (notif.title.includes('Proposal') || notif.title.includes('Quote')) {
    showToast(`💰 QUOTE: ${notif.message}`, 'success');
  } else if (notif.title.includes('Message')) {
    showToast(`📨 MESSAGE: ${notif.message}`, 'info');
  } else {
    showToast(notif.message || notif.title, 'info');
  }
};