
import React from 'react';
import { Navigate } from 'react-router-dom';
import { User, UserRole } from '../types';
import CustomerChat from './Customer/CustomerChat';
import ProviderChat from './Provider/ProviderChat';

interface Props { user: User; }

/**
 * CHAT ENGINE DISPATCHER
 * Automatically resolves the correct UI handler based on User Role.
 * Admin role has been restricted from chat access.
 */
export const ChatEngine: React.FC<Props> = ({ user }) => {
  switch (user.role) {
    case UserRole.ADMIN:
      // Redirect admins away from messaging routes
      return <Navigate to="/" replace />;
    case UserRole.PROVIDER:
      return <ProviderChat user={user} />;
    default:
      return <CustomerChat user={user} />;
  }
};
