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

    // Check if a review already exists for this RFQ to prevent duplicate prompts
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

  const isActive = rfq.status === 'OPEN' || rfq.status === 'ACTIVE';
  const acceptedQuote = quotes.find(q => q.id === rfq.acceptedQuoteId);

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-32 relative">
      <header className="px-6 pt-12 pb-4 flex items-center bg-white shrink-0 shadow-sm sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="text-[#333333] w-10 h-10 flex items-center justify-center -ml-2 rounded-full active:bg-gray-100 transition-colors">
          <span className="material-symbols-outlined font-black text-[22px]">arrow_back</span>
        </button>
        <div className="ml-2 flex-1">
          <h1 className="text-[17px] font-bold text-[#333333] leading-tight">Query {rfq.idDisplay}</h1>
          <p className="text-[11px] text-[#A0A0A0] font-medium">Stage: {rfq.status}</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pt-6 px-6 space-y-6">
        {/* RFQ Card */}
        <div className={`bg-white rounded-[2rem] p-6 shadow-card space-y-3 border-l-[6px] transition-colors ${rfq.status === 'CANCELED' ? 'border-red-400' : rfq.status === 'COMPLETED' ? 'border-accent-green' : 'border-primary'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm font-bold">radar</span>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                {rfq.status === 'ACCEPTED' ? 'Provider Selected' : rfq.status === 'COMPLETED' ? 'Service Finished' : `Search Radius: ${matchingUI.activeRadius} KM`}
              </p>
            </div>
          </div>
          <h2 className="text-lg font-bold text-text-dark">{rfq.title}</h2>
          <p className="text-xs text-gray-500 leading-relaxed">{rfq.description}</p>
        </div>

        {rfq.status === 'ACCEPTED' && (
          <button onClick={handleMarkCompleted} className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-xs shadow-xl active:scale-95 transition-all">Mark as Completed</button>
        )}

        {/* Review Component */}
        {(rfq.status === 'COMPLETED' && !hasAlreadyReviewed) && (
          <div className="bg-white rounded-[2.5rem] p-10 shadow-soft border border-white space-y-8 animate-in slide-in-from-bottom-6 duration-700">
             <div className="text-center space-y-4">
               <div className="w-20 h-20 bg-accent-green/10 text-accent-green rounded-full flex items-center justify-center mx-auto shadow-sm">
                 <span className="material-symbols-outlined text-4xl font-black">check_circle</span>
               </div>
               <div className="space-y-1">
                 <h3 className="text-2xl font-black text-text-dark tracking-tighter leading-tight">Service Successful!</h3>
                 <p className="text-[13px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">Rate your experience with <br/><span className="text-text-dark">{acceptedQuote?.providerName || 'Test Visa Service'}</span></p>
               </div>
             </div>

             <div className="space-y-8">
               {/* Star Selector */}
               <div className="flex justify-center gap-3">
                 {[1, 2, 3, 4, 5].map((star) => (
                   <button
                     key={star}
                     onMouseEnter={() => setHoverRating(star)}
                     onMouseLeave={() => setHoverRating(0)}
                     onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                     className="p-1 transition-transform active:scale-90"
                   >
                     <span className={`material-symbols-outlined text-[48px] transition-all ${
                       (hoverRating || reviewForm.rating) >= star 
                        ? 'text-[#FFD60A] fill-1 scale-110' 
                        : 'text-gray-200 font-light'
                     }`}>star</span>
                   </button>
                 ))}
               </div>

               {/* Feedback Textarea */}
               <div className="space-y-6">
                  <div className="bg-[#F8F9FA] rounded-[2rem] p-6 shadow-inner border border-gray-100">
                    <textarea
                      placeholder="test for user"
                      value={reviewForm.comment}
                      onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                      className="w-full bg-transparent border-none p-0 text-[15px] font-bold text-text-dark min-h-[100px] focus:ring-0 resize-none placeholder-gray-300 italic"
                    />
                  </div>
                  
                  {/* Action Button */}
                  <button
                    onClick={handleSubmitReview}
                    disabled={isSubmittingReview || reviewForm.rating === 0}
                    className="w-full bg-gradient-to-r from-[#A073E2] to-[#7B5CC4] text-white py-5 rounded-[2.2rem] font-black text-[14px] uppercase tracking-[0.15em] shadow-btn-glow disabled:opacity-30 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                  >
                    {isSubmittingReview ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Submit Review'}
                    {!isSubmittingReview && <span className="material-symbols-outlined text-[20px] font-black">send</span>}
                  </button>
               </div>
             </div>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-base font-bold text-[#333333]">
            {rfq.status === 'ACCEPTED' || rfq.status === 'COMPLETED' ? 'Selected Quote' : `Provider Proposals (${quotes.length})`}
          </h3>
          <div className="space-y-4">
            {quotes
              .filter(q => (rfq.status === 'ACCEPTED' || rfq.status === 'COMPLETED') ? q.id === rfq.acceptedQuoteId : true)
              .map((quote) => (
              <div key={quote.id} className="bg-white rounded-[2rem] p-6 shadow-card border border-gray-50/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/storefront/${quote.providerId}`)}>
                    <img src={quote.providerAvatar} className="w-12 h-12 rounded-full object-cover border border-gray-100" alt="" />
                    <div>
                      <h4 className="text-[14px] font-bold text-[#333333]">{quote.providerName}</h4>
                      <div className="flex items-center gap-1 text-[#FFD60A]">
                        <span className="material-symbols-outlined text-[16px] fill-1">star</span>
                        <span className="text-[10px] font-bold text-gray-400">{quote.providerRating}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-primary">{quote.price} AED</p>
                    <span className="text-[9px] font-bold text-gray-300 uppercase">INC. VAT</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => navigate(`/messages/${quote.providerId}`)} className="flex-1 bg-white border border-gray-100 py-3.5 rounded-xl font-bold text-[11px] text-text-dark uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform">
                    <span className="material-symbols-outlined text-[18px] font-bold">chat_bubble</span> CHAT
                  </button>
                  {rfq.status === 'ACTIVE' && (
                    <button onClick={() => handleAcceptQuote(quote)} className="flex-1 bg-primary text-white py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-widest active:scale-95 transition-transform">
                      Accept
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default RFQDetail;