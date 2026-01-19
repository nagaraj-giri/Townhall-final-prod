import { AppNotification } from '../../../types';

export const providerAlerts = {
  handleNotification: (notif: AppNotification, showToast: any) => {
    // Lead Discovery Notifications
    if (notif.title.includes('Opportunity') || notif.title.includes('Lead') || notif.title.includes('Market Query')) {
      showToast(`🎯 NEW LEAD: ${notif.message}`, 'success');
    } 
    // Booking/Hiring Success
    else if (notif.title.includes('Hired') || notif.title.includes('Accepted')) {
      showToast(`🏆 CONGRATS! ${notif.message}`, 'success');
    } 
    // Chat Communication
    else if (notif.title.includes('Message') || notif.title.includes('💬')) {
      showToast(`💬 CLIENT REPLY: ${notif.message}`, 'info');
    } 
    // Fallback
    else {
      showToast(`${notif.title}: ${notif.message}`, 'info');
    }
    
    console.debug(`[ProviderAlerts] Handled for Provider: ${notif.title}`);
  }
};