
import React, { useState, useEffect, useRef } from 'react';
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

const Storefront: React.FC<ProviderStorefrontProps> = ({ user: loggedInUser }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast, toggleNotifications, unreadCount } = useApp();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [reviews, setReviews] = useState<EnrichedReview[]>([]);
  
  const [stats, setStats] = useState({ rating: 'N/A', reviewCount: 0, response: '---' });

  const targetId = id || loggedInUser.id;
  const isOwnProfile = loggedInUser.id === targetId;

  // Real-time Provider Profile Listener
  useEffect(() => {
    if (!targetId) return;
    const unsub = dataService.listenToUserById(targetId, (usr) => {
      if (usr) {
        setProfileUser(usr as User);
        // Use Case: Track storefront view if a customer is viewing
        if (!isOwnProfile && loggedInUser.role === UserRole.CUSTOMER) {
          dataService.logStorefrontView(targetId, loggedInUser.id);
        }
      }
      setIsLoading(false);
    });
    return () => unsub();
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
        setStats(prev => ({ ...prev, rating: avg.toFixed(1), reviewCount: revs.length }));
      }
    });

    return () => unsubReviews();
  }, [profileUser]);

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profileUser) return;
    setIsUploading(true);
    try {
      const url = await dataService.uploadImage(file, `gallery/${profileUser.id}/${Date.now()}_${file.name}`);
      const updatedGallery = [...(profileUser.gallery || []), url];
      await dataService.saveUser({ ...profileUser, gallery: updatedGallery });
      showToast("Portfolio updated live", "success");
    } catch (err) {
      showToast("Upload failed", "error");
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading || !profileUser) return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-10">
      <header className="px-6 pt-12 pb-6 flex items-center justify-between shrink-0 sticky top-0 bg-white/80 backdrop-blur-md z-30">
        <button onClick={() => navigate(-1)} className="w-11 h-11 bg-white rounded-2xl shadow-sm flex items-center justify-center text-text-dark">
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <h1 className="text-[16px] font-bold text-text-dark tracking-tight">Expert Storefront</h1>
        <div className="w-11"></div>
      </header>

      <main className="px-6 space-y-6 overflow-y-auto no-scrollbar pb-10 pt-2">
        <div className="bg-white rounded-3xl p-6 shadow-soft flex items-center gap-5 border border-white">
          <img src={profileUser.avatar} className="w-20 h-20 rounded-[1.8rem] object-cover border-2 border-gray-100 shadow-sm" alt="" />
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-black text-text-dark leading-tight uppercase truncate">{profileUser.name}</h2>
            <p className="text-[11px] text-gray-400 font-bold mt-1 uppercase">{profileUser.services?.[0] || 'Market Expert'}</p>
            <div className="flex items-center gap-1 mt-2">
              <span className="material-icons text-secondary text-sm">star</span>
              <span className="text-[12px] font-black text-text-dark">{stats.rating}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="bg-white rounded-[1.8rem] p-5 shadow-sm border border-white text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Views</p>
              <p className="text-[20px] font-black text-primary">{profileUser.profileViews || 0}</p>
           </div>
           <div className="bg-white rounded-[1.8rem] p-5 shadow-sm border border-white text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rating</p>
              <p className="text-[20px] font-black text-secondary">{stats.rating === 'N/A' ? '---' : stats.rating}</p>
           </div>
        </div>

        <section className="bg-white rounded-[2rem] p-8 shadow-soft border border-white space-y-4">
           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">SERVICES</p>
           <div className="flex flex-wrap gap-2">
              {(profileUser.services || []).map(s => (
                <span key={s} className="bg-primary/5 text-primary text-[10px] font-bold px-3 py-1.5 rounded-lg border border-primary/10 uppercase">{s}</span>
              ))}
           </div>
        </section>

        <section className="bg-white rounded-[2rem] p-8 shadow-soft border border-white space-y-6">
           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ABOUT THE BUSINESS</p>
           <p className="text-[12px] text-gray-500 font-medium leading-relaxed italic">
             {profileUser.description || "Building trust with quality UAE services."}
           </p>
        </section>

        <section className="space-y-4">
           <div className="flex justify-between items-center px-1">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Portfolio ({profileUser.gallery?.length || 0})</p>
             {isOwnProfile && (
               <button onClick={() => galleryInputRef.current?.click()} className="text-primary text-[10px] font-black uppercase">Add Photo</button>
             )}
             <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={handleAddPhoto} />
           </div>
           <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 snap-x">
              {(profileUser.gallery || []).map((img, idx) => (
                <div key={idx} className="relative w-44 h-56 rounded-3xl overflow-hidden shrink-0 snap-start shadow-md">
                   <img src={img} className="w-full h-full object-cover" alt="" />
                </div>
              ))}
           </div>
        </section>

        <section className="space-y-4">
           <h3 className="text-lg font-black text-text-dark uppercase tracking-tight ml-1">Client Feedback</h3>
           <div className="space-y-4">
              {reviews.map((rev) => (
                <div key={rev.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50 animate-in fade-in">
                   <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                         <img src={rev.customerAvatar} className="w-10 h-10 rounded-full object-cover border shadow-sm" alt="" />
                         <div>
                            <h4 className="text-[14px] font-bold text-text-dark">{rev.customerName}</h4>
                            <div className="flex gap-0.5 text-secondary">
                               {[1, 2, 3, 4, 5].map(s => <span key={s} className={`material-icons text-sm ${s > rev.rating ? 'opacity-20' : ''}`}>star</span>)}
                            </div>
                         </div>
                      </div>
                      <span className="text-[9px] font-bold text-gray-300">{new Date(rev.createdAt).toLocaleDateString()}</span>
                   </div>
                   <p className="text-[12px] text-gray-500 font-medium leading-relaxed">"{rev.comment}"</p>
                </div>
              ))}
           </div>
        </section>
      </main>
    </div>
  );
};

export default Storefront;
