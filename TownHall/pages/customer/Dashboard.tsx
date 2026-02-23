import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ServiceCategory, RFQ } from '../../types';
import { dataService } from '../../services/dataService';
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
        .slice(0, 5);
      setRecentRfqs(myRfqs);
      setIsLoading(false);
    });
    return () => { unsubCats(); unsubRfqs(); };
  }, [user.id]);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
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
    if (hours < 24) return `${hours} hrs ago`;
    return `${days} days ago`;
  };

  return (
    <div className="flex flex-col min-h-screen pb-32">
      <header className="px-6 pt-12 pb-6 flex justify-between items-center bg-transparent">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white shadow-soft bg-white/50 backdrop-blur-sm">
            <img src={user.avatar} className="w-full h-full object-cover" alt="" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-text-light font-normal uppercase tracking-widest leading-none mb-1">SALAM,</span>
            <h1 className="text-[22px] font-black text-text-dark tracking-tighter leading-none">
              {user.name.split(' ')[0]}
            </h1>
          </div>
        </div>
        <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-soft border border-white active:scale-95 transition-all">
          <span className="material-symbols-outlined text-2xl text-text-dark font-normal">notifications</span>
          {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white"></div>}
        </button>
      </header>

      <main className="flex-1 space-y-10 overflow-y-auto no-scrollbar">
        {/* Popular Services Section with 2 rows horizontal scroll */}
        <section className="space-y-6">
          <div className="flex justify-between items-center px-10">
            <h3 className="text-[13px] font-black text-[#333333] uppercase tracking-[0.1em]">POPULAR SERVICES</h3>
            <div className="flex gap-4 text-text-light/40">
              <button onClick={scrollLeft} className="material-symbols-outlined text-xl active:text-primary cursor-pointer font-normal">chevron_left</button>
              <button onClick={scrollRight} className="material-symbols-outlined text-xl active:text-primary cursor-pointer font-normal">chevron_right</button>
            </div>
          </div>
          
          <div 
            ref={scrollRef}
            className="grid grid-rows-2 grid-flow-col gap-4 overflow-x-auto no-scrollbar snap-x px-10 pb-4"
          >
            {categories.map((cat) => (
              <div 
                key={cat.id} 
                onClick={() => navigate('/create-rfq', { state: { selectedCategory: cat.name } })} 
                className="bg-white rounded-[2.5rem] p-6 shadow-card border border-white active:scale-[0.96] transition-all cursor-pointer flex flex-col items-center text-center justify-center min-h-[175px] min-w-[165px] snap-start"
              >
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-5 shadow-sm" 
                  style={{ backgroundColor: `${cat.color}15` }}
                >
                   <span className="material-symbols-outlined text-[32px]" style={{ color: cat.color }}>{cat.icon}</span>
                </div>
                <h3 className="text-[11px] font-normal text-text-dark uppercase tracking-tight leading-tight px-1">
                  {cat.name}
                </h3>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Requests Section */}
        <section className="space-y-4 pb-10 px-6">
          <div className="flex justify-between items-end px-1">
            <h3 className="text-[22px] font-black text-text-dark tracking-tight leading-none uppercase">Recent Requests</h3>
            <button onClick={() => navigate('/queries')} className="text-primary text-[14px] font-normal tracking-tight">View All</button>
          </div>
          
          <div className="space-y-4">
            {recentRfqs.length > 0 ? recentRfqs.map((rfq) => {
              const isBooked = rfq.status === 'ACCEPTED' || rfq.status === 'COMPLETED';
              const isPending = rfq.status === 'OPEN';
              const isActive = rfq.status === 'ACTIVE';
              
              let accentColor = 'bg-[#5B3D9D]'; // Default Purple
              if (isBooked) accentColor = 'bg-[#FF69B4]'; // Pink
              else if (isPending) accentColor = 'bg-[#FFD60A]'; // Yellow
              else if (isActive) accentColor = 'bg-[#8BC34A]'; // Green

              return (
                <div 
                  key={rfq.id} 
                  onClick={() => navigate(`/rfq/${rfq.id}`)} 
                  className="bg-white rounded-[2.5rem] p-6 pl-8 shadow-card border border-white relative active:scale-[0.98] transition-all cursor-pointer overflow-hidden flex flex-col min-h-[140px] justify-center"
                >
                  {/* Left Accent Border */}
                  <div className={`absolute left-0 top-3 bottom-3 w-[6px] rounded-r-full ${accentColor}`}></div>
                  
                  <div className="flex justify-between items-center mb-4">
                    <div className="px-3.5 py-1.5 bg-[#F2F0F9] rounded-lg text-[10px] font-normal text-[#5B3D9D]">
                      {rfq.service}
                    </div>
                    {isBooked ? (
                      <div className="bg-[#E8F5E9] text-[#4CAF50] px-4 py-1.5 rounded-lg text-[10px] font-normal">
                        Booked
                      </div>
                    ) : (
                      <div className="bg-[#FFFCEE] text-[#FF9800] px-4 py-1.5 rounded-lg text-[10px] font-normal">
                        Quotes: {rfq.quotesCount || 0}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-[19px] font-black text-text-dark leading-tight mb-2 tracking-tight uppercase">
                      {rfq.title}
                    </h3>
                    <p className="text-[11px] font-normal text-text-light">
                      Request ID: {rfq.idDisplay || `#${rfq.id.substring(0,4).toUpperCase()}`} • {getRelativeTime(rfq.createdAt)}
                    </p>
                  </div>
                </div>
              );
            }) : (
              <div className="py-20 text-center bg-white/30 backdrop-blur-md rounded-[3rem] border-2 border-dashed border-white flex flex-col items-center justify-center gap-4">
                 <div className="w-16 h-16 bg-gray-100/50 rounded-2xl flex items-center justify-center text-gray-400">
                    <span className="material-symbols-outlined text-4xl font-light">inventory_2</span>
                 </div>
                 <div className="text-center px-6">
                    <p className="text-[11px] font-normal uppercase tracking-[0.2em] text-gray-400">No Active Requests</p>
                    <p className="text-[10px] font-normal text-gray-300 uppercase tracking-widest mt-1">Select a service to get started</p>
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
          <span className="text-[9px] font-normal uppercase tracking-widest">HOME</span>
        </button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light/60">
          <div className="w-12 h-10 flex items-center justify-center">
             <span className="material-symbols-outlined text-[26px]">format_list_bulleted</span>
          </div>
          <span className="text-[9px] font-normal uppercase tracking-widest">QUERIES</span>
        </button>
        <button onClick={() => navigate('/messages')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light/60 relative">
          <div className="w-12 h-10 flex items-center justify-center">
             <span className="material-symbols-outlined text-[26px]">chat_bubble</span>
          </div>
          {chatUnreadCount > 0 && <div className="absolute top-0 right-4 w-4 h-4 bg-accent-pink rounded-full border-2 border-white text-[8px] text-white flex items-center justify-center font-normal">{chatUnreadCount}</div>}
          <span className="text-[9px] font-normal uppercase tracking-widest">CHAT</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light/60">
          <div className="w-12 h-10 flex items-center justify-center">
             <span className="material-symbols-outlined text-[26px]">person</span>
          </div>
          <span className="text-[9px] font-normal uppercase tracking-widest">PROFILE</span>
        </button>
      </nav>
    </div>
  );
};

export default Dashboard;