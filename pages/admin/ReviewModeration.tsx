
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Review } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

interface Props { user: User; }

interface EnrichedReview extends Review {
  customerName?: string;
  providerName?: string;
}

const AdminReviewModeration: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [reviews, setReviews] = useState<EnrichedReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = dataService.listenToAllReviews(async (allRevs) => {
      const users = await dataService.getUsers();
      const enriched = allRevs.map(r => {
        const customer = users.find(u => u.id === r.customerId);
        const provider = users.find(u => u.id === r.providerId);
        return {
          ...r,
          customerName: customer?.name || 'Deleted User',
          providerName: provider?.name || 'Deleted Provider'
        };
      });
      setReviews(enriched);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm("Permanently delete this review? This action cannot be reversed.")) {
      try {
        await dataService.deleteReview(id);
        showToast("Review removed from platform", "info");
      } catch (err) {
        showToast("Action failed", "error");
      }
    }
  };

  const getRelativeTime = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFBF7] pb-10">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-50 border-b border-gray-100 shadow-sm">
        <button 
          onClick={() => navigate('/')} 
          className="text-text-dark w-10 h-10 flex items-center justify-center -ml-2 rounded-full active:bg-gray-100 transition-all active:scale-90"
        >
          <span className="material-symbols-outlined text-2xl font-bold">arrow_back</span>
        </button>
        <h1 className="text-base font-bold text-text-dark text-center flex-1 tracking-tight">Review Moderation</h1>
        <div className="w-10"></div>
      </header>

      <main className="px-6 pt-6 space-y-6 flex-1 overflow-y-auto no-scrollbar pb-10">
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-white flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-50 text-[#FFD60A] rounded-2xl flex items-center justify-center">
                 <span className="material-symbols-outlined text-2xl font-bold">verified</span>
              </div>
              <div>
                 <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Global Feedback</p>
                 <p className="text-lg font-black text-text-dark">{reviews.length} Total Reviews</p>
              </div>
           </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-gray-300 font-bold uppercase text-[10px] tracking-widest animate-pulse">Syncing platform feedback...</div>
        ) : (
          <div className="space-y-4">
            {reviews.map((rev) => (
              <div key={rev.id} className="bg-white rounded-[2.5rem] p-7 shadow-card border border-white space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-start">
                   <div className="space-y-1">
                      <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-1">Customer & Provider</p>
                      <h4 className="text-[13px] font-black text-text-dark uppercase truncate">{rev.customerName} → {rev.providerName}</h4>
                      <div className="flex gap-0.5 text-[#FFD60A] pt-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <span key={s} className={`material-symbols-outlined text-[18px] fill-1 ${s > rev.rating ? 'opacity-20' : ''}`}>star</span>
                        ))}
                      </div>
                   </div>
                   <span className="text-[9px] font-bold text-gray-300 uppercase whitespace-nowrap">{getRelativeTime(rev.createdAt)}</span>
                </div>
                
                <div className="bg-gray-50/50 p-5 rounded-[1.5rem] border border-gray-100">
                   <p className="text-[12px] text-gray-500 font-medium italic leading-relaxed">"{rev.comment}"</p>
                </div>

                <div className="flex gap-3 pt-1">
                   <button 
                    onClick={() => navigate(`/rfq/${rev.rfqId}`)}
                    className="flex-1 py-3.5 bg-gray-50 text-gray-400 rounded-2xl font-black text-[9px] uppercase tracking-widest active:bg-gray-100 transition-all"
                   >
                     View Query
                   </button>
                   <button 
                    onClick={() => handleDelete(rev.id)}
                    className="flex-1 py-3.5 bg-white border border-red-100 text-red-500 rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                   >
                     <span className="material-symbols-outlined text-[14px] font-black">delete_sweep</span>
                     Delete Review
                   </button>
                </div>
              </div>
            ))}

            {reviews.length === 0 && (
              <div className="py-32 text-center opacity-30">
                 <span className="material-symbols-outlined text-6xl">chat_bubble_outline</span>
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-4">No reviews found on platform</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminReviewModeration;
