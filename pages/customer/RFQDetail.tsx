
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, RFQ, Quote, Review, UserRole } from '../../types';
import { dataService } from '../services/dataService';
import { getMatchingState, MatcherState } from '../../LeadEngine/MatcherCore';
import { useApp } from '../../App';
import { performStrategicMatchAnalysis } from '../services/geminiService';

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
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
          
          // Sync AIRRA results to the subcollection for permanent UI access
          for (const res of results) {
            const matchRef = matches.find(m => m.providerId === res.providerId);
            if (matchRef) {
              // FIX: Changed saveAIRRAInsights to sendAIRRAInsights as per dataService definition
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
    if (!rfq || rfq.matchingStopped || matchingUI.isMatchingFinished) return;

    const checkInterval = setInterval(async () => {
      const createdAt = new Date(rfq.createdAt).getTime();
      const elapsedMins = (Date.now() - createdAt) / 60000;
      const quotesCount = quotes.length;

      let targetRadius = rfq.searchRadius || 3;

      if (elapsedMins > 2 && elapsedMins <= 5) {
        if (quotesCount < 7 && targetRadius < 8) targetRadius = 8;
      }
      
      if (elapsedMins > 5) {
        if (quotesCount < 7 && targetRadius < 15) targetRadius = 15;
      }

      if (targetRadius > lastSyncedRadius.current) {
        lastSyncedRadius.current = targetRadius;
        const updatedRfq = { ...rfq, searchRadius: targetRadius };
        await dataService.saveRFQ(updatedRfq);
        await dataService.triggerLeadMatchingNotifications(updatedRfq);
        showToast(`AIRRA: Expanding discovery range to ${targetRadius}KM`, "info");
      }
    }, 10000);

    return () => clearInterval(checkInterval);
  }, [rfq, quotes.length, matchingUI.isMatchingFinished]);

  const handleApproveExpansion = async (targetRadius: number) => {
    if (!rfq) return;
    const field = targetRadius === 8 ? 'expansionApproved_8km' : 'expansionApproved_15km';
    lastSyncedRadius.current = targetRadius;
    const updatedRfq = { ...rfq, [field]: true, searchRadius: targetRadius };
    await dataService.saveRFQ(updatedRfq);
    await dataService.triggerLeadMatchingNotifications(updatedRfq);
    showToast(`Operational range expanded to ${targetRadius}km`, "success");
  };

  const handleStopMatching = async () => {
    if (!rfq) return;
    if (window.confirm("Stop discovering new experts? AIRRA will freeze active scans.")) {
      await dataService.saveRFQ({ ...rfq, matchingStopped: true });
      showToast("Scanning halted", "info");
    }
  };

  const handleAcceptBid = async (quote: Quote) => {
    if (!rfq) return;
    if (window.confirm(`Hire ${quote.providerName} for AED ${quote.price}?`)) {
      await dataService.markQuoteAsAccepted(quote.id, rfq.id);
      await dataService.createAuditLog({
        admin: user, title: `Hired: ${quote.providerName}`, type: "BID_ACTIVITY",
        severity: "MEDIUM", icon: "verified", iconBg: "bg-accent-green",
        eventId: rfq.id, details: { providerId: quote.providerId, price: quote.price }
      });
      showToast("Expert hired", "success");
    }
  };

  const handleCompleteJob = async () => {
    if (!rfq) return;
    if (window.confirm("Mark this requirement as COMPLETED?")) {
      await dataService.markRFQCompleted(rfq.id);
      await dataService.createAuditLog({
        admin: user, title: `Job Completed: ${rfq.idDisplay}`, type: "QUERY_LIFECYCLE",
        severity: "LOW", icon: "check_circle", iconBg: "bg-accent-green", eventId: rfq.id
      });
      showToast("Project closed", "success");
    }
  };

  if (!rfq) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-32 relative">
      <header className="px-6 pt-12 pb-4 flex items-center bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="text-text-dark w-11 h-11 flex items-center justify-center -ml-2 rounded-full active:bg-gray-100 transition-all"><span className="material-symbols-outlined font-bold">arrow_back</span></button>
        <div className="ml-3 flex-1">
          <h1 className="text-[16px] font-black text-text-dark uppercase tracking-tight">Query {rfq.idDisplay}</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{rfq.status}</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pt-6 px-6 space-y-6">
        
        {/* PROGRESSIVE MATCHING UI */}
        {!matchingUI.isMatchingFinished && (
          <section className="bg-white rounded-[2rem] p-6 shadow-card border border-white space-y-4">
            <div className="flex justify-between items-center px-1">
               <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">AIRRA SCANNING</h3>
               <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-accent-green rounded-full animate-pulse"></div><span className="text-[9px] font-black text-accent-green uppercase">Live Discovery</span></div>
            </div>
            <div className="flex items-center gap-2">
               {[3, 8, 15].map((rad) => (
                 <div key={rad} className="flex flex-col items-center gap-2 flex-1">
                    <div className={`w-full h-1.5 rounded-full transition-all duration-700 ${rfq.searchRadius >= rad ? 'bg-primary' : 'bg-gray-100'}`}></div>
                    <span className={`text-[8px] font-black uppercase ${rfq.searchRadius >= rad ? 'text-primary' : 'text-gray-300'}`}>{rad}KM</span>
                 </div>
               ))}
            </div>
          </section>
        )}

        {/* EXPANSION CONTROL */}
        {(matchingUI.showExpansion8km || matchingUI.showExpansion15km) && (
          <div className="bg-primary rounded-[2.5rem] p-8 text-white space-y-5 shadow-btn-glow animate-in zoom-in-95 duration-500">
             <h3 className="text-sm font-black uppercase tracking-widest">AIRRA Suggestion</h3>
             <p className="text-xs leading-relaxed font-medium">To attract more competitive experts, I recommend expanding scans to <strong>{matchingUI.showExpansion8km ? '8 KM' : '15 KM'}</strong>.</p>
             <div className="flex gap-3 pt-2">
                <button onClick={() => handleApproveExpansion(matchingUI.showExpansion8km ? 8 : 15)} className="flex-1 bg-secondary text-text-dark py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Approve Scan</button>
                <button onClick={handleStopMatching} className="flex-1 bg-white/10 border border-white/20 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Stay Local</button>
             </div>
          </div>
        )}

        {/* RFQ CORE DATA */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white space-y-5">
          <div className="flex justify-between items-start">
             <div className="px-4 py-1.5 bg-primary/5 rounded-xl text-[9px] font-black text-primary uppercase tracking-widest">{rfq.service}</div>
             <span className="text-[9px] font-bold text-gray-400 uppercase">{rfq.searchRadius}KM RAD</span>
          </div>
          <h2 className="text-[20px] font-black text-text-dark leading-tight sentence-case">{rfq.title}</h2>
          <p className="text-[13px] text-gray-500 leading-relaxed font-medium italic">"{rfq.description}"</p>
          {rfq.status === 'ACCEPTED' && (
            <button onClick={handleCompleteJob} className="w-full bg-accent-green text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 mt-4"><span className="material-symbols-outlined text-lg">check_circle</span>Mark as Completed</button>
          )}
        </div>

        {/* BIDS LIST */}
        <div className="space-y-4 pb-20">
          <h3 className="text-[14px] font-black text-text-dark uppercase tracking-widest ml-1">Verified Bids ({quotes.length})</h3>
          {quotes.map((quote) => {
            const aiMatch = matches.find(m => m.providerId === quote.providerId);
            return (
              <div key={quote.id} className="bg-white rounded-[2.5rem] p-8 shadow-card border border-gray-50 space-y-6 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/storefront/${quote.providerId}`)}>
                    <img src={quote.providerAvatar} className="w-16 h-16 rounded-[1.6rem] object-cover border-2 border-white shadow-sm" alt="" />
                    <div>
                      <h4 className="text-[16px] font-black text-text-dark">{quote.providerName}</h4>
                      <div className="flex items-center gap-1 text-secondary mt-1"><span className="material-symbols-outlined text-[16px] fill-1">star</span><span className="text-[12px] font-black text-text-dark">{quote.providerRating}</span></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[22px] font-black text-primary tracking-tighter leading-none">{quote.price}</p>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">AED</p>
                  </div>
                </div>

                {aiMatch?.aiReasoning && (
                  <div className="bg-[#F2F0F9]/50 p-6 rounded-[2rem] border border-primary/5 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-primary text-[16px]">auto_awesome</span>
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">AIRRA Strategic Insight</p>
                    </div>
                    <p className="text-[12px] text-primary/70 font-medium leading-relaxed italic">"{aiMatch.aiReasoning}"</p>
                  </div>
                )}

                <div className="flex gap-4">
                  <button onClick={() => navigate(`/messages/${quote.providerId}`)} className="flex-1 bg-white border border-gray-100 py-4.5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all">Chat</button>
                  {!rfq.acceptedQuoteId && rfq.status !== 'COMPLETED' && (
                    <button onClick={() => handleAcceptBid(quote)} className="flex-1 bg-primary text-white py-4.5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Hire Expert</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default RFQDetail;
