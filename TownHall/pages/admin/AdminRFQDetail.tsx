import React, { useState, useEffect, useMemo } from 'react';
// @ts-ignore
import { useNavigate, useParams } from 'react-router-dom';
import { User, RFQ, Quote, RFQStatus, UserRole } from '../../types';
import { dataService } from '../../services/dataService';
import { useApp } from '../../App';

interface AdminRFQDetailProps {
  user: User;
}

const AdminRFQDetail: React.FC<AdminRFQDetailProps> = ({ user }) => {
  // @ts-ignore
  const navigate = useNavigate();
  // @ts-ignore
  const { id } = useParams();
  const { showToast } = useApp();
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: 'OPEN' as RFQStatus
  });

  useEffect(() => {
    if (!id) return;
    const unsubRfq = dataService.listenToRFQById(id, (currentRfq) => {
      if (currentRfq) {
        setRfq(currentRfq);
        setEditForm({
          title: currentRfq.title,
          description: currentRfq.description,
          status: currentRfq.status
        });
      }
    });

    const unsubQuotes = dataService.listenToQuotesByRFQ(id, setQuotes);
    const unsubMatches = dataService.listenToRFQMatches(id, setMatches);
    const unsubUsers = dataService.listenToUsers(setAllUsers);

    return () => { unsubRfq(); unsubQuotes(); unsubMatches(); unsubUsers(); };
  }, [id]);

  const enrichedMatches = useMemo(() => {
    return matches.map(match => {
      const providerDoc = allUsers.find(u => u.id === match.providerId);
      const quote = quotes.find(q => q.providerId === match.providerId);
      const isAccepted = rfq?.acceptedQuoteId && quote?.id === rfq.acceptedQuoteId;
      
      const dist = match.distance || 0;
      let phaseLabel = 'PHASE 1 (3KM)';
      let phaseColor = 'bg-[#E3F2FD] text-[#007AFF] border-[#D1E9FF]';
      
      if (dist > 3 && dist <= 8) {
        phaseLabel = 'PHASE 2 (8KM)';
        phaseColor = 'bg-[#F3E5F5] text-[#5B3D9D] border-[#EBDDFF]';
      } else if (dist > 8) {
        phaseLabel = 'PHASE 3 (15KM)';
        phaseColor = 'bg-[#FFF3E0] text-[#E67E22] border-[#FFE8CC]';
      }

      return {
        ...match,
        phone: providerDoc?.phone,
        email: providerDoc?.email,
        locationName: providerDoc?.locationName,
        quote,
        hasBid: !!quote,
        isAccepted,
        phaseLabel,
        phaseColor,
        isNotified: !!match.notifiedAt,
        notifiedAt: match.notifiedAt,
        aiReasoning: match.aiReasoning,
        relevancyScore: match.relevancyScore
      };
    });
  }, [matches, quotes, rfq, allUsers]);

  const handleSaveRFQ = async () => {
    if (!rfq) return;
    const updated = { ...rfq, ...editForm };
    await dataService.saveRFQ(updated);
    
    await dataService.createAuditLog({
      admin: user,
      title: `Admin Override: Modified Query ${rfq.idDisplay}`,
      type: "CONTENT_MODERATION",
      severity: "LOW",
      icon: "edit_note",
      iconBg: "bg-primary",
      eventId: rfq.id
    });

    setIsEditing(false);
    showToast("Changes committed to database", "success");
  };

  const handleDeleteRFQ = async () => {
    if (!rfq) return;
    if (window.confirm("PERMANENTLY DELETE THIS QUERY?")) {
      await dataService.deleteRFQ(rfq.id);
      showToast("Query purged", "info");
      navigate('/queries');
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '---';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  if (!rfq) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF9F6] pb-10">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-white/20 backdrop-blur-md z-50 border-b border-gray-100/50">
        <button onClick={() => navigate(-1)} className="text-[#333333] w-12 h-12 flex items-center justify-center -ml-3 rounded-full active:bg-gray-100 transition-all">
          <span className="material-symbols-outlined font-black text-[28px]">arrow_back</span>
        </button>
        <div className="ml-2 flex-1">
          <h1 className="text-[18px] font-bold text-[#333333] tracking-tight leading-tight uppercase">Query {rfq.idDisplay}</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{rfq.status}</p>
        </div>
        <button onClick={() => setIsEditing(!isEditing)} className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all active:scale-90 ${isEditing ? 'bg-primary text-white' : 'bg-white text-primary'}`}>
          <span className="material-symbols-outlined font-black">{isEditing ? 'close' : 'edit'}</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pt-4 px-6 space-y-7 pb-20">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white space-y-6">
           <div className="flex justify-between items-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Status Control</p>
              <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${rfq.status === 'OPEN' ? 'bg-[#FFF4D8] text-[#FF9800]' : rfq.status === 'ACTIVE' ? 'bg-[#E3F2FD] text-[#2196F3]' : rfq.status === 'ACCEPTED' ? 'bg-[#E8F5E9] text-[#4CAF50]' : 'bg-gray-100 text-gray-400'}`}>
                {rfq.status}
              </div>
           </div>
           
           {isEditing ? (
             <div className="space-y-4 animate-in slide-in-from-top-2">
               <input className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold shadow-inner" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
               <select className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold shadow-inner appearance-none" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value as RFQStatus})}>
                 {['OPEN', 'ACTIVE', 'ACCEPTED', 'COMPLETED', 'CANCELED'].map(s => <option key={s} value={s}>{s}</option>)}
               </select>
               <button onClick={handleSaveRFQ} className="w-full bg-primary text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest">Commit Changes</button>
             </div>
           ) : (
             <div className="space-y-4">
                <h2 className="text-xl font-black text-text-dark leading-tight">{rfq.title}</h2>
                <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 text-[13px] text-gray-500 italic">"{rfq.description}"</div>
             </div>
           )}
        </div>

        <section className="space-y-4">
           <div className="flex justify-between items-center px-1">
              <h3 className="text-[12px] font-black text-gray-400 uppercase tracking-widest ml-1">Live Discovery Logic</h3>
              <div className="bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
                 <span className="text-[10px] font-black text-primary uppercase">{enrichedMatches.length} Matches Found</span>
              </div>
           </div>
           
           <div className="space-y-4">
              {enrichedMatches.map((m) => (
                <div key={m.providerId} className={`bg-white rounded-[2rem] p-6 shadow-card border transition-all duration-500 ${m.isAccepted ? 'border-accent-green ring-4 ring-accent-green/5' : 'border-gray-50/50'}`}>
                   <div className="flex justify-between items-start mb-4">
                      <div className="min-w-0 flex-1 pr-4">
                         <h4 className="text-[16px] font-black text-[#333333] uppercase leading-tight truncate">{m.providerName}</h4>
                         <div className={`inline-flex self-start px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border mt-2 ${m.phaseColor}`}>
                           {m.phaseLabel} • {m.distance.toFixed(1)}KM
                         </div>
                      </div>
                      <div className="text-right shrink-0">
                         {m.hasBid ? (
                           <p className="text-lg font-black text-primary leading-none">AED {m.quote?.price}</p>
                         ) : (
                           <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">No Proposal</span>
                         )}
                      </div>
                   </div>

                   {m.aiReasoning && (
                     <div className="mb-4 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                        <div className="flex items-center gap-2 mb-2">
                           <span className="material-symbols-outlined text-primary text-sm font-black">psychology</span>
                           <p className="text-[9px] font-black text-primary uppercase tracking-widest">AIRRA Analysis • {m.relevancyScore}% Score</p>
                        </div>
                        <p className="text-[11px] text-gray-600 leading-relaxed italic">"{m.aiReasoning}"</p>
                     </div>
                   )}

                   <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-50 items-center">
                      <div className="space-y-1">
                         <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Notification Engine</p>
                         <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${m.isNotified ? 'bg-accent-green animate-pulse' : 'bg-gray-200'}`}></div>
                            <span className={`text-[10px] font-bold ${m.isNotified ? 'text-accent-green' : 'text-gray-400'}`}>
                               {m.isNotified ? `Alerted ${formatDateTime(m.notifiedAt)}` : 'Waitlisting...'}
                            </span>
                         </div>
                      </div>
                      <div className="flex justify-end">
                         <button onClick={() => navigate(`/admin/user/${m.providerId}`)} className="flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-widest active:scale-95 transition-all">
                            View Record <span className="material-symbols-outlined text-base">chevron_right</span>
                         </button>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </section>

        <section className="bg-white rounded-[2.5rem] p-9 shadow-card border border-white">
           <div className="grid grid-cols-2 gap-y-10 gap-x-6">
              <div className="space-y-1.5">
                 <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Created In</p>
                 <p className="text-[13px] font-black text-text-dark tracking-tight uppercase leading-none">{formatDateTime(rfq.createdAt)}</p>
              </div>
              <div className="space-y-1.5">
                 <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Stream</p>
                 <p className="text-[13px] font-black text-text-dark tracking-tight uppercase leading-none">{rfq.category || 'GENERAL'}</p>
              </div>
           </div>
        </section>

        <button onClick={handleDeleteRFQ} className="w-full py-5 bg-white border border-red-50 text-red-500 rounded-3xl font-black text-[12px] uppercase tracking-[0.2em] shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-3">
          <span className="material-symbols-outlined text-lg">delete_sweep</span>
          Terminate Query
        </button>
      </main>
    </div>
  );
};

export default AdminRFQDetail;