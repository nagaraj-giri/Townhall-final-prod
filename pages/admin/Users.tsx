import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, UserRole } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

type SortOption = 'Recent' | 'Old' | 'Most Active';

const AdminUsers: React.FC = () => {
  const navigate = useNavigate();
  const { showToast, unreadCount, toggleNotifications } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [usersList, setUsersList] = useState<User[]>([]);
  const [sortMethod, setSortMethod] = useState<SortOption>('Recent');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    uid: '',
    name: '',
    email: '',
    role: UserRole.PROVIDER,
    phone: '',
    locationName: 'Dubai, UAE'
  });

  useEffect(() => {
    const unsubUsers = dataService.listenToUsers((uList) => {
      setUsersList([...uList]);
    });
    return () => unsubUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.uid) {
      showToast("UID, Name and Email are required", "error");
      return;
    }
    setIsCreating(true);
    try {
      const userToCreate: User = {
        id: newUser.uid,
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

  const filteredAndSortedItems = useMemo(() => {
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
  }, [usersList, searchQuery, activeTab, sortMethod]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'NEVER';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  };

  return (
    <div className="flex flex-col min-h-screen pb-32 bg-transparent">
      <header className="px-6 pt-12 pb-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-text-dark active:scale-90 transition-transform">
               <span className="material-symbols-outlined font-bold text-[28px]">arrow_back</span>
            </button>
            <h1 className="text-[26px] font-[900] text-[#333333] tracking-tight uppercase">Directory</h1>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-100 rounded-full shadow-sm ml-1 h-7">
               <div className="w-1.5 h-1.5 rounded-full bg-[#8BC34A] animate-pulse"></div>
               <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Live</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 bg-white rounded-full shadow-sm flex items-center justify-center border border-gray-100 active:scale-95 transition-transform">
              <span className="material-symbols-outlined text-text-dark text-xl font-normal">notifications</span>
              {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white"></div>}
            </button>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="w-11 h-11 bg-primary rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined font-bold text-xl">person_add</span>
            </button>
          </div>
        </div>

        <div className="relative mb-6">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#888888] text-xl">search</span>
          <input 
            type="text" 
            placeholder="Search name or email..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full bg-white border-none py-4.5 pl-12 pr-4 rounded-2xl shadow-card text-[13px] font-medium text-text-dark outline-none focus:ring-1 focus:ring-primary transition-all placeholder-gray-400" 
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {['All', 'Providers', 'Customers', 'Blocked'].map((tab) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={`px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab 
                ? 'bg-primary text-white shadow-lg' 
                : 'bg-white text-gray-400 border border-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-4">
        <div className="flex justify-between items-center px-2 mb-4">
          <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Active Records</h3>
          <div className="relative">
            <button 
              onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} 
              className="flex items-center gap-1.5 text-[11px] font-black text-gray-400 uppercase tracking-widest active:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">sort</span>
              {sortMethod}
            </button>
            {isSortMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsSortMenuOpen(false)}></div>
                <div className="absolute right-0 top-7 w-40 bg-white rounded-2xl shadow-2xl border border-gray-50 py-2 z-50 animate-in fade-in zoom-in-95">
                  {(['Recent', 'Old', 'Most Active'] as SortOption[]).map((option) => (
                    <button key={option} onClick={() => { setSortMethod(option); setIsSortMenuOpen(false); }} className={`w-full px-4 py-2.5 text-left text-[11px] font-black uppercase tracking-widest ${sortMethod === option ? 'text-primary bg-primary/5' : 'text-gray-500'}`}>
                      {option}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-card border border-white overflow-hidden mb-12">
          <div className="grid grid-cols-[2.5fr_1fr_1.2fr] px-6 py-4.5 border-b border-gray-50 bg-gray-50/20">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">User Identity</span>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Access</span>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Registered</span>
          </div>

          <div className="divide-y divide-gray-50">
            {filteredAndSortedItems.map((user) => (
              <div 
                key={user.id} 
                onClick={() => navigate(`/admin/user/${user.id}`)} 
                className="grid grid-cols-[2.5fr_1fr_1.2fr] items-center px-6 py-5 active:bg-gray-50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <img 
                      src={user.avatar} 
                      className="w-11 h-11 rounded-full object-cover border border-gray-100 shadow-sm" 
                      alt="" 
                      onError={(e) => (e.currentTarget.src = 'https://ui-avatars.com/api/?name=User&background=5B3D9D&color=fff')}
                    />
                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${user.isBlocked ? 'bg-red-500' : 'bg-accent-green'}`}></div>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-black text-text-dark truncate uppercase tracking-tight leading-none mb-1.5">{user.name}</h4>
                    <p className="text-[10px] text-gray-400 truncate font-medium lowercase tracking-tight">{user.email}</p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate(`/admin/user/${user.id}`); }}
                    className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-300 hover:text-primary transition-all active:scale-90 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px]">history</span>
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-[900] text-text-dark uppercase tracking-tight">{formatDate(user.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
          
          {filteredAndSortedItems.length === 0 && (
            <div className="py-24 text-center opacity-20">
               <span className="material-symbols-outlined text-6xl">inventory_2</span>
               <p className="text-[10px] font-black uppercase tracking-[0.4em] mt-4">No records found</p>
            </div>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 border-t border-gray-100 pb-10 pt-4 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.06)] backdrop-blur-md">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-30 transition-all">
          <div className="w-12 h-10 flex items-center justify-center rounded-2xl"><span className="material-symbols-outlined text-[28px] font-normal">grid_view</span></div>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">HOME</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-2xl"><span className="material-symbols-outlined text-[28px] font-normal">group</span></div>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">USERS</span>
        </button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1 text-text-light opacity-30 transition-all">
          <div className="w-12 h-10 flex items-center justify-center rounded-2xl"><span className="material-symbols-outlined text-[28px] font-normal">format_list_bulleted</span></div>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">QUERIES</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1 text-text-light opacity-30 transition-all">
          <div className="w-12 h-10 flex items-center justify-center rounded-2xl"><span className="material-symbols-outlined text-[28px] font-normal">settings</span></div>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">SYSTEM</span>
        </button>
      </nav>
    </div>
  );
};

export default AdminUsers;