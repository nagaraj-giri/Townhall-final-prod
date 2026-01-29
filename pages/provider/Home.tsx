import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, RFQ, Quote } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';
import { calculateDistance, calculateActiveRadius } from '../../LeadEngine/LeadMatcher';

interface HomeProps { user: User; }

const Home: React.FC<HomeProps> = ({ user }) => {
  const navigate = useNavigate();
  const app = useApp();
  const { unreadCount, toggleNotifications, chatUnreadCount } = app;
  
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [myQuotes, setMyQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsubQuotes = dataService.listenToQuotesByProvider(user.id, (all) => {
      setMyQuotes(all);
    });

    const unsubRfqs = dataService.listenToRFQs((all) => {
      const filtered = all.filter(r => {
        if (r.status === 'CANCELED') return false;
        const isCategoryMatch = (user.services || []).includes(r.service);
        const isOpen = (r.status === 'OPEN' || r.status === 'ACTIVE');
        const distance = (user.location && r.lat) 
          ? calculateDistance(user.location.lat, user.location.lng, r.lat, r.lng)
          : 999; 
        const isWithinRadius = distance <= (r.searchRadius || 3);
        
        return isCategoryMatch && isOpen && isWithinRadius;
      });
      setRfqs(filtered);
      setIsLoading(false);
    });

    return () => {
      unsubQuotes();
      unsubRfqs();
    };
  }, [user]);

  const stats = useMemo(() => {
    if (!user) return { activeLeads: 0, wins: 0, rating: 0 };
    const activeWins = myQuotes.filter(q => q.status === 'ACCEPTED').length;
    const quotedRfqIds = new Set(myQuotes.map(q => q.rfqId));
    const leadsAvailable = rfqs.filter(r => !quotedRfqIds.has(r.id));

    return {
      activeLeads: leadsAvailable.length,
      wins: activeWins,
      rating: user.rating || 0 
    };
  }, [rfqs, myQuotes, user?.rating]);

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-transparent">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen pb-28 bg-transparent">
      <header className="px-6 pt-14 pb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-white rounded-2xl overflow-hidden border-2 border-white shadow-soft">
             <img src={user.avatar} className="w-full h-full object-cover" alt="Provider Logo" onError={(e) => (e.currentTarget.src = 'https://i.postimg.cc/mD8z7D7Y/default-avatar.png')} />
          </div>
          <div>
            <p className="text-[10px] text-text-light font-bold uppercase tracking-widest leading-none mb-1">PROVIDER PORTAL</p>
            <h1 className="text-[22px] font-bold text-text-dark leading-none tracking-tight">Salam, {(user.name || 'User').split(' ')[0]}</h1>
          </div>
        </div>
        <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-soft border border-border-light active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-xl text-text-dark opacity-40 font-normal">notifications</span>
          {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white"></div>}
        </button>
      </header>

      <main className="flex-1 px-6 space-y-6">
        <div className="bg-white/90 backdrop-blur-sm p-10 rounded-[3rem] shadow-soft border border-white text-center space-y-6 animate-in zoom-in-95 duration-500">
           <div className="w-20 h-20 bg-[#F2F0F9] text-primary rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
              <span className="material-symbols-outlined text-[42px] font-normal">radar</span>
           </div>
           <div>
              <h2 className="text-2xl font-bold text-text-dark tracking-tight">Discovery Center</h2>
              <p className="text-[13px] text-text-light font-medium mt-2 leading-relaxed px-4">
                {stats.activeLeads} leads within range matching your expertise
              </p>
           </div>
           <button onClick={() => navigate('/leads')} className="w-full bg-primary text-white py-5 rounded-2xl font-bold text-[13px] uppercase tracking-widest shadow-btn-glow active:scale-[0.98] transition-all">
             OPEN LEAD BOARD
           </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="bg-white/90 backdrop-blur-sm rounded-[2.5rem] py-10 px-6 shadow-card border border-white text-center flex flex-col items-center justify-center gap-2">
              <p className="text-[10px] font-bold text-text-light uppercase tracking-[0.15em] mb-1">CONTRACTS WON</p>
              <p className="text-[48px] font-bold text-accent-green leading-none tracking-tighter">{stats.wins}</p>
           </div>
           <div className="bg-white/90 backdrop-blur-sm rounded-[2.5rem] py-10 px-6 shadow-card border border-white text-center flex flex-col items-center justify-center gap-2">
              <p className="text-[10px] font-bold text-text-light uppercase tracking-[0.15em] mb-1">RATING</p>
              <p className="text-[48px] font-bold text-text-dark leading-none tracking-tighter">{stats.rating > 0 ? stats.rating.toFixed(1) : '---'}</p>
              <div className="flex gap-0.5 text-secondary">
                 <span className={`material-symbols-outlined text-sm ${stats.rating > 0 ? 'fill-1' : 'opacity-20'}`}>star</span>
              </div>
           </div>
        </div>

        <div className="text-center pt-2">
           <p className="text-[11px] font-bold text-text-light uppercase tracking-[0.2em]">Live Data Sync active</p>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-border-light pb-10 pt-3 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-xl">
            <span className="material-symbols-outlined text-[28px] font-normal fill-1">home</span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest">HOME</span>
        </button>
        <button onClick={() => navigate('/leads')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light">
          <span className="material-symbols-outlined text-[28px] font-normal">grid_view</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">LEADS</span>
        </button>
        <button onClick={() => navigate('/messages')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light relative">
          <span className="material-symbols-outlined text-[28px] font-normal">chat_bubble</span>
          {chatUnreadCount > 0 && <div className="absolute top-0 right-3 w-4 h-4 bg-accent-pink rounded-full border-2 border-white text-[8px] font-bold text-white flex items-center justify-center">{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</div>}
          <span className="text-[9px] font-bold uppercase tracking-widest">CHAT</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light">
          <span className="material-symbols-outlined text-[28px] font-normal">person</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">PROFILE</span>
        </button>
      </nav>
    </div>
  );
};

export default Home;