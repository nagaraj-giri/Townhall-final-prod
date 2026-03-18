import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserRole, ServiceCategory } from '../../types';
import { dataService } from '../../services/dataService';
import { useApp } from '../../App';

type SortOption = 'Rating' | 'Name' | 'Recent' | 'Views';

const AdminProviders: React.FC = () => {
  const navigate = useNavigate();
  const { showToast, unreadCount, toggleNotifications } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState('All Services');
  const [providersList, setProvidersList] = useState<User[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [sortMethod, setSortMethod] = useState<SortOption>('Recent');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubUsers = dataService.listenToUsers((uList) => {
      const providers = uList.filter(u => u.role === UserRole.PROVIDER);
      setProvidersList(providers);
      setIsLoading(false);
    });

    const unsubCats = dataService.listenToCategories((catList) => {
      setCategories(catList);
    });

    return () => {
      unsubUsers();
      unsubCats();
    };
  }, []);

  const filteredAndSortedItems = useMemo(() => {
    const filtered = providersList.filter(user => {
      const searchLower = (searchQuery || '').toLowerCase();
      const matchesSearch = (user.name || '').toLowerCase().includes(searchLower) || 
                            (user.email || '').toLowerCase().includes(searchLower);
                            
      const matchesService = selectedService === 'All Services' || 
                             (user.services && user.services.includes(selectedService));
      
      return matchesSearch && matchesService;
    });

    return [...filtered].sort((a, b) => {
      switch (sortMethod) {
        case 'Recent': 
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'Name': 
          return (a.name || '').localeCompare(b.name || '');
        case 'Rating': 
          return (b.rating || 0) - (a.rating || 0);
        case 'Views': 
          return (b.profileViews || 0) - (a.profileViews || 0);
        default: return 0;
      }
    });
  }, [providersList, searchQuery, selectedService, sortMethod]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'NEVER';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  };

  return (
    <div className="flex flex-col min-h-screen pb-32 bg-[#FAF9F6]">
      <header className="px-6 pt-12 pb-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-text-dark active:scale-90 transition-transform">
               <span className="material-symbols-outlined wght-700 text-[28px]">arrow_back</span>
            </button>
            <h1 className="text-[26px] font-[900] text-[#333333] tracking-tight uppercase">Providers</h1>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-100 rounded-full shadow-sm ml-1 h-7">
               <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
               <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{providersList.length} Active</span>
            </div>
          </div>
          <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 bg-white rounded-full shadow-sm flex items-center justify-center border border-gray-100 active:scale-95 transition-transform">
            <span className="material-symbols-outlined text-text-dark text-xl wght-700">notifications</span>
            {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white"></div>}
          </button>
        </div>

        <div className="relative mb-6">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#888888] text-xl">search</span>
          <input 
            type="text" 
            placeholder="Search providers..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full bg-white border-none py-4.5 pl-12 pr-4 rounded-2xl shadow-card text-[13px] font-medium text-text-dark outline-none focus:ring-1 focus:ring-primary transition-all placeholder-gray-400" 
          />
        </div>

        <div className="flex gap-3 mb-2">
          {/* Service Filter */}
          <div className="relative flex-1">
            <button 
              onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
              className="w-full bg-white px-4 py-3 rounded-xl border border-gray-100 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-text-dark shadow-sm"
            >
              <span className="truncate">{selectedService}</span>
              <span className="material-symbols-outlined text-lg">filter_list</span>
            </button>
            {isFilterMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsFilterMenuOpen(false)}></div>
                <div className="absolute left-0 top-14 w-full max-h-64 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-50 py-2 z-50 animate-in fade-in zoom-in-95">
                  <button 
                    onClick={() => { setSelectedService('All Services'); setIsFilterMenuOpen(false); }}
                    className={`w-full px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest ${selectedService === 'All Services' ? 'text-primary bg-primary/5' : 'text-gray-500'}`}
                  >
                    All Services
                  </button>
                  {categories.map((cat) => (
                    <button 
                      key={cat.id} 
                      onClick={() => { setSelectedService(cat.name); setIsFilterMenuOpen(false); }}
                      className={`w-full px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest ${selectedService === cat.name ? 'text-primary bg-primary/5' : 'text-gray-500'}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Sort Menu */}
          <div className="relative flex-1">
            <button 
              onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
              className="w-full bg-white px-4 py-3 rounded-xl border border-gray-100 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-text-dark shadow-sm"
            >
              <span>Sort: {sortMethod}</span>
              <span className="material-symbols-outlined text-lg">sort</span>
            </button>
            {isSortMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsSortMenuOpen(false)}></div>
                <div className="absolute right-0 top-14 w-full bg-white rounded-2xl shadow-2xl border border-gray-50 py-2 z-50 animate-in fade-in zoom-in-95">
                  {(['Recent', 'Name', 'Rating', 'Views'] as SortOption[]).map((option) => (
                    <button 
                      key={option} 
                      onClick={() => { setSortMethod(option); setIsSortMenuOpen(false); }}
                      className={`w-full px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest ${sortMethod === option ? 'text-primary bg-primary/5' : 'text-gray-500'}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4">
        <div className="bg-white rounded-[2.5rem] shadow-card border border-white overflow-hidden mb-12">
          <div className="grid grid-cols-[3fr_1fr_1fr] px-6 py-4.5 border-b border-gray-50 bg-gray-50/20">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Provider Details</span>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Rating</span>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Views</span>
          </div>

          <div className="divide-y divide-gray-50">
            {filteredAndSortedItems.map((user) => (
              <div 
                key={user.id} 
                onClick={() => navigate(`/admin/user/${user.id}`)} 
                className="grid grid-cols-[3fr_1fr_1fr] items-center px-6 py-5 active:bg-gray-50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <img 
                      src={user.avatar} 
                      className="w-12 h-12 rounded-2xl object-cover border border-gray-100 shadow-sm" 
                      alt="" 
                      onError={(e) => (e.currentTarget.src = 'https://ui-avatars.com/api/?name=User&background=5B3D9D&color=fff')}
                    />
                    {user.isVerified && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full border-2 border-white flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-[10px] wght-700">verified</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-black text-text-dark truncate uppercase tracking-tight leading-none mb-1.5">{user.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded-md">
                        {user.services?.[0] || 'No Service'}
                      </span>
                      {user.services && user.services.length > 1 && (
                        <span className="text-[9px] font-black text-primary uppercase tracking-widest">
                          +{user.services.length - 1} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-amber-400 text-sm fill-1">star</span>
                    <span className="text-[12px] font-black text-text-dark">{user.rating?.toFixed(1) || '5.0'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-black text-text-dark uppercase tracking-tight tabular-nums">{user.profileViews || 0}</p>
                  <p className="text-[8px] font-normal text-gray-400 uppercase tracking-widest">Total Views</p>
                </div>
              </div>
            ))}
          </div>
          
          {filteredAndSortedItems.length === 0 && (
            <div className="py-24 text-center opacity-20">
               <span className="material-symbols-outlined text-6xl">person_search</span>
               <p className="text-[10px] font-black uppercase tracking-[0.4em] mt-4">No providers found</p>
            </div>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 border-t border-gray-100 pb-10 pt-4 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.06)] backdrop-blur-md">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-30 transition-all">
          <div className="w-12 h-10 flex items-center justify-center rounded-2xl"><span className="material-symbols-outlined text-[28px] wght-700">grid_view</span></div>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">HOME</span>
        </button>
        <button onClick={() => navigate('/admin/users')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-30 transition-all">
          <div className="w-12 h-10 flex items-center justify-center rounded-2xl"><span className="material-symbols-outlined text-[28px] wght-700">group</span></div>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">USERS</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-2xl"><span className="material-symbols-outlined text-[28px] wght-700">storefront</span></div>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">EXPERTS</span>
        </button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1 text-text-light opacity-30 transition-all">
          <div className="w-12 h-10 flex items-center justify-center rounded-2xl"><span className="material-symbols-outlined text-[28px] wght-700">format_list_bulleted</span></div>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">QUERIES</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1 text-text-light opacity-30 transition-all">
          <div className="w-12 h-10 flex items-center justify-center rounded-2xl"><span className="material-symbols-outlined text-[28px] wght-700">settings</span></div>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">SYSTEM</span>
        </button>
      </nav>
    </div>
  );
};

export default AdminProviders;
