
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { User, ProviderRequest } from '../../types';
import { useApp } from '../../App';

interface RequestDetailProps {
  adminUser: User;
}

const ProviderRequestDetail: React.FC<RequestDetailProps> = ({ adminUser }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useApp();
  const [request, setRequest] = useState<ProviderRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchRequest = async () => {
      if (id) {
        const data = await dataService.getProviderRequestById(id);
        setRequest(data);
      }
    };
    fetchRequest();
  }, [id]);

  const handleUpdateStatus = async (status: 'APPROVED' | 'REJECTED') => {
    if (!request) return;
    setIsProcessing(true);
    try {
      await dataService.updateProviderRequestStatus(request.id, status);
      
      await dataService.createAuditLog({
        admin: adminUser,
        title: `Provider Application ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
        type: "BUSINESS_VERIFICATION",
        severity: status === 'APPROVED' ? "MEDIUM" : "LOW",
        icon: status === 'APPROVED' ? "verified" : "cancel",
        iconBg: status === 'APPROVED' ? "bg-accent-green" : "bg-red-500",
        eventId: request.id
      });

      setRequest({ ...request, status });
      showToast(`Application ${status.toLowerCase()} successfully`, "success");
      if (status === 'APPROVED') {
        showToast("Provider has been notified of their verification.", "info");
      }
    } catch (err) {
      showToast("Operation failed. Please check network.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!request) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Opening application...</p>
    </div>
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      timeZone: 'Asia/Dubai',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="flex flex-col min-h-screen pb-10 bg-transparent">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-white/10 backdrop-blur-md z-30 border-b border-gray-100/50">
        <button onClick={() => navigate(-1)} className="text-text-dark w-10 h-10 flex items-center justify-start active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-2xl font-bold">arrow_back</span>
        </button>
        <h1 className="text-base font-bold text-text-dark text-center flex-1">Application Review</h1>
        <div className="w-10"></div>
      </header>

      <main className="px-6 space-y-6 flex-1 overflow-y-auto no-scrollbar pt-4">
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary mb-4 shadow-sm">
            <span className="material-symbols-outlined text-4xl font-black">storefront</span>
          </div>
          <h2 className="text-xl font-bold text-text-dark tracking-tight">{request.businessName}</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Application ID: {request.id}</p>
          <div className={`mt-4 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
            request.status === 'PENDING' ? 'bg-[#FFF9E5] text-[#FFB100]' : 
            request.status === 'APPROVED' ? 'bg-[#F0F9EB] text-[#8BC34A]' : 'bg-red-50 text-red-500'
          }`}>
            {request.status}
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-7 shadow-card border border-white space-y-6">
          <div className="space-y-5">
             <div className="space-y-1">
               <p className="text-[9px] text-gray-300 font-black uppercase tracking-widest ml-1">Submission Timeline</p>
               <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                 <p className="text-sm font-bold text-text-dark">{formatDate(request.createdAt)}</p>
                 <span className="text-[10px] font-bold text-gray-400">DUBAI TIME</span>
               </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] text-gray-300 font-black uppercase tracking-widest ml-1">Primary Contact</p>
                  <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-sm font-bold text-text-dark truncate">{request.contactPerson}</p>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">{request.role || 'Partner'}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] text-gray-300 font-black uppercase tracking-widest ml-1">Operational Area</p>
                  <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-sm font-bold text-text-dark truncate">{(request.locationName || 'Unknown').split(',')[0]}</p>
                    <p className="text-[10px] text-gray-400 font-medium">UAE</p>
                  </div>
                </div>
             </div>

             <div className="space-y-1">
               <p className="text-[9px] text-gray-300 font-black uppercase tracking-widest ml-1">Verified Connectivity</p>
               <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 space-y-3">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center text-accent-green">
                      <span className="material-symbols-outlined text-lg">chat</span>
                   </div>
                   <p className="text-sm font-bold text-text-dark tracking-tight">+971 {request.whatsapp}</p>
                 </div>
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                      <span className="material-symbols-outlined text-lg">mail</span>
                   </div>
                   <p className="text-xs font-bold text-primary">{request.email}</p>
                 </div>
               </div>
             </div>

             <div className="space-y-2">
               <p className="text-[9px] text-gray-300 font-black uppercase tracking-widest ml-1">Proposed Services</p>
               <div className="flex flex-wrap gap-2 pt-1">
                 {request.services.map(s => (
                   <span key={s} className="bg-primary/5 text-primary text-[10px] font-bold px-4 py-2 rounded-xl border border-primary/5 uppercase tracking-tight animate-in zoom-in-95">
                     {s}
                   </span>
                 ))}
               </div>
             </div>
          </div>
        </div>

        {request.status === 'PENDING' && (
          <div className="flex gap-4 pt-4">
            <button 
              onClick={() => handleUpdateStatus('REJECTED')}
              disabled={isProcessing}
              className="flex-1 py-4 bg-white border border-red-50 text-red-500 rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-sm active:scale-95 transition-all"
            >
              Reject
            </button>
            <button 
              onClick={() => handleUpdateStatus('APPROVED')}
              disabled={isProcessing}
              className="flex-1 py-4 bg-primary text-white rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-purple-100 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (
                <>
                  <span className="material-symbols-outlined text-sm">verified</span>
                  Approve & Verify
                </>
              )}
            </button>
          </div>
        )}
        
        <button onClick={() => navigate(-1)} className="w-full py-6 text-[11px] font-black text-gray-300 uppercase tracking-[0.2em] active:text-primary transition-colors">
           Back to Command Center
        </button>
      </main>
    </div>
  );
};

export default ProviderRequestDetail;
