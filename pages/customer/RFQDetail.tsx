
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, RFQ, Quote, Review, UserRole } from '../../types';
import { dataService } from '../services/dataService';
import { getMatchingState, MatcherState } from '../../LeadEngine/MatcherCore';
import { useApp } from '../../App';

interface RFQDetailProps {
  user: User;
}

const RFQDetail: React.FC<RFQDetailProps> = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  
  // Review state
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  // Real-time Matching State
  const [matchingUI, setMatchingUI] = useState<MatcherState>({
    currentRadius: 3,
    showExpansion8km: false,
    showExpansion15km: false,
    showModifyWarning: false,
    isMatchingFinished: false
  });

  useEffect(() => {
    if (!id) return;

    const unsubRfq = dataService.listenToRFQById(id, (currentRfq) => {
      if (currentRfq) {
        setRfq(currentRfq);
        setMatchingUI(getMatchingState(currentRfq));
      }
    });

    const unsubQuotes = dataService.listenToQuotesByRFQ(id, setQuotes);
    const unsubMatches = dataService.listenToRFQMatches(id, setMatches);

    return () => { unsubRfq(); unsubQuotes(); unsubMatches(); };
  }, [id]);

  // Lead Match Expiry Use Case (1 hour check)
  const isStale = useMemo(() => {
    if (!rfq || quotes.length > 0 || rfq.status !== 'OPEN') return false;
    const hourMs = 60 * 60 * 1000;
    const stale = (Date.now() - new Date(rfq.createdAt).getTime()) > hourMs;
    
    // Auto-trigger stale email if detected (simulated health check)
    if (stale && rfq.id && !rfq.matchingStopped) {
       import('../../AlertsEngine/email_template/EmailDispatcher').then(({EmailDispatcher}) => {
         EmailDispatcher.send([rfq.customerId], 'MATCH_STALE', { id: rfq.idDisplay, title: rfq.title });
       });
    }

    return stale;
  }, [rfq, quotes]);

  const handleUpdateStatus = async (status: RFQ['status']) => {
    if (!rfq) return;
    const confirmMsg = status === 'COMPLETED' ? "Mark this project as finished?" : "Cancel this requirement?";
    if (window.confirm(confirmMsg)) {
      await dataService.updateRFQStatus(rfq.id, status, user);
      showToast(`Query marked as ${status.toLowerCase()}`, "success");
    }
  };

  const handleAcceptBid = async (quote: Quote) => {
    if (!rfq) return;
    if (window.confirm(`Accept proposal from ${quote.providerName} for AED ${quote.price}?`)) {
      await dataService.markQuoteAsAccepted(quote.id, rfq.id);
      showToast("Bid accepted! Opening chat...", "success");
      setTimeout(() => navigate(`/messages/${quote.providerId}`), 1500);
    }
  };

  const handleSubmitReview = async () => {
    if (!rfq || !rating) return;
    setIsSubmittingReview(true);
    const acceptedQuote = quotes.find(q => q.id === rfq.acceptedQuoteId);
    if (!acceptedQuote) return;

    const review: Review = {
      id: `rev_${Date.now()}`,
      rfqId: rfq.id,
      providerId: acceptedQuote.providerId,
      customerId: user.id,
      rating,
      comment,
      createdAt: new Date().toISOString()
    };

    try {
      await dataService.submitReview(review, acceptedQuote.providerId);
      setHasReviewed(true);
      showToast("Thank you for your feedback!", "success");
    } catch (e) {
      showToast("Failed to post review", "error");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (!rfq) return <div className="flex items-center justify-center min-h-screen">Loading Discovery...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-32 relative">
      <header className="px-6 pt-12 pb-4 flex items-center bg-white shadow-sm sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="text-text-dark w-12 h-12 flex items-center justify-center -ml-3 rounded-full">
          <span className="material-symbols-outlined font-black">arrow_back</span>
        </button>
        <div className="ml-2 flex-1">
          <h1 className="text-[17px] font-bold text-text-dark">Query {rfq.idDisplay}</h1>
          <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">{rfq.status}</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pt-6 px-6 space-y-6">
        {isStale && (
          <div className="bg-orange-50 border border-orange-100 rounded-3xl p-6 flex flex-col gap-3 animate-in slide-in-from-top-4">
             <div className="flex items-center gap-3 text-orange-600">
                <span className="material-symbols-outlined font-black">hourglass_empty</span>
                <p className="text-[12px] font-black uppercase tracking-tight">Matching Sluggish</p>
             </div>
             <p className="text-[11px] text-orange-500 font-medium leading-relaxed">No experts have matched your query in the last hour. Consider updating your location or adding more details to attract more providers.</p>
          </div>
        )}

        {rfq.status === 'ACCEPTED' && (
          <div className="flex gap-3">
             <button onClick={() => handleUpdateStatus('COMPLETED')} className="flex-1 bg-accent-green text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-lg">check_circle</span>
                Mark Completed
             </button>
             <button onClick={() => handleUpdateStatus('CANCELED')} className="flex-1 bg-white border border-red-100 text-red-500 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all">
                Cancel Query
             </button>
          </div>
        )}

        {rfq.status === 'COMPLETED' && !hasReviewed && (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-card border-2 border-accent-green/20 space-y-6 animate-in zoom-in-95">
             <div className="text-center space-y-2">
                <h3 className="text-lg font-black text-text-dark uppercase tracking-tight">Rate your experience</h3>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">Help the community choose the best experts.</p>
             </div>
             <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => setRating(s)} className={`material-symbols-outlined text-3xl ${rating >= s ? 'text-secondary fill-1' : 'text-gray-200'}`}>
                    star
                  </button>
                ))}
             </div>
             <textarea 
               value={comment}
               onChange={e => setComment(e.target.value)}
               placeholder="Write a quick review..."
               className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-1 focus:ring-primary shadow-inner min-h-[80px] resize-none"
             />
             <button 
               onClick={handleSubmitReview}
               disabled={!rating || isSubmittingReview}
               className="w-full bg-primary text-white py-4 rounded-full font-black text-[11px] uppercase tracking-[0.2em] shadow-btn-glow active:scale-[0.98]"
             >
               {isSubmittingReview ? "Posting..." : "Submit Review"}
             </button>
          </div>
        )}

        <div className="bg-white rounded-[2.2rem] p-6 shadow-card space-y-4 border border-white">
          <h2 className="text-xl font-bold text-text-dark tracking-tight leading-snug">{rfq.title}</h2>
          <p className="text-[13px] text-gray-500 leading-relaxed font-medium">"{rfq.description}"</p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
             <h3 className="text-base font-bold text-text-dark">Expert Bids ({quotes.length})</h3>
          </div>
          
          <div className="space-y-4 pb-12">
            {quotes.map((quote) => {
              const isAccepted = rfq.acceptedQuoteId === quote.id;
              return (
                <div key={quote.id} className={`bg-white rounded-[2rem] p-6 shadow-card border transition-all ${isAccepted ? 'border-primary ring-2 ring-primary/5' : 'border-gray-50/50'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/storefront/${quote.providerId}`)}>
                      <img src={quote.providerAvatar} className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-sm" alt="" />
                      <div>
                        <h4 className="text-[15px] font-bold text-text-dark">{quote.providerName}</h4>
                        <div className="flex items-center gap-1 text-secondary mt-0.5">
                          <span className="material-symbols-outlined text-[16px] fill-1">star</span>
                          <span className="text-[11px] font-black text-text-dark">{quote.providerRating}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-primary">{quote.price} AED</p>
                      {isAccepted && <span className="text-[9px] font-black text-accent-green uppercase tracking-widest">Selected Expert</span>}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => navigate(`/messages/${quote.providerId}`)} className="flex-1 bg-gray-50 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95">Chat</button>
                    {!rfq.acceptedQuoteId && (
                      <button onClick={() => handleAcceptBid(quote)} className="flex-1 bg-primary text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 shadow-lg shadow-purple-100">Hire Expert</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default RFQDetail;
