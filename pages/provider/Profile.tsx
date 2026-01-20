import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Review, ServiceCategory, Quote } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';
import { PlacesField } from '../../Functions/placesfield';

interface ProfileProps {
  user: User;
  onLogout: () => void;
  onUpdateUser?: (user: User) => void;
}

const COUNTRIES = [
  { name: 'UAE', code: 'ae', dialCode: '+971', flag: 'https://flagcdn.com/w40/ae.png' },
  { name: 'Saudi', code: 'sa', dialCode: '+966', flag: 'https://flagcdn.com/w40/sa.png' },
  { name: 'Qatar', code: 'qa', dialCode: '+974', flag: 'https://flagcdn.com/w40/qa.png' },
  { name: 'India', code: 'in', dialCode: '+91', flag: 'https://flagcdn.com/w40/in.png' },
  { name: 'UK', code: 'gb', dialCode: '+44', flag: 'https://flagcdn.com/w40/gb.png' },
];

const Profile: React.FC<ProfileProps> = ({ user, onLogout, onUpdateUser }) => {
  const navigate = useNavigate();
  const { showToast, chatUnreadCount, unreadCount, toggleNotifications } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [isPhoneDropdownOpen, setIsPhoneDropdownOpen] = useState(false);
  const [stats, setStats] = useState({ totalBids: 0, conversion: 0, rating: 0 });
  const [availableServices, setAvailableServices] = useState<ServiceCategory[]>([]);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [form, setForm] = useState({
    companyName: user.name || '',
    mobile: '',
    mobileDial: '+971',
    mobileFlag: 'https://flagcdn.com/w40/ae.png',
    location: user.locationName || '',
    lat: user.location?.lat || 25.185,
    lng: user.location?.lng || 55.275,
    email: user.email || '',
    description: user.description || ''
  });

  useEffect(() => {
    if (user.phone) {
      const match = COUNTRIES.find(c => user.phone?.startsWith(c.dialCode));
      if (match) {
        setForm(prev => ({
          ...prev,
          mobileDial: match.dialCode,
          mobileFlag: match.flag,
          mobile: user.phone!.replace(match.dialCode, '').trim()
        }));
      } else {
        setForm(prev => ({ ...prev, mobile: user.phone || '' }));
      }
    }
    setForm(prev => ({ ...prev, email: user.email || '', description: user.description || '' }));
  }, [user.phone, user.email, user.description]);
  
  const [categories, setCategories] = useState<string[]>(user.categories || []);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    const unsubQuotes = dataService.listenToQuotes((allQuotes) => {
      const myQuotes = allQuotes.filter(q => q.providerId === user.id);
      const wins = myQuotes.filter(q => q.status === 'ACCEPTED').length;
      const conv = myQuotes.length > 0 ? Math.round((wins / myQuotes.length) * 100) : 0;
      setStats(prev => ({ ...prev, totalBids: myQuotes.length, conversion: conv }));
    });

    const unsubReviews = dataService.listenToReviewsByProvider(user.id, (reviews) => {
      const avgRating = reviews.length > 0 
        ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1))
        : 0; 
      setStats(prev => ({ ...prev, rating: avgRating }));
    });

    const fetchCats = async () => {
      const cats = await dataService.getCategories();
      setAvailableServices(cats);
    };
    fetchCats();

    return () => {
      unsubQuotes();
      unsubReviews();
    };
  }, [user.id]);

  const handleSaveProfile = async () => {
    try {
      const updatedUser: User = { 
        ...user, 
        name: form.companyName.trim(), 
        phone: `${form.mobileDial} ${form.mobile.trim()}`, 
        locationName: form.location.trim(), 
        location: { lat: form.lat, lng: form.lng }, 
        email: form.email.trim(),
        description: form.description.trim(), 
        categories: categories 
      };
      await dataService.saveUser(updatedUser);
      if (onUpdateUser) onUpdateUser(updatedUser);
      setIsEditing(false);
      showToast("Profile updated successfully", "success");
    } catch (err) {
      showToast("Update failed", "error");
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast("Updating profile picture...", "info");
    try {
      const url = await dataService.uploadImage(file, `avatars/${user.id}_${Date.now()}`);
      const updatedUser = { ...user, avatar: url };
      await dataService.saveUser(updatedUser);
      if (onUpdateUser) onUpdateUser(updatedUser);
      showToast("Profile picture updated", "success");
    } catch (err) {
      showToast("Update failed", "error");
    }
  };

  const addTag = () => {
    if (newTag.trim() && !categories.includes(newTag.trim())) { 
      setCategories([...categories, newTag.trim()]); 
      setNewTag(''); 
    }
  };

  const removeTag = (tag: string) => { 
    setCategories(categories.filter(t => t !== tag)); 
  };

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    showToast("Uploading portfolio piece...", "info");
    try {
      const url = await dataService.uploadImage(file, `gallery/${user.id}/${Date.now()}_${file.name}`);
      const updatedGallery = [...(user.gallery || []), url];
      const updatedUser = { ...user, gallery: updatedGallery };
      await dataService.saveUser(updatedUser);
      if (onUpdateUser) onUpdateUser(updatedUser);
      showToast("Gallery updated successfully", "success");
    } catch (err) {
      showToast("Upload failed", "error");
    } finally {
      setIsUploading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (index: number) => {
    if (!user.gallery) return;
    if (window.confirm("Remove this photo from your portfolio?")) {
      const updatedGallery = [...user.gallery];
      updatedGallery.splice(index, 1);
      const updatedUser = { ...user, gallery: updatedGallery };
      try {
        await dataService.saveUser(updatedUser);
        if (onUpdateUser) onUpdateUser(updatedUser);
        showToast("Photo removed", "info");
      } catch (err) {
        showToast("Action failed", "error");
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-32 bg-transparent">
      <header className="px-6 pt-12 pb-4 flex justify-between items-center">
        <button onClick={() => navigate('/')} className="text-text-dark active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-2xl font-bold">grid_view</span>
        </button>
        <h1 className="text-lg font-black text-text-dark tracking-tight">Provider Profile</h1>
        <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-gray-100 active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-text-dark text-xl font-normal">notifications</span>
          {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white shadow-sm"></div>}
        </button>
      </header>

      <main className="flex-1 px-6 space-y-8 overflow-y-auto no-scrollbar pt-2">
        <div className="flex items-center justify-between relative px-1">
          <div className="flex items-center gap-4">
            <div className="relative cursor-pointer group" onClick={() => avatarInputRef.current?.click()}>
              <div className="w-20 h-20 rounded-3xl overflow-hidden border-4 border-white shadow-soft bg-white transition-transform group-active:scale-95">
                <img src={user.avatar} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-xl border-2 border-white shadow-lg flex items-center justify-center text-white transition-transform group-hover:scale-110">
                 <span className="material-symbols-outlined text-[16px] font-bold">photo_camera</span>
              </div>
              <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
            </div>
            
            <div 
              onClick={() => navigate('/storefront')} 
              className="cursor-pointer active:opacity-60 transition-all"
            >
              <h2 className="text-xl font-black text-text-dark leading-none tracking-tight">{user.name}</h2>
              <p className="text-[10px] text-gray-400 font-bold mt-1.5 uppercase tracking-widest">{user.services?.[0] || ''}</p>
              <div className="flex items-center gap-3 mt-3">
                <div className="bg-[#FFF4D8] px-2.5 py-1 rounded-lg flex items-center gap-1 border border-[#FFE4A1]">
                   <span className="text-[10px] font-black text-[#A18100] uppercase tracking-tighter">star</span>
                   <span className="text-[11px] font-black text-[#A18100]">{stats.rating > 0 ? stats.rating : '---'}</span>
                </div>
                <span className="text-[10px] font-black text-[#8BC34A] uppercase tracking-widest">VERIFIED PROVIDER</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)} 
            className="w-12 h-12 bg-primary rounded-2xl shadow-lg flex items-center justify-center text-white active:scale-90 transition-transform"
          >
            <span className="material-symbols-outlined text-[22px]">{isEditing ? 'check' : 'edit_square'}</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] p-5 shadow-sm border border-white text-center flex flex-col justify-center min-h-[110px]">
            <p className="text-2xl font-black text-text-dark leading-none mb-2">{stats.totalBids > 0 ? stats.totalBids : '---'}</p>
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-tight">TOTAL BIDS</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] p-5 shadow-sm border border-white text-center flex flex-col justify-center min-h-[110px]">
            <p className="text-2xl font-black text-accent-pink leading-none mb-2">{stats.totalBids > 0 ? `${stats.conversion}%` : '---'}</p>
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-tight">% CONVERSION</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] p-5 shadow-sm border border-white text-center flex flex-col justify-center min-h-[110px]">
            <div className="flex items-center justify-center gap-1 mb-2">
               <span className="text-[11px] font-black text-accent-green uppercase tracking-tighter">star</span>
               <p className="text-2xl font-black text-accent-green leading-none">{stats.rating > 0 ? stats.rating : '---'}</p>
            </div>
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-tight">OVERALL RATING</p>
          </div>
        </div>

        {/* About Us Management Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
             <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px] font-bold">info</span>
                <h3 className="text-[17px] font-black text-text-dark">About Us</h3>
             </div>
          </div>
          <div className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white">
            {isEditing ? (
              <textarea 
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                className="w-full px-6 py-5 bg-[#F9FAFB]/50 rounded-[1.8rem] text-[13px] border-none focus:ring-1 focus:ring-primary shadow-inner outline-none min-h-[160px] placeholder-gray-300 font-medium resize-none text-text-dark leading-relaxed"
                placeholder="Tell potential clients about your business history, specialties, and professional values to build trust..."
              />
            ) : (
              <p className="text-[13px] text-gray-500 font-medium leading-relaxed">
                {user.description || "Describe your business here to stand out in the marketplace and build trust with new clients."}
              </p>
            )}
          </div>
        </section>

        {/* Gallery Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px] font-bold">collections</span>
              <h3 className="text-[17px] font-black text-text-dark">Gallery ({user.gallery?.length || 0})</h3>
            </div>
            <button 
              onClick={() => galleryInputRef.current?.click()}
              disabled={isUploading}
              className="text-[13px] font-bold text-primary active:scale-95 transition-all"
            >
              {isUploading ? 'Uploading...' : 'Add Photo'}
            </button>
            <input 
              type="file" 
              ref={galleryInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleAddPhoto} 
            />
          </div>
          
          <div className="bg-white rounded-[2.5rem] p-6 shadow-card border border-white">
            <div className="grid grid-cols-3 gap-4">
              {(user.gallery || []).map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden group shadow-sm border border-gray-50">
                  <img src={img} className="w-full h-full object-cover" alt={`Portfolio ${idx}`} />
                  <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button 
                      onClick={() => handleDeletePhoto(idx)}
                      className="w-7 h-7 bg-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <span className="material-symbols-outlined text-[14px] text-text-dark font-black">delete</span>
                    </button>
                  </div>
                </div>
              ))}
              
              {(!user.gallery || user.gallery.length === 0) && (
                <div 
                  onClick={() => galleryInputRef.current?.click()}
                  className="col-span-3 py-10 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-100 rounded-[1.8rem] bg-gray-50/30 cursor-pointer active:bg-gray-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-4xl text-gray-200">add_a_photo</span>
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No showcase items yet</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Business Details Section */}
        <section className="space-y-4">
          <h3 className="text-[13px] font-black text-text-dark uppercase tracking-[0.1em] ml-1">Business Details</h3>
          <div className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white space-y-8">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-gray-300 uppercase ml-1 tracking-[0.15em]">COMPANY NAME</label>
              <div className="flex items-center gap-4 bg-gray-50/50 px-6 py-4.5 rounded-[1.4rem] border border-gray-100/50 shadow-inner">
                 <span className="material-symbols-outlined text-primary text-[22px]">corporate_fare</span>
                 <input 
                  disabled={!isEditing} 
                  value={form.companyName} 
                  onChange={e => setForm({...form, companyName: e.target.value})} 
                  className="bg-transparent border-none p-0 text-[14px] font-bold text-text-dark outline-none w-full disabled:opacity-100 placeholder-gray-300"
                  placeholder="Official Business Name"
                 />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-gray-300 uppercase ml-1 tracking-[0.15em]">MOBILE NUMBER</label>
              {isEditing ? (
                <div className="flex gap-2 w-full relative">
                  <button 
                    onClick={() => setIsPhoneDropdownOpen(!isPhoneDropdownOpen)}
                    className="bg-gray-50/50 rounded-[1.4rem] px-4 py-4.5 flex items-center gap-2 border border-gray-100/50 shadow-inner active:bg-gray-100 transition-colors"
                  >
                    <img src={form.mobileFlag} className="w-5 h-4 object-cover rounded-[1px]" alt="" />
                    <span className="material-symbols-outlined text-xs text-gray-300 font-black">expand_more</span>
                  </button>

                  {isPhoneDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsPhoneDropdownOpen(false)}></div>
                      <div className="absolute top-16 left-0 w-full max-w-[280px] bg-white border border-gray-100 rounded-[2rem] shadow-2xl p-2 max-h-64 overflow-y-auto no-scrollbar animate-in zoom-in-95 duration-200">
                        {COUNTRIES.map(c => (
                          <button 
                            key={c.code}
                            onClick={() => {
                              setForm({ ...form, mobileDial: c.dialCode, mobileFlag: c.flag });
                              setIsPhoneDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-gray-50 transition-colors"
                          >
                            <img src={c.flag} className="w-5 h-4 object-cover rounded-[1px]" alt="" />
                            <span className="text-[13px] font-bold text-text-dark flex-1 text-left">{c.name}</span>
                            <span className="text-[12px] font-medium text-gray-400">{c.dialCode}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="flex-1 bg-gray-50/50 rounded-[1.4rem] px-6 py-4.5 flex items-center gap-3 border border-gray-100/50 shadow-inner">
                    <span className="text-[14px] font-black text-text-dark shrink-0">{form.mobileDial}</span>
                    <div className="w-[1px] h-4 bg-gray-200"></div>
                    <input 
                      type="tel" 
                      className="bg-transparent border-none p-0 text-[14px] font-bold text-text-dark outline-none w-full focus:ring-0" 
                      placeholder="50 123 4567"
                      value={form.mobile}
                      onChange={e => setForm({...form, mobile: e.target.value})}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 bg-gray-50/50 px-6 py-4.5 rounded-[1.4rem] border border-gray-100/50 shadow-inner">
                   <img src={form.mobileFlag} className="w-5 h-4 object-cover rounded-[1px]" alt="" />
                   <span className="text-[14px] font-black text-text-dark">{form.mobileDial}</span>
                   <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>
                   <input 
                    disabled 
                    value={form.mobile} 
                    className="bg-transparent border-none p-0 text-[14px] font-bold text-text-dark outline-none w-full disabled:opacity-100" 
                   />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-gray-300 uppercase ml-1 tracking-[0.15em]">SERVICE LOCATION</label>
              <div className="flex items-center gap-4 bg-gray-50/50 px-6 py-4.5 rounded-[1.4rem] border border-gray-100/50 shadow-inner pointer-events-auto min-h-[60px]">
                 <span className="material-symbols-outlined text-accent-pink text-[22px]">location_on</span>
                 {isEditing ? (
                    <PlacesField 
                      placeholder="Search operational area..."
                      onPlaceChange={(res) => {
                        setForm(prev => ({
                          ...prev,
                          location: res.name,
                          lat: res.lat,
                          lng: res.lng
                        }));
                      }}
                    />
                 ) : (
                    <p className="text-[14px] font-bold text-text-dark truncate w-full">{form.location}</p>
                 )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-gray-300 uppercase ml-1 tracking-[0.15em]">CONTACT EMAIL</label>
              <div className="flex items-center gap-4 bg-gray-50/50 px-6 py-4.5 rounded-[1.4rem] border border-gray-100/50 shadow-inner">
                 <span className="material-symbols-outlined text-primary text-[22px]">mail</span>
                 <input 
                  disabled={!isEditing} 
                  value={form.email} 
                  onChange={e => setForm({...form, email: e.target.value})} 
                  className="bg-transparent border-none p-0 text-[14px] font-bold text-text-dark outline-none w-full disabled:opacity-100" 
                 />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4 pb-8">
          <h3 className="text-[13px] font-black text-text-dark uppercase tracking-[0.1em] ml-1">Service Management</h3>
          <div className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white space-y-8">
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[9px] font-black text-gray-300 uppercase tracking-[0.15em] ml-1">ASSIGNED CATEGORIES</label>
                <span className="bg-primary/5 text-[8px] font-black text-primary px-2 py-0.5 rounded uppercase">SYSTEM</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {(user.services || []).map(s => (
                  <span key={s} className="bg-gray-50 text-text-dark text-[10px] font-black px-4 py-2.5 rounded-xl border border-gray-100 uppercase tracking-tighter">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[9px] font-black text-gray-300 uppercase tracking-[0.15em] ml-1">SPECIALTY TAGS</label>
              <div className="bg-gray-50/50 p-5 rounded-[1.8rem] border border-gray-100/50 shadow-inner space-y-5">
                <div className="flex flex-wrap gap-2">
                  {categories.map(tag => (
                    <span key={tag} className="bg-primary/10 text-primary text-[10px] font-black px-3.5 py-2 rounded-xl flex items-center gap-2 border border-primary/5 uppercase tracking-tighter">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="material-symbols-outlined text-[16px] font-black">close</button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
                  <span className="material-symbols-outlined text-gray-300 text-[20px]">sell</span>
                  <input 
                    className="bg-transparent border-none p-0 text-[13px] font-bold text-text-dark outline-none w-full placeholder-gray-300" 
                    placeholder="Enter specialty..." 
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyPress={(e: any) => e.key === 'Enter' && addTag()}
                  />
                  <button onClick={addTag} className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform">
                    <span className="material-symbols-outlined text-base font-black">add</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <button onClick={onLogout} className="w-full py-6 text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] hover:text-red-500 transition-colors active:scale-95 text-center">SIGN OUT SESSION</button>
      </main>

      <nav className="fixed bottom-0 w-full max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-gray-100 pb-10 pt-4 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60">
          <span className="material-symbols-outlined text-[28px] font-normal">home</span>
          <span className="text-[9px] font-black uppercase tracking-widest">HOME</span>
        </button>
        <button onClick={() => navigate('/leads')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60">
          <span className="material-symbols-outlined text-[28px] font-normal">grid_view</span>
          <span className="text-[9px] font-black uppercase tracking-widest">LEADS</span>
        </button>
        <button onClick={() => navigate('/messages')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60 relative">
          <span className="material-symbols-outlined text-[28px] font-normal">chat_bubble</span>
          {chatUnreadCount > 0 && <div className="absolute top-0 right-3 w-4 h-4 bg-accent-pink rounded-full border-2 border-white text-[8px] font-black text-white flex items-center justify-center">{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</div>}
          <span className="text-[9px] font-black uppercase tracking-widest">CHAT</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-xl">
             <span className="material-symbols-outlined text-[28px] font-normal">person</span>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">PROFILE</span>
        </button>
      </nav>
    </div>
  );
};

export default Profile;