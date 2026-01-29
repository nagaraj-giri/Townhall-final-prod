import { UserRole } from '../../types';

export interface EmailTemplateResult {
  name: string;
  recipientRole: UserRole | 'SYSTEM_ADMIN';
  helperText: string;
  data: {
    Subject: string;
    html: string;
    buttonLabel?: string;
    buttonUrl?: string;
  };
}

// Export BASE_URL for usage in the global email dispatcher and other template engines
export const BASE_URL = "https://townhall.sbs/";
const COLORS = {
  primary: '#5B3D9D',
  secondary: '#FFD60A',
  green: '#8BC34A',
  pink: '#FF69B4',
  text: '#333333',
  light: '#888888',
  bg: '#FAF9F6'
};

/**
 * Town Hall UAE - Central Template Repository
 * Filtered to retain ONLY Provider triggers as per updated strategy.
 */
export const EMAIL_TEMPLATES = {
  // --- PROVIDER SCENARIOS (RETAINED) ---

  NEW_LEAD: (data: { title: string, location: string, id: string }): EmailTemplateResult => ({
    name: "Lead Discovery Alert",
    recipientRole: UserRole.PROVIDER,
    helperText: "High-priority alert sent to matching experts within the operational radius.",
    data: {
      Subject: "🎯 New Opportunity: A lead matches your expertise",
      html: `
        <h2 style="color: ${COLORS.primary}; font-weight: 900; text-transform: uppercase; margin-bottom: 15px; text-align: center;">New Lead Found</h2>
        <p style="color: ${COLORS.text}; line-height: 1.6;">A customer has just posted a request matching your expertise: <strong style="color: ${COLORS.primary};">${data.title}</strong>.</p>
        <div style="background: ${COLORS.secondary}15; border: 1px solid ${COLORS.secondary}40; padding: 20px; border-radius: 20px; margin-top: 20px;">
          <p style="margin: 0; color: ${COLORS.text}; font-weight: bold;">Location: ${data.location}</p>
          <p style="margin: 5px 0 0 0; color: ${COLORS.light}; font-size: 12px; font-weight: bold; text-transform: uppercase;">Act fast to submit your proposal before the matching phase closes.</p>
        </div>
      `,
      buttonLabel: "Submit Bid",
      buttonUrl: `${BASE_URL}#/rfq/${data.id}`
    }
  }),

  BID_WON: (data: { title: string, customerName: string }): EmailTemplateResult => ({
    name: "Contract Award Notification",
    recipientRole: UserRole.PROVIDER,
    helperText: "The 'Golden Ticket' email sent when a client officially hires a provider.",
    data: {
      Subject: "🏆 Success! You have been hired",
      html: `
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 40px;">🏆</span>
        </div>
        <h2 style="color: ${COLORS.green}; font-weight: 900; text-transform: uppercase; margin-bottom: 15px; text-align: center;">Opportunity Secured</h2>
        <p style="color: ${COLORS.text}; line-height: 1.6;">Great news! <strong style="color: ${COLORS.primary};">${data.customerName}</strong> has accepted your proposal for <strong>${data.title}</strong>.</p>
        <p style="color: ${COLORS.light}; font-size: 14px;">A secure chat channel has been opened. Please communicate with the client to finalize the logistics.</p>
      `,
      buttonLabel: "Open Secure Chat",
      buttonUrl: `${BASE_URL}#/messages`
    }
  })
};