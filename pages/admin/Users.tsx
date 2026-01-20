import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, UserRole, ProviderRequest } from '../../types';
import { dataService } from '../services/dataService';
import { authService } from '../authService';
import { useApp } from '../../App';

type SortOption = 'Recent' | 'Old' | 'Most Active';

const AdminUsers: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast, unreadCount, toggleNotifications } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(location.state?.initialTab || 'All');
  const [usersList, setUsersList] = useState<User[]>([]);
  const [providerRequests, setProviderRequests] = useState<ProviderRequest[]>([]);
  const [sortMethod, setSortMethod] = useState<SortOption>('Recent');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isLive, setIsLive] = useState(false);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    uid: '',
    name: '',
    email: '',
    role: UserRole.PROVIDER, // Default to Provider as per user workflow
    phone: '',
    locationName: 'Dubai, UAE'
  });

  useEffect(() => {
    const unsubUsers = dataService.listenToUsers((uList) => {
      setUsersList([...uList]);
      setIsLive(true);
      setTimeout(() => setIsLive(false), 2000);
    });

    const unsubRequests = dataService.listenToProviderRequests((rList) => {
      setProviderRequests([...rList]);
    });

    return () => {
      unsubUsers();
      unsubRequests();
    };
  }, []);

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.uid) {
      showToast("UID, Name and Email are required", "error");
      return;
    }
    setIsCreating(true);
    try {
      const userToCreate: User = {
        id: newUser.uid, // Linking directly to the Auth UID created manually
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
        locationName: newUser.locationName,
        location: { lat: 25.185, lng: 55.275 }, 
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newUser.name)}&background=5B3D9D&color=fff`,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      await dataService.saveUser(userToCreate);
      showToast("Profile created and linked to UID", "success");
      setIsCreateModalOpen(false);
      setNewUser({ uid: '', name: '', email: '', role: UserRole.PROVIDER, phone: '', locationName: 'Dubai, UAE' });
    } catch (err) {
      showToast("Failed to create user record", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendReset = async (email: string) => {
    try {
      await authService.resetPassword(email);
      showToast(`Reset link sent to ${email}`, "success");
    } catch (err) {
      showToast("Failed to send reset link", "error");
    }
  };

  const filteredAndSortedItems = useMemo(() => {
    if (activeTab === 'Requests') {
      const filtered = providerRequests.filter(req => {
        const searchLower = (searchQuery || '').toLowerCase();
        return (req.businessName || '').toLowerCase().includes(searchLower) ||
               (req.email || '').toLowerCase().includes(searchLower) ||
               (req.contactPerson || '').toLowerCase().includes(searchLower);
      });
      return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const filtered = usersList.filter(user => {
      const searchLower = (searchQuery || '').toLowerCase();
      const matchesSearch = (user.name || '').toLowerCase().includes(searchLower) || 
                            (user.email || '').toLowerCase().includes(searchLower);
                            
      const roleMap: any = { 'Providers': UserRole.PROVIDER, 'Customers': UserRole.CUSTOMER };
      const matchesTab = activeTab === 'All' || (activeTab === 'Blocked' && user.isBlocked) || (user.role === roleMap[activeTab]);
      return matchesSearch && matchesTab;
    });

    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      const loginA = new Date(a.lastLoginAt || 0).getTime();
      const loginB = new Date(b.lastLoginAt || 0).getTime();
      switch (sortMethod) {
        case 'Recent': return dateB - dateA;
        case 'Old': return dateA - dateB;
        case 'Most Active': return loginB - loginA;
        default: return 0;
      }
    });
  }, [usersList, providerRequests, searchQuery, activeTab, sortMethod]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return { date: 'NEVER', time: '' };
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };
  };

  return (
    <div className="flex flex-col min-h-screen pb-32 bg-transparent">
      <header className="px-6 pt-10 pb-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="w-10 h-10 flex items-center justify-center -ml-2 rounded-full active:bg-gray-100 transition-colors">
               <span className="material-symbols-outlined font-black text-[24px]">arrow_back</span>
            </button>
            <h1 className="text-[22px] font-bold text-[#333333]">Directory</h1>
            <div className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-100 rounded-full shadow-sm ml-2">
               <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-primary animate-ping' : 'bg-accent-green'}`}></div>
               <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Live</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-gray-100 active:scale-95 transition-transform">
              <span className="material-symbols-outlined text-text-dark text-xl font-normal">notifications</span>
              {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-accent-pink rounded-full border-2 border-white shadow-sm"></div>}
            </button>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="w-11 h-11 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-purple-100 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined font-bold">person_add</span>
            </button>
          </div>
        </div>

        <div className="relative mb-6">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#888888] text-xl">search</span>
          <input type="text" placeholder="Search name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-[#E0E0E0] py-4 pl-12 pr-4 rounded-2xl shadow-sm text-sm font-medium focus:ring-1 focus:ring-primary outline-none" />
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar pb-1">
          {['All', 'Requests', 'Providers', 'Customers', 'Blocked'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2 rounded-full text-sm font-bold transition-all border shrink-0 ${activeTab === tab ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-[#888888] border-[#E0E0E0]'}`}>
              {tab}
            </button>
          ))}
        </div>

        <div className="flex justify-between items-center px-1 mb-4 relative">
          <h3 className="text-[11px] font-bold text-[#888888] uppercase tracking-widest">{activeTab === 'Requests' ? 'Applications' : 'Records'}</h3>
          <button onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} className={`flex items-center gap-1 text-[11px] font-bold transition-colors ${isSortMenuOpen ? 'text-primary' : 'text-[#888888]'}`}>
            <span className="material-symbols-outlined text-[16px]">sort</span>{sortMethod}
          </button>
          {isSortMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsSortMenuOpen(false)}></div>
              <div className="absolute right-0 top-6 mt-2 w-40 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95">
                {(['Recent', 'Old', 'Most Active'] as SortOption[]).map((option) => (
                  <button key={option} onClick={() => { setSortMethod(option); setIsSortMenuOpen(false); }} className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center justify-between ${sortMethod === option ? 'text-primary bg-primary/5' : 'text-[#555555]'}`}>
                    {option} {sortMethod === option && <span className="material-symbols-outlined text-sm font-black">check</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 pb-10">
        <div className="bg-white rounded-3xl shadow-card border border-[#E0E0E0] overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr] px-6 py-4 border-b border-[#F0F0F0] bg-gray-50/30">
            <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">{activeTab === 'Requests' ? 'ENTITY' : 'USER'}</span>
            <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider text-center">ACCESS</span>
            <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider text-right">DATE</span>
          </div>
          <div className="divide-y divide-[#F0F0F0]">
            {activeTab === 'Requests' ? (
              (filteredAndSortedItems as ProviderRequest[]).map((req) => {
                const { date, time } = formatDate(req.createdAt);
                return (
                  <div key={req.id} onClick={() => navigate(`/admin/provider-request/${req.id}`)} className="grid grid-cols-[2fr_1fr_1fr] items-center px-6 py-5 active:bg-[#F9F9F9] transition-colors cursor-pointer animate-in fade-in duration-300">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shrink-0"><span className="material-symbols-outlined">storefront</span></div>
                      <div className="min-w-0"><h4 className="text-[13px] font-bold text-[#333333] truncate uppercase">{req.businessName}</h4><p className="text-[10px] text-[#888888] truncate font-medium">{req.contactPerson}</p></div>
                    </div>
                    <div className="flex justify-center"><span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${req.status === 'PENDING' ? 'bg-[#FFF9E5] text-[#FFB100]' : req.status === 'APPROVED' ? 'bg-[#F0F9EB] text-[#8BC34A]' : 'bg-red-50 text-red-500'}`}>{req.status}</span></div>
                    <div className="text-right"><p className="text-[10px] font-bold text-[#333333] uppercase">{date}</p></div>
                  </div>
                );
              })
            ) : (
              (filteredAndSortedItems as User[]).map((user) => {
                const { date, time } = formatDate(user.createdAt);
                return (
                  <div key={user.id} onClick={() => navigate(`/admin/user/${user.id}`)} className="grid grid-cols-[2fr_1fr_1fr] items-center px-6 py-5 active:bg-[#F9F9F9] transition-colors cursor-pointer animate-in fade-in duration-300">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="relative shrink-0"><img src={user.avatar} className="w-11 h-11 rounded-full object-cover border border-[#E0E0E0]" alt="" /><div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${user.isBlocked ? 'bg-[#EF4444]' : 'bg-[#22C55E]'}`}></div></div>
                      <div className="min-w-0"><h4 className="text-[13px] font-bold text-[#333333] truncate uppercase">{user.name}</h4><p className="text-[10px] text-[#888888] truncate font-medium lowercase">{user.email}</p></div>
                    </div>
                    <div className="flex justify-center">
                       <button 
                        onClick={(e) => { e.stopPropagation(); handleSendReset(user.email); }}
                        className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-primary transition-colors active:scale-90"
                        title="Send Reset Email"
                       >
                         <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                       </button>
                    </div>
                    <div className="text-right"><p className="text-[10px] font-bold text-[#333333] uppercase whitespace-nowrap">{date}</p></div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl font-black">badge</span>
              </div>
              <h3 className="text-lg font-bold text-text-dark tracking-tight leading-tight">Manual Account Link</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">Link manually created Auth users</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Firebase UID (From Console)</label>
                <input 
                  type="text" 
                  placeholder="Paste UID here" 
                  className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-[13px] font-bold shadow-inner focus:ring-1 focus:ring-primary outline-none" 
                  value={newUser.uid} 
                  onChange={e => setNewUser({...newUser, uid: e.target.value})} 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Account Role</label>
                <div className="flex bg-gray-50 p-1 rounded-2xl">
                   <button onClick={() => setNewUser({...newUser, role: UserRole.PROVIDER})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newUser.role === UserRole.PROVIDER ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}`}>Provider</button>
                   <button onClick={() => setNewUser({...newUser, role: UserRole.CUSTOMER})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newUser.role === UserRole.CUSTOMER ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}`}>Customer</button>
                </div>
              </div>
              
              <div className="space-y-4">
                <input type="text" placeholder="Full Legal Name" className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-[13px] font-bold shadow-inner focus:ring-1 focus:ring-primary outline-none" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                <input type="email" placeholder="Email Address" className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-[13px] font-bold shadow-inner focus:ring-1 focus:ring-primary outline-none" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-4 text-xs font-bold text-gray-400 bg-gray-50 rounded-2xl active:scale-95 transition-transform">Cancel</button>
              <button onClick={handleCreateUser} disabled={isCreating} className="flex-1 py-4 bg-primary text-white text-xs font-bold rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center">
                 {isCreating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Link Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white border-t border-gray-100 pb-8 pt-3 px-4 flex justify-between items-center z-50 shadow-[0_-10px_40_rgba(0,0,0,0.05)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1 text-[#888888]">
          <span className="material-symbols-outlined text-[26px]">grid_view</span>
          <span className="text-[10px] uppercase tracking-tighter">HOME</span>
        </button>
        <button onClick={() => navigate('/admin/users')} className="flex-1 flex flex-col items-center gap-1 text-primary">
          <span className="material-symbols-outlined text-[26px]">group</span>
          <span className="text-[10px] uppercase tracking-tighter">USERS</span>
        </button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1 text-[#888888]">
          <span className="material-symbols-outlined text-[26px]">format_list_bulleted</span>
          <span className="text-[10px] uppercase tracking-tighter">QUERIES</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1 text-[#888888]">
          <span className="material-symbols-outlined text-[26px]">settings</span>
          <span className="text-[10px] uppercase tracking-tighter">SYSTEM</span>
        </button>
      </nav>
    </div>
  );
};

export default AdminUsers;