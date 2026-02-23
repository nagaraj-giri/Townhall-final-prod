import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { authService } from '../services/authService';
import { User, UserRole, ServiceCategory } from '../types';
import { useApp } from '../App';
import { PlacesField } from '../FunctionsUI/placesfield';

const ProviderRegistration: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [form, setForm] = useState({
    businessName: '',
    locationName: '',
    lat: 25.185,
    lng: 55.275,
    selectedServices: [] as string[],
    contactPerson: '',
    whatsapp: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const fetchCats = async () => {
      const data = await dataService.getCategories();
      setCategories(data as ServiceCategory[]);
    };
    fetchCats();
  }, []);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const validatePhone = (phone: string) => {
    return /^\d{9}$/.test(phone.replace(/\s+/g, ''));
  };

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
    
    if (!form.businessName.trim()) { showToast("Business name is required", "error"); return; }
    if (!validateEmail(form.email)) { showToast("Please enter a valid corporate email", "error"); return; }
    if (!validatePhone(form.whatsapp)) { showToast("Enter a valid 9-digit UAE mobile number (e.g. 50XXXXXXX)", "error"); return; }
    if (!form.locationName.trim()) { showToast("Please select a business district", "error"); return; }
    if (form.selectedServices.length === 0) { showToast("Select at least one expertise area", "error"); return; }
    if (form.password.length < 8) { showToast("Password must be at least 8 characters", "error"); return; }
    if (form.password !== form.confirmPassword) { showToast("Passwords do not match", "error"); return; }

    setIsLoading(true);
    try {
      const newUser = await authService.signUp(form.email.trim(), form.password, form.contactPerson.trim());
      
      if (newUser) {
        const providerData: User = {
          ...newUser,
          name: form.businessName.trim(), 
          role: UserRole.PROVIDER,
          isVerified: false,
          status: 'pending_approval',
          services: form.selectedServices,
          categories: form.selectedServices,
          locationName: form.locationName,
          location: { lat: form.lat, lng: form.lng },
          phone: `+971 ${form.whatsapp.trim()}`,
          description: `Business application from ${form.contactPerson}`
        };

        await dataService.saveUser(providerData);
        showToast("Application submitted! Waiting for Admin verification.", "success");
        setTimeout(() => navigate('/profile'), 2000);
      }
    } catch (err: any) {
      showToast(err.message || "Registration failed.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center py-10 px-6">
      <div className="max-w-md w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="flex flex-col items-center text-center space-y-3">
          <button onClick={() => navigate('/login')} className="self-start w-10 h-10 bg-white rounded-2xl shadow-soft flex items-center justify-center text-gray-400 mb-2 active:scale-90 transition-transform">
            <span className="material-symbols-outlined font-normal">arrow_back</span>
          </button>
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-3xl flex items-center justify-center shadow-sm">
             <span className="material-symbols-outlined text-3xl font-normal">storefront</span>
          </div>
          <h1 className="text-2xl font-bold text-text-dark tracking-tighter uppercase">Provider Registration</h1>
          <p className="text-[10px] font-normal text-gray-400 uppercase tracking-widest">Register your UAE Trade License</p>
        </header>

        <form onSubmit={handleSubmit} className="bg-white rounded-[3rem] p-8 shadow-soft border border-gray-100 space-y-6 pb-12">
          <div className="space-y-4">
             <div className="space-y-1.5">
                <label className="text-[9px] font-black text-primary uppercase tracking-widest ml-1">Corporate Email</label>
                <input 
                  required
                  type="email"
                  className="w-full px-6 py-4 bg-gray-50 border-none rounded-full text-sm font-bold text-text-dark focus:ring-1 focus:ring-primary outline-none shadow-inner"
                  placeholder="office@business.ae"
                  value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-primary uppercase tracking-widest ml-1">Password</label>
                  <input 
                    required
                    type={showPassword ? 'text' : 'password'}
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-full text-sm font-bold text-text-dark focus:ring-1 focus:ring-primary shadow-inner"
                    placeholder="Min 8 chars"
                    value={form.password}
                    onChange={e => setForm({...form, password: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-primary uppercase tracking-widest ml-1">Confirm</label>
                  <input 
                    required
                    type={showPassword ? 'text' : 'password'}
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-full text-sm font-bold text-text-dark focus:ring-1 focus:ring-primary shadow-inner"
                    placeholder="Repeat"
                    value={form.confirmPassword}
                    onChange={e => setForm({...form, confirmPassword: e.target.value})}
                  />
                </div>
              </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-normal text-gray-400 uppercase tracking-widest ml-1">Business Name *</label>
              <input 
                required
                className="w-full px-6 py-4 bg-gray-50 border-none rounded-full text-sm font-normal text-text-dark focus:ring-1 focus:ring-primary outline-none shadow-inner"
                placeholder="Official Entity Name"
                value={form.businessName}
                onChange={e => setForm({...form, businessName: e.target.value})}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-normal text-gray-400 uppercase tracking-widest ml-1">Operational Area *</label>
              <div className="bg-gray-50 rounded-full px-6 min-h-[56px] overflow-hidden shadow-inner flex items-center border border-gray-100">
                 <PlacesField 
                  placeholder="e.g. Downtown Dubai"
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
              <label className="text-[9px] font-normal text-gray-400 uppercase tracking-widest ml-1">Expertise Categories *</label>
              <button
                  type="button"
                  onClick={() => setIsServiceDropdownOpen(!isServiceDropdownOpen)}
                  className="w-full px-6 py-4 bg-gray-50 border-none rounded-full text-sm font-normal text-text-dark flex items-center justify-between shadow-inner"
                >
                  <span className={form.selectedServices.length === 0 ? 'text-gray-300' : 'text-text-dark'}>
                    {form.selectedServices.length === 0 ? "Select Categories" : `${form.selectedServices.length} Selected`}
                  </span>
                  <span className="material-symbols-outlined">expand_more</span>
              </button>
              {isServiceDropdownOpen && (
                <div className="relative">
                  <div className="absolute z-[999] mt-2 w-full bg-white border rounded-3xl shadow-2xl p-4 max-h-60 overflow-y-auto">
                    {categories.map(cat => (
                      <div key={cat.id} onClick={() => toggleService(cat.name)} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer ${form.selectedServices.includes(cat.name) ? 'bg-primary/5' : ''}`}>
                        <span className="text-[10px] font-bold uppercase">{cat.name}</span>
                        {form.selectedServices.includes(cat.name) && <span className="material-symbols-outlined text-primary text-sm">check</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-normal text-gray-400 uppercase tracking-widest ml-1">WhatsApp Connectivity *</label>
              <div className="relative flex items-center bg-gray-50 rounded-full overflow-hidden shadow-inner">
                <div className="px-4 py-4 flex items-center gap-2 border-r border-gray-200 shrink-0 bg-white/50">
                  <img src="https://flagcdn.com/w20/ae.png" className="w-4 h-3 object-cover rounded-[1px]" alt="" />
                  <span className="text-xs font-normal text-gray-500">+971</span>
                </div>
                <input 
                  required
                  type="tel"
                  className="w-full px-5 py-4 bg-transparent border-none text-sm font-normal text-text-dark focus:ring-0 outline-none"
                  placeholder="50 000 0000"
                  value={form.whatsapp}
                  onChange={e => setForm({...form, whatsapp: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-white py-5 rounded-full font-black uppercase tracking-[0.2em] text-[12px] shadow-btn-glow flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Register Business'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProviderRegistration;