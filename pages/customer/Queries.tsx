
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
  const [sortOption, setSortOption] = useState<'Newest' | 'Oldest' | 'Quotes'>('Newest');
  const [isSortOpen, setIsSortOpen] = useState(false);
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

  const filteredAndSortedQueries = useMemo(() => {
    let result = queries.filter(q => {
      const searchLower = (searchQuery || '').toLowerCase();
      const titleLower = (q.title || '').toLowerCase();
      const matchesSearch = titleLower.includes(searchLower) || (q.idDisplay || '').toLowerCase().includes(searchLower);
      
      const matchesFilter = filter === 'All' || 
                            (filter === 'Open' && q.status === 'OPEN') ||
                            (filter === 'Active' && q.status === 'ACTIVE') ||
                            (filter === 'Accepted' && q.status === 'ACCEPTED') ||
                            (filter === 'Completed' && q.status === 'COMPLETED') ||
                            (filter === 'Canceled' && q.status === 'CANCELED');
      return matchesSearch && matchesFilter;
    });

    return [...result].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      if (sortOption === 'Oldest') return dateA - dateB;
      if (sortOption === 'Quotes') return b.quotesCount - a.quotesCount;
      return dateB - dateA;
    });
  }, [queries, searchQuery, filter, sortOption]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'border-orange-400';
      case 'ACTIVE': return 'border-blue-400';
      case 'ACCEPTED': return 'border-primary';
      case 'COMPLETED': return 'border-accent-green';
      case 'CANCELED': return 'border-red-400';
      default: return 'border-gray-300';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-24">
      <header className="px-6 pt-10 pb-4 flex justify-between items-center shrink-0">
        <button onClick={() => navigate('/')} className="text-text-dark active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-2xl font-normal">grid_view</span>
        </button>
        <h1 className="text-xl font-black text-text-dark uppercase">{user.role === UserRole.ADMIN ? 'All Queries' : 'My Queries'}</h1>
        <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-gray-100">
          <span className="material-symbols-outlined text-[#333333] text-xl font-normal">notifications</span>
          {unreadCount > 0 && <div className="absolute top-2 right-2 w-2 h-2 bg-accent-pink border-2 border-white rounded-full"></div>}
        </button>
      </header>

      <main className="px-6 space-y-5 flex-1 overflow-y-auto no-scrollbar pb-6">
        <div className="relative">
          <span className="absolute inset-y-0 left-4 flex items-center text-gray-400"><span className="material-symbols-outlined text-lg font-normal">search</span></span>
          <input className="w-full py-3.5 pl-11 pr-4 bg-white rounded-2xl border-none shadow-card text-xs font-normal focus:ring-1 focus:ring-primary outline-none" placeholder="Search service, ID.." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {['All', 'Open', 'Active', 'Accepted', 'Completed', 'Canceled'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest shrink-0 transition-all ${filter === f ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-50'}`}>{f}</button>
          ))}
        </div>

        {user.role === UserRole.ADMIN && (
          <div className="flex justify-end items-center gap-2 mb-1 relative">
            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Sort:</span>
            <button 
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-1 text-[11px] font-black text-primary uppercase active:scale-95 transition-transform"
            >
              {sortOption === 'Quotes' ? 'Most Quotes' : sortOption}
              <span className="material-symbols-outlined text-sm font-black">expand_more</span>
            </button>
            {isSortOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsSortOpen(false)}></div>
                <div className="absolute top-7 right-0 w-36 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95">
                  {(['Newest', 'Oldest', 'Quotes'] as const).map(opt => (
                    <button 
                      key={opt}
                      onClick={() => { setSortOption(opt); setIsSortOpen(false); }}
                      className={`w-full px-4 py-2.5 text-left text-[11px] font-bold ${sortOption === opt ? 'text-primary bg-primary/5' : 'text-text-dark hover:bg-gray-50'}`}
                    >
                      {opt === 'Quotes' ? 'Most Quotes' : opt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="space-y-4 pt-2">
          {filteredAndSortedQueries.length > 0 ? filteredAndSortedQueries.map((q) => (
            <div key={q.id} onClick={() => navigate(`/rfq/${q.id}`)} className={`bg-white rounded-[2rem] p-5 shadow-card border-l-[6px] transition-all active:scale-[0.98] cursor-pointer ${getStatusColor(q.status)}`}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-gray-50 flex items-center justify-center text-primary"><span className="material-symbols-outlined text-xl font-normal">assignment</span></div>
                  <div><h2 className="text-sm font-black text-text-dark uppercase">{q.title}</h2><p className="text-[10px] text-gray-400 mt-0.5 font-normal">{q.idDisplay} • {q.category}</p></div>
                </div>
                <span className={`px-2 py-1 text-[8px] font-black uppercase rounded ${
                  q.status === 'OPEN' ? 'bg-orange-50 text-orange-500' :
                  q.status === 'ACTIVE' ? 'bg-blue-50 text-blue-500' :
                  q.status === 'ACCEPTED' ? 'bg-primary/5 text-primary' :
                  q.status === 'COMPLETED' ? 'bg-green-50 text-green-600' :
                  'bg-gray-50 text-gray-400'
                }`}>{q.status === 'OPEN' ? 'OPENED' : q.status}</span>
              </div>
            </div>
          )) : (
            <div className="py-20 text-center opacity-30">
               <span className="material-symbols-outlined text-5xl">folder_open</span>
               <p className="text-[10px] font-black uppercase tracking-widest mt-4">No results found in {filter}</p>
            </div>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-gray-100 pb-10 pt-3 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60">
          <span className="material-symbols-outlined text-[24px] font-normal">home</span>
          <span className="text-[9px] font-normal uppercase tracking-widest">HOME</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1.5 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-xl">
             <span className="material-symbols-outlined text-[24px] font-normal">format_list_bulleted</span>
          </div>
          <span className="text-[9px] font-normal uppercase tracking-widest">QUERIES</span>
        </button>
        <button onClick={() => navigate('/messages')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light relative opacity-60">
          <span className="material-symbols-outlined text-[24px] font-normal">chat_bubble</span>
          {chatUnreadCount > 0 && <div className="absolute top-0 right-3 w-4 h-4 bg-accent-pink rounded-full border-2 border-white text-[8px] font-normal text-white flex items-center justify-center">{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</div>}
          <span className="text-[9px] font-normal uppercase tracking-widest">CHAT</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60">
          <span className="material-symbols-outlined text-[24px] font-normal">person</span>
          <span className="text-[9px] font-normal uppercase tracking-widest">PROFILE</span>
        </button>
      </nav>
    </div>
  );
};

export default Queries;
