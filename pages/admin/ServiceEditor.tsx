
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';
import { ServiceCategory } from '../../types';

const PREDEFINED_COLORS = [
  '#5B3D9D', // Deep Purple
  '#E91E63', // Pink
  '#00BCD4', // Cyan
  '#FF9800', // Orange
  '#4CAF50', // Green
];

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
  ];

  useEffect(() => {
    if (catId && catId !== 'new') {
      const fetchCat = async () => {
        setIsLoading(true);
        try {
          const categories = await dataService.getCategories();
          const matched = categories.find(c => c.id === catId);
          if (matched) {
            const data = {
              name: matched.name,
              description: matched.description || '',
              icon: matched.icon,
              color: matched.color,
              isActive: matched.isActive !== false
            };
            setForm(data);
            setOriginalData(data);
          } else {
            showToast("Service record not found", "error");
            navigate('/profile'); 
          }
        } catch (err) {
          showToast("Error retrieving service", "error");
        } finally {
          setIsLoading(false);
        }
      };
      fetchCat();
    }
  }, [catId, navigate, showToast]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast("Service Title is required", "error");
      return;
    }
    setIsSaving(true);
    try {
      const categories = await dataService.getCategories();
      const updatedList = (catId && catId !== 'new')
        ? categories.map(c => c.id === catId ? { ...c, ...form } : c)
        : [...categories, { id: `cat_${Date.now()}`, ...form }];
      
      await dataService.saveCategories(updatedList);
      showToast("Service saved successfully", "success");
      navigate('/profile'); 
    } catch (err) {
      showToast("Save failed", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (originalData) setForm(originalData);
    else setForm({ name: '', description: '', icon: 'flight', color: '#5B3D9D', isActive: true });
    showToast("Form reset", "info");
  };

  const getIconLabel = (iconName: string) => {
    return commonIcons.find(i => i.icon === iconName)?.label || 'Travel & Flights';
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#FCF6E7] gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Opening Service...</p>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#FCF6E7] pb-32">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-[#FCF6E7]/80 backdrop-blur-md z-50">
        <button onClick={() => navigate(-1)} className="text-text-dark w-10 h-10 flex items-center justify-start active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-2xl font-bold">arrow_back</span>
        </button>
        <h1 className="text-[17px] font-bold text-text-dark text-center flex-1 tracking-tight">
          {(catId && catId !== 'new') ? 'Edit Service' : 'Create Service'}
        </h1>
        <button onClick={handleReset} className="w-12 text-[#5B3D9D]/60 text-[13px] font-bold tracking-tight active:scale-95 transition-all text-right">Reset</button>
      </header>

      <main className="px-5 pt-4 space-y-6 flex-1 overflow-y-auto no-scrollbar">
        <section className="bg-white rounded-[2rem] p-8 shadow-card border border-white space-y-6">
          <div className="flex items-center gap-3">
             <span className="material-symbols-outlined text-[#5B3D9D] text-[20px] font-bold">edit_note</span>
             <h3 className="text-[15px] font-bold text-text-dark">Service Details</h3>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-text-dark ml-1 uppercase tracking-widest opacity-60">Service Title</label>
            <input 
              className="w-full px-6 py-4 bg-[#F9FAFB] rounded-2xl text-[14px] border-none focus:ring-1 focus:ring-primary outline-none placeholder-gray-300 font-bold text-text-dark shadow-inner"
              placeholder="e.g., Visa Processing"
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-text-dark ml-1 uppercase tracking-widest opacity-60">Description</label>
            <textarea 
              className="w-full px-6 py-5 bg-[#F9FAFB] rounded-[1.8rem] text-[13px] border-none focus:ring-1 focus:ring-primary outline-none min-h-[140px] placeholder-gray-300 font-medium shadow-inner resize-none text-text-dark leading-relaxed"
              placeholder="Briefly describe what this service covers..."
              value={form.description}
              onChange={e => setForm({...form, description: e.target.value})}
            />
          </div>
        </section>

        <section className="bg-white rounded-[2rem] p-8 shadow-card border border-white space-y-8">
          <div className="flex items-center gap-3">
             <span className="material-symbols-outlined text-[#5B3D9D] text-[20px] font-bold">palette</span>
             <h3 className="text-[15px] font-bold text-text-dark">Appearance</h3>
          </div>
          <div className="space-y-4">
             <label className="text-[11px] font-bold text-text-dark ml-1 uppercase tracking-widest opacity-60">Service Icon</label>
             <div className="bg-[#F9FAFB] p-4 rounded-2xl flex items-center justify-between border border-gray-100">
                <div className="flex items-center gap-4">
                   <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-50 shrink-0">
                      <span className="material-symbols-outlined text-3xl font-bold" style={{ color: form.color }}>{form.icon}</span>
                   </div>
                   <div className="min-w-0">
                      <p className="text-[13px] font-bold text-text-dark truncate">{getIconLabel(form.icon)}</p>
                      <p className="text-[11px] text-gray-400 font-medium">Default library icon</p>
                   </div>
                </div>
                <button onClick={() => setIsIconPickerOpen(!isIconPickerOpen)} className="px-5 py-2.5 bg-white border border-gray-100 rounded-xl text-[12px] font-bold text-text-dark shadow-sm active:scale-95 transition-all shrink-0">Change</button>
             </div>
             {isIconPickerOpen && (
               <div className="grid grid-cols-5 gap-3 p-4 bg-gray-50 rounded-2xl animate-in fade-in zoom-in-95">
                  {commonIcons.map(item => (
                    <button key={item.icon} onClick={() => { setForm({...form, icon: item.icon}); setIsIconPickerOpen(false); }} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${form.icon === item.icon ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-400 border border-gray-100'}`}><span className="material-symbols-outlined text-xl">{item.icon}</span></button>
                  ))}
               </div>
             )}
          </div>
          <div className="space-y-4 pb-2">
             <div className="flex justify-between items-center px-1">
                <label className="text-[11px] font-bold text-text-dark uppercase tracking-widest opacity-60">Color Theme</label>
                <span className="text-[10px] text-gray-400 font-medium">Select accent color</span>
             </div>
             <div className="flex flex-wrap items-center gap-4">
                {PREDEFINED_COLORS.map(color => (
                  <button key={color} onClick={() => setForm({...form, color})} className="relative w-12 h-12 rounded-full flex items-center justify-center transition-transform active:scale-90 shadow-sm border-2 border-white ring-2 ring-transparent" style={{ backgroundColor: color }}>
                    {form.color === color && <span className="material-symbols-outlined text-white font-black text-xl">check</span>}
                    {form.color === color && <div className="absolute inset-0 rounded-full ring-2 ring-[#5B3D9D]/30 ring-offset-2"></div>}
                  </button>
                ))}
                <button className="w-12 h-12 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 active:scale-90 transition-transform bg-white"><span className="material-symbols-outlined text-2xl font-light">add</span></button>
             </div>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white border-t border-gray-100 p-6 flex gap-4 z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.06)]">
        <button onClick={() => navigate(-1)} className="flex-1 py-4.5 border border-gray-100 rounded-2xl text-[14px] font-bold text-text-dark active:scale-95 transition-all">Cancel</button>
        <button onClick={handleSave} disabled={isSaving} className="flex-[1.5] py-4.5 bg-[#5B3D9D] text-white rounded-2xl font-bold text-[14px] shadow-btn-glow flex items-center justify-center gap-2.5 active:scale-95 transition-all disabled:opacity-50">
          {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><span className="material-symbols-outlined text-[20px]">save</span>Save Service</>}
        </button>
      </footer>
    </div>
  );
};

export default AdminServiceEditor;
