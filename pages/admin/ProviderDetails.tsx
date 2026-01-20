import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { authService } from '../authService';
import { User, Quote, ServiceCategory, Review } from '../../types';
import { useApp } from '../../App';
import { PlacesField } from '../../Functions/placesfield';

const ProviderDetails: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useApp();
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [availableServices, setAvailableServices] = useState<ServiceCategory[]>([]);
  const [providerQuotes, setProviderQuotes] = useState<Quote[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    locationName: '',
    lat: 0,
    lng: 0,
    description: '',
    primaryService: '',
    categories: [] as string[]
  });
  const [newCategory, setNewCategory] = useState('');

  const addCategory = () => {
    if (newCategory.trim() && !editForm.categories.includes(newCategory.trim())) {
      setEditForm(prev => ({
        ...prev,
        categories: [...prev.categories, newCategory.trim()]
      }));
      setNewCategory('');
    }
  };

  const removeCategory = (tag: string) => {
    setEditForm(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c !== tag)
    }));
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      const [u, cats] = await Promise.all([
        dataService.getUserById(id),
        dataService.getCategories()
      ]);
      
      if (u) {
        setUser(u as User);
        setEditForm({
          name: u.name || '',
          phone: u.phone || '',
          locationName: u.locationName || '',
          lat: u.location?.lat || 0,
          lng: u.location?.lng || 0,
          description: u.description || '',
          primaryService: u.services?.[0] || '',
          categories: u.categories || []
        });
      }
      setAvailableServices(cats as ServiceCategory[]);
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
    const wins = providerQuotes.filter(q => q.status === 'ACCEPTED').length;
    const conversion = totalQuotes > 0 ? Math.round((wins / totalQuotes) * 100) : 0;
    
    return {
      quotesSent: totalQuotes,
      conversion: `${conversion}%`,
      hours: '---'
    };
  }, [providerQuotes]);

  const activityLog = useMemo(() => {
    const logs = [];
    if (user?.createdAt) {
      logs.push({ title: 'Account Created', desc: 'Provider profile initialized in registry', time: new Date(user.createdAt), icon: 'person_add', color: 'bg-gray-200' });
    }
    if (user?.lastLoginAt) {
      logs.push({ title: 'User Login', desc: `Successful login from ${user.locationName || 'Dubai Hub'}`, time: new Date(user.lastLoginAt), icon: 'login', color: 'bg-primary' });
    }
    providerQuotes.slice(0, 4).forEach(q => {
      logs.push({ title: 'Submitted Quote', desc: `Quote sent for RFQ #${q.rfqId.substring(0, 5)}`, time: new Date(q.createdAt), icon: 'send', color: 'bg-indigo-600' });
    });
    return logs.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [user, providerQuotes]);

  const handleToggleSuspend = async () => {
    if (!user) return;
    const updated = { ...user, isBlocked: !user.isBlocked };
    try {
      await dataService.saveUser(updated);
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
      location: { lat: editForm.lat || 25.185, lng: editForm.lng || 55.275 },
      description: editForm.description,
      services: editForm.primaryService ? [editForm.primaryService] : (user.services || []),
      categories: editForm.categories
    };
    try {
      await dataService.saveUser(updatedUser);
      setUser(updatedUser);
      setIsEditing(false);
      showToast("Profile Updated", "success");
    } catch (err) {
      showToast("Save failed", "error");
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard", "success");
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-transparent">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return <div className="p-10 text-center font-bold text-gray-300 uppercase tracking-widest text-xs">Record not found</div>;

  return (
    <div className="flex flex-col min-h-screen bg-[#FDF9F3] pb-10">
      <header className="px-4 pt-10 pb-4 flex items-center justify-between sticky top-0 bg-[#FDF9F3]/80 backdrop-blur-md z-50">
        <button onClick={() => navigate(-1)} className="text-text-dark w-10 h-10 flex items-center justify-start active:scale-90 transition-transform">
          <span className="material-symbols-outlined font-black">arrow_back</span>
        </button>
        <h1 className="text-[17px] font-bold text-text-dark text-center flex-1">User Details</h1>
        <button className="text-text-dark w-10 h-10 flex items-center justify-end">
          <span className="material-symbols-outlined font-black">more_vert</span>
        </button>
      </header>

      <main className="px-6 space-y-8 overflow-y-auto no-scrollbar pt-2 pb-20">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <div className="w-28 h-28 rounded-full border-[6px] border-white shadow-lg overflow-hidden bg-white ring-1 ring-black/5">
              <img src={user.avatar} className="w-full h-full object-cover" alt="" />
            </div>
            {!user.isBlocked && (
              <div className="absolute bottom-1 right-1 bg-[#8BC34A] w-7 h-7 rounded-full border-4 border-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-white text-[14px] font-black">check</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 justify-center">
            {isEditing ? (
              <input 
                className="text-[22px] font-black text-text-dark bg-white border-none rounded-xl px-4 py-1 text-center outline-none focus:ring-1 focus:ring-primary shadow-inner max-w-[200px]" 
                value={editForm.name} 
                onChange={e => setEditForm({...editForm, name: e.target.value})}
              />
            ) : (
              <h2 className="text-[22px] font-black text-text-dark tracking-tight leading-none">{user.name}</h2>
            )}
            <span className="bg-[#EDE7F6] text-primary text-[9px] font-black px-2 py-1 rounded uppercase tracking-tighter">PRO</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 px-2">
          {[
            { label: isEditing ? 'Cancel' : 'Edit', icon: isEditing ? 'close' : 'edit', onClick: () => setIsEditing(!isEditing), active: isEditing },
            { label: user.isBlocked ? 'Restore' : 'Suspend', icon: 'block', onClick: handleToggleSuspend, active: user.isBlocked },
            { label: 'Message', icon: 'chat_bubble', onClick: () => navigate(`/messages/${user.id}`) },
            { label: isEditing ? 'Confirm' : 'Reset', icon: isEditing ? 'check_circle' : 'history', onClick: isEditing ? handleSave : handleSendReset, primary: isEditing, loading: isSendingReset },
          ].map((btn) => (
            <button key={btn.label} onClick={btn.onClick} disabled={btn.loading} className="flex flex-col items-center gap-2.5">
              <div className={`w-14 h-14 rounded-2xl shadow-sm flex items-center justify-center border border-white transition-all active:scale-90 ${btn.active ? 'bg-primary/5 border-primary text-primary' : btn.primary ? 'bg-primary border-primary text-white shadow-xl' : 'bg-white text-text-dark'}`}>
                {btn.loading ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-[24px]">{btn.icon}</span>}
              </div>
              <span className="text-[11px] font-bold text-gray-400">{btn.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-white flex flex-col items-start min-h-[110px]">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">TOTAL <br/> QUOTES SENT</p>
            <p className="text-[26px] font-black text-text-dark tracking-tighter">{stats.quotesSent}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-white flex flex-col items-start min-h-[110px]">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">% OF <br/> ACCEPTED</p>
            <div className="flex items-baseline gap-1">
               <p className="text-[26px] font-black text-text-dark tracking-tighter">{stats.conversion.replace('%', '')}</p>
               <p className="text-xs font-bold text-gray-400">%</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-white flex flex-col items-start min-h-[110px]">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">TOTAL HRS <br/> SPEND</p>
            <div className="flex items-baseline gap-1">
               <p className="text-[26px] font-black text-text-dark tracking-tighter">{stats.hours}</p>
               <p className="text-[9px] font-bold text-gray-400">HRS</p>
            </div>
          </div>
        </div>

        <section className="space-y-4">
           <div className="flex items-center gap-2 px-1">
              <span className="material-symbols-outlined text-primary text-[20px]">person</span>
              <h3 className="text-[15px] font-bold text-text-dark">Personal Details</h3>
           </div>
           <div className="bg-white rounded-[2.2rem] shadow-sm border border-white divide-y divide-gray-50 overflow-hidden">
              <div className="p-5 flex items-center justify-between group">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Address</p>
                  <p className="text-[14px] font-bold text-text-dark">{user.email}</p>
                </div>
                <button onClick={() => copyToClipboard(user.email)} className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[20px]">content_copy</span>
                </button>
              </div>

              <div className="p-5 flex items-center justify-between group">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phone Number</p>
                  <div className="flex items-center gap-2">
                    <img src="https://flagcdn.com/w20/ae.png" className="w-4 h-3 object-cover rounded-[1px] shadow-xs" alt="" />
                    <p className="text-[14px] font-bold text-text-dark">{user.phone || '---'}</p>
                  </div>
                </div>
                <button className="w-10 h-10 flex items-center justify-center text-gray-300">
                  <span className="material-symbols-outlined text-[20px]">call</span>
                </button>
              </div>

              <div className="grid grid-cols-2">
                <div className="p-5 border-r border-gray-50 space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nationality</p>
                  <p className="text-[14px] font-bold text-text-dark uppercase">{user.nationality || '---'}</p>
                </div>
                <div className="p-5 space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Language</p>
                  <p className="text-[14px] font-bold text-text-dark">---</p>
                </div>
              </div>
           </div>
        </section>

        <section className="space-y-4">
           <div className="flex items-center gap-2 px-1">
              <span className="material-symbols-outlined text-primary text-[20px]">balance</span>
              <h3 className="text-[15px] font-bold text-text-dark">Account Data</h3>
           </div>
           <div className="bg-white rounded-[2.2rem] shadow-sm border border-white p-6 space-y-8">
              <div className="grid grid-cols-2 gap-y-8">
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">User ID</p>
                   <div className="flex items-center gap-1">
                      <p className="text-[14px] font-bold text-text-dark">#{user.id.substring(0, 6).toUpperCase()}</p>
                      <button onClick={() => copyToClipboard(user.id)} className="material-symbols-outlined text-[14px] text-gray-300">content_copy</button>
                   </div>
                 </div>
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Account Type</p>
                   <p className="text-[14px] font-bold text-text-dark">Provider</p>
                 </div>
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Registration Date</p>
                   <p className="text-[14px] font-bold text-text-dark">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '---'}</p>
                   <p className="text-[10px] font-medium text-gray-300">{user.createdAt ? new Date(user.createdAt).toLocaleTimeString('en-US', { hour12: false }) : ''} GST</p>
                 </div>
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Last Login</p>
                   <p className="text-[14px] font-bold text-text-dark">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '---'}</p>
                   <p className="text-[10px] font-medium text-gray-300">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleTimeString('en-US', { hour12: false }) : ''} GST</p>
                 </div>
              </div>
           </div>
        </section>

        <section className="space-y-4">
           <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">history</span>
                <h3 className="text-[15px] font-bold text-text-dark">Activity Log</h3>
              </div>
              <button className="text-[11px] font-bold text-primary uppercase tracking-wider">View All</button>
           </div>
           
           <div className="bg-white rounded-[2.2rem] shadow-sm border border-white p-6 space-y-6">
              {activityLog.length > 0 ? activityLog.map((log, idx) => (
                <div key={idx} className="flex gap-4 relative">
                   {idx !== activityLog.length - 1 && <div className="absolute left-[11px] top-6 bottom-[-10px] w-[2px] bg-gray-50"></div>}
                   <div className={`w-6 h-6 rounded-full ${log.color} flex items-center justify-center shrink-0 z-10 border-2 border-white shadow-xs`}>
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-white"></div>
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <h4 className="text-[14px] font-bold text-text-dark">{log.title}</h4>
                        <span className="text-[10px] font-bold text-gray-300 uppercase">{log.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-[12px] text-gray-400 font-medium leading-relaxed">{log.desc}</p>
                   </div>
                </div>
              )) : (
                <p className="text-center text-[11px] text-gray-300 font-bold uppercase py-4">No recent activity detected</p>
              )}
           </div>
        </section>

        <button 
          onClick={() => { if(window.confirm("PERMANENTLY PURGE THIS ACCOUNT?")) dataService.deleteUser(user.id).then(() => navigate('/admin/users')); }}
          className="w-full py-4.5 bg-white border border-gray-100 text-red-500 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xs"
        >
          <span className="material-symbols-outlined text-[18px] font-black text-red-500">delete</span>
          Delete User Account
        </button>
      </main>
    </div>
  );
};

export default ProviderDetails;