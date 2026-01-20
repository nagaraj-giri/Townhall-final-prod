import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, Review, UserRole } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

interface ProviderStorefrontProps {
  user: User; // Logged in user context
}

interface EnrichedReview extends Review {
  customerName?: string;
  customerAvatar?: string;
}

const Storefront: React.FC<ProviderStorefrontProps> = ({ user: loggedInUser }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast, toggleNotifications, unreadCount } = useApp();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviews, setReviews] = useState<EnrichedReview[]>([]);
  
  // Fixed: Initialized response to "---" to avoid mock data.
  const [stats, setStats] = useState({ rating: 'N/A', reviewCount: 0, response: '---' });

  const targetId = id || loggedInUser.id;
  const isOwnProfile = loggedInUser.id === targetId;

  useEffect(() => {
    const fetchData = async () => {
      const usr = await dataService.getUserById(targetId) as User;
      setProfileUser(usr);
      setIsLoading(false);
    };
    fetchData();
  }, [targetId]);

  useEffect(() => {
    if (!profileUser) return;

    const unsubReviews = dataService.listenToReviewsByProvider(profileUser.id, async (revs) => {
      const allUsers = await dataService.getUsers();
      const enriched: EnrichedReview[] = revs.map(r => {
        const customer = allUsers.find(u => u.id === r.customerId);
        return {
          ...r,
          customerName: customer?.name || 'Valued Customer',
          customerAvatar: customer?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(customer?.name || 'C')}&background=random`
        };
      });
      setReviews(enriched);

      if (revs.length > 0) {
        const avg = revs.reduce((acc, r) => acc + r.rating, 0) / revs.length;
        setStats(prev => ({ 
          ...prev, 
          rating: avg.toFixed(1),
          reviewCount: revs.length
        }));
      } else {
        setStats(prev => ({ 
          ...prev, 
          rating: 'N/A',
          reviewCount: 0
        }));
      }
    });

    return () => unsubReviews();
  }, [profileUser]);

  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const then = new Date(dateString);
    const diffMs = now.getTime() - then.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return then.toLocaleDateString();
  };

  if (isLoading || !profileUser) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const tagColors = [
    'bg-[#EBE7F5] text-primary border-primary/10',
    'bg-[#FFF9E5] text-[#A18100] border-[#FFE4A1]/30',
    'bg-[#F0F9EB] text-[#8BC34A] border-[#8BC34A]/10',
    'bg-pink-50 text-accent-pink border-accent-pink/10'
  ];

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-10 no-scrollbar">
      <header className="px-6 pt-12 pb-6 flex items-center justify-between shrink-0 sticky top-0 bg-white/10 backdrop-blur-md z-30">
        <button onClick={() => navigate(-1)} className="w-11 h-11 bg-white rounded-2xl shadow-sm flex items-center justify-center text-text-dark active:scale-95 transition-transform">
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <h1 className="text-[16px] font-bold text-text-dark tracking-tight">Store Profile</h1>
        <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 bg-white rounded-2xl shadow-sm flex items-center justify-center text-text-dark active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white shadow-sm"></div>}
        </button>
      </header>

      <main className="px-6 space-y-6 overflow-y-auto no-scrollbar pb-10">
        <div className="bg-white rounded-3xl p-6 shadow-soft flex items-center gap-5 relative overflow-hidden">
          <div className="relative">
            <div className="w-20 h-20 bg-[#1F4547] rounded-[1.8rem] flex items-center justify-center border border-gray-100/10 overflow-hidden shadow-lg">
               {profileUser.avatar ? (
                 <img src={profileUser.avatar} className="w-full h-full object-cover" alt="" />
               ) : (
                 <span className="material-symbols-outlined text-white text-3xl">bolt</span>
               )}
            </div>
            {!profileUser.isBlocked && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#8BC34A] rounded-full border-4 border-white shadow-sm"></div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-black text-text-dark leading-tight tracking-tight uppercase">{profileUser.name}</h2>
            <p className="text-[11px] text-gray-400 font-bold mt-1 uppercase tracking-tight">{profileUser.services?.[0] || ''}</p>
            <div className="flex items-center gap-1 mt-2">
              <span className="material-icons text-[#FFD60A] text-sm">star</span>
              <span className="text-[12px] font-black text-text-dark">{stats.rating}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-[1.8rem] p-5 shadow-soft border border-white text-center flex flex-col justify-center gap-1">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Response</p>
             <p className="text-[20px] font-black text-primary">{stats.response}</p>
          </div>
          <div className="bg-white rounded-[1.8rem] p-5 shadow-soft border border-white text-center flex flex-col justify-center gap-1">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rating</p>
             <p className="text-[20px] font-black text-[#FFD60A]">{stats.rating === 'N/A' ? '---' : `${stats.rating}/5`}</p>
          </div>
        </div>

        <section className="bg-white rounded-[2rem] p-8 shadow-soft border border-white space-y-4">
           <div className="flex justify-between items-center">
             <h3 className="text-[15px] font-black text-text-dark tracking-tight uppercase">About Us</h3>
             {isOwnProfile && (
               <button onClick={() => navigate('/profile')} className="text-primary text-[10px] font-black uppercase tracking-widest">Edit</button>
             )}
           </div>
           <p className="text-[12px] text-gray-500 font-medium leading-relaxed">
             {profileUser.description || ""}
           </p>
        </section>

        <section className="space-y-4">
           <h3 className="text-[15px] font-black text-text-dark tracking-tight uppercase ml-1">Service</h3>
           <div className="flex flex-wrap gap-2">
              {(profileUser.services || []).map((s, idx) => (
                <div key={idx} className="bg-primary/5 border border-primary/10 px-5 py-2.5 rounded-2xl text-[10px] font-black text-primary uppercase tracking-tighter shadow-sm">
                  {s}
                </div>
              ))}
           </div>
        </section>

        <section className="space-y-4">
           <h3 className="text-[15px] font-black text-text-dark tracking-tight uppercase ml-1">Category</h3>
           <div className="flex flex-wrap gap-3">
              {(profileUser.categories || []).map((cat, idx) => {
                const colorClass = tagColors[idx % tagColors.length];
                return (
                  <div key={idx} className={`${colorClass} border px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-tight shadow-sm animate-in zoom-in-95`}>
                    {cat}
                  </div>
                );
              })}
           </div>
        </section>

        <section className="space-y-4">
           <h3 className="text-[15px] font-black text-text-dark tracking-tight uppercase ml-1">Portfolio</h3>
           <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 snap-x">
              {(profileUser.gallery?.length ? profileUser.gallery.map((img, idx) => ({ title: `Project ${idx+1}`, img })) : []).map((p, idx) => (
                <div key={idx} className="relative w-44 h-56 rounded-3xl overflow-hidden shrink-0 snap-start shadow-md">
                   <img src={p.img} className="w-full h-full object-cover" alt="" />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                   <p className="absolute bottom-4 left-4 text-white text-[10px] font-black uppercase tracking-widest">{p.title}</p>
                </div>
              ))}
              {!profileUser.gallery?.length && (
                <div className="w-full py-12 text-center bg-white rounded-3xl border border-dashed border-gray-100 opacity-40">
                   <span className="material-symbols-outlined text-4xl mb-2">collections</span>
                   <p className="text-[10px] font-black uppercase tracking-widest">No showcase items yet</p>
                </div>
              )}
           </div>
        </section>

        <section className="space-y-5">
           <div className="flex justify-between items-center px-1">
             <h3 className="text-[18px] font-black text-text-dark tracking-tight uppercase">Ratings & Reviews</h3>
             <button onClick={() => showToast("Loading full history...", "info")} className="text-primary text-[12px] font-black uppercase tracking-widest">See All</button>
           </div>

           <div className="bg-white rounded-3xl p-8 shadow-soft border border-white flex flex-col items-center justify-center text-center space-y-2">
              <div className="bg-[#FFFCEF] w-20 h-20 rounded-2xl flex items-center justify-center border border-[#FFD60A]/10">
                 <span className="text-[32px] font-black text-[#FFD60A] tracking-tighter">{stats.rating === 'N/A' ? '---' : stats.rating}</span>
              </div>
              <div className="flex gap-0.5 text-[#FFD60A]">
                 {[1, 2, 3, 4, 5].map((s) => (
                   <span key={s} className={`material-icons text-[20px] ${stats.rating === 'N/A' || s > Number(stats.rating) ? 'opacity-20' : ''}`}>star</span>
                 ))}
              </div>
              <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] mt-2">BASED ON {stats.reviewCount} REVIEWS</p>
           </div>

           <div className="space-y-4">
              {reviews.length > 0 ? reviews.slice(0, 3).map((rev: any) => (
                <div key={rev.id} className="bg-white rounded-3xl p-6 shadow-card border border-white animate-in fade-in duration-500">
                   <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                         <img src={rev.customerAvatar} className="w-10 h-10 rounded-full object-cover border border-gray-50 shadow-sm" alt="" />
                         <div>
                            <h4 className="text-[14px] font-bold text-text-dark">{rev.customerName}</h4>
                            <div className="flex gap-0.5 text-[#FFD60A] mt-0.5">
                               {[1, 2, 3, 4, 5].map((s) => (
                                 <span key={s} className={`material-icons text-[14px] ${s > rev.rating ? 'opacity-20' : ''}`}>star</span>
                               ))}
                            </div>
                         </div>
                      </div>
                      <span className="text-[10px] font-bold text-gray-300 uppercase tracking-tight">{getRelativeTime(rev.createdAt)}</span>
                   </div>
                   <p className="text-[12px] text-gray-500 font-medium leading-relaxed">
                     {rev.comment}
                   </p>
                </div>
              )) : (
                <div className="py-12 text-center opacity-30">
                  <p className="text-[11px] font-bold uppercase tracking-widest">No reviews received yet</p>
                </div>
              )}
           </div>

        <div className="bg-primary rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-4 duration-700">
          <div className="flex justify-between items-start">
             <div className="flex-1 pr-4">
               <h4 className="text-xl font-black tracking-tight leading-tight uppercase">{profileUser.locationName?.split(',')[0] || "Dubai, UAE"}</h4>
               <p className="text-[12px] font-medium text-white/60 mt-1">{profileUser.locationName || "Operational Region"}</p>
             </div>
             <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-lg shrink-0">
                <span className="material-symbols-outlined text-white text-2xl font-bold">near_me</span>
             </div>
          </div>
          <div className="flex gap-3">
             <button 
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profileUser.locationName || 'Dubai')}`, '_blank')} 
              className="flex-1 bg-white text-primary py-4 rounded-2xl font-black text-[12px] shadow-lg active:scale-95 transition-all uppercase tracking-widest"
             >
               Get Directions
             </button>
             <button 
              onClick={() => profileUser.phone ? window.open(`tel:${profileUser.phone}`, '_self') : showToast("No phone number linked", "info")} 
              className="flex-1 bg-transparent text-white py-4 rounded-2xl font-black text-[12px] border border-white/30 active:scale-95 transition-all uppercase tracking-widest"
             >
               Call Now
             </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Storefront;