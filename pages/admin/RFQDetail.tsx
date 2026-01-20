import React, { useState, useEffect } from 'react';
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
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: 'OPEN' as RFQStatus
  });

  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        const currentRfq = await dataService.getRFQById(id);
        if (currentRfq) {
          setRfq(currentRfq);
          setEditForm({
            title: currentRfq.title,
            description: currentRfq.description,
            status: currentRfq.status
          });
          const rfqQuotes = await dataService.getQuotesByRFQ(id);
          setQuotes(rfqQuotes);
        }
      }
    };
    fetchData();
  }, [id]);

  const handleSaveRFQ = async () => {
    if (!rfq) return;
    const updated = { ...rfq, ...editForm };
    await dataService.saveRFQ(updated);
    setRfq(updated);
    setIsEditing(false);
    showToast("Query updated successfully", "success");
  };

  const handleDeleteRFQ = async () => {
    if (!rfq) return;
    if (window.confirm("Delete this query? This action cannot be undone.")) {
      await dataService.deleteRFQ(rfq.id);
      showToast("Query deleted", "info");
      navigate('/queries');
    }
  };

  if (!rfq) return <div className="p-10 text-center font-bold text-gray-300">Loading Query...</div>;

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      timeZone: 'Asia/Dubai',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const then = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return 'Just now';
    return `${diffInHours} hours ago`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-10">
      <header className="px-6 pt-12 pb-4 flex items-center bg-white shrink-0 sticky top-0 z-50 border-b border-gray-100 shadow-sm">
        <button onClick={() => navigate(-1)} className="text-[#333333] w-12 h-12 flex items-center justify-center -ml-3 rounded-full active:bg-gray-100 transition-colors">
          <span className="material-symbols-outlined font-black text-[24px]">arrow_back</span>
        </button>
        <div className="ml-2 flex-1">
          <h1 className="text-[17px] font-bold text-[#333333] leading-tight">Query {rfq.idDisplay}</h1>
          <p className="text-[11px] text-[#A0A0A0] font-medium">Created {getRelativeTime(rfq.createdAt)}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsEditing(!isEditing)} className="text-primary w-11 h-11 flex items-center justify-center bg-primary/5 rounded-2xl active:scale-90 transition-transform">
            <span className="material-symbols-outlined font-black text-[22px]">{isEditing ? 'close' : 'edit'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pt-6 px-6 space-y-6">
        {/* Status Area */}
        <div className="space-y-4">
          <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
               <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] ml-1">Current Status</p>
               <span className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  rfq.status === 'OPEN' ? 'bg-orange-50 text-orange-500' :
                  rfq.status === 'ACTIVE' ? 'bg-blue-50 text-blue-500' :
                  rfq.status === 'ACCEPTED' ? 'bg-primary/5 text-primary' :
                  rfq.status === 'COMPLETED' ? 'bg-green-50 text-green-600' :
                  'bg-red-50 text-red-400'
               }`}>{rfq.status}</span>
            </div>
            
            {isEditing ? (
              <div className="relative">
                <select 
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-text-dark focus:ring-1 focus:ring-primary shadow-inner appearance-none transition-all"
                  value={editForm.status}
                  onChange={e => setEditForm({...editForm, status: e.target.value as RFQStatus})}
                >
                  {['OPEN', 'ACTIVE', 'ACCEPTED', 'COMPLETED', 'CANCELED'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span className="absolute right-5 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">unfold_more</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[#A0A0A0] ml-1">
                 <span className="material-symbols-outlined text-[18px] font-bold">info</span>
                 <span className="text-[11px] font-bold">Status managed by platform core and admin overrides.</span>
              </div>
            )}
          </div>
        </div>

        {/* Requester Info Card */}
        <div className="bg-white rounded-[2.2rem] p-6 shadow-card border border-gray-100/50 space-y-5">
           <p className="text-[11px] font-bold text-gray-300 uppercase tracking-widest ml-1">Requester Info</p>
           <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/admin/user/${rfq.customerId}`)}>
              <div className="relative">
                <img src={rfq.customerAvatar} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm" alt="" />
                <div className="absolute -bottom-1 -right-1 bg-[#8BC34A] w-6 h-6 rounded-full border-4 border-white flex items-center justify-center">
                   <span className="material-symbols-outlined text-white text-[12px] font-black">check</span>
                </div>
              </div>
              <div>
                <h2 className="text-base font-bold text-[#333333]">{rfq.customerName || 'Customer'}</h2>
                <div className="flex items-center gap-1 text-[#A0A0A0]">
                   <span className="material-symbols-outlined text-[16px] font-bold">location_on</span>
                   <span className="text-[11px] font-medium">{rfq.locationName.split(',')[0]}</span>
                </div>
              </div>
           </div>
           
           {/* Visual Fix for action buttons in Requester Info */}
           <div className="flex gap-3 pt-2">
              <button className="flex-1 bg-[#F2F0F9] py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-primary text-[11px] uppercase tracking-widest active:scale-[0.98] transition-transform">
                 <span className="material-symbols-outlined text-[18px]">call</span> Call
              </button>
              <button className="flex-1 bg-[#F2F0F9] py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-primary text-[11px] uppercase tracking-widest active:scale-[0.98] transition-transform">
                 <span className="material-symbols-outlined text-[18px]">mail</span> Email
              </button>
           </div>
        </div>

        {/* RFQ Details */}
        <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-card border border-gray-100/50">
           <div className="p-8 space-y-3">
              <h4 className="text-[13px] font-bold text-[#333333] uppercase tracking-wider">Title & Description</h4>
              {isEditing ? (
                <div className="space-y-4">
                  <input 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-text-dark focus:ring-1 focus:ring-primary outline-none"
                    value={editForm.title}
                    onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                  />
                  <textarea 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium focus:ring-1 focus:ring-primary outline-none min-h-[120px] resize-none"
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  />
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-text-dark">{rfq.title}</h2>
                  <p className="text-[13px] text-gray-500 font-medium leading-relaxed italic">
                    "{rfq.description}"
                  </p>
                </>
              )}
           </div>
        </div>

        {/* Metadata grid */}
        <div className="bg-white rounded-[2rem] p-8 shadow-card border border-gray-100/50">
          <div className="grid grid-cols-2 gap-y-8 gap-x-4">
            <div>
              <p className="text-[10px] text-[#A0A0A0] font-bold uppercase tracking-wider mb-1.5">Created At</p>
              <p className="text-[13px] font-black text-[#333333]">{formatDateTime(rfq.createdAt)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#A0A0A0] font-bold uppercase tracking-wider mb-1.5">Category</p>
              <p className="text-[13px] font-black text-[#333333] uppercase">{rfq.category}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#A0A0A0] font-bold uppercase tracking-wider mb-1.5">Quotes Received</p>
              <p className="text-[13px] font-black text-[#333333]">{rfq.quotesCount}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#A0A0A0] font-bold uppercase tracking-wider mb-1.5">Search Radius</p>
              <p className="text-[13px] font-black text-[#333333]">{rfq.searchRadius} KM</p>
            </div>
          </div>
        </div>

        {/* Quotes Section */}
        <div className="space-y-4 pt-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-[18px] font-bold text-[#333333]">Proposals</h3>
            <div className="bg-secondary px-3 py-1 rounded-lg">
              <span className="text-[11px] font-black text-[#333333] uppercase">{quotes.length} Total</span>
            </div>
          </div>

          <div className="space-y-4 pb-12">
            {quotes.map((quote) => {
              const isSelected = rfq.acceptedQuoteId === quote.id;
              return (
                <div key={quote.id} className={`bg-white rounded-[2rem] p-6 shadow-card border flex items-center justify-between transition-all ${isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-gray-100/30'}`}>
                  <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/admin/user/${quote.providerId}`)}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-gray-50 overflow-hidden shadow-sm">
                      <img src={quote.providerAvatar} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-[#333333] leading-none mb-1.5">{quote.providerName}</h4>
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-secondary text-[16px] fill-1">star</span>
                        <p className="text-[12px] font-medium text-gray-400">
                          {quote.providerRating || 4.8}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[17px] font-black mb-1.5 tracking-tight text-primary">
                      {quote.price} AED
                    </p>
                    <div className="flex justify-end">
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${isSelected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                        {isSelected ? 'SELECTED' : quote.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isEditing && (
          <button onClick={handleSaveRFQ} className="w-full py-5 bg-primary text-white rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-btn-glow active:scale-95 transition-all mb-4">
            CONFIRM UPDATES
          </button>
        )}

        <button onClick={handleDeleteRFQ} className="w-full py-5 bg-white border border-red-50 text-red-500 rounded-3xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 active:scale-95 transition-all">
           <span className="material-symbols-outlined text-lg font-black">delete_sweep</span> DELETE ENTIRE QUERY
        </button>
      </main>
    </div>
  );
};

export default AdminRFQDetail;