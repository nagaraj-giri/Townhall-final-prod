import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, RFQ, Quote, Review, UserRole } from '../../types';
import { dataService } from '../../services/dataService';
import { getMatchingState, MatcherState } from '../../LeadEngine/MatcherCore';
import { useApp } from '../../App';
import { performStrategicMatchAnalysis } from '../../services/geminiService';

interface RFQDetailProps {
  user: User;
}

const RFQDetail: React.FC<RFQDetailProps> = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast, playRingtone, chatUnreadCount } = useApp();
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAccepting, setIsAccepting] = useState<string | null>(null);
  
  const [matchingUI, setMatchingUI] = useState<MatcherState>({
    currentRadius: 3,
    showExpansion8km: false,
    showExpansion15km: false,
    showModifyWarning: false,
    isMatchingFinished: false
  });

  const lastSyncedRadius = useRef<number>(3);

  useEffect(() => {
    if (!id) return;
    const unsubRfq = dataService.listenToRFQById(id, (currentRfq) => {
      if (currentRfq) {
        setRfq(currentRfq);
        const newState = getMatchingState(currentRfq);
        setMatchingUI(newState);
        lastSyncedRadius.current = currentRfq.searchRadius || 3;
      }
    });
    const unsubQuotes = dataService.listenToQuotesByRFQ(id, setQuotes);
    
    // Listening to ROOT matches collection (Updated per PRD v12.0)
    const unsubMatches = dataService.listenToRFQMatches(id, setMatches);
    
    return () => { unsubRfq(); unsubQuotes(); unsubMatches(); };
  }, [id]);

  useEffect(() => {
    if (!rfq || quotes.length === 0) return;
    
    const unanalyzedQuotes = quotes.filter(q => {
      const match = matches.find(m => m.providerId === q.providerId);
      return !match || !match.aiReasoning;
    });

    if (unanalyzedQuotes.length > 0 && !isAnalyzing) {
      const runAnalysis = async () => {
        setIsAnalyzing(true);
        try {
          const providersToAnalyze = await Promise.all(
            unanalyzedQuotes.map(q => dataService.getUserById(q.providerId))
          );
          const validProviders = providersToAnalyze.filter(p => p !== null) as User[];
          const results = await performStrategicMatchAnalysis(rfq, validProviders);
          
          if (Array.isArray(results)) {
            for (const res of results) {
              await dataService.sendAIRRAInsights(rfq.id, res.providerId, res.reasoning, res.relevancyScore);
            }
          }
        } catch (e) {
          console.error("AIRRA Analysis failed:", e);
        } finally {
          setIsAnalyzing(false);
        }
      };
      runAnalysis();
    }
  }, [quotes.length, rfq, matches, isAnalyzing]);

  useEffect(() => {
    if (!rfq || rfq.matchingStopped || matchingUI.isMatchingFinished || (rfq.status !== 'OPEN' && rfq.status !== 'ACTIVE')) return;

    const checkInterval = setInterval(async () => {
      const createdAt = new Date(rfq.createdAt).getTime();
      const elapsedMins = (Date.now() - createdAt) / 60000;
      const quotesCount = quotes.length;

      let targetRadius = rfq.searchRadius || 3;

      if (quotesCount < 7) {
        if (elapsedMins > 2 && elapsedMins <= 5 && targetRadius < 8) targetRadius = 8;
        if (elapsedMins > 5 && targetRadius < 15) targetRadius = 15;
      }

      if (targetRadius > lastSyncedRadius.current) {
        lastSyncedRadius.current = targetRadius;
        const updatedRfq = { ...rfq, searchRadius: targetRadius };
        await dataService.saveRFQ(updatedRfq);
        await dataService.triggerLeadMatchingNotifications(updatedRfq);
        
        showToast(`Expanding discovery range to ${targetRadius}km...`, "info");
        playRingtone();
      }
    }, 10000);

    return () => clearInterval(checkInterval);
  }, [rfq, quotes.length, matchingUI.isMatchingFinished, playRingtone, showToast]);

  const handleApproveExpansion = async (targetRadius: number) => {
    if (!rfq) return;
    const field = targetRadius === 8 ? 'expansionApproved_8km' : 'expansionApproved_15km';
    lastSyncedRadius.current = targetRadius;
    const updatedRfq = { ...rfq, [field]: true, searchRadius: targetRadius };
    await dataService.saveRFQ(updatedRfq);
    await dataService.triggerLeadMatchingNotifications(updatedRfq);
    
    showToast(`Range expanded to ${targetRadius}km`, "success");
    playRingtone();
  };

  const handleStopMatching = async () => {
    if (!rfq) return;
    if (window.confirm("Stop searching for new experts?")) {
      await dataService.saveRFQ({ ...rfq, matchingStopped: true });
      showToast("Discovery stopped", "info");
    }
  };

  const handleAcceptBid = async (quote: Quote) => {
    if (!rfq) return;
    if (window.confirm(`Accept proposal from ${quote.providerName} for AED ${quote.price}?`)) {
      setIsAccepting(quote.id);
      try {
        await dataService.markQuoteAsAccepted(quote.id, rfq.id);
        showToast("Proposal Accepted Successfully!", "success");
        playRingtone();
        navigate('/messages/' + quote.providerId);
      } catch (err: any) {
        console.error("Critical Accept bid error:", err);
        showToast("System error during acceptance.", "error");
      } finally {
        setIsAccepting(null);
      }
    }
  };

  const handleCompleteJob = async () => {
    if (!rfq) return;
    if (window.confirm("Mark this project as COMPLETED?")) {
      await dataService.markRFQCompleted(rfq.id);
      showToast("Project completed", "success");
    }
  };

  const handleCancelRfq = async () => {
    if (!rfq) return;
    if (window.confirm("Are you sure you want to cancel this request?")) {
      await dataService.saveRFQ({ ...rfq, status: 'CANCELED' });
      showToast("Request canceled", "info");
      navigate('/queries');
    }
  };

  if (!rfq) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const isLocked = rfq.status === 'ACCEPTED' || rfq.status === 'COMPLETED' || rfq.status === 'CANCELED';
  const isSaturated = quotes.length >= 15;
  const isHighInterest = quotes.length > 10 && (rfq.searchRadius || 3) <= 3;
  const isMaxRange = rfq.searchRadius === 15;

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF9F6] pb-32">
      <header className="px-6 pt-12 pb-6 flex items-center bg-white border-b border-gray-100 sticky top-0 z-50">
        <button onClick={() => navigate('/queries')} className="w-10 h-10 flex items-center justify-start text-text-dark active:scale-90 transition-transform">
          <span className="material-symbols-outlined font-black">arrow_back</span>
        </button>
        <div className="ml-2 flex-1">
          <h1 className="text-[17px] font-black text-text-dark uppercase tracking-tight">Query {rfq.idDisplay}</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{rfq.status}</p>
        </div>
        {!isLocked && (
          <button onClick={handleCancelRfq} className="text-red-500 text-[10px] font-black uppercase tracking-widest">Cancel</button>
        )}
      </header>

      <main className="px-6 pt-6 space-y-6 flex-1 overflow-y-auto no-scrollbar pb-10">
        {!isLocked && (
          <div className="bg-white rounded-full px-6 py-4 shadow-soft border border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
               <div className="relative flex items-center justify-center">
                  <div className={`w-2.5 h-2.5 ${isSaturated || isMaxRange ? 'bg-primary' : 'bg-accent-green'} rounded-full ${(isSaturated || isMaxRange) ? '' : 'animate-ping opacity-75'}`}></div>
                  <div className={`absolute w-2 h-2 ${isSaturated || isMaxRange ? 'bg-primary' : 'bg-accent-green'} rounded-full`}></div>
               </div>
               <span className="text-[10px] font-black text-text-dark uppercase tracking-[0.15em]">
                 {isSaturated ? 'Saturation Reached' : isHighInterest ? 'High Interest' : rfq.matchingStopped ? 'Discovery Stopped' : 'Discovery Active'}
               </span>
            </div>
            <div className="flex items-center gap-4 flex-1 mx-6">
               <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-1000 ${isSaturated || isMaxRange ? 'bg-primary' : 'bg-accent-green'}`} style={{ width: `${Math.min(100, (quotes.length / 15) * 100)}%` }}></div>
               </div>
            </div>
            <span className="text-[10px] font-black text-primary uppercase tracking-wider">
               {isSaturated ? 'BOARD CLOSED' : `${rfq.searchRadius}KM Radius`}
            </span>
          </div>
        )}

        {isHighInterest && !isLocked && !isSaturated && (
          <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white space-y-5 shadow-btn-glow animate-in zoom-in-95">
             <div className="flex items-center gap-3">
                <span className="material-symbols-outlined font-black">bolt</span>
                <h3 className="text-sm font-black uppercase tracking-widest">High Velocity Match</h3>
             </div>
             <p className="text-xs leading-relaxed opacity-90">
               Your request has triggered significant local interest. We have <b>{quotes.length} experts</b> bidding within 3km. Auto-expansion is paused to let you focus on these local pros.
             </p>
          </div>
        )}

        {!isLocked && (matchingUI.showExpansion8km || matchingUI.showExpansion15km) && !isSaturated && !isHighInterest && (
          <div className="bg-primary rounded-[2.5rem] p-8 text-white space-y-5 shadow-btn-glow animate-in zoom-in-95">
             <h3 className="text-sm font-black uppercase tracking-widest">Widen Search?</h3>
             <p className="text-xs leading-relaxed opacity-90">To get more competitive bids, AIRRA recommends scanning experts within <b>{matchingUI.showExpansion8km ? '8km' : '15km'}</b>.</p>
             <div className="flex gap-3 pt-2">
                <button onClick={() => handleApproveExpansion(matchingUI.showExpansion8km ? 8 : 15)} className="flex-1 bg-secondary text-text-dark py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">Approve</button>
                <button onClick={handleStopMatching} className="flex-1 bg-white/10 border border-white/20 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest">Stay Local</button>
             </div>
          </div>
        )}

        <div className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white space-y-5">
          <div className="flex justify-between items-start">
             <span className="bg-primary/5 text-primary text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest">{rfq.service}</span>
             <span className="text-[9px] font-bold text-gray-300 uppercase">{new Date(rfq.createdAt).toLocaleDateString()}</span>
          </div>
          <h2 className="text-[20px] font-black text-text-dark leading-tight">{rfq.title}</h2>
          <div className="bg-gray-50/50 p-5 rounded-[1.8rem] border border-gray-100 italic">
             <p className="text-[13px] text-gray-500 font-medium leading-relaxed">"{rfq.description}"</p>
          </div>
          <div className="flex items-center gap-2 text-text-light">
             <span className="material-symbols-outlined text-lg">location_on</span>
             <p className="text-[11px] font-bold uppercase tracking-tight">{rfq.locationName}</p>
          </div>
        </div>

        <section className="space-y-4">
           <div className="flex justify-between items-center px-1">
              <h3 className="text-[12px] font-black text-gray-400 uppercase tracking-widest">Expert Proposals ({quotes.length})</h3>
           </div>
           
           {quotes.length > 0 ? (
             <div className="space-y-4">
                {quotes.map((quote) => {
                  const isAccepted = rfq.acceptedQuoteId === quote.id;
                  const hasRating = (quote.providerRating || 0) > 0;
                  const isProcessingAccept = isAccepting === quote.id;

                  return (
                    <div key={quote.id} className={`bg-white rounded-[2.5rem] p-6 border transition-all ${isAccepted ? 'border-accent-green ring-4 ring-accent-green/5' : 'border-white shadow-card'}`}>
                       <div 
                         className="flex justify-between items-start mb-5 cursor-pointer active:opacity-70 transition-opacity"
                         onClick={() => navigate(`/storefront/${quote.providerId}`)}
                       >
                          <div className="flex items-center gap-4">
                             <img src={quote.providerAvatar} className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-sm" alt="" />
                             <div>
                                <h4 className="text-[15px] font-black text-text-dark uppercase truncate max-w-[140px]">{quote.providerName}</h4>
                                <div className="flex items-center gap-1.5 text-secondary mt-1">
                                   <span className={`material-symbols-outlined text-[14px] ${hasRating ? 'fill-1' : ''}`}>star</span>
                                   <span className="text-[11px] font-black text-text-dark">{hasRating ? quote.providerRating.toFixed(1) : '5.0'}</span>
                                </div>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-lg font-black text-primary leading-none">AED {quote.price}</p>
                             <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-1">Final Bid</p>
                          </div>
                       </div>

                       <div className="flex gap-2">
                          <button 
                            onClick={() => navigate(`/messages/${quote.providerId}`)}
                            disabled={!!isAccepting}
                            className="flex-1 py-4 bg-[#F2F0F9] text-primary rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:bg-[#EBE7F5] disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm">chat</span>
                            CHAT
                          </button>

                          {isAccepted ? (
                            <div className="flex-1 py-4 bg-accent-green/10 text-accent-green rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
                               <span className="material-symbols-outlined text-sm font-black">verified</span>
                               ACCEPTED
                            </div>
                          ) : !isLocked ? (
                            <button 
                              onClick={() => handleAcceptBid(quote)}
                              disabled={!!isAccepting}
                              className="flex-1 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-btn-glow active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
                            >
                              {isProcessingAccept ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              ) : 'ACCEPT'}
                            </button>
                          ) : null}
                       </div>
                    </div>
                  );
                })}
             </div>
           ) : (
             <div className="py-24 text-center bg-white/40 rounded-[2.5rem] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center gap-4">
                <span className="material-symbols-outlined text-4xl text-gray-200 animate-pulse">radar</span>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Scanning local experts...</p>
             </div>
           )}
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-border-light pb-10 pt-4 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60"><span className="material-symbols-outlined text-[28px] font-normal">home</span><span className="text-[9px] font-normal uppercase tracking-widest">HOME</span></button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1 text-primary font-bold"><div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-xl relative"><span className="material-symbols-outlined text-[28px] font-normal fill-1">format_list_bulleted</span></div><span className="text-[9px] font-normal uppercase tracking-widest">QUERIES</span></button>
        <button onClick={() => navigate('/messages')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60 relative">
          <span className="material-symbols-outlined text-[28px] font-normal">chat_bubble</span>
          {chatUnreadCount > 0 && <div className="absolute top-0 right-3 w-4 h-4 bg-accent-pink rounded-full border-2 border-white text-[8px] font-normal text-white flex items-center justify-center">{chatUnreadCount}</div>}
          <span className="text-[9px] font-normal uppercase tracking-widest">CHAT</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60"><span className="material-symbols-outlined text-[28px] font-normal">person</span><span className="text-[9px] font-normal uppercase tracking-widest">PROFILE</span></button>
      </nav>
    </div>
  );
};

export default RFQDetail;