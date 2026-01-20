
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
  createdAt?: string;
  lastLoginAt?: string;
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
  fcmTokens?: string[]; // Added for Push Notifications
}

export interface ProviderRequest {
  id: string;
  businessName: string;
  locationName: string;
  lat?: number;
  lng?: number;
  services: string[];
  contactPerson: string;
  role: string;
  whatsapp: string;
  email: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
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
  rfqId: string; // Link to specific transaction
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

// Augment global scope for Window and JSX namespace.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    google: any;
    // The environment provides a global aistudio object.
    // Fix: Removed 'readonly' modifier to match ambient environment definitions and resolve 'identical modifiers' error.
    aistudio: AIStudio;
  }
  
  namespace JSX {
    interface IntrinsicElements {
      'gmpx-place-picker': any;
      'gmp-place-autocomplete': any;
      'gmpx-place-picker-loader': any;
      'gmp-api-loader': any;
      [elemName: string]: any;
    }
  }
}
