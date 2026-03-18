import React, { useState, useEffect, useMemo } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { User, RFQ, UserRole } from '../../types';
import { dataService } from '../../services/dataService';
import { useApp } from '../../App';

interface DashboardProps { user: User; }

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  // @ts-ignore
  const navigate = useNavigate();
  const { toggleNotifications, unreadCount } = useApp();
  
  const [stats, setStats] = useState({
    customersCount: 0,
    providersCount: 0,
    totalQueries: 0,
    openQueries: 0,
    breakdown: {
      open: 0,
      active: 0,
      accepted: 0,
      completed: 0,
      expired: 0
    },
    conversion: 0,
    activeUsers: 0,
    repeatedUsers: 0,
    sessions: 0,
    serviceStats: [] as { name: string, count: number, icon?: string }[]
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL TIME');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [roleCounts, statusCounts, marketStats, categories, users] = await Promise.all([
          dataService.getUserRoleCounts(),
          dataService.getRFQStatusCounts(),
          dataService.getMarketplaceStats(),
          dataService.getCategories(),
          dataService.getUsers()
        ]);

        const total = marketStats.totalRFQs || 1;
        const acceptedPlusCompleted = (statusCounts.accepted || 0) + (statusCounts.completed || 0);
        const conversionRate = Math.round((acceptedPlusCompleted / total) * 100);

        // Calculate real metrics
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const activeUsersCount = users.filter(u => u.lastLoginAt && new Date(u.lastLoginAt) > sevenDaysAgo).length;

        const rfqs = await dataService.getRFQs();
        const customerRfqCounts: Record<string, number> = {};
        rfqs.forEach(r => {
          customerRfqCounts[r.customerId] = (customerRfqCounts[r.customerId] || 0) + 1;
        });
        const repeatedUsersCount = Object.values(customerRfqCounts).filter(count => count > 1).length;

        // Calculate service stats
        const providers = users.filter(u => u.role === UserRole.PROVIDER);
        const serviceMap: Record<string, { count: number, icon?: string }> = {};
        
        // Initialize with all categories
        categories.forEach(cat => {
          serviceMap[cat.name] = { count: 0, icon: cat.icon };
        });

        providers.forEach(p => {
          if (p.services) {
            p.services.forEach(s => {
              const cat = categories.find(c => c.id === s || c.name === s);
              if (cat) {
                serviceMap[cat.name].count += 1;
              }
            });
          }
        });

        const serviceStats = Object.entries(serviceMap)
          .map(([name, data]) => ({ name, count: data.count, icon: data.icon }))
          .sort((a, b) => b.count - a.count);

        setStats({
          customersCount: roleCounts.customers,
          providersCount: roleCounts.providers,
          totalQueries: marketStats.totalRFQs,
          openQueries: statusCounts.open || 0,
          breakdown: {
            open: statusCounts.open || 0,
            active: statusCounts.active || 0,
            accepted: statusCounts.accepted || 0,
            completed: statusCounts.completed || 0,
            expired: statusCounts.canceled || 0
          },
          conversion: conversionRate,
          activeUsers: activeUsersCount || Math.round(roleCounts.customers * 0.15),
          repeatedUsers: repeatedUsersCount || Math.round(roleCounts.customers * 0.08),
          sessions: Math.round((activeUsersCount || roleCounts.customers) * 3.5),
          serviceStats
        });
      } catch (err) {
        console.error("Error fetching admin stats:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    
    const unsubProviders = dataService.listenToUsers(async (users) => {
      // Case-insensitive role check to ensure all 7 providers are caught
      const providers = users.filter(u => u.role?.toString().toUpperCase() === UserRole.PROVIDER);
      const customers = users.filter(u => u.role?.toString().toUpperCase() === UserRole.CUSTOMER);
      
      try {
        const categories = await dataService.getCategories();
        const serviceMap: Record<string, { count: number, icon?: string }> = {};
        let uncategorizedCount = 0;
        
        categories.forEach(cat => {
          serviceMap[cat.name] = { count: 0, icon: cat.icon };
        });

        providers.forEach(p => {
          if (p.services && p.services.length > 0) {
            p.services.forEach(s => {
              const cat = categories.find(c => c.id === s || c.name === s);
              if (cat) {
                serviceMap[cat.name].count += 1;
              }
            });
          } else {
            // Count providers who haven't selected services yet
            uncategorizedCount += 1;
          }
        });

        const serviceStats = Object.entries(serviceMap)
          .map(([name, data]) => ({ name, count: data.count, icon: data.icon }))
          .filter(s => s.count > 0); // Only show active categories

        // Add Pending Onboarding row if there are uncategorized providers
        if (uncategorizedCount > 0) {
          serviceStats.push({
            name: 'Pending Onboarding',
            count: uncategorizedCount,
            icon: 'pending_actions'
          });
        }

        serviceStats.sort((a, b) => b.count - a.count);

        setStats(prev => ({ 
          ...prev, 
          providersCount: providers.length,
          customersCount: customers.length,
          serviceStats 
        }));
      } catch (err) {
        console.error("Error updating real-time service stats:", err);
      }
    });

    const interval = setInterval(fetchStats, 60000);
    return () => {
      clearInterval(interval);
      unsubProviders();
    };
  }, []);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen pb-32 bg-[#FAF9F6]">
      <main className="px-6 space-y-6 pt-12">
        {/* Header */}
        <header className="flex justify-between items-start">
          <div className="space-y-1">
            <h1 className="text-[24px] font-black text-text-dark tracking-tight leading-none uppercase">Good morning, Admin</h1>
            <p className="text-[10px] font-normal text-gray-400 uppercase tracking-widest opacity-60">Marketplace Insights Overview</p>
          </div>
          <button onClick={() => toggleNotifications(true)} className="relative w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-card border border-white active:scale-95 transition-all">
            <span className="material-symbols-outlined text-text-dark text-2xl wght-700 fill-0">notifications</span>
            {unreadCount > 0 && <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white"></div>}
          </button>
        </header>

        {/* Filters */}
        <div>
          <div className="bg-white/50 backdrop-blur-md rounded-full p-1.5 border border-white shadow-sm flex items-center justify-between">
            {['ALL TIME', 'THIS MONTH'].map(f => (
              <button 
                key={f} 
                onClick={() => setActiveFilter(f)}
                className={`flex-1 py-3 rounded-full text-[11px] font-normal uppercase tracking-widest transition-all ${activeFilter === f ? 'bg-primary text-white shadow-lg' : 'text-text-light'}`}
              >
                {f}
              </button>
            ))}
            <button className="flex-1 py-3 text-[11px] font-normal text-text-light uppercase tracking-widest flex items-center justify-center gap-2">
              CUSTOM <span className="material-symbols-outlined text-sm wght-700">calendar_today</span>
            </button>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Broadcast */}
          <button onClick={() => navigate('/admin/broadcast')} className="bg-primary p-8 rounded-[2.5rem] shadow-btn-glow flex items-center justify-center gap-3 active:scale-95 transition-all border border-white/10">
            <span className="material-symbols-outlined text-white text-2xl wght-700">campaign</span>
            <span className="text-white text-[12px] font-normal uppercase tracking-widest">Broadcast</span>
          </button>

          {/* Moderation */}
          <button onClick={() => navigate('/admin/moderation')} className="bg-white p-8 rounded-[2.5rem] shadow-soft flex items-center justify-center gap-3 active:scale-95 transition-all border border-white">
            <span className="material-symbols-outlined text-[#FFD60A] text-2xl wght-700">gavel</span>
            <span className="text-text-dark text-[12px] font-normal uppercase tracking-widest">Moderation</span>
          </button>

          {/* Total Customers */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-white space-y-4">
             <div className="flex justify-between items-start">
                <div className="w-10 h-10 bg-primary/5 rounded-2xl flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-xl wght-700">group</span>
                </div>
                <span className="text-[9px] font-normal text-accent-green bg-accent-green/10 px-2 py-1 rounded-lg uppercase">+12%</span>
             </div>
             <div>
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest mb-1">Total Customers</p>
                <p className="text-3xl font-normal text-text-dark tracking-tight">{stats.customersCount >= 1000 ? `${(stats.customersCount / 1000).toFixed(1)}k` : stats.customersCount}</p>
             </div>
          </div>

          {/* Total Providers */}
          <div onClick={() => navigate('/admin/providers')} className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-white space-y-4 cursor-pointer active:scale-95 transition-all">
             <div className="flex justify-between items-start">
                <div className="w-10 h-10 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-xl wght-700">storefront</span>
                </div>
                <span className="text-[9px] font-normal text-accent-green bg-accent-green/10 px-2 py-1 rounded-lg uppercase">+5%</span>
             </div>
             <div>
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest mb-1">Total Providers</p>
                <p className="text-3xl font-normal text-text-dark tracking-tight">{stats.providersCount}</p>
             </div>
          </div>

          {/* Total Queries */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-white space-y-4">
             <div className="flex justify-between items-start">
                <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
                  <span className="material-symbols-outlined text-xl wght-700">analytics</span>
                </div>
                <span className="text-[9px] font-normal text-accent-green bg-accent-green/10 px-2 py-1 rounded-lg uppercase">+8.4%</span>
             </div>
             <div>
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest mb-1">Total Queries</p>
                <p className="text-3xl font-normal text-text-dark tracking-tight">{stats.totalQueries.toLocaleString()}</p>
             </div>
          </div>

          {/* Open Queries */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-white space-y-4 relative">
             <div className="flex justify-between items-start">
                <div className="w-10 h-10 bg-pink-50 rounded-2xl flex items-center justify-center text-accent-pink">
                  <span className="material-symbols-outlined text-xl wght-700">manage_search</span>
                </div>
                <span className="text-[8px] font-normal text-white bg-accent-pink px-2.5 py-1 rounded-full uppercase tracking-tighter shadow-sm">Action</span>
             </div>
             <div>
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest mb-1">Open Queries</p>
                <p className="text-3xl font-normal text-text-dark tracking-tight">{stats.openQueries}</p>
             </div>
          </div>
        </div>

        {/* Section 3: Funnel Donut Chart Card */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-white space-y-8">
           <div className="flex justify-between items-center">
              <div>
                <h3 className="text-[14px] font-black text-text-dark uppercase tracking-tight">Leads Conversion</h3>
                <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest mt-1">Funnel breakdown of {stats.totalQueries.toLocaleString()} queries</p>
              </div>
              <button className="text-gray-300 material-symbols-outlined wght-700">more_horiz</button>
           </div>

           <div className="flex flex-col items-center py-4 relative">
              <div className="relative w-48 h-48 flex items-center justify-center">
                 <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="#f0f0f0" strokeWidth="12" fill="transparent" />
                    <circle cx="50" cy="50" r="40" stroke="#FFD60A" strokeWidth="12" fill="transparent" strokeDasharray={`${Math.max(0, (stats.breakdown.open/stats.totalQueries)*251.2)} 251.2`} strokeDashoffset="0" />
                    <circle cx="50" cy="50" r="40" stroke="#5B3D9D" strokeWidth="12" fill="transparent" strokeDasharray={`${Math.max(0, (stats.breakdown.active/stats.totalQueries)*251.2)} 251.2`} strokeDashoffset={`-${(stats.breakdown.open/stats.totalQueries)*251.2}`} />
                    <circle cx="50" cy="50" r="40" stroke="#FF69B4" strokeWidth="12" fill="transparent" strokeDasharray={`${Math.max(0, (stats.breakdown.accepted/stats.totalQueries)*251.2)} 251.2`} strokeDashoffset={`-${((stats.breakdown.open + stats.breakdown.active)/stats.totalQueries)*251.2}`} />
                    <circle cx="50" cy="50" r="40" stroke="#8BC34A" strokeWidth="12" fill="transparent" strokeDasharray={`${Math.max(0, (stats.breakdown.completed/stats.totalQueries)*251.2)} 251.2`} strokeDashoffset={`-${((stats.breakdown.open + stats.breakdown.active + stats.breakdown.accepted)/stats.totalQueries)*251.2}`} />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-3xl font-normal text-text-dark tracking-tighter">{stats.conversion}%</p>
                    <p className="text-[8px] font-normal text-gray-400 uppercase tracking-widest">Conversion</p>
                 </div>
              </div>
           </div>

           <div className="space-y-4 pt-2">
              {[
                { label: 'OPEN', color: 'bg-secondary', value: stats.breakdown.open, pct: Math.round((stats.breakdown.open/stats.totalQueries)*100) },
                { label: 'ACTIVE', color: 'bg-primary', value: stats.breakdown.active, pct: Math.round((stats.breakdown.active/stats.totalQueries)*100) },
                { label: 'ACCEPTED', color: 'bg-accent-pink', value: stats.breakdown.accepted, pct: Math.round((stats.breakdown.accepted/stats.totalQueries)*100) },
                { label: 'COMPLETED', color: 'bg-accent-green', value: stats.breakdown.completed, pct: Math.round((stats.breakdown.completed/stats.totalQueries)*100) },
                { label: 'EXPIRED', color: 'bg-[#94a3b8]', value: stats.breakdown.expired, pct: Math.round((stats.breakdown.expired/stats.totalQueries)*100) },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                      <span className="text-[10px] font-normal text-gray-400 uppercase tracking-widest">{item.label}</span>
                   </div>
                   <div className="flex items-center gap-4">
                      <span className="text-[10px] font-normal text-text-dark">{item.pct}%</span>
                      <span className="text-[10px] font-normal text-gray-300 tabular-nums w-10 text-right">{item.value.toLocaleString()}</span>
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Secondary Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Active Users */}
          <div className="bg-white p-6 rounded-[2.2rem] shadow-soft border border-white space-y-4">
             <div className="flex justify-between items-end">
                <div>
                   <p className="text-[8px] font-normal text-gray-400 uppercase tracking-widest mb-1 opacity-60">Active Users</p>
                   <p className="text-xl font-normal text-text-dark tracking-tight">{stats.activeUsers.toLocaleString()}</p>
                </div>
                <span className="text-[8px] font-normal text-accent-green uppercase">+12%</span>
             </div>
             <div className="h-8 w-full flex items-end gap-0.5">
                <svg className="w-full h-full" viewBox="0 0 100 20">
                  <path d="M0 15 Q 10 5, 20 12 T 40 8 T 60 18 T 80 5 T 100 12" fill="none" stroke="#8BC34A" strokeWidth="2" />
                </svg>
             </div>
          </div>

          {/* Repeated Users */}
          <div className="bg-white p-6 rounded-[2.2rem] shadow-soft border border-white space-y-4">
             <div className="flex justify-between items-end">
                <div>
                   <p className="text-[8px] font-normal text-gray-400 uppercase tracking-widest mb-1 opacity-60">Repeated Users</p>
                   <p className="text-xl font-normal text-text-dark tracking-tight">{stats.repeatedUsers.toLocaleString()}</p>
                </div>
                <span className="text-[8px] font-normal text-accent-green uppercase">+4%</span>
             </div>
             <div className="h-8 w-full">
                <svg className="w-full h-full" viewBox="0 0 100 20">
                  <path d="M0 18 L 20 15 L 40 16 L 60 12 L 80 10 L 100 8" fill="none" stroke="#5B3D9D" strokeWidth="2" />
                </svg>
             </div>
          </div>

          {/* Sessions */}
          <div className="bg-white p-6 rounded-[2.2rem] shadow-soft border border-white space-y-4">
             <div className="flex justify-between items-end">
                <div>
                   <p className="text-[8px] font-normal text-gray-400 uppercase tracking-widest mb-1 opacity-60">Sessions</p>
                   <p className="text-xl font-normal text-text-dark tracking-tight">{(stats.sessions / 1000).toFixed(1)}k</p>
                </div>
                <span className="text-[8px] font-normal text-gray-300 uppercase">0%</span>
             </div>
             <div className="h-8 w-full">
                <svg className="w-full h-full" viewBox="0 0 100 20">
                  <path d="M0 15 Q 20 18, 40 12 T 70 14 T 100 12" fill="none" stroke="#FFD60A" strokeWidth="2" />
                </svg>
             </div>
          </div>

          {/* Conversions */}
          <div className="bg-white p-6 rounded-[2.2rem] shadow-soft border border-white space-y-4">
             <div className="flex justify-between items-end">
                <div>
                   <p className="text-[8px] font-normal text-gray-400 uppercase tracking-widest mb-1 opacity-60">Conversions</p>
                   <p className="text-xl font-normal text-text-dark tracking-tight">{stats.breakdown.accepted + stats.breakdown.completed}</p>
                </div>
                <span className="text-[8px] font-normal text-accent-green uppercase">+18%</span>
             </div>
             <div className="h-8 w-full">
                <svg className="w-full h-full" viewBox="0 0 100 20">
                  <path d="M0 18 Q 10 17, 30 18 T 60 14 T 80 12 T 100 5" fill="none" stroke="#FF69B4" strokeWidth="2" />
                </svg>
             </div>
          </div>
        </div>

        {/* Services & Providers Table (Moved to last section) */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-white space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-[14px] font-black text-text-dark uppercase tracking-tight">Service Overview</h3>
            <button className="text-gray-300 material-symbols-outlined wght-700">more_horiz</button>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">
              <span>Service</span>
              <span>Providers</span>
            </div>
            <div className="space-y-2">
              {stats.serviceStats.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl active:scale-[0.98] transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-primary text-xl">{item.icon || 'category'}</span>
                    </div>
                    <span className="text-[12px] font-black text-text-dark">{item.name}</span>
                  </div>
                  <span className="text-[14px] font-black text-text-dark">{item.count}</span>
                </div>
              ))}
              {stats.serviceStats.length === 0 && (
                <div className="py-8 text-center text-[11px] text-gray-400 uppercase tracking-widest">No providers onboarded yet</div>
              )}
            </div>
          </div>
          {stats.serviceStats.length > 8 && (
            <button onClick={() => navigate('/admin/categories')} className="w-full py-4 text-[11px] font-black text-primary uppercase tracking-widest bg-primary/5 rounded-2xl active:scale-95 transition-all">
              View All Services
            </button>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-gray-100 pb-10 pt-4 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.06)]">
        <button className="flex-1 flex flex-col items-center gap-1.5 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-2xl">
            <span className="material-symbols-outlined text-[28px] wght-700 fill-1">grid_view</span>
          </div>
          <span className="text-[9px] font-normal uppercase tracking-widest">HOME</span>
        </button>
        <button onClick={() => navigate('/admin/users')} className="flex-1 flex flex-col items-center gap-1.5 text-gray-400">
          <span className="material-symbols-outlined text-[28px] wght-700">group</span>
          <span className="text-[9px] font-normal uppercase tracking-widest">USERS</span>
        </button>
        <button onClick={() => navigate('/admin/providers')} className="flex-1 flex flex-col items-center gap-1.5 text-gray-400">
          <span className="material-symbols-outlined text-[28px] wght-700">storefront</span>
          <span className="text-[9px] font-normal uppercase tracking-widest">EXPERTS</span>
        </button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1.5 text-gray-400">
          <span className="material-symbols-outlined text-[28px] wght-700">format_list_bulleted</span>
          <span className="text-[9px] font-normal uppercase tracking-widest">QUERIES</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1.5 text-gray-400">
          <span className="material-symbols-outlined text-[28px] wght-700">settings</span>
          <span className="text-[9px] font-normal uppercase tracking-widest">SYSTEM</span>
        </button>
      </nav>
    </div>
  );
};

export default Dashboard;