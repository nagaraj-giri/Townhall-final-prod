import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { User, Quote, ServiceCategory } from '../../types';
import { useApp } from '../../App';
import { PlacesField } from '../../Functions/placesfield';

const ProviderDetails: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useApp();
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availableServices, setAvailableServices] = useState<ServiceCategory[]>([]);
  const [providerQuotes, setProviderQuotes] = useState<Quote[]>([]);
  
  // Edit State
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    locationName: '',
    lat: 0,
    lng: 0,
    primaryService: '',
    categories: [] as string[]
  });
  const [newCategory, setNewCategory] = useState('');

  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        const [u, cats, allQuotes] = await Promise.all([
          dataService.getUserById(id),
          dataService.getCategories(),
          dataService.getQuotes()
        ]);
        
        if (u) {
          setUser(u);
          setEditForm({
            name: u.name || '',
            phone: u.phone || '',
            locationName: u.locationName || '',
            lat: u.location?.lat || 0,
            lng: u.location?.lng || 0,
            primaryService: u.services?.[0] || '',
            categories: u.categories || []
          });
          
          const myQuotes = allQuotes.filter(q => q.providerId === u.id);
          setProviderQuotes(myQuotes);
        }
        setAvailableServices(cats as ServiceCategory[]);
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const stats = useMemo(() => {
    const totalQuotes = providerQuotes.length;
    const wins = providerQuotes.filter(q => q.status === 'ACCEPTED').length;
    const conversion = totalQuotes > 0 ? Math.round((wins / totalQuotes) * 100) : 0;
    
    return {
      quotesSent: totalQuotes,
      conversion: conversion,
      rating: user?.rating || 4.9
    };
  }, [providerQuotes, user]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard`, 'success');
  };

  const handleToggleSuspend = async () => {
    if (!user) return;
    const updated = { ...user, isBlocked: !user.isBlocked };
    try {
      await dataService.saveUser(updated);
      setUser(updated);
      showToast(updated.isBlocked ? "Provider account suspended" : "Provider account activated", "info");
    } catch (err) {
      showToast("Operation failed", "error");
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    if (!editForm.name.trim()) {
      showToast("Business name is required", "error");
      return;
    }

    const updatedUser: User = {
      ...user,
      name: editForm.name,
      phone: editForm.phone,
      locationName: editForm.locationName,
      location: { 
        lat: editForm.lat || user.location?.lat || 25.185, 
        lng: editForm.lng || user.location?.lng || 55.275 
      },
      services: editForm.primaryService ? [editForm.primaryService] : (user.services || []),
      categories: editForm.categories
    };

    try {
      await dataService.saveUser(updatedUser);
      setUser(updatedUser);
      setIsEditing(false);
      showToast("Provider details updated successfully", "success");
    } catch (err) {
      console.error("Save Error:", err);
      showToast("Failed to update record", "error");
    }
  };

  const addCategory = () => {
    if (newCategory.trim() && !editForm.categories.includes(newCategory.trim())) {
      setEditForm(prev => ({ ...prev, categories: [...prev.categories, newCategory.trim()] }));
      setNewCategory('');
    }
  };

  const removeCategory = (tag: string) => {
    setEditForm(prev => ({ ...prev, categories: prev.categories.filter(c => c !== tag) }));
  };

  const compressImage = (file: File, maxWidth = 800, maxHeight = 800): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        const updatedGallery = [...(user.gallery || []), compressed];
        const updatedUser = { ...user, gallery: updatedGallery };
        await dataService.saveUser(updatedUser);
        setUser(updatedUser);
        showToast("Photo added to gallery", "success");
      } catch (err) {
        showToast("Failed to upload photo", "error");
      }
    }
  };

  const handleDeletePhoto = async (index: number) => {
    if (!user || !user.gallery) return;
    if (window.confirm("Delete this photo from gallery?")) {
      const updatedGallery = [...user.gallery];
      updatedGallery.splice(index, 1);
      const updatedUser = { ...user, gallery: updatedGallery };
      try {
        await dataService.saveUser(updatedUser);
        setUser(updatedUser);
        showToast("Photo removed", "info");
      } catch (err) {
        showToast("Failed to remove photo", "error");
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (window.confirm("ARE YOU SURE? This will permanently delete this provider account.")) {
      try {
        await dataService.deleteUser(user.id);
        showToast("Account deleted", "info");
        navigate('/admin/users');
      } catch (err) {
        showToast("Deletion failed", "error");
      }
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return <div className="p-10 text-center">Provider not found</div>;

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-10">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 z-50 bg-white/10 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="text-text-dark w-10 h-10 flex items-center justify-start">
          <span className="material-symbols-outlined font-bold">arrow_back</span>
        </button>
        <h1 className="text-base font-bold text-text-dark">Provider Management</h1>
        <div className="w-10"></div>
      </header>

      <main className="px-6 space-y-6 pt-4 overflow-y-auto no-scrollbar">
        <div className="flex flex-col items-center text-center space-y-3 mb-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-white ring-1 ring-black/5">
              <img src={user.avatar} className="w-full h-full object-cover" alt="" />
            </div>
            {!user.isBlocked && (
              <div className="absolute bottom-0 right-0 bg-[#8BC34A] w-7 h-7 rounded-full border-4 border-white flex items-center justify-center shadow-md">
                <span className="material-icons text-white text-[14px]">check</span>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              {isEditing ? (
                <input 
                  className="text-xl font-bold text-[#333333] bg-white/50 border border-primary/20 rounded-xl px-4 py-2 text-center outline-none focus:ring-2 focus:ring-primary shadow-inner" 
                  value={editForm.name} 
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                />
              ) : (
                <h2 className="text-xl font-bold text-[#333333]">{user.name}</h2>
              )}
            </div>
            <p className="text-xs text-gray-400 font-black uppercase tracking-[0.1em]">
              {user.services?.[0] || 'Unassigned Service'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 px-2">
          {[
            { label: isEditing ? 'Cancel' : 'Edit', icon: isEditing ? 'close' : 'edit_square', onClick: () => setIsEditing(!isEditing), active: isEditing },
            { label: user.isBlocked ? 'Activate' : 'Suspend', icon: 'block', onClick: handleToggleSuspend, active: user.isBlocked },
            { label: 'Store', icon: 'storefront', onClick: () => navigate(`/storefront/${user.id}`) },
            { label: isEditing ? 'Save' : 'Status', icon: isEditing ? 'save' : 'verified_user', onClick: isEditing ? handleSave : undefined, primary: isEditing },
          ].map((btn) => (
            <button key={btn.label} onClick={btn.onClick} className="flex flex-col items-center gap-2 group">
              <div className={`w-12 h-12 rounded-2xl shadow-soft flex items-center justify-center border border-gray-50/50 transition-all active:scale-90 ${btn.active ? 'border-primary bg-primary/5' : btn.primary ? 'border-primary bg-primary text-white shadow-xl' : 'bg-white'}`}>
                <span className={`material-symbols-outlined text-[20px] ${btn.active ? 'text-primary' : btn.primary ? 'text-white' : 'text-gray-50'}`}>{btn.icon}</span>
              </div>
              <span className="text-[10px] font-bold text-gray-400 group-active:text-primary">{btn.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-white flex flex-col items-center justify-center h-24">
            <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-1">Quotes Sent</p>
            <p className="text-xl font-black text-[#333333]">{stats.quotesSent}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-white flex flex-col items-center justify-center h-24">
            <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-1">Conv. Rate</p>
            <p className="text-xl font-black text-[#333333]">{stats.conversion}%</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-white flex flex-col items-center justify-center h-24">
            <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-1">Rating</p>
            <div className="flex items-center gap-1">
              <p className="text-xl font-black text-[#333333]">{stats.rating}</p>
              <span className="material-icons text-[#FFD60A] text-sm">star</span>
            </div>
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
             <span className="material-symbols-outlined text-primary text-xl">corporate_fare</span>
             <h3 className="text-sm font-bold text-text-dark">Business Profile</h3>
          </div>
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-white divide-y divide-gray-50">
            <div className="pb-4">
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1">Email Address</p>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-text-dark">{user.email}</p>
                <button onClick={() => handleCopy(user.email, 'Email')} className="text-gray-300"><span className="material-symbols-outlined text-base">content_copy</span></button>
              </div>
            </div>
            <div className="py-4">
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1">Business Phone</p>
              <div className="flex items-center gap-2 flex-1">
                   <img src="https://flagcdn.com/w20/ae.png" className="w-4 h-3 object-cover rounded-[1px]" alt="" />
                   {isEditing ? (
                     <input 
                      className="text-xs font-bold text-text-dark bg-gray-50 rounded-lg px-3 py-2 w-full border-none focus:ring-1 focus:ring-primary shadow-inner" 
                      value={editForm.phone} 
                      onChange={e => setEditForm({...editForm, phone: e.target.value})}
                      placeholder="50 123 4567"
                     />
                   ) : (
                     <p className="text-xs font-bold text-text-dark">{user.phone || 'Not provided'}</p>
                   )}
                </div>
            </div>
            <div className="py-4">
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1">Location</p>
              <div className={`flex items-center gap-2 ${isEditing ? 'bg-gray-50 rounded-xl py-2 px-3 shadow-inner' : ''} pointer-events-auto`}>
                 {!isEditing && <span className="material-symbols-outlined text-red-400 text-base">location_on</span>}
                 {isEditing ? (
                    <PlacesField 
                      placeholder="Search operational area..."
                      onPlaceChange={(res) => {
                        setEditForm(prev => ({
                          ...prev,
                          locationName: res.name,
                          lat: res.lat,
                          lng: res.lng
                        }));
                      }}
                    />
                 ) : (
                   <p className="text-xs font-bold text-text-dark line-clamp-1">{user.locationName || 'Dubai, UAE'}</p>
                 )}
              </div>
            </div>
            <div className="pt-4">
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1">Assigned Service</p>
              {isEditing ? (
                <select 
                  className="w-full bg-gray-50 border-none rounded-xl text-xs font-bold text-text-dark px-3 py-2.5 mb-3 focus:ring-1 focus:ring-primary shadow-inner"
                  value={editForm.primaryService}
                  onChange={e => setEditForm({...editForm, primaryService: e.target.value})}
                >
                  <option value="">Select Primary Service</option>
                  {availableServices.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              ) : (
                <p className="text-xs font-bold text-text-dark mb-3">{user.services?.[0] || 'No Service Assigned'}</p>
              )}

              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2">Display Tags</p>
              <div className="flex flex-wrap gap-2">
                {(isEditing ? editForm.categories : user.categories || []).map(tag => (
                  <span key={tag} className="bg-gray-50 text-gray-500 text-[9px] font-bold px-3 py-1.5 rounded-lg border border-gray-100 uppercase tracking-tighter flex items-center gap-2">
                    {tag}
                    {isEditing && (
                      <button onClick={() => removeCategory(tag)} className="material-symbols-outlined text-[12px] hover:text-red-500">close</button>
                    )}
                  </span>
                ))}
                {isEditing && (
                  <div className="flex items-center gap-1">
                    <input 
                      className="bg-white border border-gray-100 text-[9px] font-bold px-3 py-1 rounded-lg outline-none w-24"
                      placeholder="Add tag..."
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                    />
                    <button onClick={addCategory} className="w-6 h-6 bg-primary text-white rounded flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm">add</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
               <span className="material-symbols-outlined text-primary text-xl">collections</span>
               <h3 className="text-sm font-bold text-text-dark">Portfolio ({user.gallery?.length || 0})</h3>
            </div>
            <button 
              onClick={() => galleryInputRef.current?.click()}
              className="text-[11px] font-bold text-primary uppercase tracking-widest active:scale-95"
            >
              Add Photo
            </button>
            <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={handleAddPhoto} />
          </div>
          <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-white">
            <div className="grid grid-cols-3 gap-3">
              {user.gallery?.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden shadow-sm group">
                  <img src={img} className="w-full h-full object-cover" alt="" />
                  <div className="absolute top-1.5 right-1.5 flex gap-1 items-center">
                    <button 
                      onClick={() => handleDeletePhoto(idx)}
                      className="w-6 h-6 bg-white/90 backdrop-blur-md rounded-lg flex items-center justify-center shadow-md active:scale-90 transition-transform"
                    >
                      <span className="material-symbols-outlined text-[14px] text-red-500 font-bold">delete</span>
                    </button>
                  </div>
                </div>
              ))}
              {(user.gallery?.length || 0) === 0 && (
                <div className="col-span-3 py-10 text-center bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100 flex flex-col items-center gap-2">
                   <span className="material-symbols-outlined text-gray-200 text-3xl">add_photo_alternate</span>
                   <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">No photos uploaded</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
             <span className="material-symbols-outlined text-primary text-xl">account_balance_wallet</span>
             <h3 className="text-sm font-bold text-text-dark">System Meta</h3>
          </div>
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-white grid grid-cols-2 gap-y-6">
            <div>
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1">Provider ID</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-text-dark uppercase">{user.id.substring(0, 8)}</p>
                <button onClick={() => handleCopy(user.id, 'ID')} className="text-gray-300"><span className="material-symbols-outlined text-sm">content_copy</span></button>
              </div>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1">Account Status</p>
              <p className={`text-xs font-bold ${user.isBlocked ? 'text-red-500' : 'text-[#8BC34A]'}`}>{user.isBlocked ? 'Suspended' : 'Active'}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1">Joined On</p>
              <p className="text-xs font-bold text-text-dark">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-AE', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</p>
            </div>
          </div>
        </section>

        <button 
          onClick={handleDeleteAccount}
          className="w-full py-4 bg-white border border-red-50 text-red-500 rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all mt-6"
        >
          <span className="material-symbols-outlined text-lg">delete_forever</span>
          Delete Provider Account
        </button>
      </main>
    </div>
  );
};

export default ProviderDetails;