import { AppNotification, UserRole } from '../../../types';
import { adminAlerts } from './AdminAlerts';
import { providerAlerts } from './ProviderAlerts';
import { customerAlerts } from './CustomerAlerts';

/**
 * Global Dispatcher for real-time notifications.
 * Routes incoming Firestore notification documents to role-specific 
 * frontend handlers that manage Toasts, Popups, and sounds.
 */
export const NotificationDispatcher = {
  dispatch: (notif: AppNotification, role: UserRole, showToast: (msg: string, type?: 'success' | 'error' | 'info') => void) => {
    console.log(`[Dispatcher] Routing notification to ${role} handler`);
    
    switch (role) {
      case UserRole.ADMIN:
        adminAlerts.handleNotification(notif, showToast);
        break;
      case UserRole.PROVIDER:
        providerAlerts.handleNotification(notif, showToast);
        break;
      case UserRole.CUSTOMER:
        customerAlerts.handleNotification(notif, showToast);
        break;
      default:
        // Fallback for generic notifications
        showToast(notif.title, 'info');
    }
  }
};