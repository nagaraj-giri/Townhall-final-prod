
import { dataService } from '../../pages/services/dataService';
import { EMAIL_TEMPLATES, BASE_URL } from './templates';

/**
 * Town Hall UAE - Atomic Bulk Email Dispatcher
 * Aligned with AIRRA Phased Matching v1.2
 */
export const EmailDispatcher = {
  
  /**
   * Dispatches a single email document containing ALL recipients for a specific phase.
   */
  sendBulkPhasedEmail: async (
    recipientEmails: string[], 
    data: any,
    rfqId: string
  ) => {
    try {
      const config = await dataService.getEmailConfig();
      const phaseLabel = data.phaseLabel || "Lead Discovery";
      
      // Global suppression check
      if (config.triggers && config.triggers["NEW_LEAD"]?.email === false) return;

      const templateGenerator = EMAIL_TEMPLATES["NEW_LEAD"];
      // @ts-ignore
      const template = templateGenerator(data);
      
      const override = config.templateOverrides?.["NEW_LEAD"];
      const finalSubject = `${override?.subject || template.data.Subject} [${phaseLabel}]`;
      const finalHtmlBody = override?.html || template.data.html;

      // Create EXACTLY ONE document with multiple recipients in the 'to' array
      await dataService.sendTemplatedEmail({
        to: recipientEmails,
        metadata: {
          rfqId,
          phase: phaseLabel,
          batchType: "AIRRA_PHASED_MATCH",
          triggeredAt: new Date().toISOString()
        },
        message: {
          subject: finalSubject,
          html: `
            <div style="font-family: sans-serif; padding: 40px 20px; color: #333; max-width: 550px; margin: 0 auto; border-radius: 40px; background-color: #ffffff; border: 1px solid #eee;">
              <div style="text-align: center; margin-bottom: 40px;">
                <img src="https://firebasestorage.googleapis.com/v0/b/townhall-io.firebasestorage.app/o/logo%20townhall.png?alt=media" width="120" alt="Town Hall UAE">
              </div>
              <div style="padding: 0 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                   <span style="background: #EBE7F5; color: #5B3D9D; font-size: 11px; font-weight: 900; padding: 6px 16px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1.5px;">
                     ${phaseLabel} DISCOVERY ACTIVE
                   </span>
                </div>
                ${finalHtmlBody}
                <div style="margin-top: 40px; text-align: center;">
                  <a href="${template.data.buttonUrl}" style="background-color: #5B3D9D; color: #ffffff; padding: 18px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 14px; display: inline-block;">
                    Submit Your Bid Now
                  </a>
                </div>
              </div>
              <div style="margin-top: 60px; border-top: 1px solid #f5f5f5; padding-top: 30px; text-align: center; color: #ccc; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">
                Town Hall UAE • UAE's Premium Marketplace
              </div>
            </div>
          `
        }
      });
      
      console.debug(`[AIRRA Email] Phased Bulk Doc Created for ${recipientEmails.length} providers.`);
    } catch (error) {
      console.error(`[EmailEngine] Bulk dispatch failed:`, error);
    }
  }
};
