import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, RFQ, UserRole } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

interface DashboardProps { user: User; }

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const { toggleNotifications, unreadCount } = useApp();
  
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allRfqs, setAllRfqs] = useState<RFQ[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL TIME');

  useEffect(() => {
    const unsubUsers = dataService.listenToUsers(setAllUsers);
    const unsubRfqs = dataService.listenToRFQs((rfqs) => {
      setAllRfqs(rfqs);
      setIsLoading(false);
    });
    return () => { unsubUsers(); unsubRfqs(); };
  }, []);

  const stats = useMemo(() => {
    const customers = allUsers.filter(u => u.role === UserRole.CUSTOMER);
    const providers = allUsers.filter(u => u.role === UserRole.PROVIDER);
    
    const openCount = allRfqs.filter(r => r.status === 'OPEN').length;
    const activeCount = allRfqs.filter(r => r.status === 'ACTIVE').length;
    const acceptedCount = allRfqs.filter(r => r.status === 'ACCEPTED').length;
    const completedCount = allRfqs.filter(r => r.status === 'COMPLETED').length;
    const canceledCount = allRfqs.filter(r => r.status === 'CANCELED').length;
    
    const total = allRfqs.length || 1; 
    const conversionRate = Math.round(((acceptedCount + completedCount) / total) * 100);

    return {
      customersCount: customers.length,
      providersCount: providers.length,
      totalQueries: allRfqs.length,
      openQueries: openCount,
      breakdown: {
        open: openCount,
        active: activeCount,
        accepted: acceptedCount,
        completed: completedCount,
        expired: canceledCount
      },
      conversion: conversionRate,
      activeUsers: allUsers.filter(u => {
        if (!u.lastLoginAt) return false;
        const lastLogin = new Date(u.lastLoginAt).getTime();
        return (Date.now() - lastLogin) < (24 * 60 * 60 * 1000);
      }).length
    };
  }, [allUsers, allRfqs]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen pb-32 bg-[#FAF9F6]">
      {/* Header */}
      <header className="px-6 pt-12 pb-6 flex justify-between items-start">
        <div className="space-y-1">
          <h1 className="text-[20px] font-black text-text-dark tracking-tight leading-none uppercase">Good morning, Admin</h1>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest opacity-60">Marketplace Insights Overview</p>
        </div>
        <button onClick={() => toggleNotifications(true)} className="relative w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-card border border-white active:scale-95 transition-all">
          <span className="material-symbols-outlined text-text-dark text-2xl font-normal fill-0">notifications</span>
          {unreadCount > 0 && <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white"></div>}
        </button>
      </header>

      {/* Filters */}
      <div className="px-6 mb-6">
        <div className="bg-white/50 backdrop-blur-md rounded-full p-1 border border-white shadow-sm flex items-center justify-between">
          {['ALL TIME', 'THIS MONTH'].map(f => (
            <button 
              key={f} 
              onClick={() => setActiveFilter(f)}
              className={`flex-1 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeFilter === f ? 'bg-primary text-white shadow-lg' : 'text-text-light'}`}
            >
              {f}
            </button>
          ))}
          <button className="flex-1 py-2.5 text-[10px] font-black text-text-light uppercase tracking-widest flex items-center justify-center gap-1">
            CUSTOM <span className="material-symbols-outlined text-sm">calendar_today</span>
          </button>
        </div>
      </div>

      <main className="px-6 space-y-6">
        {/* Main Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => navigate('/admin/broadcast')} className="bg-primary p-6 rounded-[2rem] shadow-btn-glow flex items-center justify-center gap-3 active:scale-95 transition-all border border-white/10">
            <span className="material-symbols-outlined text-white text-xl">campaign</span>
            <span className="text-white text-[11px] font-black uppercase tracking-widest">Broadcast</span>
          </button>
          <button onClick={() => navigate('/admin/requests')} className="bg-white p-6 rounded-[2rem] shadow-card flex items-center justify-center gap-3 active:scale-95 transition-all border border-white">
            <span className="material-symbols-outlined text-[#FFD60A] text-xl font-black">gavel</span>
            <span className="text-text-dark text-[11px] font-black uppercase tracking-widest">Moderation</span>
          </button>
        </div>

        {/* Core KPI Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-white space-y-3">
             <div className="flex justify-between items-start">
                <div className="w-9 h-9 bg-primary/5 rounded-xl flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-lg">group</span>
                </div>
                <span className="text-[8px] font-black text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded-md uppercase">+12%</span>
             </div>
             <div>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Customers</p>
                <p className="text-2xl font-black text-text-dark tracking-tight">{stats.customersCount >= 1000 ? `${(stats.customersCount / 1000).toFixed(1)}k` : stats.customersCount}</p>
             </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-white space-y-3">
             <div className="flex justify-between items-start">
                <div className="w-9 h-9 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-lg">storefront</span>
                </div>
                <span className="text-[8px] font-black text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded-md uppercase">+5%</span>
             </div>
             <div>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Providers</p>
                <p className="text-2xl font-black text-text-dark tracking-tight">{stats.providersCount}</p>
             </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-white space-y-3">
             <div className="flex justify-between items-start">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                  <span className="material-symbols-outlined text-lg">analytics</span>
                </div>
                <span className="text-[8px] font-black text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded-md uppercase">+8.4%</span>
             </div>
             <div>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Queries</p>
                <p className="text-2xl font-black text-text-dark tracking-tight">{stats.totalQueries.toLocaleString()}</p>
             </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-white space-y-3 relative">
             <div className="flex justify-between items-start">
                <div className="w-9 h-9 bg-pink-50 rounded-xl flex items-center justify-center text-accent-pink">
                  <span className="material-symbols-outlined text-lg">manage_search</span>
                </div>
                <span className="text-[7px] font-black text-white bg-accent-pink px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-sm">Action</span>
             </div>
             <div>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Open Queries</p>
                <p className="text-2xl font-black text-text-dark tracking-tight">{stats.openQueries}</p>
             </div>
          </div>
        </div>

        {/* Funnel Donut Chart Card */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-white space-y-8">
           <div className="flex justify-between items-center">
              <div>
                <h3 className="text-[14px] font-black text-text-dark uppercase tracking-tight">Leads Conversion</h3>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">Funnel breakdown of {stats.totalQueries.toLocaleString()} queries</p>
              </div>
              <button className="text-gray-300 material-symbols-outlined">more_horiz</button>
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
                    <p className="text-3xl font-black text-text-dark tracking-tighter">{stats.conversion}%</p>
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Conversion</p>
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
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.label}</span>
                   </div>
                   <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black text-text-dark">{item.pct}%</span>
                      <span className="text-[10px] font-bold text-gray-300 tabular-nums w-10 text-right">{item.value.toLocaleString()}</span>
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Secondary Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 pb-12">
          {/* Active Users */}
          <div className="bg-white p-6 rounded-[2.2rem] shadow-soft border border-white space-y-4">
             <div className="flex justify-between items-end">
                <div>
                   <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-60">Active Users</p>
                   <p className="text-xl font-black text-text-dark tracking-tight">{stats.activeUsers.toLocaleString()}</p>
                </div>
                <span className="text-[8px] font-black text-accent-green uppercase">+12%</span>
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
                   <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-60">Repeated Users</p>
                   <p className="text-xl font-black text-text-dark tracking-tight">924</p>
                </div>
                <span className="text-[8px] font-black text-accent-green uppercase">+4%</span>
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
                   <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-60">Sessions</p>
                   <p className="text-xl font-black text-text-dark tracking-tight">14.2k</p>
                </div>
                <span className="text-[8px] font-black text-gray-300 uppercase">0%</span>
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
                   <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-60">Conversions</p>
                   <p className="text-xl font-black text-text-dark tracking-tight">{stats.breakdown.accepted + stats.breakdown.completed}</p>
                </div>
                <span className="text-[8px] font-black text-accent-green uppercase">+18%</span>
             </div>
             <div className="h-8 w-full">
                <svg className="w-full h-full" viewBox="0 0 100 20">
                  <path d="M0 18 Q 10 17, 30 18 T 60 14 T 80 12 T 100 5" fill="none" stroke="#FF69B4" strokeWidth="2" />
                </svg>
             </div>
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-gray-100 pb-10 pt-4 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.06)]">
        <button className="flex-1 flex flex-col items-center gap-1.5 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-2xl">
            <span className="material-symbols-outlined text-[28px] fill-1">grid_view</span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest">HOME</span>
        </button>
        <button onClick={() => navigate('/admin/users')} className="flex-1 flex flex-col items-center gap-1.5 text-gray-400">
          <span className="material-symbols-outlined text-[28px]">group</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">USERS</span>
        </button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1.5 text-gray-400">
          <span className="material-symbols-outlined text-[28px]">format_list_bulleted</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">QUERIES</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1.5 text-gray-400">
          <span className="material-symbols-outlined text-[28px]">settings</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">SYSTEM</span>
        </button>
      </nav>
    </div>
  );
};

export default Dashboard;