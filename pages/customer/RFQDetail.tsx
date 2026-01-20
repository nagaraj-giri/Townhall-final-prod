import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, RFQ, Quote, Review } from '../../types';
import { dataService } from '../services/dataService';
import { getMatchingState } from '../../LeadEngine/MatcherCore';
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
  const [hasAlreadyReviewed, setHasAlreadyReviewed] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' });
  const [hoverRating, setHoverRating] = useState(0);

  const [matchingUI, setMatchingUI] = useState({
    activeRadius: 3,
    show8km: false,
    show15km: false,
    showModify: false
  });
  
  useEffect(() => {
    if (!id) return;

    // Real-time listener for RFQ document
    const unsubRfq = dataService.listenToRFQById(id, (currentRfq) => {
      if (currentRfq) {
        setRfq(currentRfq);
        
        const engine = getMatchingState(currentRfq);
        setMatchingUI({
          activeRadius: engine.currentRadius,
          show8km: engine.showExpansion8km,
          show15km: engine.showExpansion15km,
          showModify: engine.showModifyWarning && !currentRfq.lowQuoteWarningDismissed
        });

        // Trigger dynamic updates if radius needs changing in the DB
        if (engine.currentRadius !== currentRfq.searchRadius && 
            !currentRfq.matchingStopped && 
            currentRfq.status !== 'CANCELED' && 
            currentRfq.status !== 'COMPLETED') {
          dataService.saveRFQ({ ...currentRfq, searchRadius: engine.currentRadius });
        }
      }
    });

    // Real-time listener for Quotes in this RFQ
    const unsubQuotes = dataService.listenToQuotesByRFQ(id, (rfqQuotes) => {
      setQuotes(rfqQuotes);
    });

    const checkReviewStatus = async () => {
      const existing = await dataService.getReviewByRFQ(id);
      if (existing) {
        setHasAlreadyReviewed(true);
      }
    };
    checkReviewStatus();

    return () => {
      unsubRfq();
      unsubQuotes();
    };
  }, [id]);

  const handleAcceptQuote = async (quote: Quote) => {
    if (!rfq) return;
    if (window.confirm(`Accept quote from ${quote.providerName} for ${quote.price} AED?`)) {
      const updated: RFQ = { 
        ...rfq, 
        status: 'ACCEPTED', 
        acceptedQuoteId: quote.id,
        matchingStopped: true 
      };
      await dataService.saveRFQ(updated);
      await dataService.saveQuote({ ...quote, status: 'ACCEPTED' });
      showToast("Quote accepted!", "success");
    }
  };

  const handleMarkCompleted = async () => {
    if (!rfq) return;
    if (window.confirm("Mark this service as completed? This will close the query.")) {
      const updated: RFQ = { ...rfq, status: 'COMPLETED' };
      await dataService.saveRFQ(updated);
      showToast("Service marked as completed!", "success");
    }
  };

  const handleSubmitReview = async () => {
    if (!rfq || !rfq.acceptedQuoteId) return;
    if (reviewForm.rating === 0) {
      showToast("Please select a star rating", "error");
      return;
    }

    const acceptedQuote = quotes.find(q => q.id === rfq.acceptedQuoteId);
    if (!acceptedQuote) return;

    setIsSubmittingReview(true);
    const newReview: Review = {
      id: `rev_${Date.now()}`,
      rfqId: rfq.id,
      providerId: acceptedQuote.providerId,
      customerId: user.id,
      rating: reviewForm.rating,
      comment: reviewForm.comment,
      createdAt: new Date().toISOString()
    };

    try {
      await dataService.saveReview(newReview);
      setHasAlreadyReviewed(true);
      showToast("Thank you for your feedback!", "success");
    } catch (err) {
      showToast("Failed to submit review", "error");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (!rfq) return <div className="flex items-center justify-center min-h-screen text-gray-300 uppercase tracking-widest font-black text-[10px]">Syncing Discovery...</div>;

  const acceptedQuote = quotes.find(q => q.id === rfq.acceptedQuoteId);

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-32 relative">
      <header className="px-6 pt-12 pb-4 flex items-center bg-white shrink-0 shadow-sm sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="text-[#333333] w-12 h-12 flex items-center justify-center -ml-3 rounded-full active:bg-gray-100 transition-colors">
          <span className="material-symbols-outlined font-black text-[24px]">arrow_back</span>
        </button>
        <div className="ml-2 flex-1">
          <h1 className="text-[17px] font-bold text-[#333333] leading-tight">Query {rfq.idDisplay}</h1>
          <p className="text-[11px] text-[#A0A0A0] font-medium uppercase tracking-wider">Stage: {rfq.status}</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pt-6 px-6 space-y-6">
        {/* RFQ Card */}
        <div className={`bg-white rounded-[2.2rem] p-6 shadow-card space-y-4 border-l-[8px] transition-colors ${rfq.status === 'CANCELED' ? 'border-red-400' : rfq.status === 'COMPLETED' ? 'border-accent-green' : 'border-primary'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm font-black">radar</span>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {rfq.status === 'ACCEPTED' ? 'Provider Selected' : rfq.status === 'COMPLETED' ? 'Service Finished' : `Search Radius: ${matchingUI.activeRadius} KM`}
              </p>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-dark tracking-tight leading-snug">{rfq.title}</h2>
            <p className="text-[13px] text-gray-500 leading-relaxed mt-2 font-medium">"{rfq.description}"</p>
          </div>
        </div>

        {rfq.status === 'ACCEPTED' && (
          <button onClick={handleMarkCompleted} className="w-full bg-primary text-white py-5 rounded-[1.8rem] font-black text-[12px] uppercase tracking-widest shadow-btn-glow active:scale-95 transition-all">Mark as Completed</button>
        )}

        {/* Review Component */}
        {(rfq.status === 'COMPLETED' && !hasAlreadyReviewed) && (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-white space-y-8 animate-in slide-in-from-bottom-6 duration-700">
             <div className="text-center space-y-4">
               <div className="w-16 h-16 bg-accent-green/10 text-accent-green rounded-full flex items-center justify-center mx-auto shadow-sm">
                 <span className="material-symbols-outlined text-3xl font-black">check_circle</span>
               </div>
               <div className="space-y-1">
                 <h3 className="text-xl font-black text-text-dark tracking-tight leading-tight">Service Successful!</h3>
                 <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">Rate your experience with <br/><span className="text-text-dark">{acceptedQuote?.providerName || 'Specialist'}</span></p>
               </div>
             </div>

             <div className="space-y-6">
               <div className="flex justify-center gap-2.5">
                 {[1, 2, 3, 4, 5].map((star) => (
                   <button
                     key={star}
                     onMouseEnter={() => setHoverRating(star)}
                     onMouseLeave={() => setHoverRating(0)}
                     onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                     className="p-1 transition-transform active:scale-90"
                   >
                     <span className={`material-symbols-outlined text-[44px] transition-all ${
                       (hoverRating || reviewForm.rating) >= star 
                        ? 'text-secondary fill-1 scale-110' 
                        : 'text-gray-200 font-light'
                     }`}>star</span>
                   </button>
                 ))}
               </div>

               <div className="space-y-4">
                  <div className="bg-gray-50 rounded-[1.8rem] p-5 shadow-inner border border-gray-100">
                    <textarea
                      placeholder="Share details about the quality of service..."
                      value={reviewForm.comment}
                      onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                      className="w-full bg-transparent border-none p-0 text-[14px] font-bold text-text-dark min-h-[90px] focus:ring-0 resize-none placeholder-gray-300 italic"
                    />
                  </div>
                  
                  <button
                    onClick={handleSubmitReview}
                    disabled={isSubmittingReview || reviewForm.rating === 0}
                    className="w-full bg-gradient-to-r from-primary to-[#7B5CC4] text-white py-5 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.15em] shadow-btn-glow disabled:opacity-30 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                  >
                    {isSubmittingReview ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Submit Review'}
                    {!isSubmittingReview && <span className="material-symbols-outlined text-[20px] font-black">send</span>}
                  </button>
               </div>
             </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
             <h3 className="text-base font-bold text-[#333333]">
                {rfq.status === 'ACCEPTED' || rfq.status === 'COMPLETED' ? 'Winning Proposal' : `Market Proposals (${quotes.length})`}
             </h3>
             {rfq.status === 'ACTIVE' && (
                <div className="flex items-center gap-1">
                   <div className="w-1.5 h-1.5 bg-accent-green rounded-full animate-ping"></div>
                   <span className="text-[9px] font-black text-gray-300 uppercase">Live Match</span>
                </div>
             )}
          </div>
          
          <div className="space-y-4">
            {quotes
              .filter(q => (rfq.status === 'ACCEPTED' || rfq.status === 'COMPLETED') ? q.id === rfq.acceptedQuoteId : true)
              .map((quote) => (
              <div key={quote.id} className="bg-white rounded-[2rem] p-6 shadow-card border border-gray-50/50 hover:border-primary/20 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/storefront/${quote.providerId}`)}>
                    <img src={quote.providerAvatar} className="w-14 h-14 rounded-2xl object-cover border border-gray-50 shadow-sm" alt="" />
                    <div>
                      <h4 className="text-[15px] font-bold text-[#333333] tracking-tight">{quote.providerName}</h4>
                      <div className="flex items-center gap-1 text-secondary mt-0.5">
                        <span className="material-symbols-outlined text-[16px] fill-1">star</span>
                        <span className="text-[11px] font-black text-text-dark">{quote.providerRating}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-primary tracking-tight">{quote.price} AED</p>
                    <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">NET PRICE</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => navigate(`/messages/${quote.providerId}`)} className="flex-1 bg-white border border-gray-100 py-4 rounded-2xl font-black text-[11px] text-text-dark uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-sm">
                    <span className="material-symbols-outlined text-[18px] font-black">chat_bubble</span> CHAT
                  </button>
                  {(rfq.status === 'ACTIVE' || rfq.status === 'OPEN') && (
                    <button onClick={() => handleAcceptQuote(quote)} className="flex-1 bg-primary text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-transform shadow-md">
                      SELECT
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {quotes.length === 0 && (rfq.status === 'OPEN' || rfq.status === 'ACTIVE') && (
               <div className="py-12 text-center flex flex-col items-center justify-center opacity-30 bg-white/50 rounded-[2.2rem] border-2 border-dashed border-gray-200">
                  <span className="material-symbols-outlined text-4xl mb-3">hourglass_top</span>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">Awaiting expert quotes...</p>
               </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default RFQDetail;