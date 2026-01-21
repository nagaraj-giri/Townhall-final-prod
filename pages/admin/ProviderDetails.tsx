
import { useApp } from '../../App';
import { authService } from '../authService';
import { dataService } from '../services/dataService';
import { Quote, Review, ServiceCategory, User } from '../../types';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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
  const [providerQuotes, setProviderQuotes] = useState<Quote[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [availableCategories, setAvailableCategories] = useState<ServiceCategory[]>([]);
  const [newTag, setNewTag] = useState('');
  
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    locationName: '',
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

  const activityLog = useMemo(() => {
    const logs = [];
    if (user?.createdAt) {
      logs.push({ title: 'Account Created', desc: 'Initial registration and email verification', time: new Date(user.createdAt), date: new Date(user.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }), color: 'bg-gray-200' });
    }
    if (user?.lastLoginAt) {
      logs.push({ title: 'Provider Login', desc: 'System access authenticated', time: new Date(user.lastLoginAt), date: 'Last Session', timeStr: new Date(user.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), color: 'border-primary' });
    }
    providerQuotes.slice(0, 3).forEach(q => {
      logs.push({ title: 'Quote Submitted', desc: `Proposal sent for RFQ #${q.rfqId.substring(0, 5).toUpperCase()}`, time: new Date(q.createdAt), date: new Date(q.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), timeStr: new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), color: 'bg-primary' });
    });
    return logs.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [user, providerQuotes]);

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
      const updatedGallery = [...(user.gallery || []), url];
      const updatedUser = { ...user, gallery: updatedGallery };
      await dataService.saveUser(updatedUser);
      setUser(updatedUser);
      setEditForm(prev => ({ ...prev, gallery: updatedGallery }));
      showToast("Photo added to gallery", "success");
    } catch (err) {
      showToast("Upload failed", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = async (url: string) => {
    if (!user) return;
    const updatedGallery = (user.gallery || []).filter(g => g !== url);
    const updatedUser = { ...user, gallery: updatedGallery };
    try {
      await dataService.saveUser(updatedUser);
      setUser(updatedUser);
      setEditForm(prev => ({ ...prev, gallery: updatedGallery }));
      showToast("Photo removed", "info");
    } catch (err) {
      showToast("Action failed", "error");
    }
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
    setEditForm(prev => ({
      ...prev,
      services: [serviceName]
    }));
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
    <div className="flex items-center justify-center min-h-screen bg-transparent">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return <div className="p-10 text-center font-bold text-gray-300 uppercase tracking-widest text-xs bg-transparent min-h-screen">Record not found</div>;

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-10">
      <header className="px-4 pt-10 pb-4 flex items-center justify-between sticky top-0 bg-white/20 backdrop-blur-md z-50">
        <button onClick={() => navigate(-1)} className="text-text-dark w-10 h-10 flex items-center justify-start active:scale-90 transition-transform">
          <span className="material-symbols-outlined font-black">arrow_back</span>
        </button>
        <h1 className="text-[17px] font-bold text-text-dark text-center flex-1">Provider Details</h1>
        <button className="text-text-dark w-10 h-10 flex items-center justify-end">
          <span className="material-symbols-outlined font-black">more_vert</span>
        </button>
      </header>

      <main className="px-6 space-y-8 overflow-y-auto no-scrollbar pt-2 pb-20">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <div className="w-28 h-28 rounded-full border-[6px] border-white shadow-lg overflow-hidden bg-gray-100 flex items-center justify-center ring-1 ring-black/5">
              <img src={user.avatar} className="w-full h-full object-cover" alt="" />
            </div>
            {!user.isBlocked && (
              <div className="absolute bottom-1 right-1 bg-[#8BC34A] w-7 h-7 rounded-full border-4 border-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-white text-[14px] font-black">check</span>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 justify-center">
              {isEditing ? (
                <input 
                  className="text-[22px] font-black text-text-dark bg-white border-none rounded-xl px-4 py-1 text-center outline-none focus:ring-1 focus:ring-primary shadow-inner max-w-[200px]" 
                  value={editForm.name} 
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                />
              ) : (
                <h2 className="text-[22px] font-black text-text-dark tracking-tight leading-none uppercase">{user.name || 'UNNAMED PROVIDER'}</h2>
              )}
              <span className="bg-[#EBE7F5] text-[#5B3D9D] text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-tight">{user.role}</span>
            </div>
            <p className="text-[12px] font-bold text-gray-400">{user.services?.[0] || 'Market Entity'}</p>
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
              <span className="text-[11px] font-bold text-gray-400">{btn.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-white flex flex-col items-start min-h-[110px]">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">QUOTES <br/> SENT</p>
            <p className="text-[26px] font-black text-text-dark tracking-tighter">{stats.quotesSent}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-white flex flex-col items-start min-h-[110px]">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">TOTAL <br/> SALES</p>
            <div className="flex items-baseline gap-1">
               <p className="text-[26px] font-black text-text-dark tracking-tighter">{stats.sales}</p>
               <p className="text-[10px] font-bold text-gray-400">AED</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-white flex flex-col items-start min-h-[110px]">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">RATING</p>
            <div className="flex items-center gap-1">
               <p className="text-[26px] font-black text-text-dark tracking-tighter">{stats.rating}</p>
               <span className="material-symbols-outlined text-secondary fill-1 text-[22px]">star</span>
            </div>
          </div>
        </div>

        <section className="space-y-4">
           <div className="flex items-center gap-2 px-1">
              <span className="material-symbols-outlined text-[#5B3D9D] text-[20px] font-bold">corporate_fare</span>
              <h3 className="text-[15px] font-bold text-text-dark">Business Details</h3>
           </div>
           <div className="bg-white rounded-[2.2rem] shadow-sm border border-white divide-y divide-gray-50 overflow-hidden">
              <div className="p-5 flex items-center justify-between group">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Address</p>
                  <p className="text-[14px] font-bold text-text-dark truncate">{user.email || 'N/A'}</p>
                </div>
                <button onClick={() => { if(user.email) { navigator.clipboard.writeText(user.email); showToast("Copied!", "success"); } }} className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[20px]">content_copy</span>
                </button>
              </div>

              <div className="p-5 flex items-center justify-between group">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Business Phone</p>
                  <div className="flex items-center gap-2">
                    <img src="https://flagcdn.com/w20/ae.png" className="w-4 h-3 object-cover rounded-[1px] shadow-xs" alt="" />
                    {isEditing ? (
                      <input 
                        className="text-[14px] font-bold text-text-dark bg-gray-50 rounded-lg px-2 py-1 outline-none w-full"
                        value={editForm.phone}
                        onChange={e => setEditForm({...editForm, phone: e.target.value})}
                      />
                    ) : (
                      <p className="text-[14px] font-bold text-text-dark">{user.phone || 'NO PHONE LINKED'}</p>
                    )}
                  </div>
                </div>
                <button className="w-10 h-10 flex items-center justify-center text-gray-300">
                  <span className="material-symbols-outlined text-[20px]">call</span>
                </button>
              </div>

              <div className="p-5 flex items-start gap-4">
                <span className="material-symbols-outlined text-red-500 mt-1">location_on</span>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Location</p>
                  {isEditing ? (
                    <input 
                      className="text-[14px] font-bold text-text-dark bg-gray-50 rounded-lg px-2 py-1 outline-none w-full"
                      value={editForm.locationName}
                      onChange={e => setEditForm({...editForm, locationName: e.target.value})}
                    />
                  ) : (
                    <p className="text-[14px] font-bold text-text-dark leading-snug">{user.locationName || 'LOCATION NOT SET'}</p>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Services</p>
                  {isEditing ? (
                    <div className="relative mt-2">
                      <select
                        value={editForm.services[0] || ''}
                        onChange={(e) => handleServiceChange(e.target.value)}
                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-[14px] font-bold text-text-dark focus:ring-1 focus:ring-primary shadow-inner appearance-none outline-none"
                      >
                        <option value="" disabled>Select Core Service</option>
                        {availableCategories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">expand_more</span>
                    </div>
                  ) : (
                    <p className="text-[14px] font-bold text-text-dark">{editForm.services[0] || 'No primary service'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Expertise Tags</p>
                  {isEditing ? (
                    <div className="space-y-3 pt-1">
                      <div className="flex flex-wrap gap-2">
                        {editForm.categories.map(tag => (
                          <span key={tag} className="bg-primary/10 text-primary text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-primary/5">
                            {tag}
                            <button onClick={() => removeTag(tag)} className="material-symbols-outlined text-[14px] font-black">close</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          className="flex-1 bg-gray-50 border-none rounded-lg px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary outline-none shadow-inner"
                          placeholder="Add new expertise..."
                          value={newTag}
                          onChange={e => setNewTag(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && addTag()}
                        />
                        <button onClick={addTag} className="w-9 h-9 bg-primary text-white rounded-lg flex items-center justify-center shadow-sm active:scale-95">
                          <span className="material-symbols-outlined text-lg">add</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {editForm.categories.length > 0 ? editForm.categories.map(cat => (
                        <span key={cat} className="bg-gray-50 border border-gray-100 text-[10px] font-bold text-text-dark px-3 py-1.5 rounded-lg">{cat}</span>
                      )) : <p className="text-[11px] text-gray-300 font-bold uppercase">No tags defined</p>}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">About Us</p>
                  {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline">Edit</button>
                  )}
                </div>
                {isEditing ? (
                  <textarea 
                    className="w-full bg-gray-50 border-none rounded-xl text-[13px] font-medium text-text-dark p-4 focus:ring-1 focus:ring-primary shadow-inner min-h-[120px] resize-none"
                    placeholder="Describe this business..."
                    value={editForm.description}
                    onChange={e => setEditForm({...editForm, description: e.target.value})}
                  />
                ) : (
                  <p className="text-[13px] text-gray-500 font-medium leading-relaxed">
                    {user.description || "No professional description provided by this entity."}
                  </p>
                )}
              </div>
           </div>
        </section>

        <section className="space-y-4">
           <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#5B3D9D] text-[20px] font-bold">collections</span>
                <h3 className="text-[15px] font-bold text-text-dark">Gallery ({editForm.gallery.length})</h3>
              </div>
              <button onClick={() => galleryInputRef.current?.click()} disabled={isUploading} className="text-[11px] font-black text-[#5B3D9D] uppercase tracking-widest">
                {isUploading ? "Uploading..." : "ADD PHOTO"}
              </button>
              <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={handleAddPhoto} />
           </div>
           <div className="bg-white rounded-[2.2rem] shadow-sm border border-white p-6">
              <div className="grid grid-cols-3 gap-3">
                 {editForm.gallery.map((img, idx) => (
                   <div key={idx} className="relative aspect-square rounded-xl overflow-hidden shadow-sm border border-gray-50 bg-gray-50 group">
                      <img src={img} className="w-full h-full object-cover" alt="" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => removePhoto(img)} className="w-7 h-7 bg-white rounded-full flex items-center justify-center text-red-500 shadow-sm">
                           <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                   </div>
                 ))}
                 {editForm.gallery.length === 0 && (
                   <div className="col-span-3 py-10 text-center opacity-30">
                      <span className="material-symbols-outlined text-4xl mb-2">collections</span>
                      <p className="text-[10px] font-black uppercase">Empty Portfolio</p>
                   </div>
                 )}
              </div>
           </div>
        </section>

        <section className="space-y-4">
           <div className="flex items-center gap-2 px-1">
              <span className="material-symbols-outlined text-[#5B3D9D] text-[20px] font-bold">badge</span>
              <h3 className="text-[15px] font-bold text-text-dark">Account Status</h3>
           </div>
           <div className="bg-white rounded-[2.2rem] shadow-sm border border-white p-6 space-y-8">
              <div className="grid grid-cols-2 gap-y-8">
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Provider ID</p>
                   <div className="flex items-center gap-1">
                      <p className="text-[14px] font-bold text-text-dark">#PR-{user.id.substring(0, 6).toUpperCase()}</p>
                      <button onClick={() => { navigator.clipboard.writeText(user.id); showToast("Copied ID!", "success"); }} className="material-symbols-outlined text-[14px] text-gray-300">content_copy</button>
                   </div>
                 </div>
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</p>
                   <p className={`text-[14px] font-bold ${user.isBlocked ? 'text-red-500' : 'text-[#8BC34A]'}`}>{user.isBlocked ? 'Suspended' : 'Verified Active'}</p>
                 </div>
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Member Since</p>
                   <p className="text-[14px] font-bold text-text-dark">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</p>
                 </div>
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Last Sync</p>
                   <p className="text-[14px] font-bold text-text-dark">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'NEVER'} GST</p>
                 </div>
              </div>
           </div>
        </section>

        <section className="space-y-4">
           <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#5B3D9D] text-[20px] font-bold">history</span>
                <h3 className="text-[15px] font-bold text-text-dark">Recent Logs</h3>
              </div>
              <button className="text-[11px] font-bold text-primary uppercase tracking-wider">Export</button>
           </div>
           
           <div className="bg-white rounded-[2.2rem] shadow-sm border border-white p-6 space-y-0">
              {activityLog.length > 0 ? activityLog.map((log, idx) => (
                <div key={idx} className="flex gap-4 relative pb-8 group last:pb-2">
                   {idx !== activityLog.length - 1 && <div className="absolute left-[7px] top-6 bottom-[-8px] w-[2px] bg-gray-50 group-last:hidden"></div>}
                   <div className={`w-4 h-4 rounded-full ${log.color} shrink-0 z-10 border-[3px] border-white shadow-sm mt-1 flex items-center justify-center`}>
                      {log.title === 'Provider Login' && <div className="w-full h-full rounded-full border border-primary"></div>}
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <h4 className="text-[14px] font-bold text-text-dark">{log.title}</h4>
                        <span className="text-[10px] font-bold text-gray-300 uppercase">{log.timeStr || log.date}</span>
                      </div>
                      <p className="text-[12px] text-gray-400 font-medium leading-relaxed">{log.desc}</p>
                   </div>
                </div>
              )) : <div className="py-6 text-center text-gray-300 text-[10px] font-bold uppercase tracking-widest">No activity found</div>}
           </div>
        </section>

        <button 
          onClick={handlePurge}
          className="w-full py-5 bg-white border border-gray-100 text-red-500 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xs"
        >
          <span className="material-symbols-outlined text-[18px] font-black text-red-500">delete</span>
          Purge Provider Record
        </button>
      </main>
    </div>
  );
};

export default ProviderDetails;
