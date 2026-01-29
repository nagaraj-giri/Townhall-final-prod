import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, RFQ, UserRole } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

interface QueriesProps {
  user: User;
}

const Queries: React.FC<QueriesProps> = ({ user }) => {
  const navigate = useNavigate();
  const { toggleNotifications, unreadCount, chatUnreadCount } = useApp();
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [queries, setQueries] = useState<RFQ[]>([]);
  
  useEffect(() => {
    const unsub = dataService.listenToRFQs((allRFQs) => {
      if (user.role === UserRole.ADMIN) {
        setQueries([...allRFQs]);
      } else {
        setQueries(allRFQs.filter(r => r.customerId === user.id));
      }
    });
    return () => unsub();
  }, [user.id, user.role]);

  const filteredQueries = useMemo(() => {
    return queries.filter(q => {
      const searchLower = (searchQuery || '').toLowerCase();
      const titleLower = (q.title || '').toLowerCase();
      const matchesSearch = titleLower.includes(searchLower) || (q.idDisplay || '').toLowerCase().includes(searchLower);
      
      const matchesFilter = filter === 'All' || 
                            (filter === 'Open' && q.status === 'OPEN') ||
                            (filter === 'Active' && q.status === 'ACTIVE') ||
                            (filter === 'Accepted' && q.status === 'ACCEPTED') ||
                            (filter === 'Completed' && q.status === 'COMPLETED');
      return matchesSearch && matchesFilter;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [queries, searchQuery, filter]);

  const getStatusCardStyles = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'border-accent-green shadow-[0_15px_30px_rgba(139,195,74,0.12)]';
      case 'COMPLETED': return 'border-accent-green shadow-[0_15px_30px_rgba(139,195,74,0.12)]';
      case 'ACCEPTED': return 'border-accent-pink shadow-[0_15px_30px_rgba(255,105,180,0.12)]';
      case 'OPEN': return 'border-secondary shadow-[0_15px_30px_rgba(255,214,10,0.12)]';
      case 'CANCELED': return 'border-red-400 shadow-[0_15px_30px_rgba(248,113,113,0.12)]';
      default: return 'border-gray-100 shadow-sm';
    }
  };

  const getStatusBadgeStyles = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-accent-green/10 text-accent-green';
      case 'COMPLETED': return 'bg-accent-green/10 text-accent-green';
      case 'ACCEPTED': return 'bg-accent-pink/10 text-accent-pink';
      case 'OPEN': return 'bg-secondary/10 text-text-dark';
      case 'CANCELED': return 'bg-red-50 text-red-500';
      default: return 'bg-gray-100 text-gray-400';
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <header className="px-6 pt-12 pb-6 flex items-center justify-between shrink-0 relative">
        <button onClick={() => navigate('/')} className="text-text-dark w-11 h-11 flex items-center justify-start active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-[28px] font-normal">grid_view</span>
        </button>
        <h1 className="text-xl font-bold text-text-dark uppercase tracking-tight text-center flex-1">All Queries</h1>
        <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 bg-white rounded-full shadow-sm flex items-center justify-center border border-gray-100 active:scale-90 transition-all">
          <span className="material-symbols-outlined text-text-dark text-xl font-normal">notifications</span>
          {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-accent-pink rounded-full border-2 border-white"></div>}
        </button>
      </header>

      <main className="px-6 space-y-6 flex-1 overflow-y-auto no-scrollbar pb-6">
        <div className="relative">
          <span className="absolute inset-y-0 left-5 flex items-center text-gray-400">
            <span className="material-symbols-outlined text-lg">search</span>
          </span>
          <input className="w-full py-4.5 pl-12 bg-white/50 backdrop-blur-md rounded-full border-none shadow-none text-xs font-medium focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-gray-400" placeholder="Search service, ID.." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {['All', 'Open', 'Active', 'Accepted', 'Completed'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest shrink-0 transition-all border ${filter === f ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white text-text-light border-gray-100 shadow-sm'}`}>{f}</button>
          ))}
        </div>

        <div className="space-y-6 pt-2">
          {filteredQueries.length > 0 ? filteredQueries.map((q) => (
            <div key={q.id} onClick={() => navigate(`/rfq/${q.id}`)} className={`bg-white/90 backdrop-blur-sm rounded-[2.5rem] p-6 border flex items-center gap-5 transition-all active:scale-[0.98] cursor-pointer border-l-[6px] ${getStatusCardStyles(q.status)}`}>
              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center shrink-0 shadow-inner">
                <span className="material-symbols-outlined text-xl text-primary font-light">assignment</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h2 className="text-[15px] font-bold text-text-dark uppercase leading-tight tracking-tight truncate pr-2">{q.title}</h2>
                  <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-md tracking-wider ${getStatusBadgeStyles(q.status)}`}>{q.status}</span>
                </div>
                <p className="text-[10px] text-text-light font-bold uppercase tracking-widest">{q.idDisplay} • {q.service}</p>
              </div>
            </div>
          )) : (
            <div className="py-24 text-center opacity-30 flex flex-col items-center">
              <span className="material-symbols-outlined text-7xl text-text-light font-light">folder_open</span>
              <p className="text-[11px] font-bold uppercase tracking-[0.4em] mt-4 text-text-dark">No matching queries</p>
            </div>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-border-light pb-10 pt-4 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.06)]">
        {user.role === UserRole.ADMIN ? (
          <>
            <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60"><span className="material-symbols-outlined text-[28px] font-normal">grid_view</span><span className="text-[9px] font-bold uppercase tracking-widest">HOME</span></button>
            <button onClick={() => navigate('/admin/users')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60"><span className="material-symbols-outlined text-[28px] font-normal">group</span><span className="text-[9px] font-bold uppercase tracking-widest">USERS</span></button>
            <button className="flex-1 flex flex-col items-center gap-1 text-primary">
              <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-2xl relative"><span className="material-symbols-outlined text-[28px] font-normal fill-1">format_list_bulleted</span></div>
              <span className="text-[9px] font-bold uppercase tracking-widest">QUERIES</span>
            </button>
            <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60"><span className="material-symbols-outlined text-[28px] font-normal">settings</span><span className="text-[9px] font-bold uppercase tracking-widest">SYSTEM</span></button>
          </>
        ) : (
          <>
            <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60"><span className="material-symbols-outlined text-[28px] font-normal">home</span><span className="text-[9px] font-bold uppercase tracking-widest">HOME</span></button>
            <button className="flex-1 flex flex-col items-center gap-1 text-primary">
              <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-2xl relative"><span className="material-symbols-outlined text-[28px] font-normal fill-1">format_list_bulleted</span></div>
              <span className="text-[9px] font-bold uppercase tracking-widest">QUERIES</span>
            </button>
            <button onClick={() => navigate('/messages')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60 relative">
              <span className="material-symbols-outlined text-[28px] font-normal">chat_bubble</span>
              {chatUnreadCount > 0 && <div className="absolute top-0 right-3 w-4 h-4 bg-accent-pink rounded-full border-2 border-white text-[8px] font-normal text-white flex items-center justify-center">{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</div>}
              <span className="text-[9px] font-bold uppercase tracking-widest">CHAT</span>
            </button>
            <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60"><span className="material-symbols-outlined text-[28px] font-normal">person</span><span className="text-[9px] font-bold uppercase tracking-widest">PROFILE</span></button>
          </>
        )}
      </nav>
    </div>
  );
};

export default Queries;