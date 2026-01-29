import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ServiceCategory, RFQ } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

const Dashboard: React.FC<{ user: User }> = ({ user }) => {
  const navigate = useNavigate();
  const { unreadCount, toggleNotifications, chatUnreadCount } = useApp();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [recentRfqs, setRecentRfqs] = useState<RFQ[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubCats = dataService.listenToCategories((cats) => {
      setCategories(cats.filter(c => c.isActive !== false));
    });
    const unsubRfqs = dataService.listenToRFQs((all) => {
      const myRfqs = all
        .filter(r => r.customerId === user.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 2);
      setRecentRfqs(myRfqs);
      setIsLoading(false);
    });
    return () => { unsubCats(); unsubRfqs(); };
  }, [user.id]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth / 2 : scrollLeft + clientWidth / 2;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-transparent">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const getRelativeTime = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (hours < 1) return `JUST NOW`;
    if (hours < 24) return `${hours} HRS AGO`;
    return `${days} DAYS AGO`;
  };

  return (
    <div className="flex flex-col min-h-screen pb-32">
      <header className="px-6 pt-12 pb-8 flex justify-between items-center bg-transparent">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white shadow-soft bg-white/50 backdrop-blur-sm">
            <img src={user.avatar} className="w-full h-full object-cover" alt="" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-text-light font-bold uppercase tracking-widest leading-none mb-1">SALAM,</span>
            <h1 className="text-[22px] font-black text-text-dark tracking-tighter leading-none">
              {user.name.split(' ')[0]}
            </h1>
          </div>
        </div>
        <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-soft border border-white active:scale-95 transition-all">
          <span className="material-symbols-outlined text-2xl text-text-dark font-bold">notifications</span>
          {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-accent-pink rounded-full border-2 border-white"></div>}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar px-6 space-y-10">
        <section className="space-y-6">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-[12px] font-black text-text-dark uppercase tracking-widest">POPULAR SERVICES</h3>
            <div className="flex gap-4 text-text-light/50">
              <button onClick={() => scroll('left')} className="material-symbols-outlined text-xl active:text-primary cursor-pointer">chevron_left</button>
              <button onClick={() => scroll('right')} className="material-symbols-outlined text-xl active:text-primary cursor-pointer">chevron_right</button>
            </div>
          </div>
          
          <div ref={scrollRef} className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory gap-5 -mx-1 px-1 pb-4">
            {categories.map((cat) => (
              <div key={cat.id} onClick={() => navigate('/create-rfq', { state: { selectedCategory: cat.name } })} className="min-w-[160px] max-w-[160px] bg-white rounded-[2.5rem] p-7 shadow-soft border border-white snap-start active:scale-[0.96] transition-all cursor-pointer flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5 shadow-inner bg-gray-50/50" style={{ backgroundColor: `${cat.color}15` }}>
                   <span className="material-symbols-outlined text-[32px] fill-1" style={{ color: cat.color }}>{cat.icon}</span>
                </div>
                <h3 className="text-[11px] font-black text-text-dark uppercase tracking-tight leading-tight h-10 flex items-center justify-center text-center overflow-hidden">
                  {cat.name}
                </h3>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5 pb-6">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-[20px] font-bold text-text-dark tracking-tight">Recent Requests</h3>
            <button onClick={() => navigate('/queries')} className="text-primary text-[14px] font-bold uppercase tracking-tight">VIEW ALL</button>
          </div>
          
          <div className="space-y-5">
            {recentRfqs.length > 0 ? recentRfqs.map((rfq) => {
              const isBooked = rfq.status === 'ACCEPTED' || rfq.status === 'COMPLETED';
              const isPending = rfq.status === 'OPEN';
              const isActive = rfq.status === 'ACTIVE';
              
              let accentColor = 'bg-primary';
              if (isBooked) accentColor = 'bg-accent-pink';
              else if (isPending) accentColor = 'bg-secondary';
              else if (isActive) accentColor = 'bg-accent-green';

              return (
                <div key={rfq.id} onClick={() => navigate(`/rfq/${rfq.id}`)} className="bg-white rounded-[2.5rem] p-6 shadow-card border border-white relative active:scale-[0.98] transition-all cursor-pointer overflow-hidden flex flex-col">
                  <div className={`absolute left-0 top-6 bottom-6 w-[6px] rounded-r-full ${accentColor}`}></div>
                  
                  <div className="flex justify-between items-center mb-4 pl-4">
                    <div className="px-4 py-1.5 bg-primary/5 rounded-lg text-[9px] font-black text-primary uppercase tracking-widest">
                      {rfq.service}
                    </div>
                    <div className={`${isBooked ? 'bg-accent-pink/10 text-accent-pink' : isPending ? 'bg-secondary/10 text-text-dark' : 'bg-accent-green/10 text-accent-green'} px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest`}>
                      {isBooked ? 'BOOKED' : isPending ? 'PENDING' : isActive ? 'ACTIVE' : `QUOTES: ${rfq.quotesCount || 0}`}
                    </div>
                  </div>
                  
                  <div className="pl-4">
                    <h3 className="text-[19px] font-bold text-text-dark leading-tight mb-2 sentence-case">{rfq.title}</h3>
                    <p className="text-[10px] font-bold text-text-light uppercase tracking-widest">
                      REQUEST ID: {rfq.idDisplay || `#${rfq.id.substring(0,4).toUpperCase()}`} • {getRelativeTime(rfq.createdAt)}
                    </p>
                  </div>
                </div>
              );
            }) : (
              <div className="py-20 text-center bg-white/30 backdrop-blur-md rounded-[3rem] border-2 border-dashed border-white flex flex-col items-center justify-center gap-4">
                 <div className="w-16 h-16 bg-gray-100/50 rounded-2xl flex items-center justify-center text-gray-400">
                    <span className="material-symbols-outlined text-4xl font-light">inventory_2</span>
                 </div>
                 <div className="text-center">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">NO ACTIVE REQUESTS</p>
                    <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mt-1">Start by choosing a service above</p>
                 </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-border-light pb-10 pt-4 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.04)]">
        <button className="flex-1 flex flex-col items-center gap-1.5 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-xl">
             <span className="material-symbols-outlined text-[26px] fill-1">home</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest">HOME</span>
        </button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light/60">
          <div className="w-12 h-10 flex items-center justify-center">
             <span className="material-symbols-outlined text-[26px]">format_list_bulleted</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest">QUERIES</span>
        </button>
        <button onClick={() => navigate('/messages')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light/60 relative">
          <div className="w-12 h-10 flex items-center justify-center">
             <span className="material-symbols-outlined text-[26px]">chat_bubble</span>
          </div>
          {chatUnreadCount > 0 && <div className="absolute top-0 right-4 w-4 h-4 bg-accent-pink rounded-full border-2 border-white text-[8px] text-white flex items-center justify-center font-bold">{chatUnreadCount}</div>}
          <span className="text-[10px] font-black uppercase tracking-widest">CHAT</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light/60">
          <div className="w-12 h-10 flex items-center justify-center">
             <span className="material-symbols-outlined text-[26px]">person</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest">PROFILE</span>
        </button>
      </nav>
    </div>
  );
};

export default Dashboard;