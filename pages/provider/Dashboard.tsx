import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, RFQ, Quote } from '../../types';
import { dataService } from '../services/dataService';

interface ProviderDashboardProps {
  user: User;
}

type BidStatus = 'Active' | 'Pending' | 'Accepted';

const ProviderDashboard: React.FC<ProviderDashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<BidStatus>('Active');
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [myQuotes, setMyQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubQuotes = dataService.listenToQuotes((all) => {
      setMyQuotes(all.filter(q => q.providerId === user.id));
    });

    const unsubRfqs = dataService.listenToRFQs((all) => {
      setRfqs(all);
      setIsLoading(false);
    });

    return () => {
      unsubQuotes();
      unsubRfqs();
    };
  }, [user.id]);

  const stats = useMemo(() => {
    const total = myQuotes.length;
    const wins = myQuotes.filter(q => q.status === 'ACCEPTED').length;
    const rate = total > 0 ? Math.round((wins / total) * 100) : 0;
    return { total, rate };
  }, [myQuotes]);

  const filteredBids = useMemo(() => {
    const myQuoteRfqIds = myQuotes.map(q => q.rfqId);
    
    if (activeTab === 'Active') {
      return rfqs.filter(r => 
        (r.status === 'OPEN' || r.status === 'ACTIVE') && 
        (user.services || []).includes(r.service) &&
        !myQuoteRfqIds.includes(r.id)
      );
    }
    
    if (activeTab === 'Pending') {
      const pendingIds = myQuotes.filter(q => q.status === 'SENT').map(q => q.rfqId);
      return rfqs.filter(r => pendingIds.includes(r.id));
    }

    if (activeTab === 'Accepted') {
      const acceptedIds = myQuotes.filter(q => q.status === 'ACCEPTED').map(q => q.rfqId);
      return rfqs.filter(r => acceptedIds.includes(r.id));
    }

    return [];
  }, [activeTab, rfqs, myQuotes, user.services]);

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-transparent">
      <header className="px-6 pt-10 pb-4 flex justify-between items-center">
        <button onClick={() => navigate('/')} className="text-text-dark">
          <span className="material-symbols-outlined text-2xl font-bold">arrow_back</span>
        </button>
        <h1 className="text-xl font-black text-text-dark uppercase tracking-tight">Bid Manager</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 px-6 space-y-6 overflow-y-auto no-scrollbar pt-2">
        <div className="bg-white rounded-[2rem] p-6 shadow-soft flex items-center justify-between border border-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">assignment_turned_in</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Total Quotes</p>
              <p className="text-xl font-black text-text-dark">{stats.total}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Success</p>
            <p className="text-xl font-black text-[#8BC34A]">{stats.rate}%</p>
          </div>
        </div>

        <div className="flex gap-2">
          {(['Active', 'Pending', 'Accepted'] as BidStatus[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab
                  ? 'bg-primary text-white shadow-xl'
                  : 'bg-white text-gray-400 border border-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="py-20 text-center text-gray-300 font-black uppercase text-[10px] animate-pulse">Syncing Proposals...</div>
          ) : filteredBids.length > 0 ? filteredBids.map((rfq) => {
            const myQuote = myQuotes.find(q => q.rfqId === rfq.id);
            return (
              <div 
                key={rfq.id} 
                onClick={() => navigate(`/rfq/${rfq.id}`)}
                className="bg-white rounded-[2rem] p-6 shadow-card border border-gray-50 relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-2xl">radar</span>
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-text-dark leading-tight uppercase truncate max-w-[160px]">{rfq.title}</h2>
                      <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{rfq.category} • {(rfq.locationName || '').split(',')[0]}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-t border-gray-50">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">My Quote</p>
                    <p className="text-lg font-black text-primary">{myQuote ? `AED ${myQuote.price}` : '---'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Status</p>
                    <p className={`text-base font-black uppercase ${rfq.status === 'ACCEPTED' ? 'text-accent-green' : 'text-text-dark'}`}>{rfq.status}</p>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="py-24 text-center opacity-30">
               <span className="material-symbols-outlined text-5xl">folder_open</span>
               <p className="text-[10px] font-black uppercase tracking-widest mt-4">No records found</p>
            </div>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 w-full max-w-md mx-auto bg-white border-t border-gray-100 pb-8 pt-2 px-6 flex justify-around items-center z-50 shadow-soft">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1 text-gray-400">
          <span className="material-symbols-outlined text-2xl">home</span>
          <span className="text-[9px] font-bold uppercase">Home</span>
        </button>
        <button onClick={() => navigate('/leads')} className="flex-1 flex flex-col items-center gap-1 text-primary">
          <div className="bg-primary/10 w-11 h-10 flex items-center justify-center rounded-xl">
             <span className="material-symbols-outlined text-2xl">dashboard</span>
          </div>
          <span className="text-[9px] font-black uppercase">Bids</span>
        </button>
        <button onClick={() => navigate('/messages')} className="flex-1 flex flex-col items-center gap-1 text-gray-400">
          <span className="material-symbols-outlined text-2xl">chat</span>
          <span className="text-[9px] font-bold uppercase">Chat</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1 text-gray-400">
          <span className="material-symbols-outlined text-2xl">person</span>
          <span className="text-[9px] font-bold uppercase">Profile</span>
        </button>
      </nav>
    </div>
  );
};

export default ProviderDashboard;