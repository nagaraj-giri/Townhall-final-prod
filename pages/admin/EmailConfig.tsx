
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, EmailConfig, UserRole } from '../../types';
import { dataService } from '../services/dataService';
import { EMAIL_TEMPLATES } from '../../AlertsEngine/email_template/templates';
import { useApp } from '../../App';

interface Props { user: User; }

const EmailConfigPage: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<EmailConfig>({ triggers: {}, templateOverrides: {} });
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await dataService.getEmailConfig();
        setConfig({
          triggers: data.triggers || {},
          templateOverrides: data.templateOverrides || {}
        });
      } catch (err) {
        showToast("Configuration sync failed", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const scenarios = useMemo(() => {
    return Object.keys(EMAIL_TEMPLATES).map(key => {
      // Mock data for template generation
      const mockData = { 
        name: 'Verified Partner', 
        title: 'Premium Project Lead', 
        location: 'Business Bay, Dubai', 
        id: 'DXB-8821', 
        customerName: 'Executive Client' 
      };
      
      const template = (EMAIL_TEMPLATES as any)[key](mockData);
      const override = config.templateOverrides?.[key];
      const triggerState = config.triggers[key] || { email: true, inApp: true };
      
      return {
        id: key,
        ...template,
        currentSubject: override?.subject || template.data.Subject,
        currentHtml: override?.html || template.data.html,
        emailEnabled: triggerState.email,
        inAppEnabled: triggerState.inApp
      };
    });
  }, [config.triggers, config.templateOverrides]);

  const filteredScenarios = useMemo(() => {
    return scenarios.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [scenarios, searchQuery]);

  const handleToggle = (id: string, channel: 'email' | 'inApp') => {
    const currentState = config.triggers[id] || { email: true, inApp: true };
    setConfig(prev => ({
      ...prev,
      triggers: { 
        ...prev.triggers, 
        [id]: { ...currentState, [channel]: !currentState[channel] }
      }
    }));
  };

  const handleUpdateOverride = (id: string, field: 'subject' | 'html', value: string) => {
    setConfig(prev => ({
      ...prev,
      templateOverrides: {
        ...prev.templateOverrides,
        [id]: {
          ...(prev.templateOverrides?.[id] || {}),
          [field]: value
        }
      }
    }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await dataService.saveEmailConfig(config);
      await dataService.createAuditLog({
        admin: user,
        title: "Alert Logic Synchronized",
        type: "SYSTEM_CONFIG",
        severity: "MEDIUM",
        icon: "cloud_sync",
        iconBg: "bg-primary",
        eventId: "TRIGGER_SYNC"
      });
      showToast("Trigger logic is now live", "success");
      setEditingId(null);
    } catch (err) {
      showToast("Failed to commit changes", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF9F6] pb-32">
      <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-40 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="w-11 h-11 flex items-center justify-start text-text-dark active:scale-90 transition-transform">
          <span className="material-symbols-outlined font-black text-[28px]">arrow_back</span>
        </button>
        <h1 className="text-lg font-black text-text-dark uppercase tracking-tight">Alert Configuration</h1>
        <div className="flex items-center gap-2 px-3 py-1 bg-accent-green/10 rounded-full">
           <div className="w-1.5 h-1.5 bg-accent-green rounded-full animate-pulse"></div>
           <span className="text-[8px] font-black text-accent-green uppercase">Engine Linked</span>
        </div>
      </header>

      <main className="px-6 pt-6 space-y-6 flex-1 overflow-y-auto no-scrollbar">
        <div className="bg-primary p-6 rounded-[2.5rem] shadow-btn-glow text-white relative overflow-hidden">
           <div className="relative z-10 space-y-2">
              <h2 className="text-sm font-black uppercase tracking-[0.1em]">AIRRA Logic Controller</h2>
              <p className="text-[11px] text-white/80 font-medium leading-relaxed max-w-[240px]">
                Manage the automated "Voice" of the marketplace. Changes here affect global lead matching emails and app alerts.
              </p>
           </div>
           <div className="absolute -bottom-6 -right-6 opacity-10">
              <span className="material-symbols-outlined text-[120px]">hub</span>
           </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center px-5 py-4 focus-within:ring-1 focus-within:ring-primary transition-all">
          <span className="material-symbols-outlined text-gray-400 mr-3">search</span>
          <input 
            className="bg-transparent border-none focus:ring-0 p-0 text-[14px] font-bold w-full placeholder-gray-300 outline-none"
            placeholder="Search triggers..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          {filteredScenarios.map((s) => (
            <div key={s.id} className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white space-y-6 transition-all animate-in fade-in slide-in-from-bottom-2">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[8px] font-black uppercase px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 border border-gray-100">
                      {s.recipientRole === UserRole.PROVIDER ? 'Provider Alert' : 'Customer Alert'}
                    </span>
                    <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">{s.id}</p>
                  </div>
                  <h3 className="text-[17px] font-black text-text-dark uppercase tracking-tight">{s.name}</h3>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${s.emailEnabled || s.inAppEnabled ? 'bg-primary/5 text-primary' : 'bg-gray-50 text-gray-300'}`}>
                   <span className="material-symbols-outlined">{s.id === 'NEW_LEAD' ? 'radar' : 'payments'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <button 
                  onClick={() => handleToggle(s.id, 'email')}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${s.emailEnabled ? 'bg-primary/5 border-primary/20 text-primary shadow-sm' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                 >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[20px]">{s.emailEnabled ? 'mail' : 'mail_outline'}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest">Email</span>
                    </div>
                    <span className="material-symbols-outlined text-[18px]">{s.emailEnabled ? 'check_circle' : 'circle'}</span>
                 </button>
                 
                 <button 
                  onClick={() => handleToggle(s.id, 'inApp')}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${s.inAppEnabled ? 'bg-accent-pink/5 border-accent-pink/20 text-accent-pink shadow-sm' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                 >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[20px]">notifications_active</span>
                      <span className="text-[10px] font-black uppercase tracking-widest">In-App</span>
                    </div>
                    <span className="material-symbols-outlined text-[18px]">{s.inAppEnabled ? 'check_circle' : 'circle'}</span>
                 </button>
              </div>

              {editingId === s.id ? (
                <div className="space-y-5 pt-6 animate-in slide-in-from-top-4 border-t border-gray-50">
                  <div className="flex justify-between items-center px-1">
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Template Editor</p>
                     <button onClick={() => setPreviewMode(!previewMode)} className="text-[10px] font-black text-primary uppercase flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">{previewMode ? 'code' : 'visibility'}</span>
                        {previewMode ? 'View Source' : 'Preview Output'}
                     </button>
                  </div>
                  
                  {!previewMode ? (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest ml-1">Subject Header</label>
                        <input 
                          value={s.currentSubject}
                          onChange={e => handleUpdateOverride(s.id, 'subject', e.target.value)}
                          className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-[13px] font-bold text-text-dark focus:ring-1 focus:ring-primary shadow-inner"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest ml-1">HTML Structure</label>
                        <textarea 
                          value={s.currentHtml}
                          onChange={e => handleUpdateOverride(s.id, 'html', e.target.value)}
                          className="w-full px-5 py-5 bg-gray-50 border-none rounded-[1.5rem] text-[11px] font-mono text-indigo-600 focus:ring-1 focus:ring-primary shadow-inner min-h-[260px] resize-none leading-relaxed"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="bg-gray-100 rounded-[2rem] p-6 min-h-[300px] border border-gray-200 overflow-hidden shadow-inner">
                       <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100" dangerouslySetInnerHTML={{ __html: s.currentHtml }}></div>
                    </div>
                  )}
                  
                  <button onClick={() => {setEditingId(null); setPreviewMode(false);}} className="w-full py-4 bg-gray-50 rounded-2xl text-[11px] font-black text-gray-400 uppercase tracking-widest active:bg-gray-100 transition-colors">Close Editor</button>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="flex items-start gap-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-50">
                    <span className="material-symbols-outlined text-gray-300 text-[20px]">help_center</span>
                    <p className="text-[11px] text-gray-400 font-medium leading-relaxed italic">{s.helperText}</p>
                  </div>
                  <button 
                    onClick={() => setEditingId(s.id)}
                    className="w-full bg-white border border-gray-200 py-4 rounded-[1.5rem] flex items-center justify-center gap-2.5 text-[10px] font-black text-text-dark uppercase tracking-widest active:scale-[0.98] transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                    Customize Template
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="pb-10 pt-4 flex flex-col items-center gap-4 opacity-30 text-center px-10">
           <span className="material-symbols-outlined text-4xl">verified_user</span>
           <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
             Security Policy: All automated communications are logged and audited in the System Registry.
           </p>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto p-8 bg-white/90 backdrop-blur-xl z-50 border-t border-gray-100 shadow-[0_-20px_40px_rgba(0,0,0,0.04)]">
        <button 
          onClick={handleSaveAll}
          disabled={saving}
          className="w-full bg-primary text-white py-5 rounded-full font-black text-[13px] uppercase tracking-[0.2em] shadow-btn-glow active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <span className="material-symbols-outlined text-xl font-black">sync_alt</span>
              Commit to Engine
            </>
          )}
        </button>
      </footer>
    </div>
  );
};

export default EmailConfigPage;
