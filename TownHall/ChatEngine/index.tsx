import React from 'react';
// @ts-ignore
import { Navigate } from 'react-router-dom';
import { User, UserRole } from '../types';
import CustomerChat from './Customer/CustomerChat';
import ProviderChat from './Provider/ProviderChat';
import AdminChat from './Admin/AdminChat';

interface Props { user: User; }

/**
 * CHAT ENGINE DISPATCHER
 * Automatically resolves the correct UI handler based on User Role.
 * Aligned with PRD v1.2 for Role-Based Access Control.
 */
export const ChatEngine: React.FC<Props> = ({ user }) => {
  switch (user.role) {
    case UserRole.ADMIN:
      // Allow admins to view and moderate chats as per PRD 4.6
      return <AdminChat user={user} />;
    case UserRole.PROVIDER:
      return <ProviderChat user={user} />;
    case UserRole.CUSTOMER:
      return <CustomerChat user={user} />;
    default:
      return <Navigate to="/login" replace />;
  }
};