
import { dataService } from '../../pages/services/dataService';
import { EMAIL_TEMPLATES } from './templates';

/**
 * Dispatcher for all templated emails.
 * Connects the app scenarios to the standard MAIL_COLLECTION expected by the Trigger Email extension.
 */
export const EmailDispatcher = {
  
  /**
   * Generic send function that maps a template name to Firestore payload.
   */
  send: async (
    targetUids: string[], 
    templateName: keyof typeof EMAIL_TEMPLATES, 
    data: any
  ) => {
    try {
      const templateGenerator = EMAIL_TEMPLATES[templateName];
      // @ts-ignore - Handle function invocation with specific data
      const payload = templateGenerator(data);

      // We append targetUids for the Firebase Extension to resolve if needed, 
      // or we can resolve emails directly in dataService.
      await dataService.sendTemplatedEmail({
        toUids: targetUids,
        template: payload
      });

      console.debug(`[EmailDispatcher] Dispatched: ${templateName} to ${targetUids.join(',')}`);
    } catch (error) {
      console.error(`[EmailDispatcher] Error dispatching ${templateName}:`, error);
    }
  }
};
