
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ServiceCategory, RFQ } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

interface DashboardProps { user: User; }

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const { unreadCount, toggleNotifications, chatUnreadCount, showToast } = useApp();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [recentRfqs, setRecentRfqs] = useState<RFQ[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubCats = dataService.listenToCategories((cats) => {
      const activeCats = cats ? cats.filter(c => c.isActive !== false) : [];
      setCategories(activeCats);
    });

    const unsubRfqs = dataService.listenToRFQs((all) => {
      const myRfqs = all
        .filter(r => r.customerId === user.id)
        .slice(0, 3);
      setRecentRfqs(myRfqs);
      setIsLoading(false);
    });

    return () => {
      unsubCats();
      unsubRfqs();
    };
  }, [user.id]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const then = new Date(dateString);
    const diffMs = now.getTime() - then.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 1) return 'Just now';
    if (diffHrs < 24) return `${diffHrs} hrs ago`;
    return `${Math.floor(diffHrs / 24)} days ago`;
  };

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'border-orange-400';
      case 'ACTIVE': return 'border-blue-400';
      case 'ACCEPTED': return 'border-primary';
      case 'COMPLETED': return 'border-accent-green';
      case 'CANCELED': return 'border-red-400';
      default: return 'border-gray-300';
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#FAF9F6]">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen pb-28 bg-transparent">
      {/* Header Section */}
      <header className="px-6 pt-14 pb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={user.avatar} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" alt="" />
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-accent-green rounded-full border-2 border-white"></div>
          </div>
          <div>
            <p className="text-[10px] text-text-light font-normal uppercase tracking-widest leading-none mb-1 opacity-60">SALAM,</p>
            <h1 className="text-[20px] font-black text-text-dark leading-none tracking-tight">{user.name.split(' ')[0]}</h1>
          </div>
        </div>
        <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 rounded-[1.2rem] bg-white flex items-center justify-center shadow-card border border-gray-100 active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-2xl text-text-dark opacity-40 font-normal">notifications</span>
          {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white shadow-sm"></div>}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-10">
        {/* Quick Services Section */}
        <div className="px-6 mb-8 mt-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[12px] font-black text-text-dark uppercase tracking-[0.15em] opacity-80">Market Categories</h3>
            <div className="flex gap-2">
              <button onClick={() => handleScroll('left')} className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-text-dark opacity-30 active:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-xl font-normal">chevron_left</span>
              </button>
              <button onClick={() => handleScroll('right')} className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-text-dark opacity-80 active:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-xl font-normal">chevron_right</span>
              </button>
            </div>
          </div>

          <div 
            ref={scrollRef}
            className="grid grid-rows-2 grid-flow-col auto-cols-[calc(50%-8px)] gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-2"
          >
            {categories.map((cat) => (
              <div 
                key={cat.id} 
                onClick={() => navigate('/create-rfq', { state: { selectedCategory: cat.name } })} 
                className="bg-white p-5 rounded-[2.2rem] border border-white shadow-card active:scale-[0.97] transition-all cursor-pointer flex flex-col items-center justify-center gap-3 relative overflow-hidden snap-start text-center group"
              >
                <div 
                  className="w-12 h-12 rounded-[1.2rem] flex items-center justify-center relative z-10 shadow-sm transition-transform group-hover:scale-110" 
                  style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                >
                  <span className="material-symbols-outlined text-[28px] font-normal">{cat.icon}</span>
                </div>
                <h4 className="font-bold text-text-dark text-[10px] uppercase tracking-widest leading-tight relative z-10 px-1">{cat.name}</h4>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Requests Section */}
        <div className="px-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[18px] font-black text-text-dark tracking-tight">Active Requests</h3>
            <button onClick={() => navigate('/queries')} className="text-primary text-[12px] font-bold uppercase tracking-widest">History</button>
          </div>

          <div className="space-y-4">
            {recentRfqs.length > 0 ? recentRfqs.map((rfq) => (
              <div 
                key={rfq.id} 
                onClick={() => navigate(`/rfq/${rfq.id}`)}
                className={`bg-white rounded-[2.5rem] p-6 shadow-card border-white relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer group border-l-[6px] animate-in slide-in-from-bottom duration-500 ${getStatusBorderColor(rfq.status)}`}
              >
                <div className="flex justify-between items-start mb-3">
                   <div className="flex items-center gap-2">
                     <div className="inline-flex px-3 py-1 bg-primary/5 text-primary rounded-xl text-[10px] font-bold uppercase tracking-tight">
                       {rfq.category}
                     </div>
                   </div>
                   <div className="px-3 py-1 bg-[#FFF9E6] text-[#A18100] rounded-xl text-[10px] font-black uppercase tracking-tight">
                     {rfq.quotesCount} Bids
                   </div>
                </div>
                <h2 className="text-[15px] font-black text-text-dark tracking-tight mb-1">{rfq.title}</h2>
                <p className="text-[11px] text-text-light font-medium uppercase tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">schedule</span>
                  {getRelativeTime(rfq.createdAt)}
                </p>
              </div>
            )) : (
              <div className="py-12 text-center bg-white/50 rounded-[2.5rem] border-2 border-dashed border-gray-200">
                <span className="material-symbols-outlined text-4xl text-gray-200 mb-2 font-light">auto_stories</span>
                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">No active requests found</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-gray-100 pb-10 pt-3 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-[1rem]">
             <span className="material-symbols-outlined text-[26px] font-normal">home</span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest">HOME</span>
        </button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60">
          <span className="material-symbols-outlined text-[26px] font-normal">format_list_bulleted</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">QUERIES</span>
        </button>
        <button onClick={() => navigate('/messages')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light relative opacity-60">
          <span className="material-symbols-outlined text-[26px] font-normal">chat_bubble</span>
          {chatUnreadCount > 0 && <div className="absolute top-0 right-3 w-4 h-4 bg-accent-pink rounded-full border-2 border-white text-[8px] font-normal text-white flex items-center justify-center">{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</div>}
          <span className="text-[9px] font-bold uppercase tracking-widest">CHAT</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60">
          <span className="material-symbols-outlined text-[26px] font-normal">person</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">PROFILE</span>
        </button>
      </nav>
    </div>
  );
};

export default Dashboard;
