import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, RFQ, Quote } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';
import { calculateDistance } from '../../LeadEngine/LeadMatcher';

interface LeadsProps {
  user: User;
}

type ProviderTab = 'Active' | 'Pending' | 'Accepted' | 'Completed';

const Leads: React.FC<LeadsProps> = ({ user }) => {
  const navigate = useNavigate();
  const { chatUnreadCount, unreadCount, toggleNotifications } = useApp();
  const [activeTab, setActiveTab] = useState<ProviderTab>('Active');
  const [allRfqs, setAllRfqs] = useState<RFQ[]>([]);
  const [myQuotes, setMyQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Real-time listener for all marketplace queries
    const unsubRfqs = dataService.listenToRFQs((rfqs) => {
      setAllRfqs(rfqs);
      setIsLoading(false);
    });

    // Real-time listener for the current provider's bids
    const unsubQuotes = dataService.listenToQuotes((quotes) => {
       setMyQuotes(quotes.filter(q => q.providerId === user.id));
    });

    return () => {
      unsubRfqs();
      unsubQuotes();
    };
  }, [user.id]);

  const getFilteredList = () => {
    if (activeTab === 'Active') {
      // Leads looking for providers that I haven't bid on yet
      const myQuoteRfqIds = myQuotes.map(q => q.rfqId);
      return allRfqs.filter(r => {
        if (r.status === 'CANCELED' || r.status === 'COMPLETED' || r.status === 'ACCEPTED') return false;
        
        const isCategoryMatch = (user.services || []).includes(r.service);
        const isOpen = (r.status === 'OPEN' || r.status === 'ACTIVE');
        const notBidYet = !myQuoteRfqIds.includes(r.id);
        
        const distance = (user.location && r.lat) 
          ? calculateDistance(user.location.lat, user.location.lng, r.lat, r.lng)
          : 999;
        
        const isWithinRadius = distance <= (r.searchRadius || 3);

        return isCategoryMatch && isOpen && notBidYet && isWithinRadius;
      });
    }
    
    if (activeTab === 'Pending') {
      // Bids I have sent where the lead is still ACTIVE or OPEN (no final selection made yet)
      const mySentQuotes = myQuotes.filter(q => q.status === 'SENT');
      const mySentRfqIds = mySentQuotes.map(q => q.rfqId);
      
      return allRfqs.filter(r => 
        (r.status === 'OPEN' || r.status === 'ACTIVE') && 
        mySentRfqIds.includes(r.id)
      );
    }
    
    if (activeTab === 'Accepted') {
      // Lead successfully won by this provider, but not yet completed
      return allRfqs.filter(r => {
        if (r.status !== 'ACCEPTED') return false;

        const myQuoteForThis = myQuotes.find(q => q.rfqId === r.id);
        if (!myQuoteForThis) return false;

        return r.acceptedQuoteId === myQuoteForThis.id || myQuoteForThis.status === 'ACCEPTED';
      });
    }

    if (activeTab === 'Completed') {
      // Lead successfully finished by this provider
      return allRfqs.filter(r => {
        if (r.status !== 'COMPLETED') return false;

        const myQuoteForThis = myQuotes.find(q => q.rfqId === r.id);
        if (!myQuoteForThis) return false;

        return r.acceptedQuoteId === myQuoteForThis.id || myQuoteForThis.status === 'ACCEPTED';
      });
    }
    
    return [];
  };

  const currentList = getFilteredList();

  return (
    <div className="flex flex-col min-h-screen pb-28 bg-transparent">
      <header className="px-6 pt-12 pb-4 flex justify-between items-center">
        <button onClick={() => navigate('/')} className="text-text-dark active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-2xl font-black">arrow_back</span>
        </button>
        <h1 className="text-[17px] font-black text-text-dark uppercase tracking-[0.1em]">Discovery</h1>
        <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-gray-100 active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-text-dark text-xl font-normal">notifications</span>
          {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white shadow-sm"></div>}
        </button>
      </header>

      <main className="flex-1 px-6 space-y-6 overflow-y-auto no-scrollbar pt-2">
        <div className="bg-[#FFFBE6] border border-[#FFF1B8] p-4 rounded-[1.5rem] flex items-center gap-3">
          <div className="w-6 h-6 bg-secondary/20 rounded-lg flex items-center justify-center text-secondary">
             <span className="material-symbols-outlined text-sm font-black">verified</span>
          </div>
          <p className="text-[9px] font-bold text-text-dark leading-tight uppercase tracking-wider">
            Prioritizing leads matching your expertise and operational radius.
          </p>
        </div>

        {/* Tab Bar updated to include Completed */}
        <div className="flex gap-1 justify-between bg-white rounded-full p-1 border border-gray-100 shadow-soft">
          {(['Active', 'Pending', 'Accepted', 'Completed'] as ProviderTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab
                  ? 'bg-primary text-white shadow-xl shadow-purple-200'
                  : 'text-gray-400'
              }`}
            >
              {tab === 'Active' ? 'Explore' : tab === 'Pending' ? 'My Bids' : tab === 'Accepted' ? 'Accepted' : 'Completed'}
            </button>
          ))}
        </div>

        <div className="space-y-5">
          {isLoading ? (
            <div className="py-20 text-center text-gray-300 font-bold uppercase text-[10px] tracking-widest animate-pulse">Syncing Marketplace...</div>
          ) : currentList.length > 0 ? (
            currentList.map((rfq) => {
              const myQuote = myQuotes.find(q => q.rfqId === rfq.id);
              const dist = (user.location && rfq.lat) ? calculateDistance(user.location.lat, user.location.lng, rfq.lat, rfq.lng).toFixed(1) : '?';
              const displayLoc = (rfq.locationName || 'Dubai, UAE').split(',')[0];

              return (
                <div 
                  key={rfq.id} 
                  onClick={() => navigate(`/rfq/${rfq.id}`)}
                  className="bg-white rounded-[2.5rem] p-6 shadow-card border border-gray-50 relative overflow-hidden group transition-all active:scale-[0.98] cursor-pointer animate-in fade-in slide-in-from-bottom-2"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm border border-primary/5">
                        <span className="material-symbols-outlined text-2xl">assignment</span>
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-text-dark leading-tight uppercase truncate max-w-[160px]">{rfq.title}</h2>
                        <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-tight">{rfq.category} • {displayLoc}</p>
                      </div>
                    </div>
                    <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider ${
                      rfq.status === 'ACCEPTED' || rfq.status === 'COMPLETED' ? 'bg-[#F0F9EB] text-[#8BC34A]' : 'bg-primary/5 text-primary'
                    }`}>
                      {activeTab === 'Active' ? `${dist} KM` : rfq.status}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-4 border-b border-gray-50 mb-4">
                    <div>
                      <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Bid Amount</p>
                      <p className="text-lg font-black text-primary">{myQuote ? `AED ${myQuote.price}` : '...'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Query ID</p>
                      <p className="text-base font-black text-text-dark">{rfq.idDisplay}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="text-[10px] text-gray-300 font-bold uppercase tracking-tight">
                      {new Date(rfq.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1 text-primary text-[11px] font-black uppercase tracking-widest">
                      Manage
                      <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-32 text-center flex flex-col items-center justify-center">
               <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-gray-100 shadow-soft mb-8">
                  <span className="material-symbols-outlined text-6xl font-light">search_off</span>
               </div>
               <p className="text-[12px] font-black text-gray-300 uppercase tracking-[0.3em] leading-relaxed">
                 {activeTab === 'Completed' ? 'NO COMPLETED PROJECTS YET' : activeTab === 'Accepted' ? 'NO ACCEPTED PROJECTS YET' : activeTab === 'Pending' ? 'NO ACTIVE BIDS PENDING' : 'NO MATCHING LEADS NEARBY'}
               </p>
            </div>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white border-t border-gray-100 pb-10 pt-4 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1 text-text-light opacity-60">
          <span className="material-symbols-outlined text-[28px] font-normal">home</span>
          <span className="text-[9px] font-black uppercase tracking-widest">HOME</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-xl">
             <span className="material-symbols-outlined text-[28px] font-normal">grid_view</span>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">LEADS</span>
        </button>
        <button onClick={() => navigate('/messages')} className="flex-1 flex flex-col items-center gap-1 text-text-light opacity-60 relative">
          <span className="material-symbols-outlined text-[28px] font-normal">chat_bubble</span>
          {chatUnreadCount > 0 && <div className="absolute top-0 right-3 w-4 h-4 bg-accent-pink rounded-full border-2 border-white text-[8px] font-black text-white flex items-center justify-center">{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</div>}
          <span className="text-[9px] font-black uppercase tracking-widest">CHAT</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1 text-text-light opacity-60">
          <span className="material-symbols-outlined text-[28px] font-normal">person</span>
          <span className="text-[9px] font-black uppercase tracking-widest">PROFILE</span>
        </button>
      </nav>
    </div>
  );
};

export default Leads;