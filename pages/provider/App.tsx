import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from '../Login';
import { User, UserRole } from '../../types';
import { dataService } from '../services/dataService';

// Role-Based Pages Consolidated in pages/ hierarchy
import CustomerDashboard from '../customer/Dashboard';
import CustomerRFQDetail from '../customer/RFQDetail';
import CustomerCreateRFQ from '../customer/CreateRFQ';
import CustomerMessages from '../customer/Chat';
import CustomerProfile from '../customer/Profile';
import CustomerQueries from '../customer/Queries';

import ProviderHome from './Home';
import ProviderLeads from './Leads';
import ProviderRFQDetail from './RFQDetail';
import ProviderChat from './Chat';
import ProviderProfile from './Profile';
import ProviderStorefront from './Storefront';

import AdminDashboard from '../admin/Dashboard';
import AdminProfile from '../admin/Profile';
import AdminUsers from '../admin/Users';
import AdminUserDetails from '../admin/UserDetails';
import AdminRFQDetail from '../admin/RFQDetail';

/**
 * Robust serialization to handle circular references and complex library objects.
 * Standardized across both App entry points.
 */
const safeStringify = (obj: any) => {
  const cache = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) return; 
      try {
        if (
          value instanceof Node || 
          value.nodeType || 
          (value.constructor && (
            value.constructor.name === 'Mt' || 
            value.constructor.name === 'e' || 
            value.constructor.name.includes('Element') ||
            value.constructor.name.includes('Map') ||
            ['Q$1', 'Sa'].includes(value.constructor.name)
          )) ||
          (value.host && (value.renderOptions || value._renderOptions)) ||
          key === 'pickerRef' || key === 'loaderRef'
        ) {
          return;
        }
      } catch (e) { return; }
      cache.add(value);
    }
    return value;
  });
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loadingFirebase, setLoadingFirebase] = useState(true);

  useEffect(() => {
    const initializeAppAndFirebase = async () => {
      await dataService.init();
      const stored = localStorage.getItem('townhall_user');
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch (e) {
          localStorage.removeItem('townhall_user');
        }
      }
      setLoadingFirebase(false);
    };
    initializeAppAndFirebase();
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('townhall_user', safeStringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('townhall_user');
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('townhall_user', safeStringify(updatedUser));
  };

  if (loadingFirebase) {
    return <div className="flex items-center justify-center min-h-screen text-primary font-bold">Loading Town Hall...</div>;
  }

  const renderDashboard = () => {
    if (!user) return <Navigate to="/login" />;
    switch (user.role) {
      case UserRole.CUSTOMER: return <CustomerDashboard user={user} />;
      case UserRole.PROVIDER: return <ProviderHome user={user} />;
      case UserRole.ADMIN: return <AdminDashboard user={user} />;
      default: return <Navigate to="/login" />;
    }
  };

  const renderProfile = () => {
    if (!user) return <Navigate to="/login" />;
    switch (user.role) {
      case UserRole.CUSTOMER: return <CustomerProfile user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />;
      case UserRole.PROVIDER: return <ProviderProfile user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />;
      case UserRole.ADMIN: return <AdminProfile user={user} onLogout={handleLogout} />;
      default: return <Navigate to="/login" />;
    }
  };

  const renderMessages = () => {
    if (!user) return <Navigate to="/login" />;
    if (user.role === UserRole.CUSTOMER) return <CustomerMessages user={user} />;
    if (user.role === UserRole.PROVIDER) return <ProviderChat user={user} />;
    return <Navigate to="/" />;
  };

  const renderRFQDetail = () => {
    if (!user) return <Navigate to="/login" />;
    switch (user.role) {
      case UserRole.CUSTOMER: return <CustomerRFQDetail user={user} />;
      case UserRole.PROVIDER: return <ProviderRFQDetail user={user} />;
      case UserRole.ADMIN: return <AdminRFQDetail user={user} />;
      default: return <Navigate to="/" />;
    }
  };

  return (
    <HashRouter>
      <div className="max-w-md mx-auto min-h-screen bg-transparent relative overflow-x-hidden">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} />
          <Route path="/" element={renderDashboard()} />
          <Route path="/queries" element={(user?.role === UserRole.CUSTOMER || user?.role === UserRole.ADMIN) ? <CustomerQueries user={user!} /> : <Navigate to="/" />} />
          <Route path="/create-rfq" element={user?.role === UserRole.CUSTOMER ? <CustomerCreateRFQ user={user!} /> : <Navigate to="/" />} />
          <Route path="/messages" element={renderMessages()} />
          <Route path="/leads" element={user?.role === UserRole.PROVIDER ? <ProviderLeads user={user!} /> : <Navigate to="/" />} />
          <Route path="/storefront" element={user ? <ProviderStorefront user={user!} /> : <Navigate to="/login" />} />
          <Route path="/admin/users" element={user?.role === UserRole.ADMIN ? <AdminUsers /> : <Navigate to="/" />} />
          {/* Added adminUser prop to AdminUserDetails to fix missing prop error */}
          <Route path="/admin/user/:id" element={user?.role === UserRole.ADMIN ? <AdminUserDetails adminUser={user!} /> : <Navigate to="/" />} />
          <Route path="/rfq/:id" element={renderRFQDetail()} />
          <Route path="/chat/:id" element={user?.role === UserRole.PROVIDER ? <ProviderChat user={user!} /> : <CustomerMessages user={user!} />} />
          <Route path="/profile" element={renderProfile()} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </HashRouter>
  );
};

export default App;