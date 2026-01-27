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
  const adminAvatarInputRef = useRef<HTMLInputElement>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [emailLastError, setEmailLastError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'system'>('profile'); 
  
  const [isSiteOpen, setIsSiteOpen] = useState(false);
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(true);

  // URI Builder State - Updated with latest production credentials
  const [builderProvider, setBuilderProvider] = useState<'GMAIL' | 'SENDGRID' | 'CUSTOM'>('GMAIL');
  const [builderUser, setBuilderUser] = useState('fulltechsln@gmail.com');
  const [builderPass, setBuilderPass] = useState('oocn omvs lzal cirt');
  const [fromName, setFromName] = useState('Town Hall');

  const [settings, setSettings] = useState<any>({ 
    siteName: 'Town Hall UAE', 
    logo: '', 
    maintenanceMode: false, 
    newRegistrations: true,
    smtpUri: 'smtps://fulltechsln%40gmail.com:oocnomvslzalcirt@smtp.gmail.com:465',
    emailCollection: 'emails',
    defaultFrom: 'Town Hall <fulltechsln@gmail.com>',
    emailLastVerified: null
  });
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [statsData, setStatsData] = useState({ customers: 0, providers: 0, rfqs: 0 });

  useEffect(() => {
    const fetchData = async () => {
      const [sets, cats, usrs, rfqs] = await Promise.all([
        dataService.getSettings(),
        dataService.getCategories(),
        dataService.getUsers(),
        dataService.getRFQs()
      ]);
      if (sets) {
        setSettings({ ...settings, ...sets });
        if (sets.emailLastVerified) setIsEmailVerified(true);
      }
      if (cats) setCategories(cats);
      setStatsData({
        customers: usrs.filter(u => u.role === UserRole.CUSTOMER).length,
        providers: usrs.filter(u => u.role === UserRole.PROVIDER).length,
        rfqs: rfqs.length
      });
    };
    fetchData();
  }, []);

  const isUriValid = useMemo(() => {
    return settings.smtpUri && settings.smtpUri.startsWith('smtps://') && settings.smtpUri.includes('@');
  }, [settings.smtpUri]);

  const applyUriBuilder = () => {
    if (!builderUser || !builderPass) {
      showToast("Enter credentials first", "error");
      return;
    }
    
    const cleanUser = builderUser.trim().replace('@', '%40');
    const cleanPass = builderPass.trim().replace(/\s+/g, '');
    
    let uri = '';
    if (builderProvider === 'GMAIL') {
      uri = `smtps://${cleanUser}:${cleanPass}@smtp.gmail.com:465`;
    } else if (builderProvider === 'SENDGRID') {
      uri = `smtps://apikey:${cleanPass}@smtp.sendgrid.net:465`;
    }
    
    const defaultFrom = `${fromName} <${builderUser.trim()}>`;
    
    setSettings({ ...settings, smtpUri: uri, defaultFrom: defaultFrom });
    showToast("Production parameters updated", "success");
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text.trim());
    showToast(`${label} Copied`, "success");
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await dataService.saveSettings(settings);
      await dataService.createAuditLog({
        admin: user,
        title: "SMTP Gateway Finalized",
        type: "SYSTEM_CONFIG",
        severity: "MEDIUM",
        icon: "alternate_email",
        iconBg: "bg-primary"
      });
      showToast("Global configurations saved", 'success');
    } catch (err: any) {
      showToast("Error saving settings", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    setEmailLastError(null);
    showToast(`Initiating handshake for ${builderUser}...`, "info");
    try {
      await dataService.testEmailTrigger();
      showToast("Handshake document created", "success");
      
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const delivery = await dataService.getLastEmailStatus();
        if (delivery?.state === 'ERROR') {
          setEmailLastError(delivery.error);
          setIsEmailVerified(false);
          clearInterval(poll);
          setIsTestingEmail(false);
        } else if (delivery?.state === 'SUCCESS') {
          showToast("Live SMTP Verification Successful!", "success");
          setIsEmailVerified(true);
          const now = new Date().toISOString();
          setSettings(prev => ({ ...prev, emailLastVerified: now }));
          dataService.saveSettings({ ...settings, emailLastVerified: now });
          clearInterval(poll);
          setIsTestingEmail(false);
        }
        if (attempts > 12) {
          clearInterval(poll);
          setIsTestingEmail(false);
          // Fix: Changed "warning" to "info" to match the defined ToastType: 'success' | 'error' | 'info'
          showToast("Handshake timeout: Ensure Extension is active", "info");
        }
      }, 2500);

    } catch (err: any) {
      showToast(err.message || "Test dispatch failed", "error");
      setIsTestingEmail(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        showToast("Uploading logo...", "info");
        const url = await dataService.uploadImage(file, `system/logo_${Date.now()}`);
        setSettings({ ...settings, logo: url });
        showToast("Logo updated", "success");
      } catch (err) {
        showToast("Upload failed", "error");
      }
    }
  };

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
    <div className="flex flex-col min-h-screen bg-transparent pb-32">
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
            <div className="px-8 flex flex-col items-center">
              <div className="relative group">
                <div 
                  onClick={() => adminAvatarInputRef.current?.click()}
                  className="w-32 h-32 rounded-[2.8rem] border-[6px] border-white shadow-soft overflow-hidden bg-gray-100 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                >
                  <img src={user.avatar} className="w-full h-full object-cover" alt="Admin" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="material-symbols-outlined text-white">photo_camera</span>
                  </div>
                </div>
                <input type="file" ref={adminAvatarInputRef} className="hidden" accept="image/*" onChange={handleAdminAvatarUpload} />
              </div>
              <h2 className="mt-6 text-xl font-black text-text-dark uppercase tracking-tight">{user.name}</h2>
              <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mt-1">Platform Administrator</p>
            </div>

            <div className="px-8 grid grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-[2rem] shadow-soft border border-white text-center">
                <p className="text-xl font-black text-text-dark">{statsData.customers}</p>
                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Clients</p>
              </div>
              <div className="bg-white p-5 rounded-[2rem] shadow-soft border border-white text-center">
                <p className="text-xl font-black text-text-dark">{statsData.providers}</p>
                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Experts</p>
              </div>
              <div className="bg-white p-5 rounded-[2rem] shadow-soft border border-white text-center">
                <p className="text-xl font-black text-text-dark">{statsData.rfqs}</p>
                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Queries</p>
              </div>
            </div>

            <div className="px-8 space-y-3 pb-8">
               <button onClick={() => navigate('/admin/audit-log')} className="w-full bg-white p-5 rounded-[1.8rem] shadow-soft border border-white flex items-center justify-between group active:scale-[0.98] transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-[22px]">history_edu</span>
                    </div>
                    <span className="text-[13px] font-bold text-text-dark">Security Audit Logs</span>
                  </div>
                  <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">chevron_right</span>
               </button>
               <button onClick={() => navigate('/admin/categories')} className="w-full bg-white p-5 rounded-[1.8rem] shadow-soft border border-white flex items-center justify-between group active:scale-[0.98] transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-[22px]">category</span>
                    </div>
                    <span className="text-[13px] font-bold text-text-dark">Service Categories</span>
                  </div>
                  <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">chevron_right</span>
               </button>
               <button onClick={onLogout} className="w-full bg-white p-5 rounded-[1.8rem] shadow-soft border border-white flex items-center justify-between group active:scale-[0.98] transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-[22px]">logout</span>
                    </div>
                    <span className="text-[13px] font-bold text-red-500">Sign Out Console</span>
                  </div>
                  <span className="material-symbols-outlined text-gray-200">lock</span>
               </button>
            </div>
          </div>
        ) : (
          <div className="px-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-6">
              <section className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-bold text-text-dark">Global Gateway</h3>
                  <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isEmailVerified ? 'bg-accent-green/10 text-accent-green' : 'bg-red-50 text-red-400'}`}>
                    {isEmailVerified ? 'Live' : 'Handshake Pending'}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">SMTP Provider</label>
                    <div className="flex gap-2">
                      {['GMAIL', 'SENDGRID'].map(p => (
                        <button 
                          key={p} 
                          onClick={() => setBuilderProvider(p as any)}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${builderProvider === p ? 'bg-primary text-white border-primary shadow-lg' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Username / Email</label>
                    <input 
                      className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-[13px] font-bold text-text-dark shadow-inner outline-none focus:ring-1 focus:ring-primary"
                      value={builderUser}
                      onChange={e => setBuilderUser(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">App Password</label>
                    <input 
                      type="password"
                      className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-[13px] font-bold text-text-dark shadow-inner outline-none focus:ring-1 focus:ring-primary"
                      value={builderPass}
                      onChange={e => setBuilderPass(e.target.value)}
                    />
                  </div>

                  <button 
                    onClick={applyUriBuilder}
                    className="w-full py-4 bg-gray-50 text-primary rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-sm active:bg-gray-100"
                  >
                    Sync Parameters
                  </button>
                </div>
              </section>

              <div className="flex gap-4">
                <button 
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="flex-1 bg-primary text-white py-5 rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-btn-glow active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Deploy Global'}
                </button>
                <button 
                  onClick={handleTestEmail}
                  disabled={isTestingEmail}
                  className="flex-1 bg-white border border-gray-100 text-text-dark py-5 rounded-3xl font-black text-[11px] uppercase tracking-widest active:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                  {isTestingEmail ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-lg">bolt</span>}
                  Test Verify
                </button>
              </div>

              {emailLastError && (
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-red-500 text-[10px] font-bold">
                  ERROR: {emailLastError}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 border-t border-gray-100 pb-10 pt-4 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.06)] backdrop-blur-md">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-30 transition-all">
          <div className="w-12 h-10 flex items-center justify-center rounded-2xl"><span className="material-symbols-outlined text-[26px] font-normal">grid_view</span></div>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">HOME</span>
        </button>
        <button onClick={() => navigate('/admin/users')} className="flex-1 flex flex-col items-center gap-1 text-text-light opacity-30 transition-all">
          <div className="w-12 h-10 flex items-center justify-center rounded-2xl"><span className="material-symbols-outlined text-[26px] font-normal">group</span></div>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">USERS</span>
        </button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1 text-text-light opacity-30 transition-all">
          <div className="w-12 h-10 flex items-center justify-center rounded-2xl"><span className="material-symbols-outlined text-[26px] font-normal">format_list_bulleted</span></div>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">QUERIES</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-2xl"><span className="material-symbols-outlined text-[26px] font-normal">person</span></div>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">PROFILE</span>
        </button>
      </nav>
    </div>
  );
};

export default Profile;