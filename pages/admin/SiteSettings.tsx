import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

const AdminSiteSettings: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    siteName: 'Town Hall UAE',
    logo: 'https://i.postimg.cc/mD8z7DqZ/townhall-logo.png'
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await dataService.getSettings();
        if (data) {
          setSettings({
            siteName: data.siteName || 'Town Hall UAE',
            logo: data.logo || 'https://i.postimg.cc/mD8z7DqZ/townhall-logo.png'
          });
        }
      } catch (err) {
        showToast("Failed to load settings", "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!settings.siteName.trim()) {
      showToast("Site name cannot be empty", "error");
      return;
    }
    setIsSaving(true);
    try {
      await dataService.saveSettings(settings);
      showToast("Site settings updated", "success");
      // Optionally trigger a reload or context update if global branding depends on it
    } catch (err) {
      showToast("Failed to save", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    showToast("Uploading logo...", "info");
    try {
      const url = await dataService.uploadImage(file, `branding/logo_${Date.now()}`);
      setSettings(prev => ({ ...prev, logo: url }));
      showToast("Logo uploaded. Remember to save changes.", "success");
    } catch (err) {
      showToast("Upload failed", "error");
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-32">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-white/10 backdrop-blur-md z-50">
        <button onClick={() => navigate(-1)} className="text-text-dark w-10 h-10 flex items-center justify-start active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-2xl font-bold">arrow_back</span>
        </button>
        <h1 className="text-[17px] font-bold text-text-dark text-center flex-1 tracking-tight">Site Configuration</h1>
        <div className="w-10"></div>
      </header>

      <main className="px-6 pt-6 space-y-8 flex-1 overflow-y-auto no-scrollbar">
        <section className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white space-y-8">
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <div className="w-32 h-32 rounded-3xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden shadow-inner">
                <img src={settings.logo} className="w-full h-full object-contain p-4" alt="Site Logo" />
              </div>
              <button 
                onClick={() => logoInputRef.current?.click()}
                className="absolute bottom-[-10px] right-[-10px] w-10 h-10 bg-primary text-white rounded-full border-4 border-white shadow-lg flex items-center justify-center active:scale-90 transition-transform"
              >
                <span className="material-symbols-outlined text-xl">upload</span>
              </button>
              <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Platform Logo</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-text-dark ml-1 uppercase tracking-widest opacity-60">Marketplace Name</label>
              <input 
                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-[14px] font-bold text-text-dark focus:ring-1 focus:ring-primary outline-none shadow-inner"
                value={settings.siteName}
                onChange={e => setSettings({ ...settings, siteName: e.target.value })}
              />
            </div>
          </div>
        </section>

        <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 flex gap-4">
           <span className="material-symbols-outlined text-blue-500 text-2xl">info</span>
           <p className="text-[11px] text-blue-600 font-medium leading-relaxed">
             Changes to the site name and logo will update the branding across all user dashboards and automated communications.
           </p>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto p-6 bg-white/10 backdrop-blur-md border-t border-gray-100 flex gap-4 z-50">
        <button onClick={() => navigate(-1)} className="flex-1 py-4.5 bg-white border border-gray-100 rounded-2xl text-[14px] font-bold text-text-dark active:scale-95 transition-all">Discard</button>
        <button onClick={handleSave} disabled={isSaving} className="flex-[1.5] py-4.5 bg-primary text-white rounded-2xl font-bold text-[14px] shadow-btn-glow flex items-center justify-center gap-2.5 active:scale-95 transition-all disabled:opacity-50">
          {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><span className="material-symbols-outlined text-[20px]">save</span>Deploy Branding</>}
        </button>
      </footer>
    </div>
  );
};

export default AdminSiteSettings;