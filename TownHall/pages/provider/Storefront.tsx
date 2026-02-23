import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, Review, UserRole } from '../../types';
import { dataService } from '../../services/dataService';
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
  const { showToast, toggleNotifications, unreadCount } = useApp();
  
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviews, setReviews] = useState<EnrichedReview[]>([]);
  const [completedCount, setCompletedCount] = useState(0);

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

    // Fetch projects count for "Completed" metric per PRD 4.4
    dataService.getQuotes().then(allQuotes => {
       const wins = allQuotes.filter(q => q.providerId === targetId && q.status === 'ACCEPTED').length;
       setCompletedCount(wins);
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
    const hasReviews = reviews.length > 0;
    const avg = hasReviews ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : "5.0";
    
    return { 
       rating: avg, 
       count: reviews.length, 
       isNew: !hasReviews,
       responseTime: "20m" // Median response time placeholder per PRD 4.4
    };
  }, [reviews]);

  const isDescriptionUpdated = useMemo(() => {
    if (!profileUser?.description) return false;
    const desc = profileUser.description;
    const isSystemDefault = desc.startsWith("Business application from");
    return !isSystemDefault;
  }, [profileUser?.description]);

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

  if (isLoading || !profileUser) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF9F6] pb-32">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 z-40 bg-white/10 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-text-dark active:scale-90 transition-transform">
          <span className="material-symbols-outlined font-black">arrow_back</span>
        </button>
        <h1 className="text-[14px] font-[900] text-text-dark tracking-widest uppercase opacity-60">Verified Store</h1>
        <button onClick={() => toggleNotifications(true)} className="relative w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-text-dark active:scale-90 transition-transform">
          <span className="material-symbols-outlined">notifications</span>
          {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border border-white"></div>}
        </button>
      </header>

      <main className="px-6 space-y-6 overflow-y-auto no-scrollbar pt-2">
        <div className="bg-white rounded-[2.5rem] p-7 shadow-soft flex items-center gap-5 border border-white">
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-[2rem] overflow-hidden bg-primary/5 flex items-center justify-center border border-gray-100 shadow-inner p-1">
              <img 
                src={profileUser.avatar} 
                className="w-full h-full object-cover rounded-[1.8rem]" 
                alt={profileUser.name} 
                onError={(e) => (e.currentTarget.src = 'https://i.postimg.cc/mD8z7DqZ/townhall-logo.png')}
              />
            </div>
            {profileUser.isVerified && (
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-accent-green rounded-full border-4 border-white shadow-sm flex items-center justify-center">
                 <span className="material-symbols-outlined text-white text-[14px] font-black">check</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] font-black text-text-dark leading-tight tracking-tight uppercase">{profileUser.name}</h2>
            <div className="flex items-center gap-2 mt-1">
               <span className="bg-indigo-50 text-primary text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest">LICENSED PRO</span>
               <div className="flex items-center gap-1 text-secondary">
                  <span className="material-symbols-outlined text-[14px] fill-1">star</span>
                  <span className="text-[12px] font-black text-text-dark">{stats.rating}</span>
               </div>
            </div>
          </div>
        </div>

        {/* PRD 4.4 Aligned Performance Metrics */}
        <div className="grid grid-cols-3 gap-3">
           <div className="bg-white rounded-[1.8rem] p-5 shadow-card border border-white text-center space-y-1">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Avg Response</p>
              <p className="text-[18px] font-black text-primary">{stats.responseTime}</p>
           </div>
           <div className="bg-white rounded-[1.8rem] p-5 shadow-card border border-white text-center space-y-1">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Trust Rating</p>
              <p className="text-[18px] font-black text-secondary">{stats.rating}</p>
           </div>
           <div className="bg-white rounded-[1.8rem] p-5 shadow-card border border-white text-center space-y-1">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Completed</p>
              <p className="text-[18px] font-black text-accent-green">{completedCount}</p>
           </div>
        </div>

        <section className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-white space-y-4">
           <h3 className="text-[14px] font-black text-text-dark tracking-tight uppercase">About Our Firm</h3>
           <p className="text-[13px] text-gray-500 font-medium leading-relaxed italic border-l-4 border-primary/10 pl-5">
             {isDescriptionUpdated ? profileUser.description : "Premier UAE service experts dedicated to high-fidelity corporate and personal arrangements."}
           </p>
        </section>

        <section className="space-y-4">
           <div className="flex justify-between items-center px-1">
              <h3 className="text-[14px] font-black text-text-dark tracking-tight uppercase">Project Showcase</h3>
              <p className="text-[9px] font-bold text-primary uppercase tracking-[0.2em] bg-primary/5 px-3 py-1 rounded-full">{profileUser.gallery?.length || 0} WORKS</p>
           </div>
           <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x pb-4">
              {profileUser.gallery && profileUser.gallery.length > 0 ? (
                profileUser.gallery.map((url: string, idx: number) => (
                  <div key={idx} className="relative w-[220px] h-[280px] rounded-[2.5rem] overflow-hidden shrink-0 snap-start shadow-xl border-4 border-white group">
                    <img src={url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                       <p className="text-white text-[10px] font-black uppercase tracking-widest">Verified Portfolio Item</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="w-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-[3rem] bg-white/50">
                   <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 font-light">collections</span>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Waiting for Portfolio Update</p>
                </div>
              )}
           </div>
        </section>

        <div className="grid grid-cols-1 gap-6 pb-12">
          <section className="space-y-4">
             <h3 className="text-[14px] font-black text-text-dark tracking-tight ml-1 uppercase">Operational Services</h3>
             <div className="flex flex-wrap gap-2.5">
                {(profileUser.services && profileUser.services.length > 0 ? profileUser.services : ['Specialized']).map(s => (
                  <span key={s} className="bg-white text-text-dark border border-gray-100 text-[11px] font-black px-6 py-3 rounded-2xl uppercase tracking-tight shadow-sm">{s}</span>
                ))}
             </div>
          </section>

          <section className="space-y-4">
             <h3 className="text-[14px] font-black text-text-dark tracking-tight ml-1 uppercase">Expertise Profile</h3>
             <div className="grid grid-cols-2 gap-3">
                {(profileUser.categories && profileUser.categories.length > 0 ? profileUser.categories : ['Licensed']).map(cat => {
                  const meta = getCategoryMeta(cat);
                  return (
                    <div key={cat} className="flex items-center gap-3 bg-white px-5 py-4 rounded-[1.8rem] shadow-card border border-white">
                       <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.bg}`}>
                          <span className="material-symbols-outlined text-[20px]" style={{ color: meta.color }}>{meta.icon}</span>
                       </div>
                       <p className="text-[11px] font-black text-text-dark uppercase tracking-tighter truncate">{cat}</p>
                    </div>
                  );
                })}
             </div>
          </section>
        </div>

        <section className="pb-12">
           <div className="bg-[#5B3D9D] rounded-[2.8rem] p-9 shadow-xl relative overflow-hidden">
              <div className="relative z-10 space-y-2">
                 <h3 className="text-white text-xl font-black uppercase tracking-tight leading-tight">Secure Connectivity</h3>
                 <p className="text-white/60 text-[13px] font-medium leading-relaxed max-w-[220px]">
                   Located in {profileUser.locationName || 'Downtown Dubai'}.
                 </p>
                 <div className="flex gap-3 pt-6">
                    <button onClick={handleCall} className="bg-[#FFD60A] text-text-dark px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Direct Call</button>
                    <button onClick={() => navigate(`/messages/${profileUser.id}`)} className="bg-white/10 border border-white/20 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest active:bg-white/20 transition-all">In-App Chat</button>
                 </div>
              </div>
              <div className="absolute -bottom-8 -right-8 opacity-10">
                 <span className="material-symbols-outlined text-[200px]">hub</span>
              </div>
           </div>
        </section>
      </main>
    </div>
  );
};

export default Storefront;
