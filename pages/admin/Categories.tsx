import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';
import { ServiceCategory } from '../../types';

const AdminCategories: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const cats = await dataService.getCategories();
        setCategories(cats || []);
      } catch (err) {
        showToast("Failed to load categories", "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) return <div className="p-20 text-center text-gray-300 animate-pulse">Syncing Services...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-32">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-white/10 backdrop-blur-md z-50">
        <button onClick={() => navigate(-1)} className="text-text-dark active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-2xl font-bold">arrow_back</span>
        </button>
        <h1 className="text-[17px] font-bold text-text-dark text-center flex-1 tracking-tight">Service Categories</h1>
        <button onClick={() => navigate('/admin/service/new')} className="text-primary active:scale-90">
          <span className="material-symbols-outlined text-2xl font-bold">add_circle</span>
        </button>
      </header>

      <main className="px-6 pt-4 space-y-4">
        <div className="grid grid-cols-1 gap-3">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-white rounded-[1.8rem] p-5 shadow-card border border-white flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                <span className="material-symbols-outlined text-3xl">{cat.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[15px] font-bold text-text-dark truncate uppercase">{cat.name}</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase">{cat.isActive ? 'Active' : 'Disabled'}</p>
              </div>
              <button onClick={() => navigate(`/admin/service/edit/${cat.id}`)} className="text-gray-300">
                <span className="material-symbols-outlined">edit</span>
              </button>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="py-20 text-center text-gray-300">
              <span className="material-symbols-outlined text-5xl opacity-20">inventory_2</span>
              <p className="mt-4 font-bold uppercase text-[10px] tracking-widest">No services created</p>
            </div>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white border-t border-gray-100 pb-8 pt-3 px-4 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1 text-[#888888]">
          <span className="material-symbols-outlined text-[26px]">grid_view</span>
          <span className="text-[10px] uppercase tracking-tighter">HOME</span>
        </button>
        <button onClick={() => navigate('/admin/users')} className="flex-1 flex flex-col items-center gap-1 text-[#888888]">
          <span className="material-symbols-outlined text-[26px]">group</span>
          <span className="text-[10px] uppercase tracking-tighter">USERS</span>
        </button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1 text-[#888888]">
          <span className="material-symbols-outlined text-[26px]">format_list_bulleted</span>
          <span className="text-[10px] uppercase tracking-tighter">QUERIES</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1 text-[#888888]">
          <span className="material-symbols-outlined text-[26px]">settings</span>
          <span className="text-[10px] uppercase tracking-tighter">SYSTEM</span>
        </button>
      </nav>
    </div>
  );
};

export default AdminCategories;