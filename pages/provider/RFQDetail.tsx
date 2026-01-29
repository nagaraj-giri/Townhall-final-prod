
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, RFQ, Quote, Review } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';
import { calculateDistance } from '../../LeadEngine/LeadMatcher';

interface RFQDetailProps {
  user: User;
}

const RFQDetail: React.FC<RFQDetailProps> = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [myQuote, setMyQuote] = useState<Quote | null>(null);
  const [quotePrice, setQuotePrice] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    if (!id) return;
    const unsubRfq = dataService.listenToRFQById(id, (currentRfq) => setRfq(currentRfq));
    const unsubQuotes = dataService.listenToQuotesByRFQ(id, (quotes) => {
      setAllQuotes(quotes);
      const existing = quotes.find(q => q.providerId === user.id);
      setMyQuote(existing || null);
      if (existing) {
        setQuotePrice(prev => prev || existing.price);
        setMessage(prev => prev || existing.message);
      } else {
        setIsEditingMode(true);
      }
    });

    const fetchReviews = async () => {
      const revs = await dataService.getReviews(user.id);
      setReviews(revs);
    };
    fetchReviews();

    return () => { unsubRfq(); unsubQuotes(); };
  }, [id, user.id]);

  const handleSubmitQuote = async () => {
    // PRD Constraint: Unverified providers cannot submit bids
    if (!user.isVerified) {
      showToast("Access Restricted: Your business account must be approved by Admin before submitting proposals.", "error");
      return;
    }

    if (!quotePrice || !message || !rfq) {
      showToast("Provide price and proposal message", "error");
      return;
    }
    setIsSubmitting(true);
    const currentRating = reviews.length > 0 
      ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1))
      : (user.rating || 0);

    const newQuote: Quote = {
      id: myQuote?.id || `q_${Date.now()}`,
      rfqId: rfq.id,
      providerId: user.id,
      providerName: user.name,
      providerAvatar: user.avatar,
      providerRating: currentRating,
      price: quotePrice,
      timeline: 'Standard',
      message: message,
      status: 'SENT',
      createdAt: myQuote?.createdAt || new Date().toISOString()
    };

    try {
      await dataService.saveQuote(newQuote);
      
      // PRD Compliance: Audit Log for Bid Submission
      await dataService.createAuditLog({
        admin: user,
        title: `Proposal Broadcast: ${rfq.idDisplay}`,
        type: "BID_ACTIVITY",
        severity: "LOW",
        icon: "payments",
        iconBg: "bg-primary",
        eventId: rfq.id,
        details: { price: quotePrice, providerName: user.name }
      });

      showToast("Bid broadcasted to client", "success");
      setIsEditingMode(false);
    } catch (err) {
      showToast("Save failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!rfq) return <div className="p-20 text-center font-black uppercase text-[10px] text-gray-300 tracking-[0.2em] animate-pulse">Syncing...</div>;

  const isLocked = rfq.status === 'COMPLETED' || rfq.status === 'CANCELED' || (rfq.status === 'ACCEPTED' && rfq.acceptedQuoteId !== myQuote?.id);
  const distance = (user.location && rfq.lat) ? calculateDistance(user.location.lat, user.location.lng, rfq.lat, rfq.lng).toFixed(1) : '?';

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-24">
      <header className="px-6 pt-12 pb-6 flex items-center bg-white border-b border-gray-50 sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="text-text-dark w-12 h-12 flex items-center justify-center -ml-3 rounded-full active:bg-gray-100 transition-colors">
          <span className="material-symbols-outlined font-black">arrow_back</span>
        </button>
        <div className="ml-2 flex-1">
          <h1 className="text-[17px] font-bold text-text-dark">Query {rfq.idDisplay}</h1>
          <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">{rfq.status}</p>
        </div>
      </header>

      <main className="px-6 space-y-6 flex-1 overflow-y-auto no-scrollbar pt-6">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white space-y-5 animate-in fade-in duration-300">
          <h2 className="text-[20px] font-bold text-[#333333] tracking-tight">{rfq.title}</h2>
          <div className="bg-gray-50/30 p-5 rounded-[1.8rem] border border-gray-100/50">
            <p className="text-[13px] text-gray-500 leading-relaxed font-medium">"{rfq.description}"</p>
          </div>
          <div className="flex items-center gap-3 text-primary pt-1">
            <span className="material-symbols-outlined text-[20px] font-black">location_on</span>
            <p className="text-[11px] font-black uppercase tracking-widest">{distance} KM Away • {rfq.locationName.split(',')[0]}</p>
          </div>
        </div>

        {!user.isVerified && (
           <div className="bg-orange-50 border border-orange-100 p-5 rounded-[2rem] flex items-start gap-4 shadow-sm animate-in slide-in-from-top-2">
              <span className="material-symbols-outlined text-orange-500 fill-1">verified_user</span>
              <div className="space-y-1">
                <p className="text-[11px] font-black text-orange-600 uppercase tracking-widest leading-none">Account Pending Verification</p>
                <p className="text-[10px] text-orange-500/80 font-bold leading-relaxed">
                  Bidding is currently disabled. You can explore leads, but proposals can only be sent once an Admin approves your Trade License.
                </p>
              </div>
           </div>
        )}

        {myQuote && (
          <div className="flex gap-4">
             <button 
                onClick={() => navigate(`/messages/${rfq.customerId}`)}
                className="flex-1 bg-primary text-white py-5 rounded-[2rem] font-bold text-[13px] uppercase tracking-widest shadow-btn-glow active:scale-[0.98] transition-all flex items-center justify-center gap-3"
             >
                <span className="material-symbols-outlined">chat_bubble</span>
                Open Negotiation
             </button>
          </div>
        )}

        {rfq.status === 'ACCEPTED' && rfq.acceptedQuoteId === myQuote?.id ? (
          <div className="bg-[#F0F9EB] border border-[#E1F3D8] rounded-[2.5rem] p-8 text-center space-y-4 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-[#8BC34A]/10 rounded-full flex items-center justify-center mx-auto text-[#8BC34A]">
              <span className="material-symbols-outlined text-3xl font-black">verified</span>
            </div>
            <h3 className="text-lg font-bold text-text-dark">Opportunity Secured!</h3>
          </div>
        ) : isLocked ? (
          <div className="bg-gray-50 border border-gray-100 rounded-[2.5rem] p-12 text-center space-y-4 opacity-70">
            <span className="material-symbols-outlined text-gray-300 text-5xl">lock</span>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Lead Board Closed</h3>
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-card space-y-6 border border-white">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                {myQuote ? 'Your Active Bid' : 'Submit Your Proposal'}
              </h3>
              {myQuote && !isEditingMode && (
                <button onClick={() => setIsEditingMode(true)} className="text-[10px] font-black text-primary uppercase flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">edit</span>Edit</button>
              )}
            </div>
            
            {isEditingMode ? (
              <div className="space-y-5">
                <div className="relative">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-primary font-black text-[12px] uppercase">AED</div>
                  <input 
                    type="number" 
                    value={quotePrice}
                    onChange={(e) => setQuotePrice(e.target.value)}
                    className={`w-full pl-16 pr-6 py-5 bg-[#F9FAFB] rounded-2xl text-[15px] border-none focus:ring-1 focus:ring-primary outline-none font-bold text-text-dark shadow-inner ${!user.isVerified ? 'opacity-50' : ''}`}
                    placeholder="0.00"
                    disabled={!user.isVerified}
                  />
                </div>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`w-full px-6 py-5 bg-[#F9FAFB] rounded-[2rem] text-[14px] border-none focus:ring-1 focus:ring-primary shadow-inner resize-none text-text-dark leading-relaxed font-medium ${!user.isVerified ? 'opacity-50' : ''}`}
                  placeholder="Describe your offer inclusions..."
                  disabled={!user.isVerified}
                />
                <button 
                  onClick={handleSubmitQuote} 
                  disabled={isSubmitting || !quotePrice || !user.isVerified} 
                  className={`w-full py-5 rounded-full font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                    user.isVerified 
                      ? 'bg-primary text-white shadow-btn-glow active:scale-[0.98]' 
                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                  }`}
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                  ) : user.isVerified ? (
                    'Broadcast Bid'
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">lock</span>
                      Approval Required
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-primary/5 p-7 rounded-3xl border border-primary/10 shadow-inner">
                   <div>
                      <p className="text-[10px] font-bold text-primary uppercase mb-1.5 tracking-widest opacity-60">Quoted Amount</p>
                      <p className="text-[28px] font-black text-primary tracking-tighter">AED {myQuote?.price}</p>
                   </div>
                   <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-primary text-2xl">payments</span>
                   </div>
                </div>
                <div className="bg-gray-50 rounded-[1.8rem] p-6 border border-gray-100 italic text-[13px] text-gray-500 font-medium leading-relaxed">
                   "{myQuote?.message}"
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default RFQDetail;
