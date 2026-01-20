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
      if (preSelected && names.includes(preSelected)) {
        setService(preSelected);
      } else if (names.length > 0) {
        setService(names[0]);
      }
    };
    fetchData();
  }, [location.state]);

  const handleCreate = async () => {
    // Validation for phone and nationality
    if (!user.phone || !user.nationality) {
      showToast("Please update your mobile and nationality in Profile to post query", 'error');
      setTimeout(() => navigate('/profile'), 2000);
      return;
    }

    if (!title.trim() || !description.trim()) {
      showToast("Please provide all details", 'error');
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
      locationName: locationName || 'Dubai, UAE',
      lat: coords.lat,
      lng: coords.lng,
      status: 'OPEN', 
      createdAt: new Date().toISOString(),
      quotesCount: 0,
      searchRadius: 3 
    };

    try {
      await dataService.saveRFQ(rfq);
      showToast("Query broadcasted successfully", 'success');
      setTimeout(() => navigate('/queries'), 1000);
    } catch (err) {
      showToast("Failed to post", "error");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm flex flex-col justify-end">
      <div className="absolute inset-0" onClick={() => navigate(-1)}></div>
      <div className="relative z-10 bg-white rounded-t-[3rem] w-full shadow-2xl animate-in slide-in-from-bottom duration-500 h-[92vh] flex flex-col overflow-hidden">
        <header className="px-8 pt-8 pb-4 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text-dark tracking-tight leading-none">New Service Query</h1>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mt-2">Hyperlocal Discovery</p>
          </div>
          <button onClick={() => navigate(-1)} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 active:scale-90 transition-all">
            <span className="material-symbols-outlined font-bold">close</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-8 pb-10 space-y-6 no-scrollbar pt-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Official Category</label>
              <div className="relative">
                <select 
                  value={service} 
                  onChange={e => setService(e.target.value)} 
                  className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-[13px] font-bold text-text-dark focus:ring-1 focus:ring-primary shadow-inner appearance-none transition-all"
                >
                  {availableServices.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="absolute right-5 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none">unfold_more</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Title</label>
              <input 
                type="text" 
                placeholder="e.g. Family Visa Renewal" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-[13px] font-bold text-text-dark focus:ring-1 focus:ring-primary shadow-inner placeholder-gray-300 transition-all" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Location</label>
              <div className="relative flex items-center bg-gray-50 border border-gray-100 rounded-2xl shadow-inner px-4 min-h-[56px] focus-within:ring-1 focus-within:ring-primary transition-all pointer-events-auto">
                <span className="material-symbols-outlined text-accent-pink text-[22px] mr-2 shrink-0">location_on</span>
                <PlacesField 
                  placeholder="Search area in UAE..."
                  onPlaceChange={(res) => {
                    setLocationName(res.name);
                    setCoords({ lat: res.lat, lng: res.lng });
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Requirements</label>
              </div>
              <textarea 
                placeholder="Tell providers exactly what you need..." 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                className="w-full px-6 py-5 bg-gray-50 border-none rounded-[2rem] text-[13px] font-medium text-text-dark focus:ring-1 focus:ring-primary shadow-inner min-h-[160px] resize-none placeholder-gray-300 transition-all" 
              />
            </div>
          </div>
        </main>

        <footer className="p-8 bg-white border-t border-gray-50 shrink-0">
          <button 
            onClick={handleCreate} 
            disabled={isSubmitting || !description.trim() || !title.trim() || !locationName} 
            className="w-full bg-primary text-white py-5 rounded-full font-bold text-sm shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
          >
            {isSubmitting ? 'Posting...' : 'Post Query'}
            <span className="material-symbols-outlined text-lg font-black">bolt</span>
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-4 font-medium leading-relaxed">Broadcast your query to nearby verified providers.</p>
        </footer>
      </div>
    </div>
  );
};

export default CreateRFQ;