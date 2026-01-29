

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataService } from './services/dataService';
import { authService } from './authService';
import { User, UserRole, ServiceCategory } from '../types';
import { useApp } from '../App';
import { PlacesField } from '../Functions/placesfield';

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
    
    // Validations
    if (!form.businessName.trim()) { showToast("Business name is required", "error"); return; }
    if (!form.locationName.trim()) { showToast("Please select a valid district", "error"); return; }
    if (form.selectedServices.length === 0) { showToast("Select at least one service category", "error"); return; }
    if (form.password.length < 6) { showToast("Password must be at least 6 characters", "error"); return; }
    if (form.password !== form.confirmPassword) { showToast("Passwords do not match", "error"); return; }

    setIsLoading(true);
    try {
      // 1. Create the Auth User account
      // This will automatically log the user in on the frontend
      const newUser = await authService.signUp(form.email.trim(), form.password, form.contactPerson.trim());
      
      if (newUser) {
        // 2. Supplement the User record with Provider specific details
        const providerData: User = {
          ...newUser,
          name: form.businessName.trim(), // Display name is business name
          role: UserRole.PROVIDER,
          // Fixed: isVerified and status properties are now part of the User interface in types.ts
          isVerified: false,
          status: 'pending_approval',
          services: form.selectedServices,
          categories: form.selectedServices,
          locationName: form.locationName,
          location: { lat: form.lat, lng: form.lng },
          phone: `+971 ${form.whatsapp}`,
          description: `Business application from ${form.contactPerson}`
        };

        await dataService.saveUser(providerData);
        
        // 3. Log Audit Activity
        await dataService.createAuditLog({
          title: `New Business Registration: ${form.businessName}`,
          type: "USER_REGISTRATION",
          severity: "MEDIUM",
          eventId: newUser.id,
          details: { email: form.email, contact: form.contactPerson }
        });

        showToast("Account created! Waiting for Admin verification.", "success");
        // Redirect to a "waiting" state or profile
        setTimeout(() => navigate('/profile'), 2000);
      }
    } catch (err: any) {
      console.error("Registration Error:", err);
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
          <h1 className="text-2xl font-bold text-text-dark tracking-tighter uppercase">Provider Join</h1>
          <p className="text-[10px] font-normal text-gray-400 uppercase tracking-widest">Register your business for verification</p>
        </header>

        <form onSubmit={handleSubmit} className="bg-white rounded-[3rem] p-8 shadow-soft border border-gray-100 space-y-6 pb-12">
          <div className="space-y-4">
            {/* Account Credentials */}
            <div className="space-y-4 pb-4 border-b border-gray-50">
               <div className="space-y-1.5">
                <label className="text-[9px] font-black text-primary uppercase tracking-widest ml-1">Login Email</label>
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
                  <div className="relative">
                    <input 
                      required
                      type={showPassword ? 'text' : 'password'}
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-full text-sm font-bold text-text-dark focus:ring-1 focus:ring-primary outline-none shadow-inner"
                      placeholder="••••••••"
                      value={form.password}
                      onChange={e => setForm({...form, password: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-primary uppercase tracking-widest ml-1">Confirm</label>
                  <input 
                    required
                    type={showPassword ? 'text' : 'password'}
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-full text-sm font-bold text-text-dark focus:ring-1 focus:ring-primary outline-none shadow-inner"
                    placeholder="••••••••"
                    value={form.confirmPassword}
                    onChange={e => setForm({...form, confirmPassword: e.target.value})}
                  />
                </div>
              </div>
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[9px] font-black text-gray-300 uppercase tracking-widest ml-1 self-start">
                {showPassword ? 'Hide Passwords' : 'Show Passwords'}
              </button>
            </div>

            {/* Business Basics */}
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
              <label className="text-[9px] font-normal text-gray-400 uppercase tracking-widest ml-1">Business District *</label>
              <div className="bg-gray-50 rounded-full px-6 min-h-[56px] overflow-hidden shadow-inner flex items-center border border-gray-100">
                 <PlacesField 
                  placeholder="Select Dubai Area (e.g. Al Barsha)"
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
              <label className="text-[9px] font-normal text-gray-400 uppercase tracking-widest ml-1">Expertise Areas *</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsServiceDropdownOpen(!isServiceDropdownOpen)}
                  className="w-full px-6 py-4 bg-gray-50 border-none rounded-full text-sm font-normal text-text-dark flex items-center justify-between shadow-inner transition-all hover:bg-gray-100"
                >
                  <span className={form.selectedServices.length === 0 ? 'text-gray-300' : 'text-text-dark'}>
                    {form.selectedServices.length === 0 ? "Select Categories" : `${form.selectedServices.length} Selected`}
                  </span>
                  <span className={`material-symbols-outlined transition-transform duration-300 ${isServiceDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                
                {isServiceDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsServiceDropdownOpen(false)}></div>
                    <div className="absolute z-[9999] mt-3 w-full bg-white border border-gray-100 rounded-[2.5rem] shadow-2xl p-4 max-h-64 overflow-y-auto no-scrollbar animate-in fade-in zoom-in-95">
                      <div className="grid grid-cols-1 gap-1">
                        {categories.map(cat => (
                          <div key={cat.id} onClick={() => toggleService(cat.name)} className={`flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer ${form.selectedServices.includes(cat.name) ? 'bg-primary/5' : 'hover:bg-gray-50'}`}>
                            <span className={`text-[10px] font-normal uppercase tracking-widest ${form.selectedServices.includes(cat.name) ? 'text-primary' : 'text-text-dark'}`}>{cat.name}</span>
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${form.selectedServices.includes(cat.name) ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}>
                              {form.selectedServices.includes(cat.name) && <span className="material-symbols-outlined text-white text-[18px] font-normal">check</span>}
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
              <label className="text-[9px] font-normal text-gray-400 uppercase tracking-widest ml-1">Contact Person *</label>
              <input 
                required
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-full text-sm font-normal text-text-dark focus:ring-1 focus:ring-primary outline-none shadow-inner"
                placeholder="Full Name"
                value={form.contactPerson}
                onChange={e => setForm({...form, contactPerson: e.target.value})}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-normal text-gray-400 uppercase tracking-widest ml-1">WhatsApp Connectivity *</label>
              <div className="relative flex items-center bg-gray-50 rounded-full overflow-hidden shadow-inner">
                <div className="px-4 py-4 flex items-center gap-2 border-r border-gray-200 shrink-0 bg-white/50">
                  <img src="https://flagcdn.com/w20/ae.png" className="w-4 h-3 object-cover rounded-[1px] shadow-sm" alt="" />
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
              className="w-full bg-gradient-to-r from-primary to-[#7B5CC4] text-white py-5 rounded-full font-black uppercase tracking-[0.2em] text-[12px] shadow-xl shadow-purple-100 flex items-center justify-center gap-3 transform active:scale-[0.98] transition-all disabled:opacity-50"
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