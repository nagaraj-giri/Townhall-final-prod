import React, { useState, useEffect } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { User, RFQ, Quote, Review, UserRole } from '../../types';
import { dataService } from '../../services/dataService';
import { useApp } from '../../App';

const ModerationHub: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useApp();
  
  const [activeTab, setActiveTab] = useState<'providers' | 'queries' | 'quotes' | 'reviews'>('providers');
  const [providers, setProviders] = useState<User[]>([]);
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubProviders = dataService.listenToUsers((users) => {
      setProviders(users.filter(u => u.role === UserRole.PROVIDER && !u.isVerified));
    });
    const unsubRfqs = dataService.listenToRFQs(setRfqs);
    const unsubQuotes = dataService.listenToAllQuotes(setQuotes);
    const unsubReviews = dataService.listenToAllReviews(setReviews);

    setLoading(false);
    return () => {
      unsubProviders();
      unsubRfqs();
      unsubQuotes();
      unsubReviews();
    };
  }, []);

  const handleDeleteRFQ = async (id: string) => {
    if (window.confirm("Delete this query?")) {
      try {
        await dataService.deleteRFQ(id);
        showToast("Query deleted", "info");
      } catch (e) {
        showToast("Failed to delete", "error");
      }
    }
  };

  const handleDeleteQuote = async (id: string) => {
    if (window.confirm("Delete this quote?")) {
      try {
        await dataService.deleteQuote(id);
        showToast("Quote deleted", "info");
      } catch (e) {
        showToast("Failed to delete", "error");
      }
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (window.confirm("Delete this review?")) {
      try {
        await dataService.deleteReview(id);
        showToast("Review deleted", "info");
      } catch (e) {
        showToast("Failed to delete", "error");
      }
    }
  };

  const handleVerifyProvider = async (provider: User) => {
    try {
      await dataService.saveUser({ ...provider, isVerified: true });
      showToast("Provider verified", "success");
    } catch (e) {
      showToast("Failed to verify", "error");
    }
  };

  const tabs = [
    { id: 'providers', label: 'Providers', icon: 'how_to_reg', count: providers.length },
    { id: 'queries', label: 'Queries', icon: 'manage_search', count: rfqs.length },
    { id: 'quotes', label: 'Quotes', icon: 'request_quote', count: quotes.length },
    { id: 'reviews', label: 'Reviews', icon: 'star', count: reviews.length },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF9F6] pb-20">
      <header className="px-6 pt-12 pb-6 flex items-center bg-white border-b border-gray-100 sticky top-0 z-50">
        <button onClick={() => navigate('/')} className="text-text-dark active:scale-90 transition-transform">
          <span className="material-symbols-outlined font-black">arrow_back</span>
        </button>
        <h1 className="text-lg font-black text-text-dark text-center flex-1 uppercase tracking-tight">Moderation Hub</h1>
        <div className="w-10"></div>
      </header>

      {/* Tab Navigation */}
      <div className="px-6 py-4 bg-white border-b border-gray-100 sticky top-[88px] z-40 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-normal uppercase tracking-widest transition-all ${
                activeTab === tab.id 
                  ? 'bg-primary text-white shadow-lg' 
                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] ${activeTab === tab.id ? 'bg-white/20' : 'bg-gray-200 text-gray-500'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="px-6 pt-6 flex-1">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-normal text-gray-400 uppercase tracking-widest">Syncing Data...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === 'providers' && (
              <>
                <div className="bg-secondary/10 p-5 rounded-3xl border border-secondary/20 flex gap-4 mb-6">
                  <span className="material-symbols-outlined text-secondary text-2xl">verified_user</span>
                  <p className="text-[11px] text-text-dark font-normal leading-relaxed">
                    Review and approve new provider applications. Ensure trade licenses and service capabilities are vetted.
                  </p>
                </div>
                {providers.length === 0 ? (
                  <EmptyState icon="done_all" label="No pending approvals" />
                ) : providers.map(p => (
                  <ModerationCard 
                    key={p.id}
                    title={p.name}
                    subtitle={`REG: ${p.id.slice(-6).toUpperCase()}`}
                    details={[
                      { icon: 'mail', text: p.email },
                      { icon: 'location_on', text: p.locationName || 'Dubai, UAE' }
                    ]}
                    tags={p.services || []}
                    onAction={() => handleVerifyProvider(p)}
                    actionLabel="Approve"
                    onDelete={() => navigate(`/admin/user/${p.id}`)}
                    deleteLabel="View Profile"
                    deleteIcon="visibility"
                  />
                ))}
              </>
            )}

            {activeTab === 'queries' && (
              <>
                {rfqs.length === 0 ? (
                  <EmptyState icon="search_off" label="No queries found" />
                ) : rfqs.map(r => (
                  <ModerationCard 
                    key={r.id}
                    title={r.title}
                    subtitle={`ID: ${r.id.slice(-6).toUpperCase()} • ${r.status}`}
                    details={[
                      { icon: 'person', text: r.customerName || 'Customer' },
                      { icon: 'calendar_today', text: new Date(r.createdAt).toLocaleDateString() }
                    ]}
                    tags={[r.category]}
                    onAction={() => navigate(`/rfq/${r.id}`)}
                    actionLabel="View"
                    onDelete={() => handleDeleteRFQ(r.id)}
                    deleteLabel="Delete"
                  />
                ))}
              </>
            )}

            {activeTab === 'quotes' && (
              <>
                {quotes.length === 0 ? (
                  <EmptyState icon="no_sim" label="No quotes found" />
                ) : quotes.map(q => (
                  <ModerationCard 
                    key={q.id}
                    title={`AED ${q.price}`}
                    subtitle={`RFQ: ${q.rfqId.slice(-6).toUpperCase()} • ${q.status}`}
                    details={[
                      { icon: 'storefront', text: q.providerName || 'Provider' },
                      { icon: 'schedule', text: new Date(q.createdAt).toLocaleDateString() }
                    ]}
                    onAction={() => navigate(`/rfq/${q.rfqId}`)}
                    actionLabel="View RFQ"
                    onDelete={() => handleDeleteQuote(q.id)}
                    deleteLabel="Delete"
                  />
                ))}
              </>
            )}

            {activeTab === 'reviews' && (
              <>
                {reviews.length === 0 ? (
                  <EmptyState icon="rate_review" label="No reviews found" />
                ) : reviews.map(rev => (
                  <ModerationCard 
                    key={rev.id}
                    title={`${rev.rating} Stars`}
                    subtitle={`By ${rev.customerId.slice(-6).toUpperCase()}`}
                    details={[
                      { icon: 'comment', text: rev.comment }
                    ]}
                    onAction={() => navigate(`/rfq/${rev.rfqId}`)}
                    actionLabel="View RFQ"
                    onDelete={() => handleDeleteReview(rev.id)}
                    deleteLabel="Delete"
                  />
                ))}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const EmptyState = ({ icon, label }: { icon: string, label: string }) => (
  <div className="py-32 text-center opacity-20 flex flex-col items-center">
    <span className="material-symbols-outlined text-7xl font-light">{icon}</span>
    <p className="text-[10px] font-normal uppercase tracking-[0.4em] mt-6">{label}</p>
  </div>
);

const ModerationCard = ({ 
  title, 
  subtitle, 
  details, 
  tags, 
  onAction, 
  actionLabel, 
  onDelete, 
  deleteLabel,
  deleteIcon = 'delete'
}: any) => (
  <div className="bg-white rounded-[2.5rem] p-7 shadow-soft border border-white space-y-5 animate-in fade-in slide-in-from-bottom-3 transition-all">
    <div className="flex justify-between items-start">
      <div className="min-w-0 flex-1 pr-4">
        <h3 className="text-[17px] font-black text-text-dark uppercase tracking-tight leading-tight truncate">{title}</h3>
        <p className="text-[10px] font-normal text-gray-400 mt-1 uppercase tracking-widest leading-none">{subtitle}</p>
      </div>
    </div>
    
    <div className="bg-gray-50/50 p-5 rounded-[2rem] space-y-3 border border-gray-100/50">
      {details.map((d: any, i: number) => (
        <div key={i} className="flex items-center gap-3">
          <span className="material-symbols-outlined text-gray-400 text-[18px]">{d.icon}</span>
          <span className="truncate text-[12px] font-normal text-text-dark leading-none">{d.text}</span>
        </div>
      ))}
    </div>

    {tags && tags.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {tags.map((t: string) => (
          <span key={t} className="bg-primary/5 text-primary text-[9px] font-normal px-3 py-1.5 rounded-lg uppercase tracking-widest border border-primary/5">{t}</span>
        ))}
      </div>
    )}

    <div className="flex gap-3 pt-1">
      <button 
        onClick={onAction}
        className="flex-1 py-3.5 bg-primary text-white rounded-2xl font-normal text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
      >
        {actionLabel}
      </button>
      <button 
        onClick={onDelete}
        className="flex-1 py-3.5 bg-white border border-red-100 text-red-500 rounded-2xl font-normal text-[10px] uppercase tracking-widest active:bg-red-50 transition-all flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-[16px]">{deleteIcon}</span>
        {deleteLabel}
      </button>
    </div>
  </div>
);

export default ModerationHub;
