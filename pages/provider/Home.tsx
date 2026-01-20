import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, RFQ, Quote } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';
import { calculateDistance } from '../../LeadEngine/LeadMatcher';

interface HomeProps { user: User; }

const Home: React.FC<HomeProps> = ({ user }) => {
  const navigate = useNavigate();
  const { unreadCount, toggleNotifications, chatUnreadCount } = useApp();
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [myQuotes, setMyQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubQuotes = dataService.listenToQuotes((all) => {
      setMyQuotes(all.filter(q => q.providerId === user.id));
    });

    const unsubRfqs = dataService.listenToRFQs((all) => {
      // GEOMETRIC FILTERING LOGIC:
      // 1. Must match the service category
      // 2. Must be within the current search radius of the RFQ
      // 3. Must NOT be CANCELED
      // 4. Must be OPEN or ACTIVE
      const filtered = all.filter(r => {
        if (r.status === 'CANCELED') return false;
        
        const isCategoryMatch = (user.services || []).includes(r.service);
        const isOpen = (r.status === 'OPEN' || r.status === 'ACTIVE');
        
        // Calculate real-world distance in KM
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
    // Only count quotes for RFQs that are still active or completed (not canceled)
    // We need to fetch all RFQs to check their status for existing quotes
    const activeWins = myQuotes.filter(q => q.status === 'ACCEPTED').length;
    
    const quotedRfqIds = new Set(myQuotes.map(q => q.rfqId));
    const leadsAvailable = rfqs.filter(r => !quotedRfqIds.has(r.id));
    
    return {
      activeLeads: leadsAvailable.length,
      wins: activeWins,
      rating: user.rating || 0
    };
  }, [rfqs, myQuotes, user.rating]);

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen pb-28 bg-transparent">
      <header className="px-6 pt-14 pb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={user.avatar} className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-sm" alt="" />
          <div>
            <p className="text-[10px] text-text-light font-normal uppercase tracking-widest leading-none mb-0.5 opacity-60">PROVIDER PORTAL</p>
            <h1 className="text-lg font-black text-text-dark leading-none">Salam, {(user.name || 'User').split(' ')[0]}</h1>
          </div>
        </div>
        <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 rounded-[1.2rem] bg-white flex items-center justify-center shadow-card border border-gray-100">
          <span className="material-symbols-outlined text-xl font-normal">notifications</span>
          {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white shadow-sm"></div>}
        </button>
      </header>

      <main className="flex-1 px-6 space-y-6">
        <div onClick={() => navigate('/leads')} className="bg-white p-8 rounded-[2.5rem] border border-gray-50 shadow-soft text-center space-y-4 active:scale-[0.98] transition-all cursor-pointer">
          <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center mx-auto text-primary">
            <span className="material-symbols-outlined text-3xl font-normal">radar</span>
          </div>
          <div>
            <h2 className="text-xl font-black text-text-dark tracking-tight">Discovery Center</h2>
            <p className="text-xs text-text-light font-normal">{stats.activeLeads} leads within range matching your expertise</p>
          </div>
          <div className="inline-flex bg-primary text-white px-8 py-3 rounded-full text-[11px] font-normal uppercase tracking-widest shadow-lg">Open Lead Board</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-card text-center">
            <p className="text-[10px] font-normal text-text-light uppercase mb-2">Contracts Won</p>
            <p className="text-3xl font-black text-accent-green">{stats.wins}</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-card text-center">
            <p className="text-[10px] font-normal text-text-light uppercase mb-2">Rating</p>
            <div className="flex items-center justify-center gap-1">
              <p className="text-3xl font-black text-text-dark">{stats.rating > 0 ? stats.rating.toFixed(1) : '---'}</p>
              {stats.rating > 0 && <span className="material-icons text-secondary text-base">star</span>}
            </div>
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-gray-100 pb-10 pt-3 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-xl">
            <span className="material-symbols-outlined text-[26px] font-normal">home</span>
          </div>
          <span className="text-[9px] font-normal uppercase tracking-widest">HOME</span>
        </button>
        <button onClick={() => navigate('/leads')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60">
          <span className="material-symbols-outlined text-[26px] font-normal">grid_view</span>
          <span className="text-[9px] font-normal uppercase tracking-widest">LEADS</span>
        </button>
        <button onClick={() => navigate('/messages')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light relative opacity-60">
          <span className="material-symbols-outlined text-[26px] font-normal">chat_bubble</span>
          {chatUnreadCount > 0 && <div className="absolute top-0 right-3 w-4 h-4 bg-accent-pink rounded-full border-2 border-white text-[8px] font-normal text-white flex items-center justify-center">{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</div>}
          <span className="text-[9px] font-normal uppercase tracking-widest">CHAT</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60">
          <span className="material-symbols-outlined text-[26px] font-normal">person</span>
          <span className="text-[9px] font-normal uppercase tracking-widest">PROFILE</span>
        </button>
      </nav>
    </div>
  );
};

export default Home;