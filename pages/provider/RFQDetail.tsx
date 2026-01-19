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

  useEffect(() => {
    if (!id) return;

    // Real-time listener for the RFQ
    const unsubRfq = dataService.listenToRFQById(id, (currentRfq) => {
      setRfq(currentRfq);
    });

    // Real-time listener for quotes to detect the provider's own quote
    const unsubQuotes = dataService.listenToQuotesByRFQ(id, (quotes) => {
      const existing = quotes.find(q => q.providerId === user.id);
      setMyQuote(existing || null);
      if (existing) {
        // Only set default form values if we aren't already editing
        setQuotePrice(prev => prev || existing.price);
        setMessage(prev => prev || existing.message);
      } else {
        // If it's a new bid, ensure editing mode is on
        setIsEditingMode(true);
      }
    });

    const fetchReviews = async () => {
      const revs = await dataService.getReviews(user.id);
      setReviews(revs);
    };
    fetchReviews();

    return () => {
      unsubRfq();
      unsubQuotes();
    };
  }, [id, user.id]);

  const handleSubmitQuote = async () => {
    if (!quotePrice || !message || !rfq) {
      showToast("Please provide both price and message", "error");
      return;
    }
    if (rfq.status !== 'OPEN' && rfq.status !== 'ACTIVE') return;
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
      showToast(myQuote ? "Bid updated successfully!" : "Bid submitted successfully!", "success");
      setIsEditingMode(false);
    } catch (err) {
      showToast("Failed to save bid", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!rfq) return <div className="p-20 text-center font-black uppercase text-[10px] text-gray-300 tracking-[0.2em] animate-pulse">Syncing Lead...</div>;

  const isLocked = rfq.status === 'COMPLETED' || rfq.status === 'CANCELED' || (rfq.status === 'ACCEPTED' && rfq.acceptedQuoteId !== myQuote?.id);
  const distance = (user.location && rfq.lat) ? calculateDistance(user.location.lat, user.location.lng, rfq.lat, rfq.lng).toFixed(1) : '?';

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-24">
      <header className="px-6 pt-12 pb-6 flex items-center justify-between shrink-0">
        <button 
          onClick={() => navigate(-1)} 
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-text-dark active:scale-90 transition-transform"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <h1 className="text-base font-bold text-text-dark tracking-tight">Lead Detail</h1>
        <div className="w-10"></div>
      </header>

      <main className="px-6 space-y-5 flex-1 overflow-y-auto no-scrollbar">
        {/* RFQ Main Card */}
        <div className="bg-white rounded-[2rem] p-6 shadow-card space-y-4 border border-white animate-in fade-in duration-300">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-[#333333] tracking-tight">{rfq.title}</h2>
              <p className="text-[10px] text-primary font-black uppercase mt-1">ID: {rfq.idDisplay} • {distance} KM Away</p>
            </div>
            <div className={`px-2.5 py-1 text-[8px] font-black rounded-md uppercase tracking-wider border ${
              rfq.status === 'OPEN' ? 'bg-orange-50 text-orange-500 border-orange-100' :
              rfq.status === 'ACTIVE' ? 'bg-blue-50 text-blue-500 border-blue-100' :
              rfq.status === 'ACCEPTED' ? 'bg-green-50 text-green-500 border-green-100' :
              'bg-gray-100 text-gray-400 border-gray-200'
            }`}>
              {rfq.status}
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                <span className="material-symbols-outlined text-base">category</span>
              </div>
              <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-tight">
                {rfq.category}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-pink-50 flex items-center justify-center text-accent-pink">
                <span className="material-symbols-outlined text-base">location_on</span>
              </div>
              <p className="text-[11px] text-gray-500 font-semibold">
                {rfq.locationName}
              </p>
            </div>

            <div className="bg-gray-50/50 p-4 rounded-2xl">
              <p className="text-[11px] text-gray-500 italic leading-relaxed font-medium">
                "{rfq.description}"
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
            <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Posted {new Date(rfq.createdAt).toLocaleDateString()}</span>
            <div className="flex items-center gap-1">
              <span className="material-icons-outlined text-xs text-primary">verified</span>
              <span className="text-[9px] font-bold text-primary uppercase">Market Lead</span>
            </div>
          </div>
        </div>

        {/* Action / Quote Section */}
        {rfq.status === 'ACCEPTED' && rfq.acceptedQuoteId === myQuote?.id ? (
          <div className="bg-[#F0F9EB] border border-[#E1F3D8] rounded-[2.5rem] p-8 text-center space-y-4 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-[#8BC34A]/10 rounded-full flex items-center justify-center mx-auto text-[#8BC34A]">
              <span className="material-icons-outlined text-3xl">check_circle</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-text-dark">Proposal Accepted!</h3>
              <p className="text-xs text-gray-500 font-medium">The client has selected your bid. Start chatting to finalize the details.</p>
            </div>
            <button 
              onClick={() => navigate(`/messages/${rfq.customerId}`)}
              className="w-full bg-[#8BC34A] text-white py-4 rounded-2xl font-bold text-sm shadow-xl shadow-green-100 active:scale-[0.98] transition-all"
            >
              Open Client Chat
            </button>
          </div>
        ) : isLocked ? (
          <div className="bg-gray-50 border border-gray-100 rounded-[2.5rem] p-10 text-center space-y-4 opacity-70">
            <span className="material-symbols-outlined text-gray-300 text-5xl">lock</span>
            <div className="space-y-1">
               <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Lead Closed</h3>
               <p className="text-[10px] text-gray-300 font-medium px-4">This lead is no longer accepting revisions as it has been {rfq.status.toLowerCase()}.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-card space-y-6 border border-white">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                {myQuote ? 'Your Active Bid' : 'Submit Your Proposal'}
              </h3>
              {myQuote && !isEditingMode && (
                <button 
                  onClick={() => setIsEditingMode(true)}
                  className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Edit Bid
                </button>
              )}
            </div>
            
            {isEditingMode ? (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary">
                    <span className="text-xs font-bold uppercase">AED</span>
                  </div>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    value={quotePrice}
                    onChange={(e) => setQuotePrice(e.target.value)}
                    className="w-full pl-16 pr-5 py-5 bg-[#F9FAFB] rounded-2xl text-[14px] border-none focus:ring-1 focus:ring-primary outline-none placeholder-gray-300 font-bold text-text-dark shadow-inner"
                  />
                </div>
                
                <div className="relative">
                  <textarea 
                    placeholder="Briefly describe your offer, inclusions, and why they should choose you..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-5 py-5 bg-[#F9FAFB] rounded-[1.8rem] text-[13px] border-none focus:ring-1 focus:ring-primary outline-none min-h-[160px] placeholder-gray-300 font-medium shadow-inner resize-none text-text-dark leading-relaxed"
                  />
                </div>

                <div className="flex gap-3">
                  {myQuote && (
                    <button 
                      onClick={() => {
                        setIsEditingMode(false);
                        setQuotePrice(myQuote.price);
                        setMessage(myQuote.message);
                      }}
                      className="flex-1 py-4 bg-gray-50 text-gray-400 rounded-2xl font-bold text-xs active:scale-[0.98] transition-all"
                    >
                      Discard
                    </button>
                  )}
                  <button 
                    onClick={handleSubmitQuote}
                    disabled={isSubmitting}
                    className={`flex-[2] bg-primary text-white py-4 rounded-2xl font-bold text-sm shadow-xl shadow-purple-100 flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${isSubmitting ? 'opacity-50' : ''}`}
                  >
                    {isSubmitting ? 'Processing...' : myQuote ? 'Update Bid' : 'Post Proposal'}
                    <span className="material-symbols-outlined text-lg">bolt</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex justify-between items-center bg-primary/5 p-6 rounded-2xl border border-primary/10">
                   <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 opacity-60">Price Quoted</p>
                      <p className="text-2xl font-black text-primary">AED {myQuote?.price}</p>
                   </div>
                   <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-primary">payments</span>
                   </div>
                </div>
                <div className="space-y-2">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Your Proposal Message</p>
                   <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 italic text-[13px] text-gray-600 leading-relaxed">
                      "{myQuote?.message}"
                   </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-300 uppercase tracking-widest ml-1">
                   <span className="material-icons-outlined text-xs">history</span>
                   Last updated {myQuote?.createdAt ? new Date(myQuote.createdAt).toLocaleDateString() : 'recently'}
                </div>
              </div>
            )}
          </div>
        )}

        {rfq.status === 'ACTIVE' && !isLocked && (
          <div className="flex justify-center items-center py-4">
            <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-5 py-2.5 rounded-full border border-white shadow-sm">
               <div className="w-1.5 h-1.5 bg-accent-green rounded-full animate-ping"></div>
               <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Lead is Live & Matching</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default RFQDetail;