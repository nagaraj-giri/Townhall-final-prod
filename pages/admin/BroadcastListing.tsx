
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

interface Props { user: User; }

const AdminBroadcastListing: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Implementing real-time listener instead of one-time fetch
    const unsub = dataService.listenToBroadcasts((history) => {
      setBroadcasts(history);
      setIsLoading(false);
    });

    return () => unsub();
  }, [showToast]);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + 
             d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'Recent';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FCF6E7] pb-10">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-50 border-b border-gray-100 shadow-sm">
        <button 
          onClick={() => navigate('/admin/broadcast')} 
          className="text-text-dark w-10 h-10 flex items-center justify-center -ml-2 rounded-full active:bg-gray-100 transition-all active:scale-90"
        >
          <span className="material-symbols-outlined text-2xl font-bold">arrow_back</span>
        </button>
        <h1 className="text-base font-bold text-text-dark text-center flex-1 tracking-tight">Broadcast History</h1>
        <div className="w-10"></div>
      </header>

      <main className="px-5 pt-6 space-y-5 flex-1 overflow-y-auto no-scrollbar flex flex-col items-center">
        {isLoading ? (
          <div className="py-20 text-center text-gray-300 font-bold uppercase text-[10px] tracking-widest animate-pulse w-full">
            Retrieving Global Alerts...
          </div>
        ) : broadcasts.length > 0 ? (
          <div className="w-full space-y-5">
            {broadcasts.map((b) => {
              const totalSent = b.sentToCount || 0;
              const opened = b.openedCount || 0;
              const openRate = totalSent > 0 ? Math.round((opened / totalSent) * 100) : 0;
              const noActionCount = Math.max(0, totalSent - opened);
              
              return (
                <div key={b.id} className="bg-white rounded-[2rem] p-6 shadow-card border border-white space-y-4 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex justify-between items-start">
                     <div>
                        <p className="text-[9px] font-black text-primary uppercase tracking-[0.15em] mb-1">
                          {b.targetRole === 'ALL' ? 'UNIVERSAL' : `${b.targetRole}S`} AUDIENCE
                        </p>
                        <h3 className="text-base font-bold text-text-dark leading-tight">{b.title}</h3>
                     </div>
                     <span className="text-[9px] font-bold text-gray-300 uppercase whitespace-nowrap ml-2">
                        {formatDate(b.timestamp)}
                     </span>
                  </div>
                  
                  <p className="text-[12px] text-gray-500 font-medium leading-relaxed line-clamp-2 italic">
                    "{b.message}"
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-50 mt-4">
                     <div className="bg-gray-50 p-3 rounded-2xl text-center">
                        <p className="text-[14px] font-black text-text-dark">{totalSent}</p>
                        <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest">Total Sent</p>
                     </div>
                     <div className="bg-primary/5 p-3 rounded-2xl text-center">
                        <p className="text-[14px] font-black text-primary">{opened}</p>
                        <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest">Opened/Clicked</p>
                     </div>
                     <div className="bg-red-50 p-3 rounded-2xl text-center">
                        <p className="text-[14px] font-black text-red-500">{noActionCount}</p>
                        <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest">No Action</p>
                     </div>
                     <div className="bg-green-50 p-3 rounded-2xl text-center">
                        <p className="text-[14px] font-black text-[#8BC34A]">{openRate}%</p>
                        <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest">Success Rate</p>
                     </div>
                  </div>
                  
                  {b.actionUrl && b.actionUrl !== '/' && (
                    <div className="pt-2 flex items-center gap-2">
                       <span className="material-symbols-outlined text-gray-300 text-sm">link</span>
                       <p className="text-[9px] text-gray-400 font-bold truncate uppercase tracking-widest">
                         Redirect: {b.actionUrl}
                       </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-32 opacity-30 text-center">
             <span className="material-symbols-outlined text-[80px] font-light text-gray-400">history</span>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-6 text-gray-500">No broadcasts sent yet</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminBroadcastListing;
