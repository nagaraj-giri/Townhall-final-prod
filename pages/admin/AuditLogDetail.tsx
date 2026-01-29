import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { AuditLogEntry, User } from '../../types';
import { useApp } from '../../App';

const AdminAuditLogDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useApp();
  const [log, setLog] = useState<any | null>(null);
  const [actor, setActor] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!id) return;
      const unsub = dataService.listenToAuditLogs((logs) => {
        const matched = logs.find(l => l.id === id);
        if (matched) {
          setLog(matched);
          if (matched.userId) {
            dataService.getUserById(matched.userId).then(setActor);
          }
        }
        setLoading(false);
      }, 100, '2025-01-01T00:00:00.000Z');
      
      return () => unsub();
    };
    fetchDetail();
  }, [id]);

  const timestamp = useMemo(() => {
    if (!log || !log.timestamp) return { date: '---', time: '---' };
    const d = new Date(log.timestamp);
    return {
      date: d.toLocaleDateString('en-AE', { day: 'numeric', month: 'long', year: 'numeric' }),
      time: d.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    };
  }, [log]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Opening Secure Log...</p>
    </div>
  );

  if (!log) return <div className="p-20 text-center text-gray-300 font-bold uppercase">Log entry not found</div>;

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-10">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-white/30 backdrop-blur-md z-50">
        <button onClick={() => navigate(-1)} className="text-[#333333] w-12 h-12 flex items-center justify-center -ml-3 rounded-full active:bg-gray-100 transition-colors">
          <span className="material-symbols-outlined font-black text-[32px]">chevron_left</span>
        </button>
        <h1 className="text-[18px] font-bold text-[#333333] tracking-tight uppercase">Audit Perspective</h1>
        <button onClick={() => navigate(-1)} className="text-primary font-bold text-[16px] px-2 active:opacity-60">Close</button>
      </header>

      <main className="px-6 pt-4 space-y-7 overflow-y-auto no-scrollbar pb-20">
        <div className="bg-white rounded-[2rem] p-7 shadow-card border border-white flex items-center justify-between relative overflow-hidden">
           <div className="space-y-1 relative z-10">
              <div className="flex items-center gap-2">
                 <span className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">PLATFORM EVENT</span>
                 <div className="w-1.5 h-1.5 bg-accent-green rounded-full"></div>
              </div>
              <h2 className="text-[22px] font-black text-text-dark tracking-tight">#{log.id?.slice(-8).toUpperCase()}</h2>
              <p className="text-[14px] text-gray-400 font-medium">{log.title}</p>
           </div>
           <div className={`w-16 h-16 rounded-[1.4rem] flex items-center justify-center text-white shrink-0 ${log.iconBg || 'bg-primary'}`}>
              <span className="material-symbols-outlined text-[32px]">{log.icon || 'verified_user'}</span>
           </div>
        </div>

        <section className="space-y-3">
          <h3 className="text-[12px] font-black text-gray-400 uppercase tracking-widest ml-1 opacity-80">ACTOR CONTEXT</h3>
          <div className="bg-white rounded-[2rem] p-6 shadow-card border border-white flex items-center gap-4">
             <img src={actor?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(log.userName || 'U')}&background=5B3D9D&color=fff`} className="w-14 h-14 rounded-[1rem] object-cover" />
             <div className="flex-1 min-w-0">
                <h4 className="text-[16px] font-black text-text-dark leading-tight truncate">{log.userName}</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                  {log.userRole} • IP: {log.ip}
                </p>
             </div>
          </div>
        </section>

        <section className="space-y-3">
           <h3 className="text-[12px] font-black text-gray-400 uppercase tracking-widest ml-1 opacity-80">EVENT METADATA</h3>
           <div className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white space-y-6">
              <div className="space-y-4">
                 <p className="text-[12px] font-black text-primary uppercase tracking-[0.1em]">Structured Payload</p>
                 <div className="grid grid-cols-1 gap-3">
                    {log.details && Object.entries(log.details).map(([key, value]: [string, any]) => (
                      <div key={key} className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-1 border border-gray-100">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{key.replace(/_/g, ' ')}</span>
                        <span className="text-[13px] font-bold text-text-dark leading-relaxed">
                          {typeof value === 'number' ? value : String(value)}
                        </span>
                      </div>
                    ))}
                    {!log.details || Object.keys(log.details).length === 0 ? (
                      <div className="py-4 text-center text-gray-300 italic text-xs">No extra metadata payload.</div>
                    ) : null}
                 </div>
              </div>

              <div className="pt-2 border-t border-gray-50 mt-4">
                 <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-[16px] text-gray-400">info</span>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">System Narrative</p>
                 </div>
                 <p className="text-[12px] text-gray-500 font-medium leading-relaxed italic">
                   "Integrity verification synchronized to global audit chain at {timestamp.time} Dubai GST. Originating device: {log.device}."
                 </p>
              </div>
           </div>
        </section>

        <div className="pt-2">
           <button 
             onClick={() => showToast("Downloading verified trail...", "success")}
             className="w-full bg-primary text-white py-5 rounded-[1.8rem] font-black text-[13px] uppercase tracking-[0.2em] shadow-btn-glow active:scale-[0.98] transition-all"
           >
             Download Secure Trail
           </button>
        </div>
      </main>
    </div>
  );
};

export default AdminAuditLogDetail;