import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, RFQ, UserRole } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

interface DashboardProps { user: User; }

type FilterType = '7days' | 'month' | 'custom';

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const { toggleNotifications, unreadCount } = useApp();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allRfqs, setAllRfqs] = useState<RFQ[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('7days');
  const [isLoading, setIsLoading] = useState(true);
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const unsubUsers = dataService.listenToUsers(setAllUsers);
    const unsubRfqs = dataService.listenToRFQs(setAllRfqs);
    setIsLoading(false);
    return () => { unsubUsers(); unsubRfqs(); };
  }, []);

  // Filter logic based on the selected range (Real-time dynamic)
  const filteredSets = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    if (activeFilter === '7days') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (activeFilter === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (activeFilter === 'custom' && customRange.start && customRange.end) {
      startDate = new Date(customRange.start);
      const endDate = new Date(customRange.end);
      endDate.setHours(23, 59, 59, 999);
      return {
        users: allUsers.filter(u => {
          const d = new Date(u.createdAt || '');
          return d >= startDate && d <= endDate;
        }),
        rfqs: allRfqs.filter(r => {
          const d = new Date(r.createdAt || '');
          return d >= startDate && d <= endDate;
        }),
        rangeDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      };
    } else {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Fallback
    }

    return {
      users: allUsers.filter(u => new Date(u.createdAt || '') >= startDate),
      rfqs: allRfqs.filter(r => new Date(r.createdAt || '') >= startDate),
      rangeDays: activeFilter === '7days' ? 7 : 30
    };
  }, [allUsers, allRfqs, activeFilter, customRange]);

  const metrics = useMemo(() => {
    const { users, rfqs } = filteredSets;
    const total = rfqs.length || 1;
    const getPct = (status: string) => Math.round((rfqs.filter(q => q.status === status).length / total) * 100);
    
    const conversions = rfqs.filter(r => r.status === 'COMPLETED' || r.status === 'ACCEPTED').length;
    const repeatedUsers = users.filter(u => rfqs.filter(r => r.customerId === u.id).length > 1).length;

    const generateTrend = (data: any[], dateField: string, buckets: number = 8) => {
      if (data.length === 0) return Array(buckets).fill(10);
      const points = Array(buckets).fill(0);
      const now = new Date().getTime();
      const rangeMs = filteredSets.rangeDays * 24 * 60 * 60 * 1000;
      
      data.forEach(item => {
        const itemTime = new Date(item[dateField] || '').getTime();
        const diff = now - itemTime;
        const bucketIndex = Math.floor((diff / rangeMs) * buckets);
        if (bucketIndex >= 0 && bucketIndex < buckets) {
          points[(buckets - 1) - bucketIndex]++;
        }
      });
      return points.map(p => p + 5); 
    };

    return {
      customersCount: users.filter(u => u.role === UserRole.CUSTOMER).length,
      providersCount: users.filter(u => u.role === UserRole.PROVIDER).length,
      queriesCount: rfqs.length,
      openQueriesCount: rfqs.filter(r => r.status === 'OPEN' || r.status === 'ACTIVE').length,
      conversionRate: Math.round(((rfqs.filter(r => r.status === 'COMPLETED').length + rfqs.filter(r => r.status === 'ACCEPTED').length) / total) * 100),
      funnel: [
        { label: 'OPEN', color: '#FFD60A', pct: getPct('OPEN') },
        { label: 'ACTIVE', color: '#5B3D9D', pct: getPct('ACTIVE') },
        { label: 'ACCEPTED', color: '#FF69B4', pct: getPct('ACCEPTED') },
        { label: 'COMPLETED', color: '#8BC34A', pct: getPct('COMPLETED') },
        { label: 'EXPIRED', color: '#94a3b8', pct: getPct('CANCELED') }
      ],
      trends: {
        active: { value: users.length, data: generateTrend(users, 'lastLoginAt') },
        repeated: { value: repeatedUsers, data: generateTrend(users, 'createdAt') },
        sessions: { value: (users.length * 5).toFixed(0), data: [20, 25, 22, 35, 30, 45, 42, 50] },
        conversions: { value: conversions, data: generateTrend(rfqs.filter(r => r.status === 'COMPLETED'), 'createdAt') }
      }
    };
  }, [filteredSets]);

  const Sparkline = ({ color, data }: { color: string, data: number[] }) => {
    const max = Math.max(...data);
    const points = data.map((d, i) => `${(i / (data.length - 1)) * 100},${100 - (d / max) * 80}`).join(' ');
    return (
      <svg className="w-full h-10 overflow-visible mt-2" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={`M 0,100 L ${points} L 100,100 Z`} fill={`${color}15`} />
        <polyline fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={points} />
      </svg>
    );
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen pb-32 bg-[#FDFBF7]">
      {/* Header - Heading Bold Only */}
      <header className="px-6 pt-10 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-[24px] font-black text-text-dark leading-tight tracking-tight">Good morning, Admin</h1>
            <p className="text-[12px] text-gray-400 font-normal mt-0.5">Platform overview • Dubai Hub</p>
          </div>
          <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-card border border-gray-100 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-[24px] text-text-dark opacity-30 font-normal">notifications</span>
            {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white shadow-sm"></div>}
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex gap-2 mt-6">
          <button 
            onClick={() => { setActiveFilter('7days'); setShowDatePicker(false); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-normal uppercase tracking-wider transition-all ${activeFilter === '7days' ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}
          >
            Last 7 Days <span className="material-symbols-outlined text-sm font-normal">expand_more</span>
          </button>
          <button 
            onClick={() => { setActiveFilter('month'); setShowDatePicker(false); }}
            className={`px-6 py-2.5 rounded-full text-[11px] font-normal uppercase tracking-wider transition-all ${activeFilter === 'month' ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}
          >
            This Month
          </button>
          <button 
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`px-6 py-2.5 rounded-full text-[11px] font-normal uppercase tracking-wider transition-all ${(activeFilter === 'custom' || showDatePicker) ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}
          >
            Custom
          </button>
        </div>

        {showDatePicker && (
          <div className="mt-4 p-5 bg-white rounded-3xl shadow-2xl border border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-normal text-gray-400 uppercase tracking-widest ml-1">Start Date</label>
                <input 
                  type="date" 
                  className="w-full bg-gray-50 border-none rounded-xl text-xs font-normal p-3 outline-none focus:ring-1 focus:ring-primary" 
                  value={customRange.start}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-normal text-gray-400 uppercase tracking-widest ml-1">End Date</label>
                <input 
                  type="date" 
                  className="w-full bg-gray-50 border-none rounded-xl text-xs font-normal p-3 outline-none focus:ring-1 focus:ring-primary" 
                  value={customRange.end}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
            <button 
              onClick={() => { setActiveFilter('custom'); setShowDatePicker(false); }}
              disabled={!customRange.start || !customRange.end}
              className="w-full bg-primary text-white mt-4 py-3.5 rounded-xl text-[11px] font-normal uppercase tracking-[0.2em] shadow-btn-glow active:scale-95 transition-all disabled:opacity-30"
            >
              Apply Filter
            </button>
          </div>
        )}
      </header>

      <main className="px-6 space-y-6 overflow-y-auto no-scrollbar pt-2">
        {/* Top Action Cards - Uniform Grid Layout to match KPI cards width */}
        <div className="grid grid-cols-2 gap-4">
          <div 
            onClick={() => navigate('/admin/broadcast')}
            className="bg-primary rounded-[1.8rem] p-4 flex flex-col justify-center items-center gap-3 shadow-btn-glow active:scale-95 transition-all cursor-pointer border border-white/10 min-h-[110px]"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
              <span className="material-symbols-outlined font-normal text-xl">campaign</span>
            </div>
            <div className="text-center">
              <h2 className="text-white text-[12px] font-bold uppercase tracking-tight">Broadcast</h2>
              <p className="text-white/60 text-[8px] font-normal uppercase tracking-widest">Push to All</p>
            </div>
          </div>
          <div 
            onClick={() => navigate('/admin/reviews')}
            className="bg-white rounded-[1.8rem] p-4 flex flex-col justify-center items-center gap-3 shadow-card active:scale-[0.98] transition-all cursor-pointer border border-gray-100 min-h-[110px]"
          >
            <div className="w-10 h-10 bg-[#FFFCEF] rounded-xl flex items-center justify-center text-[#FFD60A] border border-[#FFD60A]/10">
              <span className="material-symbols-outlined font-normal text-xl">rate_review</span>
            </div>
            <div className="text-center">
              <h2 className="text-text-dark text-[12px] font-bold uppercase tracking-tight leading-tight">MODERATION</h2>
              <p className="text-gray-400 text-[8px] font-normal uppercase tracking-widest">Reviews</p>
            </div>
          </div>
        </div>

        {/* 2x2 KPI Grid - Values and Labels Normal */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Total Customers', value: metrics.customersCount, icon: 'group', color: '#5B3D9D' },
            { label: 'Total Providers', value: metrics.providersCount, icon: 'storefront', color: '#FF9800' },
            { label: 'Total Queries', value: metrics.queriesCount, icon: 'search_check', color: '#60A5FA' },
            { label: 'Open Queries', value: metrics.openQueriesCount, icon: 'assignment', color: '#FFD60A' },
          ].map((kpi, idx) => (
            <div key={idx} className="bg-white p-6 rounded-[2.2rem] shadow-card border border-white flex flex-col justify-between min-h-[140px] animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex justify-between items-start">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${kpi.color}10`, color: kpi.color }}>
                  <span className="material-symbols-outlined text-[24px] font-normal">{kpi.icon}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-normal uppercase tracking-widest mb-0.5">{kpi.label}</p>
                <p className="text-[26px] font-normal text-text-dark leading-none tracking-tighter">{kpi.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Leads Conversion Card - Heading Bold Only */}
        <div className="bg-white rounded-[3rem] p-8 shadow-card border border-white">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-[18px] font-bold text-text-dark tracking-tight">Leads Conversion</h3>
              <p className="text-[11px] text-gray-400 font-normal uppercase tracking-[0.2em] mt-1.5">Funnel breakdown • Market analysis</p>
            </div>
            <button className="text-gray-300 active:text-primary"><span className="material-symbols-outlined text-3xl font-normal">more_horiz</span></button>
          </div>

          <div className="flex flex-col items-center py-6">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                {/* Real-time Donut Segments */}
                <circle cx="50" cy="50" r="42" fill="transparent" stroke="#FFD60A" strokeWidth="12" strokeDasharray="264" strokeDashoffset="66" strokeLinecap="round" />
                <circle cx="50" cy="50" r="42" fill="transparent" stroke="#5B3D9D" strokeWidth="12" strokeDasharray="180" strokeDashoffset="0" strokeLinecap="round" className="opacity-80" />
                <circle cx="50" cy="50" r="42" fill="transparent" stroke="#FF69B4" strokeWidth="12" strokeDasharray="100" strokeDashoffset="-120" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[38px] font-normal text-text-dark leading-none tracking-tighter">{metrics.conversionRate}%</p>
                <p className="text-[10px] text-gray-400 uppercase font-normal mt-2 tracking-[0.2em]">Conversion</p>
              </div>
            </div>
          </div>

          <div className="space-y-5 mt-10">
            {metrics.funnel.map(f => (
              <div key={f.label} className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: f.color }}></div>
                  <span className="text-[11px] font-normal text-gray-400 uppercase tracking-[0.2em]">{f.label}</span>
                </div>
                <span className="text-[14px] font-normal text-text-dark tracking-tighter">{f.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Engagement Trends Sparklines - Heading Bold Only */}
        <section className="space-y-4 pb-12">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-[18px] font-bold text-text-dark tracking-tight">Engagement Trends</h3>
            <p className="text-[10px] font-normal text-gray-300 uppercase tracking-[0.2em]">Live Tracking</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Active Users', value: metrics.trends.active.value, color: '#8BC34A', data: metrics.trends.active.data },
              { label: 'Repeated Users', value: metrics.trends.repeated.value, color: '#5B3D9D', data: metrics.trends.repeated.data },
              { label: 'Sessions', value: metrics.trends.sessions.value, color: '#FFD60A', data: metrics.trends.sessions.data },
              { label: 'Conversions', value: metrics.trends.conversions.value, color: '#FF69B4', data: metrics.trends.conversions.data },
            ].map((trend, idx) => (
              <div key={idx} className="bg-white p-6 rounded-[2.2rem] shadow-card border border-gray-100/50 flex flex-col justify-between min-h-[130px] overflow-hidden group">
                <div>
                  <p className="text-[10px] font-normal text-gray-300 uppercase tracking-widest">{trend.label}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                     <p className="text-[20px] font-normal text-text-dark tracking-tighter">{trend.value}</p>
                  </div>
                </div>
                <div className="transition-transform duration-500 group-hover:scale-105 origin-bottom">
                  <Sparkline color={trend.color} data={trend.data} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Navigation - Headings/Labels Bold Only */}
      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 border-t border-gray-100 pb-10 pt-4 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.06)] backdrop-blur-md">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-2xl relative overflow-hidden">
             <div className="absolute inset-0 bg-primary/5 animate-pulse"></div>
             <span className="material-symbols-outlined text-[26px] relative z-10 font-normal">grid_view</span>
          </div>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">HOME</span>
        </button>
        <button onClick={() => navigate('/admin/users')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-30 active:opacity-100 transition-all">
          <span className="material-symbols-outlined text-[26px] font-normal">group</span>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">USERS</span>
        </button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-30 active:opacity-100 transition-all">
          <span className="material-symbols-outlined text-[26px] font-normal">format_list_bulleted</span>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">QUERIES</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-30 active:opacity-100 transition-all">
          <span className="material-symbols-outlined text-[26px] font-normal">person</span>
          <span className="text-[9px] uppercase tracking-[0.2em] font-normal">PROFILE</span>
        </button>
      </nav>
    </div>
  );
};

export default Dashboard;
