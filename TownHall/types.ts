import React from 'react';

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  PROVIDER = 'PROVIDER',
  ADMIN = 'ADMIN'
}

// Added Review interface
export interface Review {
  id: string;
  customerId: string;
  providerId: string;
  rfqId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface User {
  id: string; // UID
  name: string; // DisplayName
  email: string; // AuthEmail
  role: UserRole;
  avatar: string; // StorageURL
  phone: string; // +971 format
  nationality: string; // ISO Name
  isVerified: boolean;
  status: 'pending_approval' | 'verified' | 'suspended' | 'verified' | 'pending_approval' | string;
  location: { lat: number; lng: number }; // GIS Object
  geoHash?: string; // GIS Key
  locationName: string; // Dubai District Name
  services: string[]; // LeadMatchKeys[]
  categories: string[]; // DisplayTags[]
  gallery: string[]; // PortfolioURLs[]
  rating: number; // 0-5
  createdAt: string; // ISO8601
  lastLoginAt: string; // ISO8601
  fcmTokens?: string[];
  profileViews?: number;
  // Added missing properties
  description?: string;
  lastIP?: string;
  lastDevice?: string;
  isBlocked?: boolean;
}

export type RFQStatus = 'OPEN' | 'ACTIVE' | 'ACCEPTED' | 'COMPLETED' | 'CANCELED';

export interface RFQ {
  id: string; // rfq_TIMESTAMP
  idDisplay: string; // #DXB-XXXX
  customerId: string; // UID Ref
  customerName: string; // Snapshot
  customerEmail: string; // Snapshot
  customerPhone: string; // Snapshot
  customerAvatar: string; // Snapshot
  title: string;
  description: string;
  service: string; // TargetStream
  location: { lat: number; lng: number };
  locationName: string; // District
  status: RFQStatus;
  searchRadius: number; // KM Range
  quotesCount: number;
  acceptedQuoteId?: string; // QuoteRef
  createdAt: string; // ISO8601
  matchingStopped?: boolean;
  expansionApproved_8km?: boolean;
  expansionApproved_15km?: boolean;
  // Added missing properties
  category: string;
  lat?: number;
  lng?: number;
}

export interface Quote {
  id: string; // q_TIMESTAMP
  rfqId: string; // RFQ Ref
  providerId: string; // UID Ref
  providerName: string; // Snapshot
  providerEmail: string; // Snapshot
  providerPhone: string; // Snapshot
  providerAvatar: string; // Snapshot
  providerRating: number; // Snapshot
  price: string; // AED Amount
  message: string;
  status: 'SENT' | 'ACCEPTED' | 'REJECTED';
  createdAt: string; // ISO8601
  // Added missing properties
  timeline?: string;
}

export interface AuditLogEntry {
  id: string;
  actor?: { userId: string; userName: string; userRole: string };
  target?: { entity: string; entityId: string };
  title: string; // Narrative
  // Expanded string union to include all variants used in the app
  type: 'INTEGRITY' | 'USER' | 'BID' | 'QUERY_LIFECYCLE' | 'SYSTEM_CONFIG' | 'CONTENT_MODERATION' | 'USER_MANAGEMENT' | 'USER_SECURITY' | 'USER_DELETION' | 'BUSINESS_VERIFICATION' | 'PROVIDER_SECURITY' | 'BID_ACTIVITY' | 'CONTENT_DELETION' | string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: string; // ISO8601
  details?: Record<string, any>;
  // Added missing properties used in components
  icon?: string;
  iconBg?: string;
  eventId?: string;
  userName?: string;
  userRole?: string;
  ip?: string;
  device?: string;
  userId?: string;
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

export interface EmailConfig {
  triggers: Record<string, { email: boolean; inApp: boolean }>;
  templateOverrides?: Record<string, { subject?: string; html?: string }>;
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