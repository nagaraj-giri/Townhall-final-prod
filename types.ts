
import React from 'react';

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  PROVIDER = 'PROVIDER',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  avatar: string;
  role: UserRole;
  isBlocked?: boolean;
  isVerified?: boolean;
  status?: string;
  createdAt?: string;
  lastLoginAt?: string;
  lastIP?: string;
  lastDevice?: string;
  location?: {
    lat: number;
    lng: number;
  };
  locationName?: string;
  nationality?: string;
  phone?: string;
  description?: string;
  services?: string[]; 
  categories?: string[]; 
  rating?: number;
  gallery?: string[];
  licenseNo?: string;
  licenseExpiry?: string;
  fcmTokens?: string[];
  profileViews?: number;
}

export interface ProviderRequest {
  id: string;
  businessName: string;
  locationName: string;
  lat: number;
  lng: number;
  services: string[];
  contactPerson: string;
  role: string;
  whatsapp: string;
  email: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface EmailTemplateOverride {
  subject?: string;
  html?: string;
}

export interface EmailConfig {
  // scenario -> channel -> state
  triggers: Record<string, { email: boolean; inApp: boolean }>;
  templateOverrides?: Record<string, EmailTemplateOverride>;
}

export interface AuditLogEntry {
  id: string;
  type: string;
  title: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  ip: string;
  device: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  eventId: string;
  icon: string;
  iconBg: string;
  details?: Record<string, any>;
}

export type RFQStatus = 'OPEN' | 'ACTIVE' | 'ACCEPTED' | 'COMPLETED' | 'CANCELED';

export interface RFQ {
  id: string;
  idDisplay: string;
  customerId: string;
  customerName?: string;
  customerAvatar?: string;
  title: string;
  description: string;
  service: string; 
  category: string; 
  locationName: string;
  lat: number;
  lng: number;
  status: RFQStatus;
  createdAt: string;
  quotesCount: number;
  searchRadius: number; 
  expansionApproved_8km?: boolean;
  expansionApproved_15km?: boolean;
  matchingStopped?: boolean; 
  lowQuoteWarningDismissed?: boolean;
  acceptedQuoteId?: string;
}

export interface Quote {
  id: string;
  rfqId: string;
  providerId: string;
  providerName: string;
  providerAvatar: string;
  providerRating: number;
  price: string;
  timeline: string;
  message: string;
  status: 'SENT' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

export interface Review {
  id: string;
  rfqId: string;
  providerId: string;
  customerId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  isActive?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string; 
  text: string;
  imageUrl?: string;
  timestamp: string;
  status: 'read' | 'unread' | 'sent';
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'URGENT';
  targetRole?: UserRole;
  actionUrl?: string;
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  var aistudio: AIStudio;
  interface Window {
    google: any;
  }
}
