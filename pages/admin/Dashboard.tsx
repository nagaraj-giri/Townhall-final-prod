import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, RFQ, UserRole, Quote } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

interface DashboardProps { user: User; }

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const { toggleNotifications, unreadCount } = useApp();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allRfqs, setAllRfqs] = useState<RFQ[]>([]);
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Multi-stream listener for real-time dashboard updates
    const unsubUsers = dataService.listenToUsers(setAllUsers);
    const unsubRfqs = dataService.listenToRFQs(setAllRfqs);
    
    const fetchQuotes = async () => {
      const quotes = await dataService.getQuotes();
      setAllQuotes(quotes);
    };
    
    fetchQuotes();
    setIsLoading(false);
    return () => { unsubUsers(); unsubRfqs(); };
  }, []);

  const metrics = useMemo(() => {
    const now = new Date();
    const last7Days = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const prev7Days = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));

    const getTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? '+100%' : '0%';
      const change = ((current - previous) / previous) * 100;
      return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    };

    const customers = allUsers.filter(u => u.role === UserRole.CUSTOMER);
    const custThisWeek = customers.filter(u => new Date(u.createdAt || 0) > last7Days).length;
    const custPrevWeek = customers.filter(u => {
      const d = new Date(u.createdAt || 0);
      return d > prev7Days && d <= last7Days;
    }).length;

    const providers = allUsers.filter(u => u.role === UserRole.PROVIDER);
    const provThisWeek = providers.filter(u => new Date(u.createdAt || 0) > last7Days).length;
    const provPrevWeek = providers.filter(u => {
      const d = new Date(u.createdAt || 0);
      return d > prev7Days && d <= last7Days;
    }).length;

    const totalQueries = allRfqs.length;
    const rfqThisWeek = allRfqs.filter(r => new Date(r.createdAt) > last7Days).length;
    const rfqPrevWeek = allRfqs.filter(r => {
      const d = new Date(r.createdAt);
      return d > prev7Days && d <= last7Days;
    }).length;

    const openQueries = allRfqs.filter(q => q.status === 'OPEN' || q.status === 'ACTIVE').length;

    const getCount = (status: string) => allRfqs.filter(q => q.status === status).length;
    const funnel = {
      open: getCount('OPEN'),
      active: getCount('ACTIVE'),
      accepted: getCount('ACCEPTED'),
      completed: getCount('COMPLETED'),
      canceled: getCount('CANCELED')
    };

    const conversionRate = totalQueries > 0 
      ? Math.round(((funnel.completed + funnel.accepted) / totalQueries) * 100) 
      : 0;

    const getPct = (count: number) => totalQueries > 0 ? Math.round((count / totalQueries) * 100) : 0;

    return {
      totalCustomers: customers.length,
      customerTrend: getTrend(custThisWeek, custPrevWeek),
      totalProviders: providers.length,
      providerTrend: getTrend(provThisWeek, prev7Days ? provPrevWeek : 0),
      totalQueries: totalQueries,
      queryTrend: getTrend(rfqThisWeek, rfqPrevWeek),
      openQueries: openQueries,
      conversion: conversionRate,
      funnel: [
        { label: 'OPEN', value: `${getPct(funnel.open)}%`, color: 'bg-orange-400', count: funnel.open },
        { label: 'ACTIVE', value: `${getPct(funnel.active)}%`, color: 'bg-blue-400', count: funnel.active },
        { label: 'ACCEPTED', value: `${getPct(funnel.accepted)}%`, color: 'bg-primary', count: funnel.accepted },
        { label: 'COMPLETED', value: `${getPct(funnel.completed)}%`, color: 'bg-accent-green', count: funnel.completed },
        { label: 'CANCELED', value: `${getPct(funnel.canceled)}%`, color: 'bg-red-400', count: funnel.canceled },
      ]
    };
  }, [allUsers, allRfqs]);

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen pb-32 bg-transparent">
      {/* Header */}
      <header className="px-6 pt-12 pb-4 flex justify-between items-center">
        <div>
          <p className="text-[10px] text-text-light uppercase tracking-widest leading-none mb-1">OVERVIEW</p>
          <h1 className="text-xl font-black text-text-dark tracking-tight">Admin Dashboard</h1>
        </div>
        <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 rounded-2xl bg-white shadow-soft flex items-center justify-center border border-white">
          <span className="material-symbols-outlined text-text-dark text-2xl">notifications</span>
          {unreadCount > 0 && (
            <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white shadow-sm"></div>
          )}
        </button>
      </header>

      {/* Date Filters */}
      <div className="px-6 flex gap-2 mb-6 overflow-x-auto no-scrollbar">
        <button className="bg-primary text-white px-5 py-2.5 rounded-[1.2rem] text-[11px] shadow-btn-glow flex items-center gap-1 shrink-0">
          Last 7 Days <span className="material-symbols-outlined text-sm">expand_more</span>
        </button>
        <button className="bg-white text-text-light px-6 py-2.5 rounded-[1.2rem] text-[11px] border border-white shadow-soft shrink-0">
          This Month
        </button>
        <button className="bg-white text-text-light px-6 py-2.5 rounded-[1.2rem] text-[11px] border border-white shadow-soft shrink-0">
          Custom
        </button>
      </div>

      <main className="flex-1 px-6 space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[2.2rem] shadow-card border border-white/50 transition-all active:scale-95">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-primary/5 rounded-2xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">group</span>
              </div>
              <span className={`text-[9px] px-2 py-0.5 rounded-lg border ${metrics.customerTrend.startsWith('+') ? 'bg-accent-green/10 text-accent-green border-accent-green/5' : 'bg-accent-pink/10 text-accent-pink border-accent-pink/5'}`}>
                {metrics.customerTrend}
              </span>
            </div>
            <p className="text-[10px] text-text-light uppercase tracking-tight">Total Customers</p>
            <p className="text-2xl text-text-dark mt-1 font-bold">{metrics.totalCustomers >= 1000 ? (metrics.totalCustomers / 1000).toFixed(1) + 'k' : metrics.totalCustomers}</p>
          </div>

          <div className="bg-white p-6 rounded-[2.2rem] shadow-card border border-white/50 transition-all active:scale-95">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-secondary/5 rounded-2xl flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined">storefront</span>
              </div>
              <span className={`text-[9px] px-2 py-0.5 rounded-lg border ${metrics.providerTrend.startsWith('+') ? 'bg-accent-green/10 text-accent-green border-accent-green/5' : 'bg-accent-pink/10 text-accent-pink border-accent-pink/5'}`}>
                {metrics.providerTrend}
              </span>
            </div>
            <p className="text-[10px] text-text-light uppercase tracking-tight">Total Providers</p>
            <p className="text-2xl text-text-dark mt-1 font-bold">{metrics.totalProviders}</p>
          </div>

          <div className="bg-white p-6 rounded-[2.2rem] shadow-card border border-white/50 transition-all active:scale-95">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
                <span className="material-symbols-outlined">radar</span>
              </div>
              <span className={`text-[9px] px-2 py-0.5 rounded-lg border ${metrics.queryTrend.startsWith('+') ? 'bg-accent-green/10 text-accent-green border-accent-green/5' : 'bg-accent-pink/10 text-accent-pink border-accent-pink/5'}`}>
                {metrics.queryTrend}
              </span>
            </div>
            <p className="text-[10px] text-text-light uppercase tracking-tight">Total Queries</p>
            <p className="text-2xl text-text-dark mt-1 font-bold">{metrics.totalQueries.toLocaleString()}</p>
          </div>

          <div className="bg-white p-6 rounded-[2.2rem] shadow-card border border-white/50 transition-all active:scale-95 relative overflow-hidden">
            <div className="absolute -top-1 -right-1 w-16 h-16 bg-secondary/5 rounded-full blur-2xl"></div>
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-yellow-50 rounded-2xl flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined">assignment</span>
              </div>
              {metrics.openQueries > 0 && (
                <span className="bg-secondary text-text-dark text-[8px] px-2 py-1 rounded-lg uppercase tracking-tighter shadow-sm animate-pulse">Action</span>
              )}
            </div>
            <p className="text-[10px] text-text-light uppercase tracking-tight">Open Queries</p>
            <p className="text-2xl text-text-dark mt-1 font-bold">{metrics.openQueries}</p>
          </div>
        </div>

        {/* Leads Conversion Card */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white space-y-6">
          <div>
            <h3 className="text-lg font-black text-text-dark tracking-tight">Leads Conversion</h3>
            <p className="text-[11px] text-text-light uppercase tracking-widest mt-1">Marketplace Funnel</p>
          </div>

          <div className="flex flex-col items-center py-6">
            <div className="relative w-44 h-44">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f3f4f6" strokeWidth="12" />
                {metrics.totalQueries > 0 && (
                  <>
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#FB923C" strokeWidth="12" strokeDasharray={`${metrics.funnel[0].count / metrics.totalQueries * 251} 251`} strokeDashoffset="0" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#60A5FA" strokeWidth="12" strokeDasharray={`${metrics.funnel[1].count / metrics.totalQueries * 251} 251`} strokeDashoffset={`-${metrics.funnel[0].count / metrics.totalQueries * 251}`} strokeLinecap="round" />
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#5B3D9D" strokeWidth="12" strokeDasharray={`${metrics.funnel[2].count / metrics.totalQueries * 251} 251`} strokeDashoffset={`-${(metrics.funnel[0].count + metrics.funnel[1].count) / metrics.totalQueries * 251}`} strokeLinecap="round" />
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#8BC34A" strokeWidth="12" strokeDasharray={`${metrics.funnel[3].count / metrics.totalQueries * 251} 251`} strokeDashoffset={`-${(metrics.funnel[0].count + metrics.funnel[1].count + metrics.funnel[2].count) / metrics.totalQueries * 251}`} strokeLinecap="round" />
                  </>
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-4xl text-text-dark leading-none font-black">{metrics.conversion}%</p>
                <p className="text-[9px] text-text-light uppercase mt-2 tracking-[0.1em] font-bold">Win Rate</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {metrics.funnel.map(item => (
              <div key={item.label} className="flex items-center justify-between group cursor-default">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color} shadow-sm`}></div>
                  <span className="text-[10px] text-text-light tracking-widest uppercase font-bold">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-gray-300">{item.count}</span>
                  <span className="text-[11px] text-text-dark group-hover:text-primary transition-colors font-bold">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white border-t border-gray-100 pb-10 pt-4 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.06)] backdrop-blur-md bg-white/95">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-xl">
             <span className="material-symbols-outlined text-[24px]">grid_view</span>
          </div>
          <span className="text-[9px] uppercase tracking-widest font-black">DASH</span>
        </button>
        <button onClick={() => navigate('/admin/users')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light group">
          <span className="material-symbols-outlined text-[24px]">group</span>
          <span className="text-[9px] uppercase tracking-widest">USERS</span>
        </button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light group">
          <span className="material-symbols-outlined text-[24px]">format_list_bulleted</span>
          <span className="text-[9px] uppercase tracking-widest">QUERIES</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light group">
          <span className="material-symbols-outlined text-[24px]">settings</span>
          <span className="text-[9px] uppercase tracking-widest">SYSTEM</span>
        </button>
      </nav>
    </div>
  );
};

export default Dashboard;