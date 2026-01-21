
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { AuditLogEntry } from '../../types';
import { useApp } from '../../App';

const AdminAuditLog: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [logLimit, setLogLimit] = useState(20);
  
  // As per instruction: get historical logs from December 2025 to till date
  const startDate = '2025-12-01T00:00:00.000Z';

  useEffect(() => {
    const unsub = dataService.listenToAuditLogs((data) => {
      setLogs(data);
      setLoading(false);
    }, logLimit, startDate);
    return () => unsub();
  }, [logLimit, startDate]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const search = searchQuery.toLowerCase();
      return (
        log.userName?.toLowerCase().includes(search) ||
        log.title?.toLowerCase().includes(search) ||
        log.ip?.includes(search) ||
        log.eventId?.toLowerCase().includes(search)
      );
    });
  }, [logs, searchQuery]);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-32">
      <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 bg-white/10 backdrop-blur-md z-50">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center -ml-2 rounded-full active:bg-gray-100 transition-all active:scale-90">
          <span className="material-symbols-outlined text-2xl font-bold">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold text-text-dark text-center flex-1 tracking-tight">Audit Log</h1>
        <button className="w-11 h-11 bg-primary/5 rounded-full flex items-center justify-center text-primary active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-2xl">download</span>
        </button>
      </header>

      <main className="px-6 space-y-6 overflow-y-auto no-scrollbar pt-2">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center px-4 py-3 focus-within:ring-1 focus-within:ring-primary transition-all">
          <span className="material-symbols-outlined text-gray-400 mr-3">search</span>
          <input 
            type="text" 
            placeholder="Search user, IP, or event..." 
            className="flex-1 bg-transparent border-none p-0 text-sm font-medium text-text-dark outline-none focus:ring-0 placeholder-gray-300"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          {/* Highlighted Date Range button as per screenshot */}
          <button className="flex-1 bg-primary text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md">
            DATE RANGE <span className="material-symbols-outlined text-base">calendar_month</span>
          </button>
          <button className="flex-1 bg-white border border-gray-100 text-gray-400 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm">
            ROLE <span className="material-symbols-outlined text-base">expand_more</span>
          </button>
          <button className="flex-1 bg-white border border-gray-100 text-gray-400 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm">
            CATEGORY <span className="material-symbols-outlined text-base">page_info</span>
          </button>
        </div>

        <div className="flex justify-between items-center px-1">
          <h3 className="text-[12px] font-black text-primary uppercase tracking-[0.15em]">System Activities</h3>
          <div className="bg-primary/10 px-3 py-1 rounded-md flex items-center gap-1.5">
             <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
             <span className="text-[9px] font-black text-primary uppercase tracking-widest">Live</span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center animate-pulse">
            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Retrieving logs...</span>
          </div>
        ) : filteredLogs.length > 0 ? (
          <div className="space-y-4 pb-20">
            {filteredLogs.map((log) => (
              <div key={log.id} className="bg-white rounded-[2rem] p-6 shadow-card border border-white space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-start">
                   <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 ${log.iconBg || 'bg-primary'}`}>
                         <span className="material-symbols-outlined text-2xl">{log.icon || 'history_edu'}</span>
                      </div>
                      <div className="min-w-0">
                         <h4 className="text-[15px] font-black text-text-dark leading-tight">{log.title}</h4>
                         <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${log.severity === 'HIGH' ? 'text-red-500' : 'text-primary'}`}>
                           {log.severity === 'HIGH' ? `Severity: ${log.severity}` : `Event ID: #${log.eventId || log.id.substring(0,6)}`}
                         </p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{formatDate(log.timestamp)}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                        log.userRole === 'ADMIN' ? 'bg-primary/10 text-primary' : 
                        log.userRole === 'PROVIDER' ? 'bg-blue-50 text-blue-500' :
                        log.userRole === 'USER' ? 'bg-purple-50 text-purple-500' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {log.userRole || 'UNKNOWN'}
                      </span>
                   </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                   <div className="flex items-center gap-2 text-gray-500">
                      <span className="material-symbols-outlined text-lg">person</span>
                      <p className="text-[13px] font-bold truncate">{log.userName || 'Anonymous Entity'}</p>
                   </div>
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-400">
                         <span className="material-symbols-outlined text-lg">devices</span>
                         <p className="text-[11px] font-medium truncate">{log.device || 'System Component'} • IP: {log.ip || 'Local'}</p>
                      </div>
                      <button className="flex items-center gap-1 text-primary text-[11px] font-black uppercase tracking-widest">
                         Details <span className="material-symbols-outlined text-sm font-black">chevron_right</span>
                      </button>
                   </div>
                </div>
              </div>
            ))}
            
            <button 
              onClick={() => setLogLimit(prev => prev + 20)}
              className="w-full py-6 flex flex-col items-center gap-2 opacity-50 active:opacity-100 transition-opacity"
            >
               <span className="material-symbols-outlined text-2xl font-light">history</span>
               <p className="text-[10px] font-black uppercase tracking-[0.3em]">Load Previous Activities</p>
            </button>
          </div>
        ) : (
          <div className="py-24 text-center opacity-30 flex flex-col items-center">
             <span className="material-symbols-outlined text-[80px] font-light text-gray-300">manage_search</span>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-6">No matching activities found</p>
          </div>
        )}

        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm">
           <button 
            onClick={() => showToast("Preparing full CSV export...", "info")}
            className="w-full bg-primary text-white py-5 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-btn-glow active:scale-95 transition-all flex items-center justify-center gap-3"
           >
              <span className="material-symbols-outlined text-xl">ios_share</span>
              Export Log
           </button>
        </div>
      </main>
    </div>
  );
};

export default AdminAuditLog;
