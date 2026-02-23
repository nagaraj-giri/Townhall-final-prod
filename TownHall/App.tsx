import React, { useState, useEffect, createContext, useContext, Suspense, lazy, useRef } from 'react';
// @ts-ignore
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import { User, UserRole, AppNotification } from './types';
import { dataService } from './services/dataService';
import { ChatService } from './ChatEngine/ChatService';
import { pushNotificationService } from './AlertsEngine/PushEngine/PushNotificationService';
// @ts-ignore
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./services/firebase";
import { AlertsEngine } from './AlertsEngine/UIDesign/index';

// Core Application Pages
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

// Admin Governance Pages
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

// Specialized Engine
const ChatEngine = lazy(() => import('./ChatEngine/index').then(m => ({ default: m.ChatEngine })));

const GOOGLE_MAPS_API_KEY = "AIzaSyAmJUZ265xMUIpxyXi4KC3BF-SZjlkFu6w";
const NOTIFICATION_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const safeStringify = (obj: any) => {
  const cache = new WeakSet();
  try {
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return; 
        const constructorName = value.constructor?.name;
        const isMinifiedInternal = constructorName && (/^[A-Z]\$?[0-9]?$/.test(constructorName) || constructorName.length < 4);
        if (
          value instanceof Node || value.nodeType || isMinifiedInternal ||
          (constructorName && (['Map', 'Place', 'Element', 'LatLng', 'Autocomplete'].some(n => constructorName.includes(n)))) ||
          value.gm_bindings_ || value.gm_accessors_
        ) return;
        cache.add(value);
      }
      return value;
    });
  } catch (err) { return "{}"; }
};

interface AppContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  playRingtone: () => void;
  unreadCount: number;
  chatUnreadCount: number;
  toggleNotifications: (open: boolean) => void;
}
const AppContext = createContext<AppContextType | undefined>(undefined);
export const useApp = () => useContext(AppContext)!;

const NotificationTray: React.FC<{ isOpen: boolean; onClose: () => void; notifications: AppNotification[]; userId: string; }> = ({ isOpen, onClose, notifications, userId }) => {
  // @ts-ignore
  const navigate = useNavigate();
  const { showToast } = useApp();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[6000] flex justify-end">
      <div className="absolute inset-0 bg-black/10 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-[380px] bg-[#FAF9F6] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <header className="px-8 pt-16 pb-8 bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div><h2 className="text-[28px] font-black text-text-dark uppercase tracking-tight">Alerts</h2><p className="text-[10px] font-normal text-primary uppercase tracking-[0.2em] mt-1">Real-time Activity</p></div>
            <button onClick={onClose} className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gray-50 text-gray-400 shadow-inner"><span className="material-symbols-outlined font-normal">close</span></button>
          </div>
          {notifications.some(n => !n.isRead) && (
            <button onClick={async () => { await dataService.markAllNotificationsAsRead(userId); showToast("Inbox cleared", "success"); }} className="flex items-center gap-2 text-[11px] font-normal text-primary uppercase tracking-widest bg-primary/5 px-4 py-2 rounded-xl">
              <span className="material-symbols-outlined text-sm font-normal">done_all</span> Clear All
            </button>
          )}
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-4 no-scrollbar">
          {notifications.length > 0 ? notifications.map(n => (
            <div key={n.id} onClick={async () => { await dataService.markNotificationAsRead(n.id); onClose(); if(n.actionUrl) navigate(n.actionUrl); }} className={`p-6 rounded-[2.5rem] border transition-all duration-300 cursor-pointer ${n.isRead ? 'border-gray-100 bg-white/50 opacity-80' : 'border-primary/20 bg-white shadow-soft ring-2 ring-primary/5'}`}>
              <div className="flex gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${n.type === 'URGENT' ? 'bg-red-50 text-red-500' : 'bg-primary/5 text-primary'}`}><span className="material-symbols-outlined">{n.type === 'URGENT' ? 'priority_high' : 'notifications'}</span></div>
                <div className="min-w-0 flex-1">
                  <h4 className={`text-[14px] font-black text-text-dark truncate uppercase tracking-tight ${n.isRead ? 'opacity-50' : ''}`}>{n.title}</h4>
                  <p className="text-[12px] text-gray-500 leading-relaxed font-normal line-clamp-2">{n.message}</p>
                  <p className="text-[9px] font-normal text-gray-300 uppercase mt-3 tracking-widest">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            </div>
          )) : <div className="h-full flex flex-col items-center justify-center opacity-20 py-20"><span className="material-symbols-outlined text-7xl font-light">notifications_off</span><p className="text-[10px] font-normal uppercase tracking-[0.4em] mt-6">All caught up</p></div>}
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

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => { setToast({ message, type }); setTimeout(() => setToast(null), 4000); };
  const playRingtone = () => { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); } };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fbUser: any) => {
      try {
        if (fbUser) {
          const fresh = await dataService.getUserById(fbUser.uid);
          if (fresh) { 
            setUser(fresh); 
            localStorage.setItem('townhall_user', safeStringify(fresh));
            // Multi-Channel Handshake: Register device for Push Notifications
            pushNotificationService.init(fresh);
          }
        } else { 
          setUser(null); 
          localStorage.removeItem('townhall_user'); 
        }
      } catch (err) { console.error("[Auth] Init error:", err); } 
      finally { setIsReady(true); }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const unsubNotifs = dataService.listenToNotifications(user.id, (notifs) => {
      const currentUnread = notifs.filter(n => !n.isRead).length;
      if (!initialLoadRef.current && currentUnread > lastUnreadCountRef.current) {
        // Multi-Channel Feedback: Audio + Visual Toast
        playRingtone();
        const latest = notifs[0];
        if (latest && !latest.isRead) AlertsEngine.dispatch(latest, user.role, showToast);
      }
      setNotifications(notifs);
      lastUnreadCountRef.current = currentUnread;
      initialLoadRef.current = false;
    });
    const unsubChatCount = ChatService.listenToTotalUnreadMessages(user.id, setChatUnreadCount);
    const unsubPushForeground = pushNotificationService.listenForForegroundMessages((payload) => {
       // Optional: specific logic for foreground push arrival
       console.debug("[Push] Foreground message received", payload);
    });
    return () => { unsubNotifs(); unsubChatCount(); unsubPushForeground(); };
  }, [user?.id]);

  if (!isReady) return null;

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <AppContext.Provider value={{ showToast, playRingtone, unreadCount: notifications.filter(n => !n.isRead).length, chatUnreadCount, toggleNotifications: setIsNotifOpen }}>
        <HashRouter>
          <div className="max-w-md mx-auto min-h-screen relative overflow-x-hidden">
            <audio ref={audioRef} src={NOTIFICATION_SOUND_URL} preload="auto" />
            {toast && (
              <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[7000] w-[90%] max-w-sm animate-in slide-in-from-top duration-300">
                <div className="p-5 rounded-[2.5rem] shadow-2xl bg-white/95 backdrop-blur-xl border border-white flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${toast.type === 'success' ? 'bg-accent-green' : 'bg-primary'} text-white`}>
                    <span className="material-symbols-outlined">{toast.type === 'success' ? 'verified' : 'info'}</span>
                  </div>
                  <p className="text-[13px] font-normal text-text-dark leading-tight">{toast.message}</p>
                </div>
              </div>
            )}
            <NotificationTray isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} notifications={notifications} userId={user?.id || ''} />
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>}>
              <Routes>
                <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={(u) => setUser(u)} />} />
                <Route path="/join-expert" element={<ProviderRegistration />} />
                <Route path="/" element={user ? (user.role === UserRole.ADMIN ? <AdminDashboard user={user} /> : user.role === UserRole.PROVIDER ? <ProviderHome user={user} /> : <CustomerDashboard user={user} />) : <Navigate to="/login" />} />
                <Route path="/profile" element={user ? (user.role === UserRole.ADMIN ? <AdminProfile user={user} onLogout={() => {setUser(null); localStorage.removeItem('townhall_user');}} /> : user.role === UserRole.PROVIDER ? <ProviderProfile user={user} onLogout={() => {setUser(null); localStorage.removeItem('townhall_user');}} /> : <CustomerProfile user={user} onLogout={() => {setUser(null); localStorage.removeItem('townhall_user');}} />) : <Navigate to="/login" />} />
                <Route path="/queries" element={user ? <CustomerQueries user={user} /> : <Navigate to="/login" />} />
                <Route path="/create-rfq" element={user?.role === UserRole.CUSTOMER ? <CustomerCreateRFQ user={user!} /> : <Navigate to="/" />} />
                <Route path="/messages/:id?" element={user ? <ChatEngine user={user} /> : <Navigate to="/login" />} />
                <Route path="/leads" element={user?.role === UserRole.PROVIDER ? <ProviderLeads user={user!} /> : <Navigate to="/" />} />
                <Route path="/rfq/:id" element={user ? (user.role === UserRole.PROVIDER ? <ProviderRFQDetail user={user} /> : user.role === UserRole.ADMIN ? <AdminRFQDetail user={user} /> : <CustomerRFQDetail user={user} />) : <Navigate to="/login" />} />
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