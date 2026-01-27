
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, RFQ } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';
import { PlacesField } from '../../Functions/placesfield';

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

      if (initialQuery) {
        setTitle(initialQuery);
      } else if (preSelected && names.includes(preSelected)) {
        setService(preSelected);
      } else if (names.length > 0) {
        setService(names[0]);
      }
    };
    fetchData();
  }, [location.state]);

  const handleCreate = async () => {
    if (!user.phone || !user.nationality) {
      showToast("Please update your mobile and nationality in Profile", 'error');
      setTimeout(() => navigate('/profile'), 1500);
      return;
    }

    if (!title.trim() || !description.trim() || !locationName) {
      showToast("Please fill in all details", 'error');
      return;
    }
    
    setIsSubmitting(true);
    const rfq: RFQ = {
      id: `rfq_${Date.now()}`,
      idDisplay: `#DXB-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: user.id,
      customerName: user.name,
      customerAvatar: user.avatar,
      title: title.trim(),
      description: description.trim(),
      service, 
      category: service, 
      locationName: locationName,
      lat: coords.lat,
      lng: coords.lng,
      status: 'OPEN', 
      createdAt: new Date().toISOString(),
      quotesCount: 0,
      searchRadius: 3 
    };

    try {
      await dataService.saveRFQ(rfq);
      showToast("Query broadcasted to UAE Experts", 'success');
      setTimeout(() => navigate('/queries'), 800);
    } catch (err) {
      showToast("Failed to post", "error");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm flex flex-col justify-end">
      <div className="absolute inset-0" onClick={() => navigate(-1)}></div>
      <div className="relative z-10 bg-[#FAF9F6] rounded-t-[3rem] w-full shadow-2xl animate-in slide-in-from-bottom duration-500 h-[94vh] flex flex-col overflow-hidden">
        <header className="px-8 pt-8 pb-4 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-xl font-[900] text-text-dark tracking-tight leading-none uppercase">Post Requirement</h1>
            <p className="text-[9px] text-primary font-black uppercase tracking-[0.2em] mt-2">Verified UAE Network</p>
          </div>
          <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white shadow-sm rounded-full flex items-center justify-center text-gray-400 active:scale-90 transition-all">
            <span className="material-symbols-outlined font-bold">close</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-8 pb-10 space-y-6 no-scrollbar pt-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Requirement Title</label>
              </div>
              <input 
                type="text" 
                placeholder="e.g. Setting up a Freezone Company" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="w-full px-6 py-4.5 bg-white border border-gray-100 rounded-2xl text-[14px] font-bold text-text-dark focus:ring-1 focus:ring-primary shadow-sm placeholder-gray-300 transition-all" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Service Stream</label>
              <div className="relative">
                <select 
                  value={service} 
                  onChange={e => setService(e.target.value)} 
                  className="w-full px-6 py-4.5 bg-white border border-gray-100 rounded-2xl text-[13px] font-bold text-text-dark focus:ring-1 focus:ring-primary shadow-sm appearance-none"
                >
                  {availableServices.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="absolute right-5 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-300 pointer-events-none">expand_more</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Precise Location (UAE)</label>
              <div className="relative flex items-center bg-white border border-gray-100 rounded-2xl shadow-sm px-4 min-h-[58px] focus-within:ring-1 focus-within:ring-primary transition-all pointer-events-auto">
                <span className="material-symbols-outlined text-accent-pink text-[22px] mr-2 shrink-0">location_on</span>
                <PlacesField 
                  placeholder="Select District (e.g. JLT)"
                  onPlaceChange={(res) => {
                    setLocationName(res.name);
                    setCoords({ lat: res.lat, lng: res.lng });
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Context & Details</label>
              <textarea 
                placeholder="Briefly describe what you need..." 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                className="w-full px-6 py-5 bg-white border border-gray-100 rounded-[2.2rem] text-[14px] font-medium text-text-dark focus:ring-1 focus:ring-primary shadow-sm min-h-[160px] resize-none placeholder-gray-300 leading-relaxed" 
              />
            </div>
          </div>
        </main>

        <footer className="p-8 bg-white border-t border-gray-100 shrink-0">
          <button 
            onClick={handleCreate} 
            disabled={isSubmitting || !description.trim() || !title.trim() || !locationName} 
            className="w-full bg-primary text-white py-5 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-btn-glow flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
          >
            {isSubmitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (
              <>
                BROADCAST LIVE
                <span className="material-symbols-outlined text-lg font-black">sensors</span>
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default CreateRFQ;
