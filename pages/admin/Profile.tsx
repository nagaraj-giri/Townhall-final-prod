import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserRole } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

interface ProfileProps {
  user: User;
  onLogout: () => void;
  onUpdateUser?: (user: User) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onLogout, onUpdateUser }) => {
  const navigate = useNavigate();
  const { showToast, unreadCount, toggleNotifications } = useApp();
  const adminAvatarInputRef = useRef<HTMLInputElement>(null);
  
  const [statsData, setStatsData] = useState({ customers: 0, providers: 0, rfqs: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const unsubUsers = dataService.listenToUsers((usrs) => {
      const customers = usrs.filter(u => u.role === UserRole.CUSTOMER).length;
      const providers = usrs.filter(u => u.role === UserRole.PROVIDER).length;
      setStatsData(prev => ({ ...prev, customers, providers }));
    });

    const unsubRfqs = dataService.listenToRFQs((rfqs) => {
      setStatsData(prev => ({ ...prev, rfqs: rfqs.length }));
      setLoadingStats(false);
    });

    return () => { unsubUsers(); unsubRfqs(); };
  }, []);

  const handleAdminAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        showToast("Updating avatar...", "info");
        const url = await dataService.uploadImage(file, `avatars/admin_${Date.now()}`);
        const updatedUser = { ...user, avatar: url };
        await dataService.saveUser(updatedUser);
        if (onUpdateUser) onUpdateUser(updatedUser);
        showToast("Avatar updated", "success");
      } catch (err) {
        showToast("Update failed", "error");
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-transparent relative">
      {/* Header - Fixed Height & High Z-Index */}
      <header className="px-6 pt-14 pb-6 flex items-center justify-between shrink-0 relative z-[40]">
        <h1 className="text-[14px] uppercase tracking-[0.2em] text-text-dark font-black">Command Center</h1>
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleNotifications(true); }} 
            className="relative w-11 h-11 bg-white rounded-2xl shadow-soft flex items-center justify-center border border-white active:scale-95 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-text-dark text-2xl font-bold">notifications</span>
            {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white shadow-sm"></div>}
          </button>
        </div>
      </header>

      {/* Main Content - Scrollable with padding for nav */}
      <main className="flex-1 space-y-8 overflow-y-auto no-scrollbar pb-32 z-[10] relative">
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Identity Section */}
          <div className="px-6 flex flex-col items-center">
            <div 
              onClick={() => adminAvatarInputRef.current?.click()}
              className="w-32 h-32 rounded-[2.8rem] bg-white p-1 shadow-soft overflow-hidden cursor-pointer relative group"
            >
              <img 
                src={user.avatar} 
                className="w-full h-full object-cover rounded-[2.5rem]" 
                alt="Admin" 
                onError={(e) => (e.currentTarget.src = 'https://ui-avatars.com/api/?name=Admin&background=5B3D9D&color=fff')}
              />
              <div className="absolute bottom-2 right-2 bg-primary w-8 h-8 rounded-full border-4 border-white flex items-center justify-center text-white shadow-md group-active:scale-90 transition-transform">
                 <span className="material-symbols-outlined text-[18px]">edit</span>
              </div>
              <input type="file" ref={adminAvatarInputRef} className="hidden" accept="image/*" onChange={handleAdminAvatarUpload} />
            </div>
            <div className="mt-6 text-center">
              <h2 className="text-[22px] text-text-dark font-[900] uppercase tracking-tight">{user.name}</h2>
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-1">Platform Administrator</p>
            </div>
          </div>

          {/* Core Marketplace Management */}
          <div className="px-6 space-y-4">
             <h3 className="text-[11px] text-gray-400 font-black uppercase tracking-[0.2em] ml-2">Marketplace Control</h3>
             <div className="bg-white rounded-[2.8rem] p-4 shadow-soft border border-white space-y-2 relative z-[20]">
                <button 
                  type="button"
                  onClick={() => navigate('/admin/categories')} 
                  className="w-full p-5 rounded-[2rem] flex items-center justify-between group active:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                    <div className="flex items-center gap-4 pointer-events-none">
                      <div className="w-14 h-14 bg-indigo-50 text-primary rounded-2xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-[32px]">category</span>
                      </div>
                      <div className="text-left">
                        <h3 className="text-[15px] font-black text-text-dark uppercase tracking-tight">Manage Services</h3>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Edit Categories & Icons</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-gray-300 font-bold">chevron_right</span>
                </button>

                <div className="h-[1px] bg-gray-50 mx-4"></div>

                <button 
                  type="button"
                  onClick={() => navigate('/admin/site-settings')} 
                  className="w-full p-5 rounded-[2rem] flex items-center justify-between group active:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                    <div className="flex items-center gap-4 pointer-events-none">
                      <div className="w-14 h-14 bg-orange-50 text-orange-400 rounded-2xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-[32px]">branding_watermark</span>
                      </div>
                      <div className="text-left">
                        <h3 className="text-[15px] font-black text-text-dark uppercase tracking-tight">Site Branding</h3>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Logo, Name & Colors</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-gray-300 font-bold">chevron_right</span>
                </button>
             </div>
          </div>

          {/* System Operations */}
          <div className="px-6 space-y-4">
             <h3 className="text-[11px] text-gray-400 font-black uppercase tracking-[0.2em] ml-2">Integrity & Logs</h3>
             <div className="bg-white rounded-[2.8rem] p-4 shadow-soft border border-white space-y-2 relative z-[20]">
                <button 
                  type="button"
                  onClick={() => navigate('/admin/audit-log')} 
                  className="w-full p-5 rounded-[2rem] flex items-center justify-between group active:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                    <div className="flex items-center gap-4 pointer-events-none">
                      <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-[32px]">history_edu</span>
                      </div>
                      <div className="text-left">
                        <h3 className="text-[15px] font-black text-text-dark uppercase tracking-tight">Audit Logs</h3>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Security Event History</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-gray-300 font-bold">chevron_right</span>
                </button>

                <div className="h-[1px] bg-gray-50 mx-4"></div>

                <button 
                  type="button"
                  onClick={() => navigate('/admin/email-logic')} 
                  className="w-full p-5 rounded-[2rem] flex items-center justify-between group active:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                    <div className="flex items-center gap-4 pointer-events-none">
                      <div className="w-14 h-14 bg-accent-pink/5 text-accent-pink rounded-2xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-[32px]">mail_lock</span>
                      </div>
                      <div className="text-left">
                        <h3 className="text-[15px] font-black text-text-dark uppercase tracking-tight">Email Rules</h3>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Triggers & Engagement</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-gray-300 font-bold">chevron_right</span>
                </button>
             </div>
          </div>
          
          <div className="px-6">
            <button 
              type="button"
              onClick={onLogout} 
              className="w-full bg-white/50 border-2 border-white p-6 rounded-[2.5rem] flex items-center justify-center gap-4 active:scale-[0.98] transition-all group shadow-soft cursor-pointer"
            >
                <span className="material-symbols-outlined text-red-500 group-active:scale-110 transition-transform font-bold">logout</span>
                <h3 className="text-[13px] text-red-500 font-black uppercase tracking-[0.2em]">Sign Out Console</h3>
            </button>
          </div>
        </div>
      </main>

      {/* Navigation Footer - Ultra-High Z-Index */}
      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/90 backdrop-blur-xl border-t border-border-light pb-10 pt-4 px-6 flex justify-around items-center z-[100] shadow-[0_-15px_40px_rgba(0,0,0,0.06)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-30 transition-all active:scale-95">
          <div className="w-12 h-10 flex items-center justify-center"><span className="material-symbols-outlined text-[28px] font-normal">grid_view</span></div>
          <span className="text-[9px] font-black uppercase tracking-widest">HOME</span>
        </button>
        <button onClick={() => navigate('/admin/users')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-30 transition-all active:scale-95">
          <div className="w-12 h-10 flex items-center justify-center"><span className="material-symbols-outlined text-[26px] font-normal">group</span></div>
          <span className="text-[9px] font-black uppercase tracking-widest">USERS</span>
        </button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-30 transition-all active:scale-95">
          <div className="w-12 h-10 flex items-center justify-center"><span className="material-symbols-outlined text-[26px] font-normal">format_list_bulleted</span></div>
          <span className="text-[9px] font-black uppercase tracking-widest">QUERIES</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1.5 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-xl">
             <span className="material-symbols-outlined text-[28px] fill-1">person</span>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">PROFILE</span>
        </button>
      </nav>
    </div>
  );
};

export default Profile;