import { UserRole } from '../../types';

export interface EmailTemplateResult {
  name: string;
  recipientRole: UserRole | 'SYSTEM_ADMIN' | 'USER';
  helperText: string;
  data: {
    Subject: string;
    html: string;
    buttonLabel?: string;
    buttonUrl?: string;
  };
}

export const BASE_URL = "https://townhall.sbs/";
const COLORS = {
  primary: '#5B3D9D',
  secondary: '#FFD60A',
  green: '#8BC34A',
  pink: '#FF69B4',
  text: '#333333',
  light: '#888888',
  bg: '#FFFFFF'
};

export const EMAIL_TEMPLATES = {
  WELCOME_APPROVED: (data: { businessName: string }): EmailTemplateResult => ({
    name: "Onboarding Approval",
    recipientRole: UserRole.PROVIDER,
    helperText: "Sent automatically when an admin approves a provider's application.",
    data: {
      Subject: "✨ Congrats!! Welcome to Town Hall UAE - You are Onboarded",
      html: `
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background-color: ${COLORS.secondary}20; padding: 20px; border-radius: 50%;">
            <span style="font-size: 48px;">🎖️</span>
          </div>
        </div>
        <h2 style="color: ${COLORS.primary}; font-weight: 900; text-transform: uppercase; margin-bottom: 10px; text-align: center;">You're Officially In!</h2>
        <p style="color: ${COLORS.text}; font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 25px;">Congrats, ${data.businessName}!</p>
        <p style="color: ${COLORS.text}; line-height: 1.8; text-align: center; font-size: 15px;">We are thrilled to welcome you to <b>Town Hall UAE</b>. Your business has been successfully onboarded as a <b>Premium Service Provider</b>.</p>
      `,
      buttonLabel: "Access Dashboard",
      buttonUrl: `${BASE_URL}#/login`
    }
  }),

  NEW_LEAD: (data: { title: string, location: string, id: string }): EmailTemplateResult => ({
    name: "Lead Discovery Alert",
    recipientRole: UserRole.PROVIDER,
    helperText: "Direct alert sent to matching experts within the operational radius.",
    data: {
      Subject: `🎯 New lead match in ${data.location}`,
      html: `
        <h2 style="color: ${COLORS.primary}; font-weight: 900; text-transform: uppercase; margin-bottom: 15px; text-align: center;">New Lead Match</h2>
        <p style="color: ${COLORS.text}; line-height: 1.6;">A customer has just posted a request matching your expertise: <strong style="color: ${COLORS.primary};">${data.title}</strong>.</p>
        <div style="background: ${COLORS.secondary}15; border: 1px solid ${COLORS.secondary}40; padding: 20px; border-radius: 20px; margin-top: 20px;">
          <p style="margin: 0; color: ${COLORS.text}; font-weight: bold;">Location: ${data.location}</p>
        </div>
      `,
      buttonLabel: "Submit Bid",
      buttonUrl: `${BASE_URL}#/rfq/${data.id}`
    }
  }),

  BID_WON: (data: { title: string, customerName: string }): EmailTemplateResult => ({
    name: "Contract Award Notification",
    recipientRole: UserRole.PROVIDER,
    helperText: "Sent when a client officially hires a provider.",
    data: {
      Subject: "🏆 Success! You have been hired",
      html: `
        <h2 style="color: ${COLORS.green}; font-weight: 900; text-transform: uppercase; margin-bottom: 15px; text-align: center;">Opportunity Secured</h2>
        <p style="color: ${COLORS.text}; line-height: 1.6;">Great news! <strong style="color: ${COLORS.primary};">${data.customerName}</strong> has accepted your proposal for <strong>${data.title}</strong>.</p>
      `,
      buttonLabel: "Open Secure Chat",
      buttonUrl: `${BASE_URL}#/messages`
    }
  }),

  BID_RECEIVED: (data: { title: string, providerName: string, price: string, rfqId: string }): EmailTemplateResult => ({
    name: "New Proposal Received",
    recipientRole: UserRole.CUSTOMER,
    helperText: "Sent to customers when an expert submits a bid.",
    data: {
      Subject: `💰 New Quote Received: ${data.providerName}`,
      html: `
        <h2 style="color: ${COLORS.primary}; font-weight: 900; text-transform: uppercase; margin-bottom: 15px;">New Proposal</h2>
        <p style="color: ${COLORS.text};"><strong>${data.providerName}</strong> has submitted a bid for <b>${data.title}</b>.</p>
        <div style="background: #F3F0FF; padding: 20px; border-radius: 20px; margin: 20px 0;">
          <p style="margin: 0; font-size: 24px; font-weight: 900; color: ${COLORS.primary};">AED ${data.price}</p>
          <p style="margin: 5px 0 0 0; font-size: 11px; text-transform: uppercase; color: ${COLORS.light};">Final Bid Amount</p>
        </div>
      `,
      buttonLabel: "View Proposal",
      buttonUrl: `${BASE_URL}#/rfq/${data.rfqId}`
    }
  }),

  RFQ_COMPLETED: (data: { title: string }): EmailTemplateResult => ({
    name: "Project Completed",
    recipientRole: 'USER',
    helperText: "Sent to both parties when a request is marked completed.",
    data: {
      Subject: "✅ Project Completed Successfully",
      html: `
        <h2 style="color: ${COLORS.green}; font-weight: 900; text-transform: uppercase; margin-bottom: 15px;">Job Delivered</h2>
        <p style="color: ${COLORS.text};">The requirement <b>"${data.title}"</b> has been marked as completed.</p>
        <p style="color: ${COLORS.light}; font-size: 14px;">Thank you for using Town Hall UAE. Please leave a review to help the community.</p>
      `,
      buttonLabel: "Manage Dashboard",
      buttonUrl: `${BASE_URL}#/login`
    }
  }),

  RFQ_CANCELED: (data: { title: string }): EmailTemplateResult => ({
    name: "Query Canceled",
    recipientRole: 'USER',
    helperText: "Sent when a marketplace query is withdrawn.",
    data: {
      Subject: "🛑 Marketplace Query Withdrawn",
      html: `
        <h2 style="color: ${COLORS.pink}; font-weight: 900; text-transform: uppercase; margin-bottom: 15px;">Query Canceled</h2>
        <p style="color: ${COLORS.text};">The request <b>"${data.title}"</b> has been canceled and is no longer active on the marketplace.</p>
      `,
      buttonLabel: "View My Queries",
      buttonUrl: `${BASE_URL}#/queries`
    }
  }),

  ACCOUNT_ACTION: (data: { actionName: string, message: string }): EmailTemplateResult => ({
    name: "Admin Account Action",
    recipientRole: 'USER',
    helperText: "Sent when an admin takes action on a user account (Block/Verify).",
    data: {
      Subject: `🔔 Security Update: Account ${data.actionName}`,
      html: `
        <h2 style="color: ${COLORS.primary}; font-weight: 900; text-transform: uppercase; margin-bottom: 15px;">Account Notification</h2>
        <p style="color: ${COLORS.text}; font-weight: bold;">${data.message}</p>
        <p style="color: ${COLORS.light}; font-size: 13px; margin-top: 20px;">If you have any questions regarding this action, please contact our support team.</p>
      `,
      buttonLabel: "Go to Profile",
      buttonUrl: `${BASE_URL}#/profile`
    }
  })
};