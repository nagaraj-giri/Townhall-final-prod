
import React, { useState, useEffect, createContext, useContext, Suspense, lazy, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import { User, UserRole, AppNotification } from './types';
import { dataService } from './pages/services/dataService';
import { ChatService } from './ChatEngine/ChatService';
// @ts-ignore
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./pages/services/firebase";
import { AlertsEngine } from './AlertsEngine/UIDesign/index';

const Login = lazy(() => import('./pages/Login'));
const CustomerDashboard = lazy(() => import('./pages/customer/Dashboard'));
const CustomerRFQDetail = lazy(() => import('./pages/customer/RFQDetail'));
const CustomerCreateRFQ = lazy(() => import('./pages/customer/CreateRFQ'));
const CustomerProfile = lazy(() => import('./pages/customer/Profile'));
const CustomerQueries = lazy(() => import('./pages/customer/Queries'));
const ProviderHome = lazy(() => import('./pages/provider/Home'));
const ProviderLeads = lazy(() => import('./pages/provider/Leads'));
const ProviderRFQDetail = lazy(() => import('./pages/provider/RFQDetail'));
const ProviderProfile = lazy(() => import('./pages/provider/Profile'));
const ProviderStorefront = lazy(() => import('./pages/provider/Storefront'));
const ProviderRegistration = lazy(() => import('./pages/ProviderRegistration'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProfile = lazy(() => import('./pages/admin/Profile'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminUserDetails = lazy(() => import('./pages/admin/UserDetails'));
const AdminRFQDetail = lazy(() => import('./pages/admin/RFQDetail'));
const AdminSiteSettings = lazy(() => import('./pages/admin/SiteSettings'));
const AdminAuditLog = lazy(() => import('./pages/admin/AuditLog'));
const AdminAuditLogDetail = lazy(() => import('./pages/admin/AuditLogDetail'));
const AdminBroadcastManager = lazy(() => import('./pages/admin/BroadcastManager'));
const AdminBroadcastListing = lazy(() => import('./pages/admin/BroadcastListing'));
const AdminProviderRequests = lazy(() => import('./pages/admin/AdminProviderRequests'));
const AdminCategories = lazy(() => import('./pages/admin/Categories'));
const AdminServiceEditor = lazy(() => import('./pages/admin/ServiceEditor'));
const AdminEmailConfig = lazy(() => import('./pages/admin/EmailConfig'));
const AdminReviewModeration = lazy(() => import('./pages/admin/ReviewModeration'));
const ChatEngine = lazy(() => import('./ChatEngine/index').then(m => ({ default: m.ChatEngine })));

const GOOGLE_MAPS_API_KEY = "AIzaSyAmJUZ265xMUIpxyXi4KC3BF-SZjlkFu6w";
const NOTIFICATION_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

/**
 * Robust serialization to handle circular references and complex library objects (Google Maps).
 */
const safeStringify = (obj: any) => {
  const cache = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) return; 
      try {
        const constructorName = value.constructor?.name;
        if (
          value instanceof Node || 
          value.nodeType || 
          (constructorName && (
            ['Q$1', 'Sa', 'Mt', 'e', 'Map', 'Place', 'Element', 'LatLng'].includes(constructorName) ||
            constructorName.includes('Map') ||
            constructorName.includes('Place') ||
            constructorName.includes('Element')
          )) ||
          value.gm_bindings_ ||
          value.gm_accessors_ ||
          key === 'pickerRef' || key === 'loaderRef'
        ) {
          return;
        }
        cache.add(value);
      } catch (e) { return; }
    }
    return value;
  });
};

interface AppContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  unreadCount: number;
  chatUnreadCount: number;
  toggleNotifications: (open: boolean) => void;
}
const AppContext = createContext<AppContextType | undefined>(undefined);
export const useApp = () => useContext(AppContext)!;

const NotificationTray: React.FC<{ isOpen: boolean; onClose: () => void; notifications: AppNotification[]; userId: string; }> = ({ isOpen, onClose, notifications, userId }) => {
  const navigate = useNavigate();
  const { showToast } = useApp();

  const handleMarkAllRead = async () => {
    try {
      await dataService.markAllNotificationsAsRead(userId);
      showToast("Clear!", "success");
    } catch (e) {
      showToast("Sync Error", "error");
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[6000] flex justify-end">
      <div className="absolute inset-0 bg-black/5 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>
      <div className="relative w-full max-w-[360px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
        <header className="px-8 pt-16 pb-8 flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <h2 className="text-[26px] font-[900] text-text-dark tracking-tight leading-none uppercase">Inbox</h2>
            <button onClick={onClose} className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-50 active:scale-90 transition-transform">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          {notifications.some(n => !n.isRead) && (
            <button onClick={handleMarkAllRead} className="text-[10px] font-black text-primary uppercase tracking-widest text-left py-2 border-b border-primary/10 active:opacity-60">Mark as Read</button>
          )}
        </header>
        <div className="flex-1 overflow-y-auto px-6 space-y-5 no-scrollbar">
          {notifications.map(n => (
            <div 
              key={n.id} 
              onClick={async () => { await dataService.markNotificationAsRead(n.id); onClose(); if(n.actionUrl) navigate(n.actionUrl); }} 
              className={`p-6 rounded-[2.5rem] border flex gap-4 cursor-pointer active:scale-95 transition-all ${n.isRead ? 'border-gray-50 bg-white' : 'border-primary/20 bg-primary/5 shadow-sm'}`}
            >
              <div className={`w-10 h-10 ${n.isRead ? 'bg-gray-50' : 'bg-white'} rounded-xl flex items-center justify-center shrink-0`}>
                <span className={`material-symbols-outlined ${n.isRead ? 'text-gray-300' : 'text-primary'}`}>info</span>
              </div>
              <div className="min-w-0">
                <h4 className={`text-[13px] font-black text-text-dark truncate ${!n.isRead ? '' : 'opacity-60'}`}>{n.title}</h4>
                <p className="text-[12px] text-text-light leading-relaxed line-clamp-2">{n.message}</p>
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="py-20 text-center opacity-20 flex flex-col items-center gap-4">
              <span className="material-symbols-outlined text-6xl">notifications_off</span>
              <p className="uppercase text-[10px] font-black tracking-widest">Empty</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastUnreadCountRef = useRef<number>(0);
  const initialLoadRef = useRef<boolean>(true);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fbUser: any) => {
      if (fbUser) {
        const fresh = await dataService.getUserById(fbUser.uid);
        if (fresh) { 
          setUser(fresh); 
          localStorage.setItem('townhall_user', safeStringify(fresh)); 
        }
      } else { 
        setUser(null); 
        localStorage.removeItem('townhall_user'); 
      }
      setIsReady(true);
    });
    return () => unsubAuth();
  }, []);

  const handleSetUserWithSync = (fresh: User | null) => {
    setUser(fresh);
    if (fresh) {
      localStorage.setItem('townhall_user', safeStringify(fresh));
    } else {
      localStorage.removeItem('townhall_user');
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    
    const unsubNotifs = dataService.listenToNotifications(user.id, (notifs) => {
      const currentUnread = notifs.filter(n => !n.isRead).length;
      
      if (!initialLoadRef.current && currentUnread > lastUnreadCountRef.current) {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
        
        const latest = notifs[0];
        if (latest && !latest.isRead) {
          AlertsEngine.dispatch(latest, user.role, showToast);
        }
      }

      setNotifications(notifs);
      lastUnreadCountRef.current = currentUnread;
      initialLoadRef.current = false;
    });

    const unsubChatCount = ChatService.listenToTotalUnreadMessages(user.id, setChatUnreadCount);
    return () => { unsubNotifs(); unsubChatCount(); };
  }, [user?.id, user?.role]);

  if (!isReady) return null;

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <AppContext.Provider value={{ showToast, unreadCount: notifications.filter(n => !n.isRead).length, chatUnreadCount, toggleNotifications: setIsNotifOpen }}>
        <HashRouter>
          <div className="max-w-md mx-auto min-h-screen relative overflow-x-hidden">
            <audio ref={audioRef} src={NOTIFICATION_SOUND_URL} preload="auto" />
            
            {toast && (
              <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[5000] w-[90%] max-w-sm animate-in slide-in-from-top duration-500">
                <div className="p-5 rounded-[2.5rem] shadow-2xl bg-white/95 backdrop-blur-xl border border-white flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${toast.type === 'success' ? 'bg-accent-green' : toast.type === 'error' ? 'bg-red-500' : 'bg-primary'} text-white shadow-lg`}>
                    <span className="material-symbols-outlined text-[24px] fill-1">notifications</span>
                  </div>
                  <p className="text-[13px] font-black text-text-dark leading-snug">{toast.message}</p>
                </div>
              </div>
            )}
            <NotificationTray isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} notifications={notifications} userId={user?.id || ''} />
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>}>
              <Routes>
                <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={handleSetUserWithSync} />} />
                <Route path="/join-expert" element={<ProviderRegistration />} />
                <Route path="/" element={user ? (
                  user.role === UserRole.ADMIN ? <AdminDashboard user={user} /> : 
                  user.role === UserRole.PROVIDER ? <ProviderHome user={user} /> : 
                  <CustomerDashboard user={user} />
                ) : <Navigate to="/login" />} />
                <Route path="/profile" element={user ? (
                  user.role === UserRole.ADMIN ? <AdminProfile user={user} onLogout={() => auth.signOut()} onUpdateUser={handleSetUserWithSync} /> :
                  user.role === UserRole.PROVIDER ? <ProviderProfile user={user} onLogout={() => auth.signOut()} onUpdateUser={handleSetUserWithSync} /> : 
                  <CustomerProfile user={user} onLogout={() => auth.signOut()} onUpdateUser={handleSetUserWithSync} />
                ) : <Navigate to="/login" />} />
                <Route path="/queries" element={user ? <CustomerQueries user={user} /> : <Navigate to="/login" />} />
                <Route path="/create-rfq" element={user?.role === UserRole.CUSTOMER ? <CustomerCreateRFQ user={user!} /> : <Navigate to="/" />} />
                <Route path="/messages/:id?" element={user ? <ChatEngine user={user} /> : <Navigate to="/login" />} />
                <Route path="/leads" element={user?.role === UserRole.PROVIDER ? <ProviderLeads user={user!} /> : <Navigate to="/" />} />
                <Route path="/rfq/:id" element={user ? (
                  user.role === UserRole.PROVIDER ? <ProviderRFQDetail user={user} /> : 
                  user.role === UserRole.ADMIN ? <AdminRFQDetail user={user} /> :
                  <CustomerRFQDetail user={user} />
                ) : <Navigate to="/login" />} />
                <Route path="/storefront/:id?" element={user ? <ProviderStorefront user={user!} /> : <Navigate to="/login" />} />
                <Route path="/admin/users" element={user?.role === UserRole.ADMIN ? <AdminUsers /> : <Navigate to="/" />} />
                <Route path="/admin/requests" element={user?.role === UserRole.ADMIN ? <AdminProviderRequests /> : <Navigate to="/" />} />
                <Route path="/admin/audit-log" element={user?.role === UserRole.ADMIN ? <AdminAuditLog /> : <Navigate to="/" />} />
                <Route path="/admin/audit-log/:id" element={user?.role === UserRole.ADMIN ? <AdminAuditLogDetail /> : <Navigate to="/" />} />
                <Route path="/admin/broadcast" element={user?.role === UserRole.ADMIN ? <AdminBroadcastManager user={user!} /> : <Navigate to="/" />} />
                <Route path="/admin/broadcasts" element={user?.role === UserRole.ADMIN ? <AdminBroadcastListing user={user!} /> : <Navigate to="/" />} />
                <Route path="/admin/site-settings" element={user?.role === UserRole.ADMIN ? <AdminSiteSettings /> : <Navigate to="/" />} />
                <Route path="/admin/categories" element={user?.role === UserRole.ADMIN ? <AdminCategories /> : <Navigate to="/" />} />
                <Route path="/admin/service/:catId" element={user?.role === UserRole.ADMIN ? <AdminServiceEditor /> : <Navigate to="/" />} />
                <Route path="/admin/email-logic" element={user?.role === UserRole.ADMIN ? <AdminEmailConfig user={user!} /> : <Navigate to="/" />} />
                <Route path="/admin/reviews" element={user?.role === UserRole.ADMIN ? <AdminReviewModeration user={user!} /> : <Navigate to="/" />} />
                <Route path="/admin/user/:id" element={user?.role === UserRole.ADMIN ? <AdminUserDetails adminUser={user!} /> : <Navigate to="/" />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Suspense>
          </div>
        </HashRouter>
      </AppContext.Provider>
    </APIProvider>
  );
};
export default App;
