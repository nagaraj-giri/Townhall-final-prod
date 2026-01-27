
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, RFQ, UserRole } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

interface DashboardProps { user: User; }

type FilterType = 'overall' | 'month' | 'custom';

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const { toggleNotifications, unreadCount } = useApp();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allRfqs, setAllRfqs] = useState<RFQ[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('overall');
  const [isLoading, setIsLoading] = useState(true);
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const unsubUsers = dataService.listenToUsers(setAllUsers);
    const unsubRfqs = dataService.listenToRFQs(setAllRfqs);
    setIsLoading(false);
    return () => { unsubUsers(); unsubRfqs(); };
  }, []);

  const staleQueriesCount = useMemo(() => {
    const twelveHrsMs = 12 * 60 * 60 * 1000;
    return allRfqs.filter(r => 
      (r.status === 'OPEN' || r.status === 'ACTIVE') && 
      (Date.now() - new Date(r.createdAt).getTime()) > twelveHrsMs
    ).length;
  }, [allRfqs]);

  const filteredSets = useMemo(() => {
    const now = new Date();
    
    if (activeFilter === 'overall') {
      const allDates = [...allUsers, ...allRfqs].map(x => new Date(x.createdAt || '').getTime()).filter(t => !isNaN(t));
      const minDate = allDates.length > 0 ? Math.min(...allDates) : now.getTime();
      const diffMs = now.getTime() - minDate;
      return {
        users: allUsers,
        rfqs: allRfqs,
        rangeDays: Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
      };
    }

    let startDate: Date;
    if (activeFilter === 'month') {
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
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return {
      users: allUsers.filter(u => new Date(u.createdAt || '') >= startDate),
      rfqs: allRfqs.filter(r => new Date(r.createdAt || '') >= startDate),
      rangeDays: activeFilter === 'month' ? 30 : 365
    };
  }, [allUsers, allRfqs, activeFilter, customRange]);

  const metrics = useMemo(() => {
    const { users, rfqs } = filteredSets;
    const total = rfqs.length || 1;
    
    const getPct = (status: string) => Math.round((rfqs.filter(q => q.status === status).length / total) * 100);
    const selectionRate = Math.round((rfqs.filter(r => r.status === 'ACCEPTED' || r.status === 'COMPLETED').length / total) * 100);

    const generateTrend = (data: any[], dateField: string, buckets: number = 8) => {
      if (data.length === 0) return Array(buckets).fill(0);
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
      return points; 
    };

    return {
      customersCount: users.filter(u => u.role === UserRole.CUSTOMER).length,
      providersCount: users.filter(u => u.role === UserRole.PROVIDER).length,
      queriesCount: rfqs.length,
      openQueriesCount: rfqs.filter(r => r.status === 'OPEN' || r.status === 'ACTIVE').length,
      conversionRate: selectionRate,
      funnel: [
        { label: 'OPEN', color: '#FFD60A', pct: getPct('OPEN') },
        { label: 'ACTIVE', color: '#5B3D9D', pct: getPct('ACTIVE') },
        { label: 'ACCEPTED', color: '#FF69B4', pct: getPct('ACCEPTED') },
        { label: 'COMPLETED', color: '#8BC34A', pct: getPct('COMPLETED') }
      ],
      trends: {
        active: { value: users.length, data: generateTrend(users, 'lastLoginAt') },
        conversions: { value: rfqs.filter(r => r.status === 'COMPLETED').length, data: generateTrend(rfqs.filter(r => r.status === 'COMPLETED'), 'createdAt') }
      }
    };
  }, [filteredSets]);

  const Sparkline = ({ color, data }: { color: string, data: number[] }) => {
    const max = Math.max(...data, 1);
    const points = data.map((d, i) => `${(i / (data.length - 1)) * 100},${100 - (d / max) * 80}`).join(' ');
    return (
      <svg className="w-full h-10 overflow-visible mt-2" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={`M 0,100 L ${points} L 100,100 Z`} fill={`${color}15`} />
        <polyline fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={points} />
      </svg>
    );
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-screen">Loading Analytics...</div>;

  return (
    <div className="flex flex-col min-h-screen pb-32 bg-transparent">
      <header className="px-6 pt-10 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-[24px] font-black text-text-dark tracking-tight">Analytics Dashboard</h1>
            <p className="text-[12px] text-gray-400 font-normal mt-0.5">Platform monitoring</p>
          </div>
          <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-card border border-gray-100 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-[24px] text-text-dark opacity-30 font-normal">notifications</span>
            {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white shadow-sm"></div>}
          </button>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={() => setActiveFilter('overall')} className={`px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${activeFilter === 'overall' ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>Overall</button>
          <button onClick={() => setActiveFilter('month')} className={`px-6 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${activeFilter === 'month' ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>Month</button>
        </div>
      </header>

      <main className="px-6 space-y-6 overflow-y-auto no-scrollbar pt-2">
        {/* Stale Query oversight (Admin Use Case 5) */}
        {staleQueriesCount > 0 && (
          <div onClick={() => navigate('/queries')} className="bg-red-50 border border-red-100 rounded-3xl p-6 flex items-center justify-between cursor-pointer active:scale-95 transition-all">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined font-black">timer_off</span>
               </div>
               <div>
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-widest leading-none mb-1">Stale Health Check</p>
                  <p className="text-sm font-bold text-red-600">{staleQueriesCount} queries open &gt; 12 hours</p>
               </div>
            </div>
            <span className="material-symbols-outlined text-red-300">chevron_right</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Customers', value: metrics.customersCount, icon: 'group', color: '#5B3D9D' },
            { label: 'Providers', value: metrics.providersCount, icon: 'storefront', color: '#FF9800' },
            { label: 'Live Leads', value: metrics.openQueriesCount, icon: 'assignment', color: '#FFD60A' },
            { label: 'Conversion', value: `${metrics.conversionRate}%`, icon: 'trending_up', color: '#8BC34A' },
          ].map((kpi, idx) => (
            <div key={idx} className="bg-white p-6 rounded-[2.2rem] shadow-card border border-white flex flex-col justify-between min-h-[140px]">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${kpi.color}10`, color: kpi.color }}><span className="material-symbols-outlined text-[24px] font-normal">{kpi.icon}</span></div>
              <div><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">{kpi.label}</p><p className="text-[26px] font-black text-text-dark leading-none tracking-tighter">{kpi.value}</p></div>
            </div>
          ))}
        </div>

        <section className="space-y-4 pb-12">
          <div className="flex justify-between items-center px-1"><h3 className="text-[18px] font-bold text-text-dark tracking-tight">System Trends</h3></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-[2.2rem] shadow-card border border-gray-100/50 flex flex-col justify-between min-h-[130px] overflow-hidden group">
               <div><p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Active Users</p><p className="text-[20px] font-black text-text-dark tracking-tighter mt-1">{metrics.trends.active.value}</p></div>
               <div className="transition-transform duration-500 group-hover:scale-105 origin-bottom"><Sparkline color="#8BC34A" data={metrics.trends.active.data} /></div>
            </div>
            <div className="bg-white p-6 rounded-[2.2rem] shadow-card border border-gray-100/50 flex flex-col justify-between min-h-[130px] overflow-hidden group">
               <div><p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Conversions</p><p className="text-[20px] font-black text-text-dark tracking-tighter mt-1">{metrics.trends.conversions.value}</p></div>
               <div className="transition-transform duration-500 group-hover:scale-105 origin-bottom"><Sparkline color="#5B3D9D" data={metrics.trends.conversions.data} /></div>
            </div>
          </div>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 border-t border-gray-100 pb-10 pt-4 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.06)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-2xl"><span className="material-symbols-outlined text-[26px] font-normal">grid_view</span></div>
          <span className="text-[9px] uppercase tracking-widest font-bold">HOME</span>
        </button>
        <button onClick={() => navigate('/admin/users')} className="flex-1 flex flex-col items-center gap-1 text-text-light opacity-30"><span className="material-symbols-outlined text-[26px] font-normal">group</span><span className="text-[9px] uppercase tracking-widest font-bold">USERS</span></button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1 text-text-light opacity-30"><span className="material-symbols-outlined text-[26px] font-normal">format_list_bulleted</span><span className="text-[9px] uppercase tracking-widest font-bold">QUERIES</span></button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1 text-text-light opacity-30"><span className="material-symbols-outlined text-[26px] font-normal">settings</span><span className="text-[9px] uppercase tracking-widest font-bold">SYSTEM</span></button>
      </nav>
    </div>
  );
};

export default Dashboard;
