import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, RFQ, UserRole } from '../../types';
import { dataService } from '../../services/dataService';
import { useApp } from '../../App';
import { PlacesField } from '../../FunctionsUI/placesfield';

interface CreateRFQProps {
  user: User;
}

const CreateRFQ: React.FC<CreateRFQProps> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useApp();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [coords, setCoords] = useState({ lat: 25.185, lng: 55.275 });
  const [service, setService] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableServices, setAvailableServices] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const cats = await dataService.getCategories();
      const names = cats.map((c: any) => c.name);
      setAvailableServices(names);
      
      const preSelected = location.state?.selectedCategory;
      const initialQuery = location.state?.initialQuery;
      if (initialQuery) setTitle(initialQuery);
      if (preSelected && names.includes(preSelected)) {
        setService(preSelected);
      } else if (names.length > 0 && !service) {
        setService(names[0]);
      }
    };
    fetchData();
  }, [location.state, service]);

  const isProfileComplete = !!(user.phone && user.nationality);

  const handleCreate = async () => {
    if (!isProfileComplete) {
      showToast("Missing Mobile/Nationality. Redirecting...", 'error');
      setTimeout(() => navigate('/profile'), 1800);
      return;
    }
    if (!title.trim() || !description.trim() || !locationName) {
      showToast("Please complete all fields", 'error');
      return;
    }
    
    setIsSubmitting(true);
    const rfqId = `rfq_${Date.now()}`;
    
    // Structured exactly as per dataschema.json
    const rfq: RFQ = {
      id: rfqId,
      idDisplay: `#DXB-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: user.id,
      customerName: user.name,
      customerEmail: user.email,
      customerPhone: user.phone || '',
      customerAvatar: user.avatar,
      title: title.trim(),
      description: description.trim(),
      service: service || availableServices[0] || 'General Service', 
      category: service || availableServices[0] || 'General Service', 
      locationName: locationName,
      location: { lat: coords.lat, lng: coords.lng },
      status: 'OPEN', 
      createdAt: new Date().toISOString(),
      quotesCount: 0,
      searchRadius: 3 
    };

    try {
      await dataService.saveRFQ(rfq);
      await dataService.triggerLeadMatchingNotifications(rfq);
      
      await dataService.createAuditLog({
        actor: { userId: user.id, userName: user.name, userRole: user.role },
        target: { entity: 'rfqs', entityId: rfqId },
        title: `Broadcasted New Query: ${rfq.idDisplay}`,
        type: 'QUERY_LIFECYCLE',
        severity: 'LOW'
      });

      showToast("Broadcast Successful", 'success');
      setTimeout(() => navigate('/queries'), 800);
    } catch (err) {
      showToast("Sync Error", "error");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm flex flex-col justify-end">
      <div className="absolute inset-0" onClick={() => navigate(-1)}></div>
      <div className="relative z-10 bg-white rounded-t-[3rem] w-full shadow-2xl animate-in slide-in-from-bottom duration-500 h-[94vh] flex flex-col overflow-hidden">
        <header className="px-8 pt-8 pb-4 flex justify-between items-center shrink-0">
          <div><h1 className="text-xl font-black text-text-dark tracking-tight uppercase">Post Requirement</h1><p className="text-[9px] text-primary font-black uppercase tracking-[0.2em] mt-2">AIRRA Intelligence Active</p></div>
          <button onClick={() => navigate(-1)} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 active:scale-90 transition-all"><span className="material-symbols-outlined">close</span></button>
        </header>
        <main className="flex-1 overflow-y-auto px-8 pb-10 space-y-6 no-scrollbar pt-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Requirement Title</label>
              <input type="text" placeholder="What do you need help with?" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-6 py-4.5 bg-gray-50 border-none rounded-2xl text-[14px] font-bold text-text-dark focus:ring-1 focus:ring-primary shadow-inner" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Service Stream</label>
              <select value={service} onChange={e => setService(e.target.value)} className="w-full px-6 py-4.5 bg-gray-50 border-none rounded-2xl text-[13px] font-bold text-text-dark focus:ring-1 focus:ring-primary shadow-inner">
                {availableServices.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">UAE Operational District</label>
              <div className="relative flex items-center bg-gray-50 rounded-2xl shadow-inner px-4 min-h-[58px] focus-within:ring-1 focus-within:ring-primary">
                <span className="material-symbols-outlined text-accent-pink text-[22px] mr-2 shrink-0">location_on</span>
                <PlacesField onPlaceChange={(res) => { setLocationName(res.name); setCoords({ lat: res.lat, lng: res.lng }); }} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Context & Details</label>
              <textarea placeholder="Describe your needs..." value={description} onChange={e => setDescription(e.target.value)} className="w-full px-6 py-5 bg-gray-50 border-none rounded-[2.2rem] text-[14px] font-medium text-text-dark focus:ring-1 focus:ring-primary shadow-inner min-h-[160px] resize-none leading-relaxed" />
            </div>
          </div>
        </main>
        <footer className="p-8 bg-white border-t border-gray-100 shrink-0">
          <button onClick={handleCreate} disabled={isSubmitting || !description.trim() || !title.trim()} className={`w-full py-5 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-btn-glow flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 ${isProfileComplete ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400 shadow-none border border-gray-200'}`}>
            {isSubmitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (isProfileComplete ? 'STRATEGIC BROADCAST' : 'COMPLETE PROFILE TO POST')}
          </button>
        </footer>
      </div>
    </div>
  );
};
export default CreateRFQ;