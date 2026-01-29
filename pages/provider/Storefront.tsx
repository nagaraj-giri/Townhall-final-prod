import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, Review, UserRole } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

interface ProviderStorefrontProps {
  user: User; 
}

interface EnrichedReview extends Review {
  customerName?: string;
  customerAvatar?: string;
}

const CATEGORY_STYLE_MAP: Record<string, { icon: string; color: string; bg: string }> = {
  'visa': { icon: 'shopping_bag', color: '#FFD60A', bg: 'bg-yellow-50' },
  'travel': { icon: 'flight_takeoff', color: '#FF69B4', bg: 'bg-pink-50' },
  'office': { icon: 'home_work', color: '#8BC34A', bg: 'bg-green-50' },
  'legal': { icon: 'gavel', color: '#5B3D9D', bg: 'bg-purple-50' },
  'translation': { icon: 'translate', color: '#5B3D9D', bg: 'bg-blue-50' },
  'setup': { icon: 'apartment', color: '#FF69B4', bg: 'bg-pink-50' },
  'default': { icon: 'verified', color: '#5B3D9D', bg: 'bg-indigo-50' }
};

const Storefront: React.FC<ProviderStorefrontProps> = ({ user: loggedInUser }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast, toggleNotifications, unreadCount, chatUnreadCount } = useApp();
  
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviews, setReviews] = useState<EnrichedReview[]>([]);

  const targetId = id || loggedInUser.id;
  const isOwnProfile = loggedInUser.id === targetId;

  useEffect(() => {
    if (!targetId) return;
    const unsub = dataService.listenToUserById(targetId, (usr) => {
      if (usr) {
        setProfileUser(usr as User);
        if (!isOwnProfile && loggedInUser.role === UserRole.CUSTOMER) {
          dataService.logStorefrontView(targetId, loggedInUser.id);
        }
      }
      setIsLoading(false);
    });
    return () => unsub();
  }, [targetId, isOwnProfile, loggedInUser.id, loggedInUser.role]);

  useEffect(() => {
    if (!profileUser) return;
    const unsubReviews = dataService.listenToReviewsByProvider(profileUser.id, async (revs) => {
      const allUsers = await dataService.getUsers();
      const enriched: EnrichedReview[] = revs.map(r => {
        const customer = allUsers.find(u => u.id === r.customerId);
        return {
          ...r,
          customerName: customer?.name || 'Customer',
          customerAvatar: customer?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(customer?.name || 'C')}&background=random`
        };
      });
      setReviews(enriched);
    });
    return () => unsubReviews();
  }, [profileUser?.id]);

  const stats = useMemo(() => {
    if (reviews.length === 0) return { rating: '---', count: 0, isNew: true };
    const avg = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
    return { rating: avg.toFixed(1), count: reviews.length, isNew: false };
  }, [reviews]);

  const getCategoryMeta = (name: string) => {
    const key = Object.keys(CATEGORY_STYLE_MAP).find(k => name.toLowerCase().includes(k)) || 'default';
    return CATEGORY_STYLE_MAP[key];
  };

  const handleCall = () => {
    if (profileUser?.phone) {
      window.location.href = `tel:${profileUser.phone.replace(/\s+/g, '')}`;
    } else {
      showToast("Phone contact restricted", "error");
    }
  };

  const handleDirections = () => {
    const loc = profileUser?.locationName || 'Dubai, UAE';
    window.open(`https://www.google.com/maps?q=${encodeURIComponent(loc)}`, '_blank');
  };

  if (isLoading || !profileUser) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-32">
      {/* Header */}
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 z-40 bg-white/10 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-text-dark active:scale-90 transition-transform">
          <span className="material-symbols-outlined font-black">arrow_back</span>
        </button>
        <h1 className="text-[16px] font-[900] text-text-dark tracking-tight uppercase">Store Profile</h1>
        <button onClick={() => toggleNotifications(true)} className="relative w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-text-dark active:scale-90 transition-transform">
          <span className="material-symbols-outlined">notifications</span>
          {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border border-white"></div>}
        </button>
      </header>

      <main className="px-6 space-y-6 overflow-y-auto no-scrollbar pt-2">
        {/* Profile Card */}
        <div className="bg-white rounded-[2.5rem] p-7 shadow-soft flex items-center gap-5 border border-border-light/40">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-[1.8rem] overflow-hidden bg-[#0A3D30] flex items-center justify-center border border-border-light shadow-inner">
              <img 
                src={profileUser.avatar} 
                className="w-full h-full object-cover" 
                alt={profileUser.name} 
                onError={(e) => (e.currentTarget.src = 'https://i.postimg.cc/mD8z7DqZ/townhall-logo.png')}
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-accent-green rounded-full border-4 border-white shadow-sm flex items-center justify-center">
               <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-[900] text-text-dark leading-tight tracking-tight uppercase">{profileUser.name}</h2>
            <p className="text-[11px] text-text-light font-bold mt-0.5 tracking-tight uppercase opacity-60">
              {profileUser.services?.[0] || 'Verified Specialist'}
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-secondary">
              <span className="material-symbols-outlined text-[16px] fill-1">star</span>
              <span className="text-[14px] font-black text-text-dark">{stats.rating}</span>
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 gap-4">
           <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-border-light/40 text-center">
              <p className="text-[11px] font-bold text-text-light uppercase tracking-widest mb-1.5">Response</p>
              <p className="text-[22px] font-black text-primary">{stats.isNew ? '---' : '1h'}</p>
           </div>
           <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-border-light/40 text-center">
              <p className="text-[11px] font-bold text-text-light uppercase tracking-widest mb-1.5">Rating</p>
              <p className="text-[22px] font-black text-secondary">{stats.rating}{!stats.isNew && '/5'}</p>
           </div>
        </div>

        {/* About Us */}
        <section className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-border-light/40 space-y-3 relative">
           <div className="flex justify-between items-center">
              <h3 className="text-[16px] font-[900] text-text-dark tracking-tight uppercase">About Us</h3>
              {isOwnProfile && (
                <button onClick={() => navigate('/profile')} className="text-[11px] font-black text-primary uppercase tracking-widest">Edit</button>
              )}
           </div>
           <p className="text-[13px] text-text-light font-medium leading-relaxed">
             {profileUser.description || "We specialize in premium corporate services, legal consultants, and business setup arrangements in the UAE. Our team ensures fast processing for all your marketplace requirements."}
           </p>
        </section>

        {/* Portfolio - High Fidelity Redesign */}
        <section className="space-y-4">
           <h3 className="text-[16px] font-[900] text-text-dark tracking-tight ml-1 uppercase">Portfolio</h3>
           <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x pb-4">
              {profileUser.gallery && profileUser.gallery.length > 0 ? (
                profileUser.gallery.map((url: string, idx: number) => (
                  <div key={idx} className="relative w-[180px] h-[240px] rounded-[2.8rem] overflow-hidden shrink-0 snap-start shadow-xl border-4 border-white group">
                    <img src={url} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt="" />
                    <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-black/95 via-black/40 to-transparent"></div>
                    <div className="absolute bottom-5 left-0 right-0 px-4 text-center">
                      <p className="text-white text-[10px] font-[900] uppercase tracking-[0.15em] leading-tight">Business Gallery</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="w-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-[3rem] bg-white/40">
                   <span className="material-symbols-outlined text-4xl text-gray-200 mb-2">collections</span>
                   <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">No showcase images</p>
                </div>
              )}
           </div>
        </section>

        {/* Services & Categories Grid */}
        <div className="grid grid-cols-1 gap-6">
          <section className="space-y-4">
             <h3 className="text-[16px] font-[900] text-text-dark tracking-tight ml-1 uppercase">Service Streams</h3>
             <div className="flex flex-wrap gap-2.5">
                {(profileUser.services && profileUser.services.length > 0 ? profileUser.services : ['Specialist']).map(s => (
                  <span key={s} className="bg-[#EEEBF5] text-[#5B3D9D] text-[11px] font-black px-6 py-3 rounded-2xl uppercase tracking-tight shadow-sm">{s}</span>
                ))}
             </div>
          </section>

          <section className="space-y-4">
             <h3 className="text-[16px] font-[900] text-text-dark tracking-tight ml-1 uppercase">Expertise Tags</h3>
             <div className="flex flex-wrap gap-3">
                {(profileUser.categories && profileUser.categories.length > 0 ? profileUser.categories : ['Verified']).map(cat => {
                  const meta = getCategoryMeta(cat);
                  return (
                    <div key={cat} className="flex items-center gap-3 bg-white px-6 py-4 rounded-[1.8rem] shadow-card border border-border-light/40">
                       <span className="material-symbols-outlined text-[22px]" style={{ color: meta.color }}>{meta.icon}</span>
                       <p className="text-[13px] font-black text-text-dark uppercase tracking-tight">{cat}</p>
                    </div>
                  );
                })}
             </div>
          </section>
        </div>

        {/* Ratings & Reviews Section */}
        <section className="space-y-5">
           <div className="flex justify-between items-center px-1">
              <h3 className="text-[16px] font-[900] text-text-dark uppercase">Verified Feedback</h3>
              <button className="text-[11px] font-black text-primary uppercase tracking-widest">View All</button>
           </div>
           
           <div className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-border-light/40 flex items-center gap-6">
              <div className="bg-[#FFFCEE] px-6 py-3 rounded-[1.8rem] flex items-center justify-center shadow-inner min-w-[80px]">
                 <p className="text-[28px] font-black text-secondary">{stats.rating}</p>
              </div>
              <div className="flex-1 space-y-1">
                 <div className="flex gap-0.5 text-secondary">
                    {[1,2,3,4,5].map(s => <span key={s} className={`material-symbols-outlined text-[18px] ${(!stats.isNew && s <= parseFloat(stats.rating)) ? 'fill-1' : 'opacity-20'}`}>star</span>)}
                 </div>
                 <p className="text-[10px] font-black text-text-light uppercase tracking-widest mt-1">
                   {stats.isNew ? 'New Specialist' : `Based on ${stats.count} Feedback`}
                 </p>
              </div>
           </div>

           <div className="space-y-4">
              {reviews.length > 0 ? reviews.slice(0, 2).map((rev) => (
                <div key={rev.id} className="bg-white rounded-[2.5rem] p-8 shadow-card border border-border-light/40 space-y-4">
                   <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                         <img src={rev.customerAvatar} className="w-12 h-12 rounded-full object-cover border shadow-sm" alt="" />
                         <div className="space-y-0.5">
                            <h4 className="text-[14px] font-black text-text-dark uppercase">{rev.customerName}</h4>
                            <div className="flex gap-0.5 text-secondary">
                               {[1,2,3,4,5].map(s => <span key={s} className={`material-symbols-outlined text-[10px] ${s > rev.rating ? 'opacity-20' : 'fill-1'}`}>star</span>)}
                            </div>
                         </div>
                      </div>
                      <span className="text-[10px] font-bold text-text-light uppercase whitespace-nowrap">
                        {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recently'}
                      </span>
                   </div>
                   <p className="text-[13px] text-text-light font-medium leading-relaxed italic border-l-4 border-primary/10 pl-5">"{rev.comment}"</p>
                </div>
              )) : (
                <div className="py-12 text-center bg-white rounded-[2.5rem] border border-border-light/20">
                   <p className="text-[10px] font-black text-text-light uppercase tracking-widest">Waiting for first review</p>
                </div>
              )}
           </div>
        </section>

        {/* Branded Location Footer */}
        <section className="pb-12">
           <div className="bg-[#5B3D9D] rounded-[2.8rem] p-9 shadow-xl relative overflow-hidden group">
              <div className="absolute top-8 right-8 w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10 group-hover:scale-110 transition-transform">
                 <span className="material-symbols-outlined text-white text-[28px]">explore</span>
              </div>
              
              <div className="space-y-2 relative z-10">
                 <h3 className="text-2xl font-black text-white tracking-tight uppercase">{profileUser.locationName?.split(',')[0] || 'DUBAI'}</h3>
                 <p className="text-[13px] text-white/70 font-medium max-w-[220px] leading-relaxed">
                   {profileUser.locationName || 'United Arab Emirates'}
                 </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-12 relative z-10">
                 <button 
                  onClick={handleDirections}
                  className="bg-white text-[#5B3D9D] py-5 rounded-[1.4rem] font-black text-[12px] uppercase tracking-widest active:scale-[0.98] transition-all shadow-lg"
                 >
                   Get Directions
                 </button>
                 <button 
                  onClick={handleCall}
                  className="bg-white/10 text-white border-2 border-white/20 py-5 rounded-[1.4rem] font-black text-[12px] uppercase tracking-widest backdrop-blur-md active:scale-[0.98] transition-all"
                 >
                   Call Now
                 </button>
              </div>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
           </div>
        </section>
      </main>

      {loggedInUser.role === UserRole.CUSTOMER && (
        <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-border-light pb-10 pt-3 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.04)]">
          <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60">
            <span className="material-symbols-outlined text-[26px]">home</span>
            <span className="text-[9px] font-bold uppercase tracking-widest">HOME</span>
          </button>
          <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60">
            <span className="material-symbols-outlined text-[26px]">format_list_bulleted</span>
            <span className="text-[9px] font-bold uppercase tracking-widest">QUERIES</span>
          </button>
          <button onClick={() => navigate('/messages')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light relative opacity-60">
            <span className="material-symbols-outlined text-[26px]">chat_bubble</span>
            {chatUnreadCount > 0 && <div className="absolute top-0 right-3 w-4 h-4 bg-accent-pink rounded-full border-2 border-white text-[8px] font-normal text-white flex items-center justify-center">{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</div>}
            <span className="text-[9px] font-bold uppercase tracking-widest">CHAT</span>
          </button>
          <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60">
            <span className="material-symbols-outlined text-[26px]">person</span>
            <span className="text-[9px] font-bold uppercase tracking-widest">PROFILE</span>
          </button>
        </nav>
      )}
    </div>
  );
};

export default Storefront;