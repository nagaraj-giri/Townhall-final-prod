
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { authService } from '../authService';
import { User, RFQ } from '../../types';
import { useApp } from '../../App';

const CustomerDetails: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useApp();
  const [user, setUser] = useState<User | null>(null);
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Form state for editing
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    nationality: '',
    email: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      const [u, allRfqs] = await Promise.all([
        dataService.getUserById(id),
        dataService.getRFQs()
      ]);
      if (u) {
        setUser(u as User);
        setEditForm({
          name: u.name || '',
          phone: u.phone || '',
          nationality: u.nationality || '',
          email: u.email || ''
        });
        setRfqs(allRfqs.filter(r => r.customerId === u.id));
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const stats = useMemo(() => {
    const total = rfqs.length;
    const accepted = rfqs.filter(r => r.status === 'ACCEPTED' || r.status === 'COMPLETED').length;
    const rate = total > 0 ? Math.round((accepted / total) * 100) : 0;
    
    // Removing mock duration calculation. 
    const actualHrs = 0; 

    return { 
      total: total, 
      rate: `${rate}%`, 
      hours: actualHrs.toLocaleString()
    };
  }, [rfqs]);

  const activityLog = useMemo(() => {
    const logs = [];
    if (user?.createdAt) {
      logs.push({ 
        title: 'Account Created', 
        desc: 'New customer profile registered', 
        time: new Date(user.createdAt), 
        color: 'bg-gray-200',
        timeStr: new Date(user.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateStr: new Date(user.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
      });
    }
    if (user?.lastLoginAt) {
      const loginDate = new Date(user.lastLoginAt);
      const isToday = loginDate.toDateString() === new Date().toDateString();
      logs.push({ 
        title: 'User Login', 
        desc: `System session authenticated`, 
        time: loginDate, 
        color: 'border-primary border-2 bg-white',
        timeStr: loginDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateStr: isToday ? 'Today' : loginDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
      });
    }
    rfqs.slice(0, 5).forEach(r => {
      logs.push({ 
        title: 'Posted Query', 
        desc: `Broadcasted: "${r.title}"`, 
        time: new Date(r.createdAt), 
        color: 'bg-primary',
        timeStr: new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateStr: new Date(r.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
      });
    });
    return logs.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [user, rfqs]);

  const handleSave = async () => {
    if (!user) return;
    try {
      const updated = { ...user, ...editForm };
      await dataService.saveUser(updated);
      setUser(updated);
      setIsEditing(false);
      showToast("Profile updated", "success");
    } catch (e) {
      showToast("Update failed", "error");
    }
  };

  const handleToggleSuspend = async () => {
    if (!user) return;
    const updated = { ...user, isBlocked: !user.isBlocked };
    try {
      await dataService.saveUser(updated);
      setUser(updated);
      showToast(updated.isBlocked ? "User Suspended" : "User Restored", "info");
    } catch (e) {
      showToast("Update failed", "error");
    }
  };

  const handleSendReset = async () => {
    if (!user) return;
    setIsSendingReset(true);
    try {
      await authService.resetPassword(user.email);
      showToast("Reset link sent", "success");
    } catch (err) {
      showToast("Dispatch failed", "error");
    } finally {
      setIsSendingReset(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return <div className="p-20 text-center text-gray-300 uppercase tracking-widest font-black text-[10px] bg-transparent min-h-screen">Record not found</div>;

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-12">
      <header className="px-4 pt-10 pb-4 flex items-center justify-between sticky top-0 bg-white/20 backdrop-blur-md z-50">
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
            <div className="w-28 h-28 rounded-full border-[4px] border-white shadow-lg overflow-hidden bg-white ring-1 ring-black/5">
              <img src={user.avatar} className="w-full h-full object-cover" alt="" />
            </div>
            {!user.isBlocked && (
              <div className="absolute bottom-1 right-1 bg-[#8BC34A] w-7 h-7 rounded-full border-4 border-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-white text-[14px] font-black">check</span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 justify-center">
              {isEditing ? (
                <input 
                  className="text-[22px] font-black text-text-dark bg-white border-none rounded-xl px-4 py-1 text-center outline-none focus:ring-1 focus:ring-primary shadow-inner max-w-[200px]" 
                  value={editForm.name} 
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                />
              ) : (
                <h2 className="text-[22px] font-black text-text-dark tracking-tight leading-none uppercase">{user.name}</h2>
              )}
              <span className="bg-[#EBE7F5] text-[#5B3D9D] text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">CLIENT</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 px-2">
          {[
            { label: isEditing ? 'Save' : 'Edit', icon: isEditing ? 'check' : 'edit', onClick: isEditing ? handleSave : () => setIsEditing(true), active: isEditing },
            { label: user.isBlocked ? 'Restore' : 'Suspend', icon: 'block', onClick: handleToggleSuspend, active: user.isBlocked },
            { label: 'Message', icon: 'chat_bubble', onClick: () => navigate(`/messages/${user.id}`) },
            { label: 'Reset', icon: 'history', onClick: handleSendReset, loading: isSendingReset },
          ].map((btn) => (
            <button key={btn.label} onClick={btn.onClick} disabled={btn.loading} className="flex flex-col items-center gap-2.5">
              <div className={`w-14 h-14 rounded-2xl shadow-sm flex items-center justify-center border border-white transition-all active:scale-90 ${btn.active ? 'bg-primary text-white' : 'bg-white text-text-dark'}`}>
                {btn.loading ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-[24px]">{btn.icon}</span>}
              </div>
              <span className="text-[11px] font-bold text-gray-400">{btn.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-white flex flex-col items-start min-h-[110px]">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">TOTAL <br/> QUERY <br/> POSTED</p>
            <p className="text-[26px] font-black text-text-dark tracking-tighter">{stats.total}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-white flex flex-col items-start min-h-[110px]">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">% OF <br/> ACCEPTED</p>
            <div className="flex items-baseline gap-1">
               <p className="text-[26px] font-black text-text-dark tracking-tighter">{stats.rate.replace('%', '')}</p>
               <p className="text-xs font-bold text-gray-400">%</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-white flex flex-col items-start min-h-[110px]">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">PLATFORM <br/> UTILIZATION</p>
            <div className="flex items-baseline gap-1">
               <p className="text-[26px] font-black text-text-dark tracking-tighter">{stats.hours}</p>
               <p className="text-[10px] font-bold text-gray-400">HRS</p>
            </div>
          </div>
        </div>

        <section className="space-y-4">
           <div className="flex items-center gap-2 px-1">
              <span className="material-symbols-outlined text-[#5B3D9D] text-[20px] font-bold">person</span>
              <h3 className="text-[15px] font-bold text-text-dark">Personal Details</h3>
           </div>
           <div className="bg-white rounded-[2.2rem] shadow-sm border border-white divide-y divide-gray-50 overflow-hidden">
              <div className="p-5 flex items-center justify-between group">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Address</p>
                  <p className="text-[14px] font-bold text-text-dark truncate">{user.email}</p>
                </div>
                <button onClick={() => { if(user.email) { navigator.clipboard.writeText(user.email); showToast("Copied!", "success"); } }} className="w-10 h-10 flex items-center justify-center text-gray-300">
                  <span className="material-symbols-outlined text-[20px]">content_copy</span>
                </button>
              </div>

              <div className="p-5 flex items-center justify-between group">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phone Number</p>
                  <div className="flex items-center gap-2">
                    <img src="https://flagcdn.com/w20/ae.png" className="w-4 h-3 object-cover rounded-[1px] shadow-xs" alt="" />
                    {isEditing ? (
                      <input 
                        className="text-[14px] font-bold text-text-dark bg-gray-50 rounded-lg px-2 py-1 outline-none w-full"
                        value={editForm.phone}
                        onChange={e => setEditForm({...editForm, phone: e.target.value})}
                      />
                    ) : (
                      <p className="text-[14px] font-bold text-text-dark">{user.phone || '---'}</p>
                    )}
                  </div>
                </div>
                <button className="w-10 h-10 flex items-center justify-center text-gray-300">
                  <span className="material-symbols-outlined text-[20px]">call</span>
                </button>
              </div>

              <div className="grid grid-cols-2">
                <div className="p-5 border-r border-gray-50 space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nationality</p>
                  {isEditing ? (
                    <input 
                      className="text-[14px] font-bold text-text-dark bg-gray-50 rounded-lg px-2 py-1 outline-none w-full"
                      value={editForm.nationality}
                      onChange={e => setEditForm({...editForm, nationality: e.target.value})}
                    />
                  ) : (
                    <p className="text-[14px] font-bold text-text-dark uppercase">{user.nationality || 'Not Set'}</p>
                  )}
                </div>
                <div className="p-5 space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Languages</p>
                  <p className="text-[14px] font-bold text-text-dark lowercase italic">{user.nationality ? 'Primary Local + English' : 'Not Specified'}</p>
                </div>
              </div>
           </div>
        </section>

        <section className="space-y-4">
           <div className="flex items-center gap-2 px-1">
              <span className="material-symbols-outlined text-[#5B3D9D] text-[20px] font-bold">badge</span>
              <h3 className="text-[15px] font-bold text-text-dark">Account Data</h3>
           </div>
           <div className="bg-white rounded-[2.2rem] shadow-sm border border-white p-6 space-y-8">
              <div className="grid grid-cols-2 gap-y-8">
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">User ID</p>
                   <div className="flex items-center gap-1">
                      <p className="text-[14px] font-bold text-text-dark">#{user.id.substring(0, 6).toUpperCase()}</p>
                      <button onClick={() => { navigator.clipboard.writeText(user.id); showToast("Copied ID!", "success"); }} className="material-symbols-outlined text-[14px] text-gray-300">content_copy</button>
                   </div>
                 </div>
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Account Type</p>
                   <p className="text-[14px] font-bold text-text-dark">Customer</p>
                 </div>
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Registration Date</p>
                   <p className="text-[14px] font-bold text-text-dark">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '---'}</p>
                   <p className="text-[10px] font-medium text-gray-300">{user.createdAt ? new Date(user.createdAt).toLocaleTimeString('en-US', { hour12: false }) : ''} GST</p>
                 </div>
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Last Login</p>
                   <p className="text-[14px] font-bold text-text-dark">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '---'}</p>
                   <p className="text-[10px] font-medium text-gray-300">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleTimeString('en-US', { hour12: false }) : ''} GST</p>
                 </div>
              </div>
           </div>
        </section>

        <section className="space-y-4">
           <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#5B3D9D] text-[20px] font-bold">history</span>
                <h3 className="text-[15px] font-bold text-text-dark">Activity Log</h3>
              </div>
              <button className="text-[11px] font-bold text-[#5B3D9D] uppercase tracking-wider">View All</button>
           </div>
           
           <div className="bg-white rounded-[2.2rem] shadow-sm border border-white p-6 space-y-0">
              {activityLog.length > 0 ? activityLog.map((log, idx) => (
                <div key={idx} className="flex gap-4 relative pb-8 group last:pb-2">
                   {idx !== activityLog.length - 1 && <div className="absolute left-[7px] top-6 bottom-[-8px] w-[2px] bg-gray-50 group-last:hidden"></div>}
                   <div className={`w-4 h-4 rounded-full ${log.color} shrink-0 z-10 border-[3px] border-white shadow-sm mt-1 flex items-center justify-center`}>
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <h4 className="text-[14px] font-bold text-text-dark">{log.title}</h4>
                        <span className="text-[10px] font-bold text-gray-300 uppercase">{log.timeStr}</span>
                      </div>
                      <p className="text-[12px] text-gray-400 font-medium leading-relaxed">{log.desc}</p>
                      <p className="text-[10px] text-gray-300 font-bold uppercase mt-1">{log.dateStr}</p>
                   </div>
                </div>
              )) : (
                <div className="py-10 text-center text-gray-300 uppercase tracking-widest text-[10px] font-black">No recent records</div>
              )}
           </div>
        </section>

        <button 
          onClick={() => { if(window.confirm("PERMANENTLY PURGE THIS ACCOUNT?")) dataService.deleteUser(user.id).then(() => navigate('/admin/users')); }}
          className="w-full py-5 bg-white border border-gray-100 text-red-500 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xs"
        >
          <span className="material-symbols-outlined text-[18px] font-black text-red-500">delete</span>
          Purge Customer Record
        </button>
      </main>
    </div>
  );
};

export default CustomerDetails;
