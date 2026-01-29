import { useApp } from '../../App';
import { authService } from '../authService';
import { dataService } from '../services/dataService';
import { Quote, Review, ServiceCategory, User } from '../../types';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlacesField } from '../../Functions/placesfield';

interface Props {
  adminUser: User;
}

const ProviderDetails: React.FC<Props> = ({ adminUser }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useApp();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [providerQuotes, setProviderQuotes] = useState<Quote[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [availableCategories, setAvailableCategories] = useState<ServiceCategory[]>([]);
  const [newTag, setNewTag] = useState('');
  
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    locationName: '',
    lat: 25.185,
    lng: 55.275,
    description: '',
    services: [] as string[],
    categories: [] as string[],
    gallery: [] as string[]
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      const [u, cats] = await Promise.all([
        dataService.getUserById(id),
        dataService.getCategories()
      ]);
      setAvailableCategories(cats);
      if (u) {
        setUser(u as User);
        setEditForm({
          name: u.name || '',
          phone: u.phone || '',
          locationName: u.locationName || '',
          lat: u.location?.lat || 25.185,
          lng: u.location?.lng || 55.275,
          description: u.description || '',
          services: u.services || [],
          categories: u.categories || [],
          gallery: u.gallery || []
        });
      }
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const unsubQuotes = dataService.listenToQuotes((all) => {
      setProviderQuotes(all.filter(q => q.providerId === id));
      setLoading(false);
    });
    const unsubReviews = dataService.listenToReviewsByProvider(id, setReviews);
    return () => { unsubQuotes(); unsubReviews(); };
  }, [id]);

  const stats = useMemo(() => {
    const totalQuotes = providerQuotes.length;
    const acceptedQuotes = providerQuotes.filter(q => q.status === 'ACCEPTED');
    const totalSales = acceptedQuotes.reduce((acc, q) => acc + (parseFloat(q.price) || 0), 0);
    const avgRating = reviews.length > 0 
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
      : (user?.rating || 0).toFixed(1);
    
    const formattedSales = totalSales >= 1000 ? `${(totalSales / 1000).toFixed(0)}k` : totalSales;

    return {
      quotesSent: totalQuotes,
      sales: formattedSales,
      rating: avgRating
    };
  }, [providerQuotes, reviews, user]);

  const handleApprove = async () => {
    if (!user) return;
    if (!window.confirm(`Finalize verification for ${user.name}? They will gain full lead access.`)) return;
    
    setIsApproving(true);
    try {
      const updatedUser: User = {
        ...user,
        ...editForm,
        isVerified: true,
        status: 'verified' as any
      };
      
      await dataService.saveUser(updatedUser);
      
      await dataService.createAuditLog({
        admin: adminUser,
        title: `Business Verified: ${user.name}`,
        type: "BUSINESS_VERIFICATION",
        severity: "MEDIUM",
        icon: "verified",
        iconBg: "bg-accent-green",
        eventId: user.id
      });

      setUser(updatedUser);
      setIsApproving(false);
      setIsEditing(false);
      showToast(`${user.name} is now verified!`, "success");
    } catch (err) {
      showToast("Verification failed", "error");
      setIsApproving(false);
    }
  };

  const handleToggleSuspend = async () => {
    if (!user) return;
    const isNowBlocked = !user.isBlocked;
    const updated = { ...user, isBlocked: isNowBlocked };
    try {
      await dataService.saveUser(updated);
      
      await dataService.createAuditLog({
        admin: adminUser,
        title: `${isNowBlocked ? 'Suspended' : 'Restored'} Provider Access: ${user.name}`,
        type: "PROVIDER_SECURITY",
        severity: isNowBlocked ? "HIGH" : "MEDIUM",
        icon: isNowBlocked ? "block" : "verified_user",
        iconBg: isNowBlocked ? "bg-red-500" : "bg-accent-green",
        eventId: user.id
      });

      setUser(updated);
      showToast(updated.isBlocked ? "Account Suspended" : "Account Active", "info");
    } catch (err) {
      showToast("Status change failed", "error");
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const updatedUser: User = {
      ...user,
      name: editForm.name,
      phone: editForm.phone,
      locationName: editForm.locationName,
      location: { lat: editForm.lat, lng: editForm.lng },
      description: editForm.description,
      gallery: editForm.gallery,
      services: editForm.services,
      categories: editForm.categories
    };
    try {
      await dataService.saveUser(updatedUser);
      
      await dataService.createAuditLog({
        admin: adminUser,
        title: `Updated Provider Business Profile: ${user.name}`,
        type: "USER_MANAGEMENT",
        severity: "LOW",
        icon: "store",
        iconBg: "bg-blue-500",
        eventId: user.id
      });

      setUser(updatedUser);
      setIsEditing(false);
      showToast("Profile Updated", "success");
    } catch (err) {
      showToast("Save failed", "error");
    }
  };

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    try {
      const url = await dataService.uploadImage(file, `gallery/${user.id}/${Date.now()}`);
      const updatedGallery = [...(editForm.gallery || []), url];
      setEditForm(prev => ({ ...prev, gallery: updatedGallery }));
      showToast("Photo staged for save", "success");
    } catch (err) {
      showToast("Upload failed", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (url: string) => {
    const updatedGallery = (editForm.gallery || []).filter(g => g !== url);
    setEditForm(prev => ({ ...prev, gallery: updatedGallery }));
  };

  const handleSendReset = async () => {
    if (!user) return;
    setIsSendingReset(true);
    try {
      await authService.resetPassword(user.email);
      showToast("Reset link sent successfully", "success");
    } catch (err) {
      showToast("Failed to send reset link", "error");
    } finally {
      setIsSendingReset(false);
    }
  };

  const handlePurge = async () => {
    if (!user) return;
    if (window.confirm("PERMANENTLY PURGE THIS ACCOUNT? All data will be lost.")) {
       try {
         await dataService.deleteUser(user.id);
         
         await dataService.createAuditLog({
           admin: adminUser,
           title: `PERMANENT PURGE: Provider ${user.name}`,
           type: "USER_DELETION",
           severity: "HIGH",
           icon: "delete_forever",
           iconBg: "bg-red-600",
           eventId: user.id
         });

         showToast("Record Purged", "success");
         navigate('/admin/users');
       } catch (err) {
         showToast("Purge failed", "error");
       }
    }
  };

  const handleServiceChange = (serviceName: string) => {
    setEditForm(prev => ({ ...prev, services: [serviceName] }));
  };

  const addTag = () => {
    if (newTag.trim() && !editForm.categories.includes(newTag.trim())) {
      setEditForm(prev => ({ ...prev, categories: [...prev.categories, newTag.trim()] }));
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setEditForm(prev => ({ ...prev, categories: prev.categories.filter(t => t !== tag) }));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#FAF9F6]">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return <div className="p-10 text-center font-bold text-gray-300 uppercase tracking-widest text-xs bg-transparent min-h-screen">Record not found</div>;

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF9F6] pb-10">
      <header className="px-4 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-white/20 backdrop-blur-md z-50">
        <button onClick={() => navigate('/admin/users')} className="text-text-dark w-10 h-10 flex items-center justify-start active:scale-90 transition-transform">
          <span className="material-symbols-outlined font-black">arrow_back</span>
        </button>
        <h1 className="text-[17px] font-bold text-text-dark text-center flex-1">Provider Console</h1>
        <div className="w-10"></div>
      </header>

      <main className="px-6 space-y-8 overflow-y-auto no-scrollbar pt-2 pb-20">
        {!user.isVerified && (
           <div className="bg-orange-50 border-2 border-orange-100 rounded-[2.5rem] p-8 text-center space-y-5 animate-in slide-in-from-top-4 duration-500 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <span className="material-symbols-outlined text-[100px]">gavel</span>
              </div>
              <div className="w-16 h-16 bg-orange-100/50 rounded-full flex items-center justify-center mx-auto text-orange-500 relative z-10">
                 <span className="material-symbols-outlined text-3xl font-black">verified_user</span>
              </div>
              <div className="relative z-10">
                 <h3 className="text-lg font-black text-text-dark uppercase tracking-tight">Pending Verification</h3>
                 <p className="text-[11px] text-orange-600 font-bold uppercase tracking-widest mt-1">Provider has limited platform access</p>
              </div>
              <button 
                onClick={handleApprove}
                disabled={isApproving}
                className="w-full bg-primary text-white py-5 rounded-full font-black uppercase tracking-[0.2em] text-[12px] shadow-btn-glow active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 relative z-10"
              >
                {isApproving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (
                  <>
                    <span className="material-symbols-outlined text-lg">verified</span>
                    Finalize & Approve Business
                  </>
                )}
              </button>
           </div>
        )}

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <div className="w-28 h-28 rounded-full border-[6px] border-white shadow-lg overflow-hidden bg-gray-100 flex items-center justify-center ring-1 ring-black/5">
              <img src={user.avatar} className="w-full h-full object-cover" alt="" />
            </div>
            {user.isVerified && (
              <div className="absolute bottom-1 right-1 bg-[#8BC34A] w-7 h-7 rounded-full border-4 border-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-white text-[14px] font-black">check</span>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex flex-col items-center gap-1 justify-center">
              {isEditing ? (
                <input 
                  className="text-[22px] font-black text-text-dark bg-white border-none rounded-xl px-4 py-1 text-center outline-none focus:ring-1 focus:ring-primary shadow-inner" 
                  value={editForm.name} 
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                />
              ) : (
                <h2 className="text-[22px] font-black text-text-dark tracking-tight leading-none uppercase">{user.name || 'UNNAMED PROVIDER'}</h2>
              )}
              <div className="flex items-center gap-2 mt-2">
                 <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${user.isVerified ? 'bg-[#EBE7F5] text-[#5B3D9D]' : 'bg-orange-50 text-orange-500'}`}>
                   {user.isVerified ? 'VERIFIED EXPERT' : 'UNVERIFIED ACCOUNT'}
                 </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 px-2">
          {[
            { label: isEditing ? 'Save' : 'Edit', icon: isEditing ? 'check' : 'edit_square', onClick: isEditing ? handleSave : () => setIsEditing(true), active: isEditing },
            { label: user.isBlocked ? 'Restore' : 'Suspend', icon: 'block', onClick: handleToggleSuspend, active: user.isBlocked },
            { label: 'Store', icon: 'storefront', onClick: () => navigate(`/storefront/${user.id}`) },
            { label: 'Reset', icon: isEditing ? 'close' : 'history', onClick: isEditing ? () => setIsEditing(false) : handleSendReset, loading: isSendingReset },
          ].map((btn) => (
            <button key={btn.label} onClick={btn.onClick} disabled={btn.loading} className="flex flex-col items-center gap-2.5">
              <div className={`w-14 h-14 rounded-2xl shadow-sm flex items-center justify-center border border-white transition-all active:scale-90 ${btn.active ? 'bg-primary text-white' : 'bg-white text-text-dark'}`}>
                {btn.loading ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-[24px]">{btn.icon}</span>}
              </div>
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{btn.label}</span>
            </button>
          ))}
        </div>

        <section className="space-y-4">
           <h3 className="text-[13px] font-black text-gray-400 ml-1 uppercase tracking-widest">Business Profile</h3>
           <div className="bg-white rounded-[2.5rem] shadow-card border border-white divide-y divide-gray-50 overflow-hidden">
              <div className="p-6 flex items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Corporate Email</p>
                  <p className="text-[14px] font-bold text-text-dark truncate lowercase">{user.email || 'N/A'}</p>
                </div>
                <button onClick={() => { if(user.email) { navigator.clipboard.writeText(user.email); showToast("Copied!", "success"); } }} className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300 active:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[20px]">content_copy</span>
                </button>
              </div>

              <div className="p-6 space-y-1">
                <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Business Mobile</p>
                <div className="flex items-center gap-3">
                  <img src="https://flagcdn.com/w20/ae.png" className="w-5 h-4 object-cover rounded shadow-sm" alt="" />
                  {isEditing ? (
                    <input 
                      className="text-[14px] font-bold text-text-dark bg-gray-50 rounded-xl px-4 py-2 outline-none w-full border-none focus:ring-1 focus:ring-primary shadow-inner"
                      value={editForm.phone}
                      onChange={e => setEditForm({...editForm, phone: e.target.value})}
                    />
                  ) : (
                    <p className="text-[14px] font-bold text-text-dark">{user.phone || 'NOT SET'}</p>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-1">
                <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Business Location</p>
                {isEditing ? (
                  <div className="bg-gray-50 rounded-xl px-4 py-2 shadow-inner border border-gray-100/50">
                    <PlacesField 
                      placeholder="Enter Business Location..."
                      defaultValue={editForm.locationName}
                      onPlaceChange={(res) => setEditForm(prev => ({ ...prev, locationName: res.name, lat: res.lat, lng: res.lng }))}
                    />
                  </div>
                ) : (
                  <p className="text-[14px] font-bold text-text-dark leading-snug">{user.locationName || 'DUBAI, UAE'}</p>
                )}
              </div>

              <div className="p-6 space-y-2">
                <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Business Description</p>
                {isEditing ? (
                  <textarea 
                    className="w-full bg-gray-50 border-none rounded-xl text-[13px] font-medium text-text-dark p-4 focus:ring-1 focus:ring-primary shadow-inner min-h-[120px] resize-none"
                    value={editForm.description}
                    onChange={e => setEditForm({...editForm, description: e.target.value})}
                  />
                ) : (
                  <p className="text-[13px] text-gray-500 font-medium leading-relaxed italic border-l-4 border-gray-100 pl-4">
                    {user.description || "No company overview provided."}
                  </p>
                )}
              </div>
           </div>
        </section>

        <section className="space-y-4">
           <div className="flex items-center justify-between px-1">
              <h3 className="text-[13px] font-black text-gray-400 uppercase tracking-widest">Gallery Portfolio</h3>
              <button onClick={() => galleryInputRef.current?.click()} disabled={isUploading} className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
                {isUploading ? "..." : "ADD"}
              </button>
              <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={handleAddPhoto} />
           </div>
           <div className="bg-white rounded-[2.5rem] shadow-card border border-white p-6">
              <div className="grid grid-cols-3 gap-3">
                 {editForm.gallery.map((img, idx) => (
                   <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden shadow-sm border border-gray-50 bg-gray-50 group">
                      <img src={img} className="w-full h-full object-cover" alt="" />
                      <button onClick={() => removePhoto(img)} className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="material-symbols-outlined text-[14px] font-black">delete</span>
                      </button>
                   </div>
                 ))}
                 {editForm.gallery.length === 0 && (
                   <div className="col-span-3 py-10 text-center opacity-30 flex flex-col items-center">
                      <span className="material-symbols-outlined text-4xl mb-2">collections</span>
                      <p className="text-[9px] font-black uppercase tracking-widest">No portfolio photos</p>
                   </div>
                 )}
              </div>
           </div>
        </section>

        <div className="pt-6 pb-12 space-y-4">
          <button 
            onClick={handlePurge}
            className="w-full py-5 bg-white border border-gray-100 text-red-500 rounded-3xl font-black text-[12px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">delete_forever</span>
            Purge Provider Record
          </button>
        </div>
      </main>
    </div>
  );
};

export default ProviderDetails;