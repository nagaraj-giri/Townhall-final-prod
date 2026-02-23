import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dataService } from '../../services/dataService';
import { useApp } from '../../App';
import { ServiceCategory } from '../../types';

const PREDEFINED_COLORS = [
  '#5B3D9D', // Deep Purple
  '#E91E63', // Pink
  '#00BCD4', // Cyan
  '#FF9800', // Orange
  '#4CAF50', // Green
];

// Fix: Completed the missing logic and exported as default to satisfy App.tsx lazy loading and React.FC requirements.
const AdminServiceEditor: React.FC = () => {
  const navigate = useNavigate();
  const { catId } = useParams();
  const { showToast } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalData, setOriginalData] = useState<any>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    icon: 'flight',
    color: '#5B3D9D',
    isActive: true
  });

  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const commonIcons = [
    { label: 'Travel & Flights', icon: 'flight' },
    { label: 'Visa Services', icon: 'verified' },
    { label: 'Business Setup', icon: 'corporate_fare' },
    { label: 'Legal Consultancy', icon: 'gavel' },
    { label: 'Logistics & Moving', icon: 'local_shipping' },
    { label: 'Work & Employment', icon: 'work' },
    { label: 'Home Services', icon: 'home_repair_service' },
    { label: 'Financial Services', icon: 'account_balance' },
    { label: 'Real Estate', icon: 'apartment' },
    { label: 'Cleaning Services', icon: 'cleaning_services' },
    { label: 'Healthcare', icon: 'medical_services' },
    { label: 'IT & Tech', icon: 'computer' },
    { label: 'Security', icon: 'security' },
    { label: 'Food & Beverage', icon: 'restaurant' },
    { label: 'Education', icon: 'school' },
    { label: 'Event Planning', icon: 'event' },
    { label: 'Auto Services', icon: 'directions_car' },
    { label: 'General Task', icon: 'task_alt' }
  ];

  useEffect(() => {
    if (catId && catId !== 'new') {
      const load = async () => {
        setIsLoading(true);
        try {
          const cats = await dataService.getCategories();
          const match = cats.find(c => c.id === catId);
          if (match) {
            setForm({
              name: match.name,
              description: match.description || '',
              icon: match.icon,
              color: match.color,
              isActive: match.isActive !== false
            });
            setOriginalData(match);
          }
        } catch (e) {
          showToast("Failed to load category data", "error");
        } finally {
          setIsLoading(false);
        }
      };
      load();
    }
  }, [catId, showToast]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast("Service name is required", "error");
      return;
    }
    setIsSaving(true);
    try {
      const allCats = await dataService.getCategories();
      const updatedCat: ServiceCategory = {
        id: catId === 'new' ? `cat_${Date.now()}` : catId!,
        name: form.name.trim(),
        description: form.description.trim(),
        icon: form.icon,
        color: form.color,
        isActive: form.isActive
      };

      let newSet;
      if (catId === 'new') {
        newSet = [...allCats, updatedCat];
      } else {
        newSet = allCats.map(c => c.id === catId ? updatedCat : c);
      }

      await dataService.saveCategories(newSet);
      showToast("Service category updated", "success");
      navigate('/admin/categories');
    } catch (e) {
      showToast("Update failed", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-transparent">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF9F6] pb-32">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-white/20 backdrop-blur-md z-50 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="text-text-dark w-10 h-10 flex items-center justify-start active:scale-90 transition-transform">
          <span className="material-symbols-outlined font-black">arrow_back</span>
        </button>
        <h1 className="text-lg font-black text-text-dark uppercase tracking-tight">
          {catId === 'new' ? 'Create Service' : 'Modify Stream'}
        </h1>
        <div className="w-10"></div>
      </header>

      <main className="px-6 pt-6 space-y-6 flex-1 overflow-y-auto no-scrollbar">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white space-y-8">
           <div className="space-y-2">
             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Service Label</label>
             <input 
               className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-text-dark focus:ring-1 focus:ring-primary shadow-inner"
               value={form.name}
               onChange={e => setForm({...form, name: e.target.value})}
               placeholder="Enter display name..."
             />
           </div>

           <div className="flex items-center gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Iconography</label>
                <button 
                  onClick={() => setIsIconPickerOpen(true)}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner border border-gray-100 bg-white"
                  style={{ color: form.color }}
                >
                  <span className="material-symbols-outlined text-3xl font-normal">{form.icon}</span>
                </button>
              </div>
              <div className="space-y-2 flex-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Accent Theme</label>
                <div className="flex gap-2.5">
                   {PREDEFINED_COLORS.map(c => (
                     <button 
                       key={c}
                       onClick={() => setForm({...form, color: c})}
                       className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? 'border-primary scale-110 shadow-md' : 'border-transparent opacity-40 hover:opacity-70'}`}
                       style={{ backgroundColor: c }}
                     />
                   ))}
                </div>
              </div>
           </div>

           <div className="space-y-2">
             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Marketplace Context</label>
             <textarea 
               className="w-full px-6 py-4 bg-gray-50 border-none rounded-[1.5rem] text-sm font-medium text-text-dark focus:ring-1 focus:ring-primary shadow-inner min-h-[120px] resize-none leading-relaxed"
               value={form.description}
               onChange={e => setForm({...form, description: e.target.value})}
               placeholder="Describe the scope for AIRRA matching..."
             />
           </div>

           <div className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl shadow-inner border border-gray-100/50">
              <div className="flex items-center gap-3">
                 <span className="material-symbols-outlined text-gray-400">visibility</span>
                 <span className="text-xs font-bold uppercase tracking-widest text-text-dark">Public Visibility</span>
              </div>
              <button 
                onClick={() => setForm({...form, isActive: !form.isActive})}
                className={`w-12 h-6 rounded-full relative transition-all duration-300 ${form.isActive ? 'bg-accent-green' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${form.isActive ? 'left-7' : 'left-1'}`} />
              </button>
           </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-primary text-white py-5 rounded-full font-black uppercase tracking-[0.2em] text-[12px] shadow-btn-glow active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
            <>
              <span className="material-symbols-outlined text-lg font-black">verified_user</span>
              Authorize Service Definition
            </>
          )}
        </button>
      </main>

      {isIconPickerOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end animate-in fade-in duration-300">
          <div className="bg-white w-full rounded-t-[3rem] p-8 max-h-[80vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-500">
            <div className="flex justify-between items-center mb-8">
               <h3 className="text-sm font-black uppercase tracking-[0.2em] text-text-dark ml-2">Library Icons</h3>
               <button onClick={() => setIsIconPickerOpen(false)} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 active:scale-90 transition-transform">
                  <span className="material-symbols-outlined">close</span>
               </button>
            </div>
            <div className="grid grid-cols-4 gap-6 pb-10">
              {commonIcons.map(item => (
                <button 
                  key={item.icon}
                  onClick={() => { setForm({...form, icon: item.icon}); setIsIconPickerOpen(false); }}
                  className={`flex flex-col items-center gap-2.5 p-2 rounded-2xl transition-all ${form.icon === item.icon ? 'bg-primary/5 text-primary scale-110 shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                  <span className="material-symbols-outlined text-[32px]">{item.icon}</span>
                  <span className="text-[8px] font-black uppercase tracking-tighter w-full text-center line-clamp-1">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminServiceEditor;