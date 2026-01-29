import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, RFQ, Quote, RFQStatus, UserRole } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

interface AdminRFQDetailProps {
  user: User;
}

const AdminRFQDetail: React.FC<AdminRFQDetailProps> = ({ user }) => {
  const navigate = useNavigate();
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

  // DERIVED STATE: Enriched matched providers with contact info, bid and acceptance data
  const enrichedMatches = useMemo(() => {
    return matches.map(match => {
      const providerDoc = allUsers.find(u => u.id === match.providerId);
      const quote = quotes.find(q => q.providerId === match.providerId);
      const isAccepted = rfq?.acceptedQuoteId && quote?.id === rfq.acceptedQuoteId;
      
      // Determine distance-based phase label
      const dist = match.distance || 0;
      let phaseLabel = 'PHASE 1 (3KM)';
      let phaseColor = 'bg-[#E3F2FD] text-[#007AFF] border-[#D1E9FF]'; // Blue
      
      if (dist > 3 && dist <= 8) {
        phaseLabel = 'PHASE 2 (8KM)';
        phaseColor = 'bg-[#F3E5F5] text-[#5B3D9D] border-[#EBDDFF]'; // Purple
      } else if (dist > 8) {
        phaseLabel = 'PHASE 3 (15KM)';
        phaseColor = 'bg-[#FFF3E0] text-[#E67E22] border-[#FFE8CC]'; // Orange
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
        phaseColor
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
    if (window.confirm("PERMANENTLY DELETE THIS QUERY? This will remove all associated matches and bids.")) {
      await dataService.deleteRFQ(rfq.id);
      
      await dataService.createAuditLog({
        admin: user,
        title: `CRITICAL: Deleted Query ${rfq.idDisplay}`,
        type: "CONTENT_DELETION",
        severity: "HIGH",
        icon: "delete_sweep",
        iconBg: "bg-red-500",
        eventId: rfq.id
      });

      showToast("Query and associated data purged", "info");
      navigate('/queries');
    }
  };

  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const then = new Date(dateString);
    const diffInMs = now.getTime() - then.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    return `${Math.floor(diffInMins / 60)}h ago`;
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '---';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (!rfq) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Querying Engine...</p>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-10">
      <header className="px-6 pt-12 pb-4 flex items-center bg-transparent sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="text-[#333333] w-12 h-12 flex items-center justify-center -ml-3 rounded-full active:bg-gray-100 transition-colors">
          <span className="material-symbols-outlined font-black text-[28px]">arrow_back</span>
        </button>
        <div className="ml-2 flex-1">
          <h1 className="text-[18px] font-bold text-[#333333] tracking-tight leading-tight uppercase">Query {rfq.idDisplay}</h1>
          <p className="text-[12px] text-gray-400 font-medium tracking-tight">Created {getRelativeTime(rfq.createdAt)}</p>
        </div>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all active:scale-90 ${isEditing ? 'bg-primary text-white' : 'bg-white text-primary'}`}
        >
          <span className="material-symbols-outlined font-black">{isEditing ? 'close' : 'edit'}</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pt-4 px-6 space-y-7 pb-20">
        <div className="bg-white rounded-[2rem] p-7 shadow-card border border-white space-y-4">
           <div className="flex justify-between items-center">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">CURRENT STATUS</p>
              <div className={`px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest ${
                rfq.status === 'OPEN' ? 'bg-[#FFF4D8] text-[#FF9800]' :
                rfq.status === 'ACTIVE' ? 'bg-[#E3F2FD] text-[#2196F3]' :
                rfq.status === 'ACCEPTED' ? 'bg-[#E8F5E9] text-[#4CAF50]' :
                'bg-gray-100 text-gray-400'
              }`}>
                {rfq.status}
              </div>
           </div>
           
           {isEditing ? (
             <div className="relative">
               <select 
                 className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-text-dark focus:ring-1 focus:ring-primary shadow-inner appearance-none transition-all"
                 value={editForm.status}
                 onChange={e => setEditForm({...editForm, status: e.target.value as RFQStatus})}
               >
                 {['OPEN', 'ACTIVE', 'ACCEPTED', 'COMPLETED', 'CANCELED'].map(s => (
                   <option key={s} value={s}>{s}</option>
                 ))}
               </select>
               <span className="absolute right-5 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none font-black">unfold_more</span>
             </div>
           ) : (
             <div className="flex items-start gap-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100/50">
                <span className="material-symbols-outlined text-gray-300 text-[20px] font-bold mt-0.5">info</span>
                <p className="text-[12px] text-gray-400 font-medium leading-relaxed">
                   Status managed by platform core and admin overrides.
                </p>
             </div>
           )}
        </div>

        <section className="space-y-3">
           <h3 className="text-[12px] font-black text-gray-400 uppercase tracking-widest ml-1 opacity-80">REQUESTER INFO</h3>
           <div className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white space-y-6">
              <div className="flex items-center gap-5">
                 <div className="relative shrink-0">
                    <img src={rfq.customerAvatar} className="w-16 h-16 rounded-[1.4rem] object-cover border-2 border-white shadow-sm ring-1 ring-gray-100" alt="" />
                    <div className="absolute -bottom-1 -right-1 bg-accent-green w-6 h-6 rounded-full border-4 border-white flex items-center justify-center shadow-md">
                       <span className="material-symbols-outlined text-white text-[12px] font-black">check</span>
                    </div>
                 </div>
                 <div className="flex-1 min-w-0">
                    <h2 className="text-[18px] font-black text-[#333333] leading-none uppercase truncate">{rfq.customerName || 'Requester'}</h2>
                    <div className="flex items-start gap-1.5 mt-2">
                       <span className="material-symbols-outlined text-accent-pink text-[18px] font-black shrink-0">location_on</span>
                       <p className="text-[12px] text-gray-400 font-medium leading-snug">{rfq.locationName || 'Dubai, UAE'}</p>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* REFINED MATCHED PROVIDERS: High-Fidelity Funnel View */}
        <section className="space-y-4">
           <div className="flex justify-between items-center px-1">
              <h3 className="text-[12px] font-[900] text-[#9EA4AE] uppercase tracking-[0.2em] ml-1">MATCHED PROVIDERS</h3>
              <div className="bg-[#EBE7F5] px-3 py-1 rounded-full border border-[#5B3D9D]/10">
                 <span className="text-[10px] font-black text-primary uppercase">{enrichedMatches.length} TOTAL</span>
              </div>
           </div>
           
           <div className="p-2 border-2 border-dashed border-blue-400 rounded-[2.5rem] space-y-4">
              {enrichedMatches.length > 0 ? enrichedMatches.map((m) => (
                <div 
                  key={m.providerId} 
                  className={`bg-white rounded-[2rem] p-6 shadow-card border transition-all duration-500 space-y-5 ${
                    m.isAccepted ? 'border-accent-green ring-4 ring-accent-green/5' : 'border-gray-50/50'
                  }`}
                >
                   <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                         <h4 className="text-[17px] font-black text-[#333333] uppercase leading-tight truncate">{m.providerName}</h4>
                         <div className={`inline-flex self-start px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border ${m.phaseColor}`}>
                           RADIUS: {m.phaseLabel}
                         </div>
                      </div>
                      {m.hasBid && (
                        <div className="text-right ml-4 shrink-0">
                           <p className="text-lg font-black text-primary leading-none">AED {m.quote?.price}</p>
                           <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-1">PROPOSED</p>
                        </div>
                      )}
                   </div>
                   
                   <div className="space-y-3 pt-1">
                      <div className="flex items-center gap-2 text-gray-400">
                         <span className="material-symbols-outlined text-[20px] font-black opacity-60">location_on</span>
                         <p className="text-[13px] font-bold text-text-light truncate">{(m.locationName || 'Dubai Region').split(',')[0]}</p>
                      </div>
                      
                      <div className="flex gap-6">
                         <div className="flex items-center gap-2 text-primary">
                            <span className="material-symbols-outlined text-[20px] font-black">call</span>
                            <p className="text-[12px] font-[700] tracking-tight">{m.phone || '+971 50 000 0000'}</p>
                         </div>
                         <div className="flex items-center gap-2 text-primary min-w-0 flex-1">
                            <span className="material-symbols-outlined text-[20px] font-black shrink-0">mail</span>
                            <p className="text-[12px] font-[700] truncate lowercase">{m.email || 'office@provider.ae'}</p>
                         </div>
                      </div>
                   </div>
                   
                   <div className="flex gap-4 pt-4 border-t border-gray-50 items-center justify-between">
                      <div className="flex gap-3">
                        <div className="flex items-center gap-1.5 text-gray-400">
                           <span className="material-symbols-outlined text-[18px] font-black">sensors</span>
                           <p className="text-[10px] font-black uppercase tracking-[0.1em]">Hitted</p>
                        </div>
                        {m.hasBid && (
                           <div className={`flex items-center gap-1.5 ${m.isAccepted ? 'text-accent-green' : 'text-[#9C27B0]'}`}>
                              <span className="material-symbols-outlined text-[18px] font-black animate-in zoom-in">{m.isAccepted ? 'verified' : 'payments'}</span>
                              <p className="text-[10px] font-black uppercase tracking-[0.1em]">{m.isAccepted ? 'Bid Accepted' : 'Bid Submitted'}</p>
                           </div>
                        )}
                      </div>
                      <button onClick={() => navigate(`/admin/user/${m.providerId}`)} className="flex items-center gap-1 text-gray-300 hover:text-primary transition-all active:scale-95">
                         <span className="text-[10px] font-black uppercase tracking-[0.1em]">View Record</span>
                         <span className="material-symbols-outlined text-[20px] font-black">chevron_right</span>
                      </button>
                   </div>
                </div>
              )) : (
                <div className="py-20 text-center bg-white/50 rounded-[2.5rem] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center gap-4 mx-2">
                   <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
                      <span className="material-symbols-outlined text-4xl font-light">search_off</span>
                   </div>
                   <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Discovery phase in progress...</p>
                </div>
              )}
           </div>
        </section>

        <section className="bg-white rounded-[2.5rem] p-9 shadow-card border border-white">
           <div className="grid grid-cols-2 gap-y-10 gap-x-6">
              <div className="space-y-1.5">
                 <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">CREATED AT</p>
                 <p className="text-[13px] font-black text-text-dark tracking-tight uppercase leading-none">{formatDateTime(rfq.createdAt)}</p>
              </div>
              <div className="space-y-1.5">
                 <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">CATEGORY</p>
                 <p className="text-[13px] font-black text-text-dark tracking-tight uppercase leading-none">{rfq.category || 'GENERAL'}</p>
              </div>
              <div className="space-y-1.5">
                 <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">QUOTES RECEIVED</p>
                 <p className="text-[15px] font-black text-text-dark tracking-tight leading-none">{rfq.quotesCount}</p>
              </div>
              <div className="space-y-1.5">
                 <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">PHASE SETTING</p>
                 <p className="text-[13px] font-black text-text-dark tracking-tight uppercase leading-none">Phase {rfq.searchRadius === 3 ? '1' : rfq.searchRadius === 8 ? '2' : '3'} ({rfq.searchRadius} KM)</p>
              </div>
           </div>
        </section>

        <div className="pt-6">
           <button 
            onClick={handleDeleteRFQ}
            className="w-full py-5 bg-white border-2 border-white rounded-[1.8rem] shadow-card flex items-center justify-center gap-3 active:scale-[0.98] transition-all group"
           >
              <span className="material-symbols-outlined text-red-500 font-black group-active:scale-110">delete</span>
              <span className="text-[13px] font-black text-red-500 uppercase tracking-[0.2em]">DELETE ENTIRE QUERY</span>
           </button>
        </div>
      </main>
    </div>
  );
};

export default AdminRFQDetail;