
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserRole, ServiceCategory } from '../../types';
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
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const adminAvatarInputRef = useRef<HTMLInputElement>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'system'>('system'); // Default to system for visual matching
  
  // Collapsible state for system settings
  const [isSiteOpen, setIsSiteOpen] = useState(false);
  const [isServiceOpen, setIsServiceOpen] = useState(true);

  const [settings, setSettings] = useState<any>({ 
    siteName: 'Town Hall UAE', 
    logo: '', 
    maintenanceMode: false, 
    newRegistrations: true 
  });
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [statsData, setStatsData] = useState({ customers: 0, providers: 0, rfqs: 0 });

  useEffect(() => {
    const fetchData = async () => {
      const [sets, cats, usrs, rfqs, bans] = await Promise.all([
        dataService.getSettings(),
        dataService.getCategories(),
        dataService.getUsers(),
        dataService.getRFQs(),
        dataService.getBanners()
      ]);
      if (sets) setSettings(sets);
      if (cats) setCategories(cats);
      if (bans) setBanners(bans.filter(b => b && b.id && b.imageUrl));
      setStatsData({
        customers: usrs.filter(u => u.role === UserRole.CUSTOMER).length,
        providers: usrs.filter(u => u.role === UserRole.PROVIDER).length,
        rfqs: rfqs.length
      });
    };
    fetchData();
  }, []);

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        dataService.saveSettings(settings),
        dataService.saveCategories(categories),
        dataService.saveBanners(banners)
      ]);
      showToast("System configurations saved", 'success');
    } catch (err: any) {
      showToast("Error saving settings", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        showToast("Uploading logo...", "info");
        const url = await dataService.uploadImage(file, `system/logo_${Date.now()}`);
        setSettings({ ...settings, logo: url });
        showToast("Logo uploaded", "success");
      } catch (err) {
        showToast("Upload failed", "error");
      }
    }
  };

  const handleAdminAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        showToast("Updating profile picture...", "info");
        const url = await dataService.uploadImage(file, `avatars/admin_${Date.now()}`);
        const updatedUser = { ...user, avatar: url };
        await dataService.saveUser(updatedUser);
        if (onUpdateUser) onUpdateUser(updatedUser);
        showToast("Profile picture updated", "success");
      } catch (err) {
        showToast("Update failed", "error");
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FCF6E7] pb-32">
      <header className="px-8 pt-14 pb-6 flex items-center justify-between">
        <h1 className="text-[14px] font-[900] text-text-dark uppercase tracking-[0.2em]">Command Center</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-gray-100 active:scale-95 transition-transform">
            <span className="material-symbols-outlined text-text-dark text-xl font-normal">notifications</span>
            {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white shadow-sm"></div>}
          </button>
          <button 
            onClick={() => setActiveTab(activeTab === 'profile' ? 'system' : 'profile')}
            className={`w-11 h-11 rounded-[1.2rem] shadow-soft border flex items-center justify-center transition-all ${activeTab === 'system' ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-gray-100'}`}
          >
            <span className="material-symbols-outlined text-[22px]">{activeTab === 'profile' ? 'settings' : 'person'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-8 overflow-y-auto no-scrollbar">
        {activeTab === 'profile' ? (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Admin Info Section */}
            <div className="px-8 flex flex-col items-center">
              <div className="relative group">
                <div 
                  onClick={() => adminAvatarInputRef.current?.click()}
                  className="w-32 h-32 rounded-[2.8rem] border-[6px] border-white shadow-soft overflow-hidden bg-gray-100 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                >
                  <img src={user.avatar} className="w-full h-full object-cover" alt="Admin Avatar" />
                </div>
                {/* Fix: Added missing className property and ensured Tailwind classes are correctly stringified */}
                <div 
                  onClick={() => adminAvatarInputRef.current?.click()}
                  className="absolute bottom-1 right-1 bg-primary w-9 h-9 rounded-2xl border-4 border-white flex items-center justify-center shadow-lg text-white cursor-pointer active:scale-90"
                >
                  <span className="material-symbols-outlined text-sm font-black">photo_camera</span>
                </div>
                <input type="file" ref={adminAvatarInputRef} className="hidden" accept="image/*" onChange={handleAdminAvatarUpload} />
              </div>
              
              <div className="mt-6 text-center">
                <h2 className="text-[26px] font-[900] text-text-dark tracking-tighter uppercase leading-none">Admin</h2>
                <div className="mt-3 inline-flex items-center gap-2 bg-primary/5 px-4 py-1.5 rounded-xl border border-primary/10">
                  <span className="material-symbols-outlined text-primary text-sm font-black">verified_user</span>
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">System Administrator</span>
                </div>
              </div>
            </div>

            {/* Metrics Section */}
            <div className="px-6 grid grid-cols-3 gap-3">
              {[
                { label: 'Total Users', value: statsData.customers + statsData.providers, color: 'text-primary' },
                { label: 'Total RFQs', value: statsData.rfqs, color: 'text-accent-pink' },
                { label: 'Providers', value: statsData.providers, color: 'text-accent-green' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/60 backdrop-blur-md rounded-[2.5rem] p-5 text-center shadow-card border border-white flex flex-col items-center justify-center min-h-[120px]">
                  <p className="text-[9px] font-black text-gray-400 mb-2 uppercase tracking-[0.15em] leading-tight">{stat.label}</p>
                  <p className={`text-[32px] font-[900] ${stat.color} leading-none tracking-tighter`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Sign Out Section */}
            <div className="px-8 pt-4">
              <button 
                onClick={onLogout} 
                className="w-full py-5 bg-white border border-gray-100 text-red-500 rounded-[2rem] text-[12px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-soft active:scale-[0.98] transition-all"
              >
                <span className="material-symbols-outlined text-[20px] font-black">logout</span>
                Sign Out Session
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
            {/* System Management Tab Header */}
            <div className="px-6 flex justify-between items-center mb-2">
              <h2 className="text-xl font-black text-text-dark uppercase tracking-tight">System Config</h2>
              <button 
                onClick={handleSaveAll}
                disabled={isSaving}
                className="bg-primary text-white text-[11px] font-black uppercase tracking-widest px-6 py-3 rounded-full shadow-btn-glow flex items-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
              >
                {isSaving ? 'Saving...' : 'Save All'}
              </button>
            </div>

            {/* Site Management Section */}
            <section>
              <button 
                onClick={() => setIsSiteOpen(!isSiteOpen)}
                className="w-full px-8 py-3 flex items-center justify-between text-gray-400 font-bold uppercase text-[11px] tracking-widest"
              >
                SITE MANAGEMENT
                <span className={`material-symbols-outlined transition-transform duration-300 ${isSiteOpen ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
              
              {isSiteOpen && (
                <div className="px-6 space-y-4 mb-4">
                  <div className="bg-white rounded-[2rem] shadow-card border border-white p-6 space-y-6">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-4">
                         <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 border border-gray-100 overflow-hidden">
                           {settings.logo ? <img src={settings.logo} className="w-full h-full object-contain" alt="Logo" /> : <span className="material-symbols-outlined text-3xl">image</span>}
                         </div>
                         <div>
                           <h4 className="text-[13px] font-bold text-text-dark uppercase">Site Logo</h4>
                           <p className="text-[10px] text-gray-400 font-medium">Visible on dashboard</p>
                         </div>
                       </div>
                       <button onClick={() => logoInputRef.current?.click()} className="bg-primary/5 text-primary px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border border-primary/5 active:scale-95 transition-all">Upload</button>
                       <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    </div>
                    <div className="space-y-2">
                       <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest ml-1">Platform Identity</p>
                       <input value={settings.siteName} onChange={(e) => setSettings({ ...settings, siteName: e.target.value })} className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-[14px] font-bold text-text-dark focus:ring-1 focus:ring-primary shadow-inner" placeholder="Site Name" />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* SERVICES LIST - UPDATED TO MATCH SCREENSHOT */}
            <section className="px-6 space-y-4">
              <div className="space-y-3">
                {categories.map((cat) => (
                  <div 
                    key={cat.id} 
                    onClick={() => navigate(`/admin/service/edit/${cat.id}`)}
                    className="bg-white rounded-[2.5rem] p-5 shadow-card border border-white flex items-center gap-5 active:scale-[0.98] transition-all cursor-pointer group"
                  >
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                      <span className="material-symbols-outlined text-3xl font-normal">{cat.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[14px] font-[800] text-text-dark truncate uppercase tracking-tight">{cat.name}</h4>
                    </div>
                    <div className="w-8 h-8 flex items-center justify-center text-gray-200 group-hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </div>
                  </div>
                ))}
                
                {/* ADD NEW SERVICE BUTTON - PILL STYLE FROM SCREENSHOT */}
                <button 
                  onClick={() => navigate('/admin/service/new')}
                  className="w-full py-4 bg-white border border-gray-100 text-gray-400 rounded-full text-[11px] font-black uppercase tracking-[0.1em] shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all mt-6"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  ADD NEW SERVICE
                </button>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* BOTTOM NAVIGATION - PRECISELY MATCHING SCREENSHOT */}
      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white border-t border-gray-100 pb-10 pt-4 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40_rgba(0,0,0,0.06)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1 text-text-light opacity-40">
          <span className="material-symbols-outlined text-[28px] font-light">grid_view</span>
          <span className="text-[9px] font-black uppercase tracking-widest">HOME</span>
        </button>
        <button onClick={() => navigate('/admin/users')} className="flex-1 flex flex-col items-center gap-1 text-text-light opacity-40">
          <span className="material-symbols-outlined text-[28px] font-light">group</span>
          <span className="text-[9px] font-black uppercase tracking-widest">USERS</span>
        </button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1 text-text-light opacity-40">
           <span className="material-symbols-outlined text-[28px] font-light">format_list_bulleted</span>
           <span className="text-[9px] font-black uppercase tracking-widest">QUERIES</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 text-primary">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-12 h-12 bg-primary/10 rounded-full -z-10 animate-in zoom-in duration-300"></div>
            <span className="material-symbols-outlined text-[28px] font-black fill-1">settings</span>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest mt-1">SYSTEM</span>
        </button>
      </nav>
    </div>
  );
};

export default Profile;