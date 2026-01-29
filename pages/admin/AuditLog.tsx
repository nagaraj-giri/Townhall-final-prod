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
        <button onClick={() => navigate('/')} className="w-10 h-10 flex items-center justify-center -ml-2 rounded-full active:bg-gray-100 transition-all active:scale-90">
          <span className="material-symbols-outlined text-2xl font-bold">arrow_back</span>
        </button>
        <h1 className="text-xl font-black text-text-dark text-center flex-1 tracking-tight">Audit Log</h1>
        <button className="w-11 h-11 bg-primary/5 rounded-full flex items-center justify-center text-primary active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-2xl">download</span>
        </button>
      </header>

      <main className="px-6 space-y-6 overflow-y-auto no-scrollbar pt-2">
        <div className="bg-white rounded-2xl shadow-sm border border-border-light flex items-center px-4 py-3 focus-within:ring-1 focus-within:ring-primary transition-all">
          <span className="material-symbols-outlined text-text-light mr-3">search</span>
          <input 
            type="text" 
            placeholder="Search activities..." 
            className="flex-1 bg-transparent border-none p-0 text-sm font-medium text-text-dark outline-none focus:ring-0 placeholder-text-light/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button className="flex-1 bg-primary text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md">
            DATE RANGE <span className="material-symbols-outlined text-base">calendar_month</span>
          </button>
          <button className="flex-1 bg-white border border-border-light text-text-light py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm">
            ROLE <span className="material-symbols-outlined text-base">expand_more</span>
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center animate-pulse">
            <span className="text-[10px] font-black text-text-light uppercase tracking-widest">Retrieving logs...</span>
          </div>
        ) : filteredLogs.length > 0 ? (
          <div className="space-y-4 pb-20">
            {filteredLogs.map((log) => (
              <div 
                key={log.id} 
                onClick={() => navigate(`/admin/audit-log/${log.id}`)}
                className="bg-white rounded-[2rem] p-6 shadow-card border border-border-light space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 active:scale-[0.98] cursor-pointer"
              >
                <div className="flex justify-between items-start">
                   <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 ${log.iconBg || 'bg-primary'}`}>
                         <span className="material-symbols-outlined text-2xl">{log.icon || 'history_edu'}</span>
                      </div>
                      <div className="min-w-0">
                         <h4 className="text-[15px] font-black text-text-dark leading-tight">{log.title}</h4>
                         <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${log.severity === 'HIGH' ? 'text-red-500' : 'text-primary'}`}>
                           ID: #{log.eventId || log.id.substring(0,6)}
                         </p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-bold text-text-light whitespace-nowrap">{formatDate(log.timestamp)}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-gray-50 text-text-light border border-border-light`}>
                        {log.userRole || 'UNKNOWN'}
                      </span>
                   </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                   <div className="flex items-center gap-2 text-text-light">
                      <span className="material-symbols-outlined text-lg">person</span>
                      <p className="text-[13px] font-bold truncate text-text-dark">{log.userName || 'Anonymous Entity'}</p>
                   </div>
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-text-light">
                         <span className="material-symbols-outlined text-lg">devices</span>
                         <p className="text-[11px] font-medium truncate">{log.device || 'System'} • IP: {log.ip || 'Local'}</p>
                      </div>
                      <button className="flex items-center gap-1 text-primary text-[11px] font-black uppercase tracking-widest">
                         Details <span className="material-symbols-outlined text-sm font-black">chevron_right</span>
                      </button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center opacity-30 flex flex-col items-center">
             <span className="material-symbols-outlined text-[80px] font-light text-text-light">manage_search</span>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-6 text-text-light">No records found</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminAuditLog;