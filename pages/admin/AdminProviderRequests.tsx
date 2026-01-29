
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// @ts-ignore
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { User, UserRole } from '../../types';
import { useApp } from '../../App';

const AdminProviderRequests: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [requests, setRequests] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Querying the 'users' collection directly for unverified providers
    const q = query(
      collection(db, 'users'), 
      where('role', '==', UserRole.PROVIDER), 
      where('isVerified', '==', false)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as User));
      setRequests(data);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Registry Error:", error);
      showToast("Unable to sync provider registry", "error");
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF9F6] pb-10">
      <header className="px-6 pt-12 pb-6 flex items-center bg-white border-b border-gray-100 sticky top-0 z-50">
        <button onClick={() => navigate('/')} className="text-text-dark active:scale-90 transition-transform">
          <span className="material-symbols-outlined font-black">arrow_back</span>
        </button>
        <h1 className="text-lg font-black text-text-dark text-center flex-1 uppercase tracking-tight">Verification Queue</h1>
        <div className="w-10"></div>
      </header>

      <main className="px-6 pt-6 space-y-6 flex-1 overflow-y-auto no-scrollbar">
        <div className="bg-secondary/10 p-5 rounded-3xl border border-secondary/20 flex gap-4">
           <span className="material-symbols-outlined text-secondary text-2xl">verified_user</span>
           <p className="text-[11px] text-text-dark font-medium leading-relaxed">
             These businesses have created accounts and are waiting for manual vetting. Review their profiles to verify Trade Licenses and Service capability.
           </p>
        </div>

        {loading ? (
          <div className="py-20 text-center animate-pulse flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Retrieving Queue...</p>
          </div>
        ) : requests.length > 0 ? requests.map(req => (
          <div key={req.id} onClick={() => navigate(`/admin/user/${req.id}`)} className="bg-white rounded-[2.5rem] p-7 shadow-soft border border-white space-y-6 animate-in fade-in slide-in-from-bottom-3 active:scale-[0.98] transition-all cursor-pointer group">
            <div className="flex justify-between items-start">
              <div className="min-w-0 flex-1 pr-4">
                <h3 className="text-[17px] font-black text-text-dark uppercase tracking-tight leading-tight truncate">{req.name}</h3>
                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest leading-none">REG: {req.id.slice(-6).toUpperCase()}</p>
              </div>
              <span className="px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-orange-50 text-orange-500">PENDING</span>
            </div>
            
            <div className="bg-gray-100/60 p-6 rounded-[2.5rem] space-y-4 border border-gray-100/50 shadow-inner">
               <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-[20px]">mail</span>
                  <span className="truncate lowercase text-[13px] font-bold text-text-dark">{req.email}</span>
               </div>
               <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-accent-green text-[20px]">location_on</span>
                  <span className="truncate text-[13px] font-bold text-text-dark">{(req.locationName || 'Dubai, UAE').split(',')[0]}</span>
               </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(req.services || []).map(s => (
                <span key={s} className="bg-primary/10 text-primary text-[9px] font-black px-4 py-2 rounded-xl uppercase tracking-widest border border-primary/5">{s}</span>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
               <p className="text-[10px] text-gray-300 font-bold uppercase">Applied {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'Recently'}</p>
               <div className="flex items-center gap-1 text-primary text-[11px] font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                  Review
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
               </div>
            </div>
          </div>
        )) : (
          <div className="py-32 text-center opacity-20 flex flex-col items-center">
            <span className="material-symbols-outlined text-7xl font-light">fact_check</span>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] mt-6">All applications processed</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminProviderRequests;
