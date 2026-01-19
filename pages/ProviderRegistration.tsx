
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataService } from './services/dataService';
import { ProviderRequest, ServiceCategory } from '../types';
import { useApp } from '../App';
import { PlacesField } from '../Functions/placesfield';

const ProviderRegistration: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  
  const [form, setForm] = useState({
    businessName: '',
    locationName: '',
    lat: 25.185,
    lng: 55.275,
    selectedServices: [] as string[],
    contactPerson: '',
    role: '',
    whatsapp: '',
    email: ''
  });

  useEffect(() => {
    const fetchCats = async () => {
      const data = await dataService.getCategories();
      setCategories(data as ServiceCategory[]);
    };
    fetchCats();
  }, []);

  const toggleService = (serviceName: string) => {
    setForm(prev => ({
      ...prev,
      selectedServices: prev.selectedServices.includes(serviceName)
        ? prev.selectedServices.filter(s => s !== serviceName)
        : [...prev.selectedServices, serviceName]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.contactPerson || !form.whatsapp || !form.email || form.selectedServices.length === 0 || !form.locationName) {
      showToast("Please fill in all required fields including location", "error");
      return;
    }

    setIsLoading(true);
    const request: ProviderRequest = {
      id: `preq_${Date.now()}`,
      businessName: form.businessName,
      locationName: form.locationName,
      lat: form.lat,
      lng: form.lng,
      services: form.selectedServices,
      contactPerson: form.contactPerson,
      role: form.role,
      whatsapp: form.whatsapp,
      email: form.email,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    try {
      await dataService.saveProviderRequest(request);
      showToast("Application submitted successfully!", "success");
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      showToast("Submission failed", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center py-10 px-6">
      <div className="max-w-md w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="flex flex-col items-center text-center space-y-3">
          <button onClick={() => navigate('/login')} className="self-start w-10 h-10 bg-white rounded-2xl shadow-soft flex items-center justify-center text-gray-400 mb-2">
            <span className="material-symbols-outlined font-bold">arrow_back</span>
          </button>
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-3xl flex items-center justify-center shadow-sm">
             <span className="material-symbols-outlined text-3xl font-black">storefront</span>
          </div>
          <h1 className="text-2xl font-black text-text-dark tracking-tighter uppercase">Provider Application</h1>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Join the UAE's Elite Service Network</p>
        </header>

        <form onSubmit={handleSubmit} className="bg-white rounded-[3rem] p-8 shadow-soft border border-gray-100 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Business Name *</label>
              <input 
                required
                className="w-full px-6 py-4 bg-gray-50 border-none rounded-full text-sm font-bold text-text-dark focus:ring-1 focus:ring-primary outline-none shadow-inner"
                placeholder="Trade License Name"
                value={form.businessName}
                onChange={e => setForm({...form, businessName: e.target.value})}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Primary Location *</label>
              <div className="bg-gray-50 rounded-full px-6 min-h-[56px] overflow-hidden shadow-inner flex items-center border border-gray-100 pointer-events-auto">
                 <PlacesField 
                  placeholder="Search UAE Area..."
                  onPlaceChange={(res) => {
                    setForm(prev => ({ 
                      ...prev, 
                      locationName: res.name,
                      lat: res.lat, 
                      lng: res.lng 
                    }));
                  }}
                 />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Services Offered *</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsServiceDropdownOpen(!isServiceDropdownOpen)}
                  className="w-full px-6 py-4 bg-gray-50 border-none rounded-full text-sm font-bold text-text-dark flex items-center justify-between shadow-inner transition-all hover:bg-gray-100"
                >
                  <span className={form.selectedServices.length === 0 ? 'text-gray-300' : 'text-text-dark'}>
                    {form.selectedServices.length === 0 ? "Select Services" : `${form.selectedServices.length} selected`}
                  </span>
                  <span className={`material-symbols-outlined transition-transform duration-300 ${isServiceDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                
                {isServiceDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsServiceDropdownOpen(false)}></div>
                    <div className="absolute z-50 mt-3 w-full bg-white border border-gray-100 rounded-[2.5rem] shadow-2xl p-4 max-h-64 overflow-y-auto no-scrollbar animate-in fade-in zoom-in-95">
                      <div className="grid grid-cols-1 gap-1">
                        {categories.map(cat => (
                          <div key={cat.id} onClick={() => toggleService(cat.name)} className={`flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer ${form.selectedServices.includes(cat.name) ? 'bg-primary/5' : 'hover:bg-gray-50'}`}>
                            <span className={`text-xs font-bold uppercase tracking-tight ${form.selectedServices.includes(cat.name) ? 'text-primary' : 'text-text-dark'}`}>{cat.name}</span>
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${form.selectedServices.includes(cat.name) ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}>
                              {form.selectedServices.includes(cat.name) && <span className="material-symbols-outlined text-white text-[18px] font-black">check</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">WhatsApp Number *</label>
              <div className="relative flex items-center bg-gray-50 rounded-full overflow-hidden shadow-inner">
                <div className="px-4 py-4 flex items-center gap-2 border-r border-gray-200 shrink-0 bg-white/50">
                  <img src="https://flagcdn.com/w20/ae.png" className="w-4 h-3 object-cover rounded-[1px] shadow-sm" alt="" />
                  <span className="text-xs font-bold text-gray-500">+971</span>
                </div>
                <input 
                  required
                  className="w-full px-5 py-4 bg-transparent border-none text-sm font-bold text-text-dark focus:ring-0 outline-none"
                  placeholder="50 123 4567"
                  value={form.whatsapp}
                  onChange={e => setForm({...form, whatsapp: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Business Email *</label>
              <input 
                required
                type="email"
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-full text-sm font-bold text-text-dark focus:ring-1 focus:ring-primary outline-none shadow-inner"
                placeholder="contact@business.ae"
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-primary via-[#7B5CC4] to-[#A073E2] text-white py-5 rounded-full font-bold text-sm shadow-xl shadow-purple-100 flex items-center justify-center gap-3 transform active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProviderRegistration;
