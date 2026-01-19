import { AppNotification } from '../../../types';

export const customerAlerts = {
  handleNotification: (notif: AppNotification, showToast: any) => {
    // Quote/Proposal Received
    if (notif.title.includes('Proposal') || notif.title.includes('Quote') || notif.title.includes('💰')) {
      showToast(`💰 NEW PROPOSAL: ${notif.message}`, 'success');
    } 
    // Chat from Provider
    else if (notif.title.includes('Message') || notif.title.includes('💬')) {
      showToast(`📨 PROVIDER UPDATE: ${notif.message}`, 'info');
    } 
    // System Updates
    else {
      showToast(`Update: ${notif.message}`, 'info');
    }
    
    console.debug(`[CustomerAlerts] Handled for Customer: ${notif.title}`);
  }
};