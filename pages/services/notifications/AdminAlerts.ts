import { AppNotification } from '../../../types';

export const adminAlerts = {
  handleNotification: (notif: AppNotification, showToast: any) => {
    // High Priority Actions
    if (notif.type === 'URGENT' || notif.title.includes('Application') || notif.title.includes('Partnership')) {
      showToast(`⚡ ADMIN ALERT: ${notif.message}`, 'error');
    } 
    // Platform Monitoring
    else if (notif.type === 'WARNING') {
      showToast(`⚠️ SYSTEM WARNING: ${notif.message}`, 'info');
    } 
    // General Logs
    else {
      showToast(`Log: ${notif.title}`, 'info');
    }
    
    console.debug(`[AdminAlerts] Logged in system: ${notif.title}`);
  },

  showSystemNotice: (showToast: any, message: string) => {
    showToast(`📢 System Update: ${message}`, 'info');
  }
};