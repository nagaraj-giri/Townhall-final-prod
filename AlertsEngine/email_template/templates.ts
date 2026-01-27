
import { UserRole } from '../../types';

export interface EmailTemplateData {
  subject: string;
  title: string;
  mainText: string;
  buttonLabel?: string;
  buttonUrl?: string;
  footerText?: string;
  // Specific fields based on user request for "New User Signed Up" style
  role?: string;
  username?: string;
  name?: string;
  location?: string;
  timestamp?: string;
}

const BASE_URL = "https://townhall.sbs/";

export const EMAIL_TEMPLATES = {
  // --- CUSTOMER USE CASES ---
  WELCOME_CUSTOMER: (data: { name: string }) => ({
    name: "Welcome to Town Hall",
    data: {
      Subject: "Welcome to Town Hall UAE!",
      name: data.name,
      html: `
        <h2 style="color: #5B3D9D;">Salam ${data.name.split(' ')[0]},</h2>
        <p>Welcome to Dubai's premium service network. You can now post requirements, receive expert quotes, and manage projects all in one place.</p>
        <p>Login to your dashboard to start your first discovery.</p>
      `,
      buttonLabel: "Get Started",
      buttonUrl: BASE_URL
    }
  }),

  QUERY_LIVE: (data: { id: string, title: string, location: string }) => ({
    name: "Query Posted",
    data: {
      Subject: `Confirmation: Your Query ${data.id} is Live`,
      html: `
        <p>Salam, your requirement for <strong>${data.title}</strong> has been broadcasted to verified experts in <strong>${data.location}</strong>.</p>
        <p>You will be notified as soon as experts start bidding on your request.</p>
      `,
      buttonLabel: "View Status",
      buttonUrl: BASE_URL
    }
  }),

  MATCH_STALE: (data: { id: string, title: string }) => ({
    name: "Discovery Pulse Check",
    data: {
      Subject: `Update on your requirement: ${data.title}`,
      html: `
        <p>We noticed that your query <strong>${data.title}</strong> hasn't received matching bids in the last hour.</p>
        <p>Try broadening your location or adding more specific details to attract more experts in our network.</p>
      `,
      buttonLabel: "Optimize Query",
      buttonUrl: BASE_URL
    }
  }),

  // --- PROVIDER USE CASES ---
  APPLICATION_APPROVED: (data: { businessName: string }) => ({
    name: "Provider Application Approved",
    data: {
      Subject: "Application Approved: Welcome to Town Hall UAE",
      html: `
        <h2 style="color: #5B3D9D;">Congratulations!</h2>
        <p>Your application for <strong>${data.businessName}</strong> has been verified and approved by our team.</p>
        <p>You can now log in to the Provider Portal to access live leads and manage your professional storefront.</p>
      `,
      buttonLabel: "Access Dashboard",
      buttonUrl: BASE_URL
    }
  }),

  BID_WON: (data: { title: string, customerName: string }) => ({
    name: "Bid Accepted",
    data: {
      Subject: "🏆 Opportunity Secured: You've been Hired!",
      html: `
        <p>Great news! <strong>${data.customerName}</strong> has accepted your proposal for <strong>${data.title}</strong>.</p>
        <p>A secure chat channel has been opened. Please communicate with the client to finalize the logistics.</p>
      `,
      buttonLabel: "Open Chat",
      buttonUrl: BASE_URL
    }
  }),

  // --- ADMIN & SECURITY USE CASES ---
  NEW_USER_ADMIN: (data: { name: string, email: string, role: string, location: string }) => ({
    name: "New User Signed Up",
    data: {
      Subject: "New User Signed up in TownHall",
      role: data.role,
      username: data.email,
      name: data.name,
      location: data.location,
      timestamp: new Date().toLocaleString(),
      html: `
        <p><strong>Hi Admin,</strong></p>
        <p>A new user has joined the platform:</p>
        <ul>
          <li><strong>Name:</strong> ${data.name}</li>
          <li><strong>Email:</strong> ${data.email}</li>
          <li><strong>Role:</strong> ${data.role}</li>
          <li><strong>Location:</strong> ${data.location}</li>
        </ul>
        <p>Login to the management console to view more details.</p>
      `,
      buttonLabel: "Go to Admin Panel",
      buttonUrl: BASE_URL
    }
  }),

  IDENTITY_ALERT: (data: { name: string, ip: string, prevIP: string }) => ({
    name: "Security Identity Alert",
    data: {
      Subject: "⚠️ SECURITY ALERT: Suspicious Login Detected",
      html: `
        <p><strong>Security Warning:</strong></p>
        <p>User <strong>${data.name}</strong> has logged in from a significantly different IP address.</p>
        <ul>
          <li><strong>New IP:</strong> ${data.ip}</li>
          <li><strong>Previous IP:</strong> ${data.prevIP}</li>
        </ul>
        <p>Please investigate this account for potential unauthorized access.</p>
      `,
      buttonLabel: "Audit User",
      buttonUrl: BASE_URL
    }
  })
};
