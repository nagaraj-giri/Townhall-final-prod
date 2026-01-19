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
    const unsubRFQs = dataService.listenToRFQs((all) => {
      setRfqs(all);
    });
    
    const unsubQuotes = dataService.listenToQuotes((all) => {
      setMyQuotes(all.filter(q => q.providerId === user.id));
    });

    setIsLoading(false);
    return () => {
      unsubRFQs();
      unsubQuotes();
    };
  }, [user.id]);

  const filteredBids = useMemo(() => {
    const myQuoteRfqIds = myQuotes.map(q => q.rfqId);
    // Always filter out CANCELED RFQs from the Provider's dashboard lists
    const nonCanceledRfqs = rfqs.filter(r => r.status !== 'CANCELED');

    if (activeTab === 'Active') {
      return nonCanceledRfqs.filter(r => 
        (user.services || []).includes(r.service) && 
        (r.status === 'OPEN' || r.status === 'ACTIVE') && 
        !myQuoteRfqIds.includes(r.id)
      );
    }
    if (activeTab === 'Pending') {
      const pendingIds = myQuotes.filter(q => q.status === 'SENT').map(q => q.rfqId);
      return nonCanceledRfqs.filter(r => pendingIds.includes(r.id));
    }
    if (activeTab === 'Accepted') {
      const acceptedIds = myQuotes.filter(q => q.status === 'ACCEPTED').map(q => q.rfqId);
      return nonCanceledRfqs.filter(r => acceptedIds.includes(r.id));
    }
    return [];
  }, [activeTab, rfqs, myQuotes, user.services]);

  const stats = useMemo(() => {
    // Only count quotes for non-canceled RFQs in stats
    const validMyQuotes = myQuotes.filter(q => {
      const rfq = rfqs.find(r => r.id === q.rfqId);
      return rfq && rfq.status !== 'CANCELED';
    });
    
    const wins = validMyQuotes.filter(q => q.status === 'ACCEPTED').length;
    const successRate = validMyQuotes.length > 0 ? Math.round((wins / validMyQuotes.length) * 100) : 0;
    
    return {
      count: validMyQuotes.length,
      success: successRate
    };
  }, [myQuotes, rfqs]);

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-[#FAF9F6]">
      <header className="px-6 pt-10 pb-4 flex justify-between items-center">
        <button onClick={() => navigate('/')} className="text-text-dark">
          <span className="material-symbols-outlined text-2xl font-bold">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold text-text-dark uppercase tracking-tight">Bid Center</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 px-6 space-y-6 overflow-y-auto no-scrollbar pt-2">
        <div className="bg-white rounded-[2rem] p-6 shadow-soft flex items-center justify-between border border-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#F2F0F9] rounded-full flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">assignment_turned_in</span>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Active Quotes</p>
              <p className="text-xl font-bold text-text-dark">{stats.count}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Success</p>
            <p className="text-xl font-bold text-[#8BC34A]">
              {stats.success}%
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-between">
          {(['Active', 'Pending', 'Accepted'] as BidStatus[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3.5 rounded-[1.2rem] text-xs font-bold transition-all ${
                activeTab === tab ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'
              }`}
            >
              {tab === 'Active' ? 'Explore' : tab === 'Pending' ? 'Active Bids' : 'Wins'}
            </button>
          ))}
        </div>

        <div className="space-y-5">
          {isLoading ? (
            <div className="py-20 text-center text-gray-300 font-bold uppercase text-[10px] animate-pulse">Syncing Bids...</div>
          ) : filteredBids.length > 0 ? filteredBids.map((rfq) => {
            const myQuote = myQuotes.find(q => q.rfqId === rfq.id);
            return (
              <div key={rfq.id} onClick={() => navigate(`/rfq/${rfq.id}`)} className="bg-white rounded-[2.2rem] p-6 shadow-card border border-gray-50 relative overflow-hidden active:scale-[0.98] transition-transform cursor-pointer">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary/5 rounded-full flex items-center justify-center text-primary">
                       <span className="material-symbols-outlined text-2xl">radar</span>
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-text-dark leading-tight">{rfq.title}</h2>
                      <p className="text-[11px] text-gray-400 font-medium mt-0.5">{rfq.category} • {rfq.locationName.split(',')[0]}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Your Quote</p>
                    <p className="text-lg font-bold text-primary">{myQuote ? `AED ${myQuote.price}` : '---'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Status</p>
                    <p className={`text-base font-bold uppercase ${rfq.status === 'ACCEPTED' ? 'text-[#8BC34A]' : 'text-text-dark'}`}>{rfq.status}</p>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="py-20 text-center opacity-30">
               <span className="material-symbols-outlined text-5xl">inventory_2</span>
               <p className="text-[10px] font-black uppercase tracking-widest mt-4">No records found</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProviderDashboard;