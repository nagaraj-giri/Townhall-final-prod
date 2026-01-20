import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { UserRole, User, RFQ } from '../../types';
import { useApp } from '../../App';

const CustomerDetails: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useApp();
  const [user, setUser] = useState<User | null>(null);
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        const [u, allRfqs] = await Promise.all([
          dataService.getUserById(id),
          dataService.getRFQs()
        ]);
        if (u) {
          setUser(u as User);
          setRfqs(allRfqs.filter(r => r.customerId === u.id));
        }
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const stats = useMemo(() => {
    const total = rfqs.length;
    const accepted = rfqs.filter(r => r.status === 'ACCEPTED' || r.status === 'COMPLETED').length;
    const rate = total > 0 ? Math.round((accepted / total) * 100) : 0;
    
    // Simulate total hours spent based on registration age and session frequency
    // In a real app, this would be a field tracked in the DB
    const regDate = user?.createdAt ? new Date(user.createdAt).getTime() : Date.now();
    const ageInDays = Math.max(1, (Date.now() - regDate) / (1000 * 60 * 60 * 24));
    const simulatedHrs = Math.floor(ageInDays * 1.5 + (total * 2)); 

    return { total, rate, hours: simulatedHrs.toLocaleString() };
  }, [rfqs, user]);

  const formatDubaiTimeOnly = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Dubai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDubaiHMS = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Dubai',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }) + ' GST';
  };

  const formatDubaiDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      timeZone: 'Asia/Dubai',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const activityLog = useMemo(() => {
    if (!user) return [];
    const activities: any[] = [];
    
    if (user.createdAt) {
      activities.push({
        id: 'join',
        title: 'ACCOUNT CREATED',
        message: 'Joined Town Hall UAE platform',
        timestamp: user.createdAt,
        color: 'bg-[#8BC34A]'
      });
    }

    if (user.lastLoginAt) {
      activities.push({
        id: 'login',
        title: 'USER LOG...',
        message: 'Successful session established',
        timestamp: user.lastLoginAt,
        color: 'border-primary border-2 bg-white text-primary'
      });
    }

    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [user]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard", "success");
  };

  const handleToggleSuspend = async () => {
    if (!user) return;
    const updated = { ...user, isBlocked: !user.isBlocked };
    try {
      await dataService.saveUser(updated);
      setUser(updated);
      showToast(updated.isBlocked ? "Account suspended" : "Account activated", "info");
    } catch (e) {
      showToast("Update failed", "error");
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return <div className="p-20 text-center text-gray-300 uppercase tracking-widest font-black text-[10px]">User Not Found</div>;

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-12">
      <header className="px-6 pt-10 pb-4 flex items-center justify-between sticky top-0 z-50 bg-white/20 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="text-text-dark w-10 h-10 flex items-center justify-start active:scale-90 transition-transform">
          <span className="material-symbols-outlined font-black text-[24px]">arrow_back</span>
        </button>
        <h1 className="text-[17px] font-bold text-text-dark text-center flex-1">User Details</h1>
        <button className="text-text-dark w-10 h-10 flex items-center justify-end active:scale-90">
          <span className="material-symbols-outlined font-bold">more_vert</span>
        </button>
      </header>

      <main className="px-6 space-y-8 overflow-y-auto no-scrollbar pt-2">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <div className="w-28 h-28 rounded-full border-4 border-white shadow-soft overflow-hidden bg-white ring-1 ring-black/5">
              <img src={user.avatar} className="w-full h-full object-cover" alt={user.name} />
            </div>
            {!user.isBlocked && (
              <div className="absolute bottom-1 right-1 bg-[#8BC34A] w-7 h-7 rounded-full border-4 border-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-white text-[14px] font-black">check</span>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <h2 className="text-[22px] font-black text-text-dark tracking-tight leading-none uppercase">{user.name}</h2>
            <span className="inline-flex bg-primary/10 text-primary text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
              {user.role}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 px-2">
          {[
            { label: 'Edit', icon: 'edit' },
            { label: user.isBlocked ? 'Activate' : 'Suspend', icon: 'block', onClick: handleToggleSuspend, active: user.isBlocked },
            { label: 'Message', icon: 'chat_bubble' },
            { label: 'Reset', icon: 'restart_alt' },
          ].map((btn) => (
            <button key={btn.label} onClick={btn.onClick} className="flex flex-col items-center gap-2 group">
              <div className={`w-14 h-14 rounded-2xl shadow-soft flex items-center justify-center border transition-all active:scale-90 ${btn.active ? 'bg-red-50 border-red-100' : 'bg-white border-gray-50'}`}>
                <span className={`material-symbols-outlined text-[24px] ${btn.active ? 'text-red-500 font-bold' : 'text-text-dark font-normal'}`}>{btn.icon}</span>
              </div>
              <span className="text-[10px] font-bold text-gray-400 group-active:text-primary uppercase tracking-tighter">{btn.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-[2rem] p-5 shadow-card border border-white flex flex-col justify-center min-h-[110px]">
            <p className="text-[8px] font-black text-gray-400 uppercase leading-tight mb-2 tracking-widest">TOTAL QUERY POSTED</p>
            <p className="text-[22px] font-black text-text-dark tracking-tighter">{stats.total}</p>
          </div>
          <div className="bg-white rounded-[2rem] p-5 shadow-card border border-white flex flex-col justify-center min-h-[110px]">
            <p className="text-[8px] font-black text-gray-400 uppercase leading-tight mb-2 tracking-widest">% OF ACCEPTED</p>
            <p className="text-[22px] font-black text-text-dark tracking-tighter">{stats.rate}%</p>
          </div>
          <div className="bg-white rounded-[2rem] p-5 shadow-card border border-white flex flex-col justify-center min-h-[110px]">
            <p className="text-[8px] font-black text-gray-400 uppercase leading-tight mb-2 tracking-widest">TOTAL HRS SPEND</p>
            <p className="text-[22px] font-black text-text-dark tracking-tighter">{stats.hours}</p>
            <span className="text-[8px] font-bold text-gray-400 -mt-1 uppercase">Hrs</span>
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
             <span className="material-symbols-outlined text-primary text-xl font-black">person</span>
             <h3 className="text-[15px] font-black text-text-dark uppercase tracking-tight">Personal Details</h3>
          </div>
          <div className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white space-y-8">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest ml-1">Email Address</label>
              <div className="flex items-center justify-between group cursor-pointer" onClick={() => handleCopy(user.email)}>
                <p className="text-[13px] font-bold text-text-dark truncate mr-4">{user.email}</p>
                <span className="material-symbols-outlined text-gray-300 text-[18px]">content_copy</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest ml-1">Phone Number</label>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="https://flagcdn.com/w20/ae.png" className="w-5 h-4 object-cover rounded-[1px] shadow-sm" alt="UAE" />
                  <p className="text-[13px] font-bold text-text-dark">{user.phone || 'Not provided'}</p>
                </div>
                <span className="material-symbols-outlined text-gray-300 text-[18px]">call</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest ml-1">Nationality</label>
                <p className="text-[13px] font-bold text-text-dark">{user.nationality || ''}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest ml-1">Language</label>
                <p className="text-[13px] font-bold text-text-dark">English</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
             <span className="material-symbols-outlined text-primary text-xl font-black">badge</span>
             <h3 className="text-[15px] font-black text-text-dark uppercase tracking-tight">Account Data</h3>
          </div>
          <div className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white space-y-10">
            <div className="grid grid-cols-2 gap-x-4 gap-y-10">
              <div>
                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1.5 ml-1">User ID</p>
                <div className="flex items-center gap-2 cursor-pointer active:opacity-60" onClick={() => handleCopy(`#${user.id.substring(0, 6)}`)}>
                   <p className="text-[13px] font-black text-text-dark uppercase tracking-tight">#{user.id.substring(0, 6).toUpperCase()}</p>
                   <span className="material-symbols-outlined text-gray-300 text-[16px]">content_copy</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1.5 ml-1">Account Type</p>
                <p className="text-[13px] font-black text-text-dark uppercase tracking-tight">{user.role}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1.5 ml-1">Registration Date</p>
                <p className="text-[13px] font-black text-text-dark">
                  {user.createdAt ? formatDubaiDate(user.createdAt) : 'N/A'}
                </p>
                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tight">{user.createdAt ? formatDubaiHMS(user.createdAt) : ''}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1.5 ml-1">Last Login</p>
                <p className="text-[13px] font-black text-text-dark uppercase tracking-tight">
                   {user.lastLoginAt ? 'Today' : 'Never'}
                </p>
                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tight">{user.lastLoginAt ? formatDubaiHMS(user.lastLoginAt) : ''}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
             <div className="flex items-center gap-2">
               <span className="material-symbols-outlined text-primary text-xl font-black">history</span>
               <h3 className="text-[15px] font-black text-text-dark uppercase tracking-tight">Activity Log</h3>
             </div>
             <button className="text-[11px] font-black text-primary uppercase tracking-widest">View All</button>
          </div>
          <div className="bg-white rounded-[2.5rem] p-7 shadow-card border border-white">
            <div className="space-y-8 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-gray-50">
               {activityLog.length > 0 ? activityLog.map((log) => (
                 <div key={log.id} className="relative flex gap-5 pl-8">
                    <div className={`absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center shadow-sm z-10 ${log.color}`}>
                       {!log.color.includes('border') ? (
                         <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                       ) : (
                         <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                       )}
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-start mb-1">
                          <h4 className="text-[13px] font-black text-text-dark uppercase tracking-tight truncate mr-2">{log.title}</h4>
                          <span className="text-[9px] font-bold text-gray-300 uppercase whitespace-nowrap">{formatDubaiTimeOnly(log.timestamp)}</span>
                       </div>
                       <p className="text-[11px] text-gray-400 font-bold uppercase tracking-tight leading-tight">{log.message}</p>
                    </div>
                 </div>
               )) : (
                 <p className="text-[10px] text-gray-300 uppercase tracking-widest text-center py-4">No recent activity</p>
               )}
            </div>
          </div>
        </section>

        <button 
          onClick={() => { if(window.confirm("PERMANENTLY DELETE THIS USER?")) showToast("Deletion request queued", "info"); }}
          className="w-full py-6 flex items-center justify-center gap-2 text-red-500 active:opacity-60 transition-opacity mt-4 border border-transparent hover:border-red-100 rounded-3xl"
        >
           <span className="material-symbols-outlined font-black text-[18px]">delete_forever</span>
           <span className="text-[12px] font-black uppercase tracking-[0.15em]">Delete User Account</span>
        </button>
      </main>
    </div>
  );
};

export default CustomerDetails;