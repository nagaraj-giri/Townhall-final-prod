import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, RFQ, Quote, Review } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';
import { PlacesField } from '../../Functions/placesfield';

interface ProfileProps {
  user: User;
  onLogout: () => void;
  onUpdateUser?: (user: User) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onLogout, onUpdateUser }) => {
  const navigate = useNavigate();
  const { showToast, chatUnreadCount, unreadCount, toggleNotifications } = useApp();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  const [stats, setStats] = useState({ totalBids: 0, conversion: 0, rating: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [categories, setCategories] = useState<string[]>(user.categories || []);
  const [gallery, setGallery] = useState<string[]>(user.gallery || []);

  const [form, setForm] = useState({
    companyName: user.name || '',
    phone: user.phone || '',
    location: user.locationName || '',
    lat: user.location?.lat || 25.185,
    lng: user.location?.lng || 55.275,
    email: user.email || '',
    description: user.description || ''
  });

  useEffect(() => {
    const fetchRealStats = async () => {
      try {
        const quotes = await dataService.getQuotes();
        const myQuotes = quotes.filter(q => q.providerId === user.id);
        const wins = myQuotes.filter(q => q.status === 'ACCEPTED').length;
        const conv = myQuotes.length > 0 ? Math.round((wins / myQuotes.length) * 100) : 0;
        
        setStats({
          totalBids: myQuotes.length,
          conversion: conv,
          rating: user.rating || 0
        });
      } catch (e) {
        console.error("Stats calc error:", e);
      }
    };
    fetchRealStats();
  }, [user.id, user.rating]);

  const handleSave = async () => {
    try {
      const updatedUser: User = {
        ...user,
        name: form.companyName,
        phone: form.phone,
        locationName: form.location,
        location: { lat: form.lat, lng: form.lng },
        email: form.email,
        description: form.description,
        categories: categories,
        gallery: gallery
      };
      await dataService.saveUser(updatedUser);
      if (onUpdateUser) onUpdateUser(updatedUser);
      setIsEditing(false);
      showToast("Profile updated successfully", "success");
    } catch (err) {
      showToast("Update failed", "error");
    }
  };

  const handleAddGalleryPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingGallery(true);
    try {
      showToast("Uploading to gallery...", "info");
      const url = await dataService.uploadImage(file, `gallery/${user.id}/${Date.now()}`);
      const newGallery = [...gallery, url];
      setGallery(newGallery);
      
      const updatedUser = { ...user, gallery: newGallery };
      await dataService.saveUser(updatedUser);
      if (onUpdateUser) onUpdateUser(updatedUser);
      
      showToast("Gallery updated", "success");
    } catch (err) {
      showToast("Upload failed", "error");
    } finally {
      setIsUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleRemoveGalleryPhoto = async (url: string) => {
    const newGallery = gallery.filter(g => g !== url);
    setGallery(newGallery);
    try {
      const updatedUser = { ...user, gallery: newGallery };
      await dataService.saveUser(updatedUser);
      if (onUpdateUser) onUpdateUser(updatedUser);
      showToast("Photo removed", "success");
    } catch (err) {
      showToast("Delete failed", "error");
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

  return (
    <div className="flex flex-col min-h-screen pb-32 bg-transparent">
      {/* Header */}
      <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-transparent">
        <button onClick={() => navigate('/')} className="w-10 h-10 flex items-center justify-center text-text-dark active:scale-90 transition-transform">
          <span className="material-symbols-outlined font-black text-2xl">grid_view</span>
        </button>
        <h1 className="text-[18px] font-black text-text-dark uppercase tracking-tight">Provider Profile</h1>
        <button onClick={() => toggleNotifications(true)} className="relative w-10 h-10 flex items-center justify-center text-text-dark active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-2xl font-black">notifications</span>
          {unreadCount > 0 && <div className="absolute top-2 right-2 w-2 h-2 bg-accent-pink rounded-full border border-white"></div>}
        </button>
      </header>

      <main className="flex-1 px-6 space-y-8 overflow-y-auto no-scrollbar pt-4">
        {/* Top Profile Summary */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-24 h-24 rounded-[2rem] border-[3px] border-white shadow-soft overflow-hidden bg-white p-1">
              <img src={user.avatar} className="w-full h-full object-cover rounded-[1.8rem]" alt="" />
              <div className="absolute bottom-1 right-1 w-5 h-5 bg-accent-green border-[3px] border-white rounded-full shadow-sm"></div>
            </div>
          </div>
          
          <div className="flex-1 min-w-0 pr-12 relative">
            <h2 className="text-[20px] font-black text-text-dark leading-tight uppercase truncate">
              {form.companyName ? (form.companyName.split(' ')[0] + ' ' + (form.companyName.split(' ')[1] || '')) : 'New Business'}
            </h2>
            <p className="text-[12px] text-gray-400 font-bold uppercase tracking-tight mt-1">
              {form.description || 'Verified Service Provider'}
            </p>
            <div className="flex items-center gap-3 mt-2">
               <div className="bg-[#FFFCEE] px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-secondary fill-1">star</span>
                  <span className="text-[12px] font-black text-text-dark">{stats.rating > 0 ? stats.rating.toFixed(1) : '---'}</span>
               </div>
               <span className="text-[10px] font-black text-accent-green uppercase tracking-widest">Verified Provider</span>
            </div>

            <button 
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              className="absolute top-1/2 -right-4 -translate-y-1/2 w-12 h-12 bg-primary rounded-full shadow-xl flex items-center justify-center text-white active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-xl">{isEditing ? 'check' : 'edit'}</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
           <div className="bg-white rounded-[2rem] p-5 shadow-card border border-white flex flex-col items-center justify-center text-center gap-1 h-32">
              <p className="text-[22px] font-black text-primary leading-none">{stats.totalBids || '---'}</p>
              <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest leading-tight">Total Bids</p>
           </div>
           <div className="bg-white rounded-[2rem] p-5 shadow-card border border-white flex flex-col items-center justify-center text-center gap-1 h-32">
              <p className="text-[22px] font-black text-accent-pink leading-none">{stats.totalBids > 0 ? `${stats.conversion}%` : '---'}</p>
              <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest leading-tight">% Conversion</p>
           </div>
           <div className="bg-white rounded-[2rem] p-5 shadow-card border border-white flex flex-col items-center justify-center text-center gap-1 h-32">
              <div className="flex items-center gap-1 text-accent-green">
                 {stats.rating > 0 && <span className="material-symbols-outlined text-lg fill-1">star</span>}
                 <p className="text-[22px] font-black leading-none">{stats.rating > 0 ? stats.rating.toFixed(1) : '---'}</p>
              </div>
              <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest leading-tight">Overall Rating</p>
           </div>
        </div>

        {/* Business Details */}
        <section className="space-y-4">
           <h3 className="text-[16px] font-black text-text-dark tracking-tight ml-1">Business Details</h3>
           <div className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-white space-y-6">
              {[
                { label: 'Company Name', value: form.companyName, icon: 'corporate_fare', key: 'companyName' },
                { label: 'Mobile Number', value: form.phone, icon: 'call', key: 'phone', isPhone: true },
                { label: 'Service Location', value: form.location, icon: 'location_on', key: 'location', isLocation: true },
                { label: 'Contact Email', value: form.email, icon: 'mail', key: 'email' }
              ].map((field) => (
                <div key={field.key} className="space-y-2">
                   <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{field.label}</label>
                   <div className="bg-[#F9FAFB] rounded-2xl p-4.5 flex items-center gap-4 border border-gray-50 shadow-inner min-h-[64px]">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
                         <span className="material-symbols-outlined text-[20px]">{field.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                         {field.isPhone && (
                           <div className="flex items-center gap-1.5 border-r border-gray-200 pr-3 mr-1">
                              <img src="https://flagcdn.com/w20/ae.png" className="w-4 h-3 object-cover rounded-sm" alt="" />
                              <span className="text-xs font-bold text-gray-500">+971</span>
                           </div>
                         )}
                         {isEditing ? (
                           field.isLocation ? (
                              <PlacesField 
                                placeholder="Update Business Address..."
                                defaultValue={form.location}
                                onPlaceChange={(res) => setForm(prev => ({ ...prev, location: res.name, lat: res.lat, lng: res.lng }))}
                              />
                           ) : (
                             <input 
                               className="w-full bg-transparent border-none p-0 text-[14px] font-bold text-text-dark focus:ring-0 outline-none"
                               value={field.value}
                               onChange={(e) => setForm({...form, [field.key]: e.target.value})}
                             />
                           )
                         ) : (
                           <p className="text-[14px] font-bold text-text-dark truncate">{field.value || 'Not Set'}</p>
                         )}
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </section>

        {/* Gallery Management */}
        <section className="space-y-4">
           <div className="flex justify-between items-center px-1">
              <h3 className="text-[16px] font-black text-text-dark tracking-tight">Gallery Management</h3>
              <button 
                onClick={() => galleryInputRef.current?.click()}
                disabled={isUploadingGallery}
                className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">{isUploadingGallery ? 'sync' : 'add_a_photo'}</span>
                {isUploadingGallery ? 'UPLOADING...' : 'ADD PHOTO'}
              </button>
              <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={handleAddGalleryPhoto} />
           </div>
           <div className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-white">
              <div className="grid grid-cols-3 gap-3">
                 {gallery.map((url, idx) => (
                   <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden group border border-gray-100 shadow-sm bg-gray-50">
                      <img src={url} className="w-full h-full object-cover" alt="" />
                      <button 
                        onClick={() => handleRemoveGalleryPhoto(url)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      >
                         <span className="material-symbols-outlined text-[14px] font-black">close</span>
                      </button>
                   </div>
                 ))}
                 {gallery.length === 0 && (
                   <div className="col-span-3 py-10 flex flex-col items-center justify-center text-gray-300 opacity-40">
                      <span className="material-symbols-outlined text-4xl mb-2">collections</span>
                      <p className="text-[10px] font-black uppercase tracking-widest">No portfolio photos</p>
                   </div>
                 )}
              </div>
           </div>
        </section>

        {/* Service Management */}
        <section className="space-y-4">
           <h3 className="text-[16px] font-black text-text-dark tracking-tight ml-1">Service Management</h3>
           <div className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-white space-y-8">
              <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Assigned Services</p>
                    <span className="bg-gray-50 text-gray-400 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">System Set</span>
                 </div>
                 <div className="flex flex-wrap gap-2.5">
                    {(user.services && user.services.length > 0 ? user.services : ['Service Not Assigned']).map(s => (
                      <span key={s} className="bg-white border border-gray-100 text-[11px] font-bold text-text-dark px-5 py-2.5 rounded-2xl shadow-sm">
                        {s}
                      </span>
                    ))}
                 </div>
              </div>

              <div className="space-y-4">
                 <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Expertise Tags</p>
                 <div className="bg-gray-50/50 rounded-[2.2rem] p-6 space-y-6 shadow-inner border border-gray-100/50">
                    <div className="flex flex-wrap gap-2.5">
                       {categories.map(tag => (
                         <span key={tag} className="bg-[#EBE7F5] text-primary text-[11px] font-black px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm animate-in zoom-in-95">
                           {tag}
                           <button onClick={() => removeTag(tag)} className="material-symbols-outlined text-[16px] font-black opacity-40 hover:opacity-100 transition-opacity">close</button>
                         </span>
                       ))}
                    </div>
                    
                    <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-3 shadow-sm border border-white focus-within:ring-1 focus-within:ring-primary transition-all">
                       <span className="material-symbols-outlined text-gray-300 text-xl">sell</span>
                       <input 
                         className="flex-1 bg-transparent border-none p-0 text-[13px] font-bold text-text-dark outline-none focus:ring-0 placeholder-gray-300"
                         placeholder="Add custom tag..."
                         value={newTag}
                         onChange={e => setNewTag(e.target.value)}
                         onKeyPress={e => e.key === 'Enter' && addTag()}
                       />
                       <button onClick={addTag} className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform">
                          <span className="material-symbols-outlined text-lg font-black">add</span>
                       </button>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* Logout Section */}
        <div className="px-1 pt-4 pb-12">
          <button 
            onClick={onLogout}
            className="w-full py-5 bg-white border border-red-50 text-red-500 font-black text-[11px] uppercase tracking-[0.3em] rounded-[2.5rem] shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            <span className="material-symbols-outlined text-[18px] font-black">logout</span>
            Sign Out Session
          </button>
        </div>
      </main>

      {/* Navigation Footer */}
      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-gray-100 pb-10 pt-4 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60">
          <span className="material-symbols-outlined text-[28px] font-normal">home</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">Home</span>
        </button>
        <button onClick={() => navigate('/leads')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60">
          <span className="material-symbols-outlined text-[28px] font-normal">grid_view</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">Leads</span>
        </button>
        <button onClick={() => navigate('/messages')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light relative opacity-60">
          <span className="material-symbols-outlined text-[28px] font-normal">chat_bubble</span>
          {chatUnreadCount > 0 && <div className="absolute top-0 right-3 w-4 h-4 bg-accent-pink rounded-full border-2 border-white text-[8px] font-normal text-white flex items-center justify-center">{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</div>}
          <span className="text-[9px] font-bold uppercase tracking-widest">Chat</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-xl">
             <span className="material-symbols-outlined text-[28px] font-normal">person</span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest">Profile</span>
        </button>
      </nav>
    </div>
  );
};

export default Profile;