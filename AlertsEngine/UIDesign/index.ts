import { AppNotification, UserRole } from '../../types';
import { handleAdminAlert } from './Admin';
import { handleProviderAlert } from './Provider';
import { handleCustomerAlert } from './Customer';

export const AlertsEngine = {
  dispatch: (
    notif: AppNotification, 
    role: UserRole, 
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  ) => {
    switch (role) {
      case UserRole.ADMIN:
        handleAdminAlert(notif, showToast);
        break;
      case UserRole.PROVIDER:
        handleProviderAlert(notif, showToast);
        break;
      case UserRole.CUSTOMER:
        handleCustomerAlert(notif, showToast);
        break;
      default:
        showToast(notif.title, 'info');
    }
  }
};