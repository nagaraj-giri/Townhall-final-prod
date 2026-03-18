import { useApp } from '../../App';
import { authService } from '../authService';
import { dataService } from '../../services/dataService';
import { Quote, Review, ServiceCategory, User, AuditLogEntry } from '../../types';
import React, { useEffect, useMemo, useRef, useState } from 'react';
// @ts-ignore
import { useNavigate, useParams } from 'react-router-dom';
import { PlacesField } from '../../FunctionsUI/placesfield';

interface Props {
  adminUser: User;
}

const ProviderDetails: React.FC<Props> = ({ adminUser }) => {
  // @ts-ignore
  const navigate = useNavigate();
  // @ts-ignore
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
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [availableCategories, setAvailableCategories] = useState<ServiceCategory[]>([]);
  
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
    if (user && !isEditing) {
      setEditForm({
        name: user.name || '',
        phone: user.phone || '',
        locationName: user.locationName || '',
        lat: user.location?.lat || 25.185,
        lng: user.location?.lng || 55.275,
        description: user.description || '',
        services: user.services || [],
        categories: user.categories || [],
        gallery: user.gallery || []
      });
    }
  }, [user, isEditing]);

  useEffect(() => {
    if (!id) return;
    const unsubUser = dataService.listenToUserById(id, (u) => {
      if (u) setUser(u);
    });
    const unsubQuotes = dataService.listenToQuotesByProvider(id, (quotes) => {
      setProviderQuotes(quotes);
      setLoading(false);
    });
    const unsubReviews = dataService.listenToReviewsByProvider(id, setReviews);
    const unsubLogs = dataService.listenToAuditLogsByEventId(id, setAuditLogs);
    
    return () => { 
      unsubUser();
      unsubQuotes(); 
      unsubReviews(); 
      unsubLogs();
    };
  }, [id]);

  const stats = useMemo(() => {
    const totalQuotes = providerQuotes.length;
    const acceptedQuotes = providerQuotes.filter(q => q.status === 'ACCEPTED');
    const totalSales = acceptedQuotes.reduce((acc, q) => acc + (parseFloat(q.price) || 0), 0);
    const avgRating = reviews.length > 0 
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
      : (user?.rating || 0).toFixed(1);
    
    const formattedSales = totalSales >= 1000 ? `${(totalSales / 1000).toFixed(1)}k` : totalSales.toLocaleString();

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
        status: 'verified'
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

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#FAF9F6]">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return <div className="p-10 text-center font-bold text-gray-300 uppercase tracking-widest text-xs bg-transparent min-h-screen">Record not found</div>;

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF9F6] pb-10">
      <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
        <button onClick={() => navigate('/admin/users')} className="text-text-dark w-10 h-10 flex items-center justify-start active:scale-90 transition-transform">
          <span className="material-symbols-outlined font-normal">arrow_back</span>
        </button>
        <h1 className="text-[17px] font-black text-text-dark text-center flex-1 uppercase tracking-tight">Provider Details</h1>
        <button className="w-10 h-10 flex items-center justify-end text-text-dark">
          <span className="material-symbols-outlined font-normal">more_vert</span>
        </button>
      </header>

      <main className="px-6 space-y-8 pt-6 pb-20">
        {/* Verification Banner */}
        {!user.isVerified && (
          <div className="bg-accent-green/10 p-6 rounded-[2.5rem] border border-accent-green/20 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-2xl bg-accent-green flex items-center justify-center shrink-0 shadow-lg shadow-accent-green/20">
                <span className="material-symbols-outlined text-white text-2xl wght-900">verified_user</span>
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-black text-text-dark uppercase tracking-tight">Verification Pending</h3>
                <p className="text-[12px] text-gray-500 font-normal leading-relaxed mt-1">
                  This provider has submitted their profile for review. Verify their details and documents before granting full access.
                </p>
              </div>
            </div>
            <button 
              onClick={handleApprove}
              disabled={isApproving}
              className="w-full py-4 bg-accent-green text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-accent-green/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isApproving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  Approve Provider
                </>
              )}
            </button>
          </div>
        )}

        {/* Profile Section */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-[6px] border-white shadow-xl overflow-hidden bg-gray-100 flex items-center justify-center ring-1 ring-black/5">
              <img src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} className="w-full h-full object-cover" alt="" />
            </div>
            {user.isVerified && (
              <div className="absolute bottom-1 right-2 bg-[#8BC34A] w-8 h-8 rounded-full border-4 border-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-white text-[16px] wght-900">check</span>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="text-[22px] font-black text-text-dark tracking-tight leading-none uppercase bg-gray-50 border-b-2 border-primary outline-none text-center w-full max-w-xs"
                  placeholder="Business Name"
                />
              ) : (
                <h2 className="text-[22px] font-black text-text-dark tracking-tight leading-none uppercase">{user.name || 'UNNAMED PROVIDER'}</h2>
              )}
              <span className="bg-[#EBE7F5] text-[#5B3D9D] text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest">{user.role}</span>
            </div>
            <p className="text-[13px] font-normal text-gray-400 uppercase tracking-widest">Licensed PRO & Travel Consultant</p>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: isEditing ? 'Save' : 'Edit', icon: isEditing ? 'check' : 'edit_square', onClick: isEditing ? handleSave : () => setIsEditing(true), active: isEditing },
            { label: user.isBlocked ? 'Restore' : 'Suspend', icon: 'block', onClick: handleToggleSuspend, active: user.isBlocked },
            { label: 'Store', icon: 'storefront', onClick: () => navigate(`/storefront/${user.id}`) },
            { label: 'Reset', icon: isEditing ? 'close' : 'history', onClick: isEditing ? () => setIsEditing(false) : handleSendReset, loading: isSendingReset },
          ].map((btn) => (
            <button key={btn.label} onClick={btn.onClick} disabled={btn.loading} className="flex flex-col items-center gap-2.5">
              <div className={`w-14 h-14 rounded-2xl shadow-sm flex items-center justify-center border border-white transition-all active:scale-90 ${btn.active ? 'bg-primary text-white' : 'bg-white text-text-dark'}`}>
                {btn.loading ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-[24px] font-normal">{btn.icon}</span>}
              </div>
              <span className="text-[10px] font-normal uppercase text-gray-400 tracking-widest">{btn.label}</span>
            </button>
          ))}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-white text-left space-y-1">
            <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Quotes Sent</p>
            <p className="text-2xl font-black text-text-dark">{stats.quotesSent}</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-white text-left space-y-1">
            <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Total Sales</p>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-black text-text-dark">{stats.sales}</p>
              <p className="text-[10px] font-normal text-gray-400 uppercase">AED</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-white text-left space-y-1">
            <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Rating</p>
            <div className="flex items-center gap-1">
              <p className="text-2xl font-black text-text-dark">{stats.rating}</p>
              <span className="material-symbols-outlined text-[#FFD60A] text-lg fill-1">star</span>
            </div>
          </div>
        </div>

        {/* Business Details Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="material-symbols-outlined text-primary text-xl">store</span>
            <h3 className="text-[13px] font-black text-text-dark uppercase tracking-widest">Business Details</h3>
          </div>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-white divide-y divide-gray-50 overflow-hidden">
            <div className="p-6 flex items-center justify-between">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Email Address</p>
                <p className="text-[14px] font-normal text-text-dark truncate">{user.email || 'N/A'}</p>
              </div>
              <button onClick={() => { if(user.email) { navigator.clipboard.writeText(user.email); showToast("Copied!", "success"); } }} className="text-gray-300 active:text-primary">
                <span className="material-symbols-outlined text-[20px]">content_copy</span>
              </button>
            </div>

            <div className="p-6 flex items-center justify-between">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Business Phone</p>
                <div className="flex items-center gap-2">
                  <img src="https://flagcdn.com/w20/ae.png" className="w-4 h-3 object-cover rounded-sm" alt="" />
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="text-[14px] font-normal text-text-dark bg-gray-50 border-b border-gray-200 outline-none w-full"
                    />
                  ) : (
                    <p className="text-[14px] font-normal text-text-dark">{user.phone || 'NOT SET'}</p>
                  )}
                </div>
              </div>
              <button className="text-gray-300">
                <span className="material-symbols-outlined text-[20px]">call</span>
              </button>
            </div>

            <div className="p-6 flex items-center justify-between">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Location</p>
                {isEditing ? (
                  <PlacesField
                    defaultValue={editForm.locationName}
                    onPlaceChange={(result) => setEditForm({ ...editForm, locationName: result.name, lat: result.lat, lng: result.lng })}
                    placeholder="Search location..."
                    className="text-[14px] font-normal text-text-dark bg-gray-50 border-b border-gray-200 outline-none w-full py-1"
                  />
                ) : (
                  <p className="text-[14px] font-normal text-text-dark leading-snug">{user.locationName || 'DUBAI, UAE'}</p>
                )}
              </div>
              <button className="text-red-400">
                <span className="material-symbols-outlined text-[20px] fill-1">location_on</span>
              </button>
            </div>

            <div className="p-6 space-y-3">
              <div className="space-y-1">
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Service</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.services.join(', ')}
                    onChange={(e) => setEditForm({ ...editForm, services: e.target.value.split(',').map(s => s.trim()) })}
                    className="text-[14px] font-normal text-text-dark bg-gray-50 border-b border-gray-200 outline-none w-full"
                    placeholder="e.g. Visa, Flight Booking"
                  />
                ) : (
                  <p className="text-[14px] font-normal text-text-dark">{user.services?.join(', ') || 'PRO & Visa Consultant'}</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Category</p>
                {isEditing ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {availableCategories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          const exists = editForm.categories.includes(cat.name);
                          setEditForm({
                            ...editForm,
                            categories: exists 
                              ? editForm.categories.filter(c => c !== cat.name)
                              : [...editForm.categories, cat.name]
                          });
                        }}
                        className={`text-[10px] font-normal px-3 py-1.5 rounded-lg border uppercase tracking-wider transition-colors ${
                          editForm.categories.includes(cat.name)
                            ? 'bg-primary text-white border-primary'
                            : 'bg-gray-50 text-gray-500 border-gray-100'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(user.categories || ['Visa Processing', 'Flight Booking', 'Legal Translation']).map(cat => (
                      <span key={cat} className="bg-gray-50 text-gray-500 text-[10px] font-normal px-3 py-1.5 rounded-lg border border-gray-100 uppercase tracking-wider">{cat}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 space-y-2">
              <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">About Us</p>
              {isEditing ? (
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="text-[13px] text-gray-500 font-normal leading-relaxed w-full bg-gray-50 border border-gray-100 rounded-xl p-3 outline-none min-h-[100px]"
                  placeholder="Describe the business..."
                />
              ) : (
                <p className="text-[13px] text-gray-500 font-normal leading-relaxed">
                  {user.description || "With over 10 years of experience in Dubai, Al-Fayed Services has established itself as a premier consultancy for visa processing and legal translations. Our expertise lies in navigating complex regulatory frameworks to provide seamless solutions for international clients and local businesses alike."}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Gallery Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">image</span>
              <h3 className="text-[13px] font-black text-text-dark uppercase tracking-widest">Gallery ({user.gallery?.length || 0})</h3>
            </div>
            <button onClick={() => galleryInputRef.current?.click()} className="text-[11px] font-normal text-primary uppercase tracking-widest">Add Photo</button>
            <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={handleAddPhoto} />
          </div>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-white p-6">
            <div className="grid grid-cols-3 gap-3">
              {(user.gallery || [1,2,3,4,5,6]).map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 group">
                  <img src={typeof img === 'string' ? img : `https://picsum.photos/seed/${idx + 10}/400/400`} className="w-full h-full object-cover" alt="" />
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="w-6 h-6 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-text-dark shadow-sm">
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                    </button>
                    <button onClick={() => typeof img === 'string' && removePhoto(img)} className="w-6 h-6 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-red-500 shadow-sm">
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Account Status Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="material-symbols-outlined text-primary text-xl">badge</span>
            <h3 className="text-[13px] font-black text-text-dark uppercase tracking-widest">Account Status</h3>
          </div>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-white p-8 space-y-8">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Provider ID</p>
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-normal text-text-dark">#PR - {user.id.slice(-6).toUpperCase()}</p>
                  <button onClick={() => { navigator.clipboard.writeText(user.id); showToast("ID Copied", "success"); }} className="text-gray-300">
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Account Status</p>
                <p className={`text-[14px] font-normal ${user.isBlocked ? 'text-red-500' : 'text-[#8BC34A]'}`}>
                  {user.isBlocked ? 'Suspended' : 'Active'}
                </p>
              </div>
            </div>
            <div className="w-full h-px bg-gray-50"></div>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Joined On</p>
                <p className="text-[14px] font-normal text-text-dark">
                  {new Date(user.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Last Active</p>
                <p className="text-[14px] font-normal text-text-dark">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Today'}
                </p>
                <p className="text-[10px] font-normal text-gray-400 uppercase">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '09:12:44'} GST
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Activity Log Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">request_quote</span>
              <h3 className="text-[13px] font-black text-text-dark uppercase tracking-widest">Recent Quotes ({providerQuotes.length})</h3>
            </div>
          </div>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-white p-6 space-y-4">
            {providerQuotes.length > 0 ? providerQuotes.slice(0, 3).map((quote) => (
              <div key={quote.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[12px] font-black text-text-dark uppercase tracking-tight">AED {quote.price}</p>
                  <p className="text-[10px] font-normal text-gray-400 uppercase tracking-widest">RFQ: {quote.rfqId.slice(-6).toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
                    quote.status === 'ACCEPTED' ? 'bg-accent-green/20 text-accent-green' :
                    quote.status === 'REJECTED' ? 'bg-red-50 text-red-500' :
                    'bg-blue-50 text-blue-500'
                  }`}>
                    {quote.status}
                  </span>
                  <p className="text-[9px] font-normal text-gray-300 uppercase mt-1">
                    {new Date(quote.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-[11px] font-normal text-gray-400 uppercase tracking-widest text-center py-4">No quotes sent yet</p>
            )}
          </div>
        </section>

        {/* Recent Reviews Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">star</span>
              <h3 className="text-[13px] font-black text-text-dark uppercase tracking-widest">Recent Reviews ({reviews.length})</h3>
            </div>
          </div>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-white p-6 space-y-4">
            {reviews.length > 0 ? reviews.slice(0, 3).map((review) => (
              <div key={review.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className={`material-symbols-outlined text-[14px] ${i < review.rating ? 'text-[#FFD60A] fill-1' : 'text-gray-200'}`}>star</span>
                    ))}
                  </div>
                  <span className="text-[9px] font-normal text-gray-300 uppercase">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-[12px] font-normal text-text-dark leading-relaxed italic">"{review.comment}"</p>
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">— User {review.customerId.slice(-4).toUpperCase()}</p>
              </div>
            )) : (
              <p className="text-[11px] font-normal text-gray-400 uppercase tracking-widest text-center py-4">No reviews yet</p>
            )}
          </div>
        </section>

        {/* Activity Log Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">history</span>
              <h3 className="text-[13px] font-black text-text-dark uppercase tracking-widest">Activity Log</h3>
            </div>
            <button className="text-[11px] font-normal text-primary uppercase tracking-widest">View All</button>
          </div>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-white p-8 space-y-8">
            {auditLogs.length > 0 ? [...auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((log, idx) => (
              <div key={log.id} className="flex gap-4 relative">
                {idx !== auditLogs.length - 1 && (
                  <div className="absolute left-[11px] top-8 bottom-[-32px] w-px bg-gray-100"></div>
                )}
                <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center z-10 ${log.iconBg || 'bg-primary'}`}>
                  <span className="material-symbols-outlined text-white text-[14px] font-normal">{log.icon || 'circle'}</span>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start">
                    <h4 className="text-[14px] font-normal text-text-dark leading-none">{log.title}</h4>
                    <span className="text-[10px] font-normal text-gray-300 uppercase">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] font-normal text-gray-400 leading-relaxed">
                    {log.type === 'BUSINESS_VERIFICATION' ? 'Provider account has been verified by admin.' : 
                     log.type === 'PROVIDER_SECURITY' ? 'Security status updated for this provider.' :
                     'System activity logged for this account.'}
                  </p>
                </div>
              </div>
            )) : (
              <div className="text-center py-4">
                <p className="text-[11px] font-normal text-gray-400 uppercase tracking-widest">No activity recorded yet</p>
              </div>
            )}
          </div>
        </section>

        <div className="pt-6 pb-12">
          <button 
            onClick={handlePurge}
            className="w-full py-4 flex items-center justify-center gap-2 text-red-500 font-normal text-[13px] uppercase tracking-widest bg-white rounded-2xl shadow-sm border border-gray-100 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
            Delete Provider Account
          </button>
        </div>
      </main>
    </div>
  );
};

export default ProviderDetails;
