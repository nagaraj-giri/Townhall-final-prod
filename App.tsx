import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import Login from './pages/Login';
import { User, UserRole, AppNotification } from './types';
import { dataService } from './pages/services/dataService';
import { authService } from './pages/authService';
import { AlertsEngine } from './AlertsEngine/UIDesign';
import { ChatService } from './ChatEngine/ChatService';
import { ChatEngine } from './ChatEngine/index';
import { pushNotificationService } from './AlertsEngine/PushEngine/PushNotificationService';

import CustomerDashboard from './pages/customer/Dashboard';
import CustomerRFQDetail from './pages/customer/RFQDetail';
import CustomerCreateRFQ from './pages/customer/CreateRFQ';
import CustomerProfile from './pages/customer/Profile';
import CustomerQueries from './pages/customer/Queries';

import ProviderHome from './pages/provider/Home';
import ProviderLeads from './pages/provider/Leads';
import ProviderRFQDetail from './pages/provider/RFQDetail';
import ProviderProfile from './pages/provider/Profile';
import ProviderStorefront from './pages/provider/Storefront';
import ProviderRegistration from './pages/ProviderRegistration';

import AdminDashboard from './pages/admin/Dashboard';
import AdminProfile from './pages/admin/Profile';
import AdminUsers from './pages/admin/Users';
import AdminUserDetails from './pages/admin/UserDetails';
import AdminRFQDetail from './pages/admin/RFQDetail';
import AdminCategories from './pages/admin/Categories';
import AdminServiceEditor from './pages/admin/ServiceEditor';
import ProviderRequestDetail from './pages/admin/ProviderRequestDetail';

const GOOGLE_MAPS_API_KEY = "AIzaSyAFRh0oVYKee-hPcWKoT2L05LD_XE2VT98";

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
            value.constructor.name === 'Q$1' ||
            value.constructor.name === 'Sa'
          )) ||
          (value.host && (value.renderOptions || value._renderOptions))
        ) {
          return;
        }
      } catch (e) { return; }
      cache.add(value);
    }
    return value;
  });
};

type ToastType = 'success' | 'error' | 'info';
interface AppContextType {
  showToast: (message: string, type?: ToastType) => void;
  unreadCount: number;
  chatUnreadCount: number;
  toggleNotifications: (open: boolean) => void;
}
const AppContext = createContext<AppContextType | undefined>(undefined);
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

const NotificationsOverlay: React.FC<{ 
  user: User; 
  isOpen: boolean; 
  onClose: () => void;
  notifications: AppNotification[];
}> = ({ user, isOpen, onClose, notifications }) => {
  const navigate = useNavigate();
  const { showToast } = useApp();

  const handleAction = async (notif: AppNotification) => {
    if (!notif.isRead) {
      await dataService.markNotificationAsRead(notif.id);
    }
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
      onClose();
    }
  };

  const handleMarkAllRead = async () => {
    await dataService.markAllNotificationsAsRead(user.id);
    showToast("Inbox cleared", "success");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[4px]" onClick={onClose}></div>
      <div className="relative w-[85%] max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <header className="px-6 pt-14 pb-5 flex justify-between items-center border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl">
              <span className="material-symbols-outlined font-bold">arrow_back</span>
            </button>
            <h2 className="text-xl font-bold text-text-dark uppercase">Alerts</h2>
          </div>
          {notifications.length > 0 && (
            <button onClick={handleMarkAllRead} className="text-[10px] font-bold text-primary uppercase">Clear</button>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar bg-gray-50/30">
          {notifications.length > 0 ? (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                onClick={() => handleAction(notif)}
                className={`p-4 rounded-[1.5rem] bg-white border transition-all cursor-pointer ${notif.isRead ? 'opacity-60' : 'border-primary/20 shadow-sm'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-[12px] font-bold text-text-dark uppercase">{notif.title}</h4>
                  {!notif.isRead && <div className="w-2 h-2 bg-accent-pink rounded-full animate-pulse"></div>}
                </div>
                <p className="text-[11px] text-gray-500 font-medium leading-relaxed">{notif.message}</p>
              </div>
            ))
          ) : (
            <div className="py-20 text-center opacity-30">
              <span className="material-symbols-outlined text-5xl">notifications_off</span>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-4">Empty</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await dataService.init();
        const stored = localStorage.getItem('townhall_user');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            const fresh = await dataService.getUserById(parsed.id);
            if (fresh) {
              setUser(fresh);
              localStorage.setItem('townhall_user', safeStringify(fresh));
            }
          } catch (e) {
            localStorage.removeItem('townhall_user');
          }
        }
      } catch (err) {
        console.error("Bootstrap error:", err);
      } finally {
        setIsReady(true);
      }
    };
    bootstrap();
  }, []);

  // Push Notifications Setup: Triggered upon user identification
  useEffect(() => {
    if (user) {
      // Register device for background push
      pushNotificationService.init(user);
      
      // Setup listener for foreground notifications
      const unsubPush = pushNotificationService.listenForForegroundMessages((payload) => {
        // Map FCM foreground message to the application's toast notification system
        const title = payload.notification?.title || "New Update";
        const body = payload.notification?.body || "";
        showToast(`${title}: ${body}`, "info");
      });
      
      return () => unsubPush();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setChatUnreadCount(0);
      return;
    }
    const unsubNotifs = dataService.listenToNotifications(user.id, (notifs) => {
      setNotifications(notifs);
      const unread = notifs.filter(n => !n.isRead);
      if (unread.length > 0) {
        AlertsEngine.dispatch(unread[0], user.role, showToast);
      }
    });
    const unsubChatCount = ChatService.listenToTotalUnreadMessages(user.id, setChatUnreadCount);
    return () => {
      unsubNotifs();
      unsubChatCount();
    };
  }, [user?.id, user?.role]);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('townhall_user', safeStringify(u));
  };

  const handleLogout = async () => {
    await authService.signOut();
    setUser(null);
  };

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} solutionChannel='GMP_devsite_samples_v3_rgmautocomplete'>
      <AppContext.Provider value={{ showToast, unreadCount, chatUnreadCount, toggleNotifications: setIsNotifOpen }}>
        <HashRouter>
          <div className="max-w-md mx-auto min-h-screen relative overflow-x-hidden">
            {toast && (
              <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[4000] w-[90%] max-w-sm animate-in slide-in-from-top duration-500">
                <div className={`p-4 rounded-[2rem] shadow-xl flex items-center gap-4 bg-white/95 backdrop-blur-xl border ${toast.type === 'success' ? 'border-accent-green/20' : toast.type === 'error' ? 'border-accent-pink/20' : 'border-primary/20'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${toast.type === 'success' ? 'bg-accent-green' : toast.type === 'error' ? 'bg-accent-pink' : 'bg-primary'} text-white`}>
                    <span className="material-symbols-outlined text-[18px]">{toast.type === 'success' ? 'check' : toast.type === 'error' ? 'priority_high' : 'info'}</span>
                  </div>
                  <p className="text-[13px] font-bold text-text-dark">{toast.message}</p>
                </div>
              </div>
            )}

            {user && <NotificationsOverlay user={user} isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} notifications={notifications} />}

            <Routes>
              <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} />
              <Route path="/provider-registration" element={user ? <Navigate to="/" /> : <ProviderRegistration />} />
              <Route path="/" element={user ? (user.role === UserRole.ADMIN ? <AdminDashboard user={user} /> : user.role === UserRole.PROVIDER ? <ProviderHome user={user} /> : <CustomerDashboard user={user} />) : <Navigate to="/login" />} />
              <Route path="/queries" element={user ? <CustomerQueries user={user} /> : <Navigate to="/login" />} />
              <Route path="/create-rfq" element={user ? <CustomerCreateRFQ user={user!} /> : <Navigate to="/login" />} />
              <Route path="/messages/:id?" element={user ? <ChatEngine user={user} /> : <Navigate to="/login" />} />
              <Route path="/leads" element={user?.role === UserRole.PROVIDER ? <ProviderLeads user={user!} /> : <Navigate to="/" />} />
              <Route path="/storefront/:id?" element={user ? <ProviderStorefront user={user!} /> : <Navigate to="/login" />} />
              <Route path="/admin/users" element={user?.role === UserRole.ADMIN ? <AdminUsers /> : <Navigate to="/" />} />
              <Route path="/admin/user/:id" element={user?.role === UserRole.ADMIN ? <AdminUserDetails /> : <Navigate to="/" />} />
              <Route path="/admin/categories" element={user?.role === UserRole.ADMIN ? <AdminCategories /> : <Navigate to="/" />} />
              <Route path="/admin/service/new" element={user?.role === UserRole.ADMIN ? <AdminServiceEditor /> : <Navigate to="/" />} />
              <Route path="/admin/service/edit/:catId" element={user?.role === UserRole.ADMIN ? <AdminServiceEditor /> : <Navigate to="/" />} />
              <Route path="/admin/provider-request/:id" element={user?.role === UserRole.ADMIN ? <ProviderRequestDetail /> : <Navigate to="/" />} />
              <Route path="/rfq/:id" element={user ? (user.role === UserRole.ADMIN ? <AdminRFQDetail user={user} /> : user.role === UserRole.PROVIDER ? <ProviderRFQDetail user={user} /> : <CustomerRFQDetail user={user} />) : <Navigate to="/login" />} />
              <Route path="/profile" element={user ? (user.role === UserRole.ADMIN ? <AdminProfile user={user} onLogout={handleLogout} /> : user.role === UserRole.PROVIDER ? <ProviderProfile user={user} onLogout={handleLogout} /> : <CustomerProfile user={user} onLogout={handleLogout} />) : <Navigate to="/login" />} />
            </Routes>
          </div>
        </HashRouter>
      </AppContext.Provider>
    </APIProvider>
  );
};

export default App;