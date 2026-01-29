import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';
import { ServiceCategory } from '../../types';

const AdminCategories: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

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

  const handleToggleActive = async (catId: string, currentStatus: boolean) => {
    const updatedCategories = categories.map(c => 
      c.id === catId ? { ...c, isActive: !currentStatus } : c
    );
    setCategories(updatedCategories);
    try {
      await dataService.saveCategories(updatedCategories);
    } catch (err) {
      showToast("Sync failed", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Permanently delete this service category? This will affect matching for providers and customers using this service.")) {
      const updated = categories.filter(c => c.id !== id);
      setCategories(updated);
      try {
        await dataService.saveCategories(updated);
        showToast("Service category purged", "info");
      } catch (err) {
        showToast("Purge failed", "error");
        // Revert UI on failure
        const fresh = await dataService.getCategories();
        setCategories(fresh);
      }
    }
    setActiveMenuId(null);
  };

  const filteredCategories = useMemo(() => {
    return categories.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [categories, searchQuery]);

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-32">
      {/* Header */}
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-white/10 backdrop-blur-md z-40">
        <button onClick={() => navigate(-1)} className="text-text-dark w-10 h-10 flex items-center justify-start active:scale-90 transition-transform">
          <span className="material-symbols-outlined font-black">arrow_back</span>
        </button>
        <h1 className="text-[20px] font-black text-text-dark tracking-tight uppercase">Service Categories</h1>
        <button 
          onClick={() => navigate('/admin/service/new')}
          className="w-11 h-11 bg-primary text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-2xl font-black">add</span>
        </button>
      </header>

      <main className="px-6 pt-2 space-y-6 flex-1">
        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center px-5 py-4 focus-within:ring-1 focus-within:ring-primary transition-all">
          <span className="material-symbols-outlined text-gray-400 mr-3 font-normal">search</span>
          <input 
            type="text" 
            placeholder="Search services..." 
            className="flex-1 bg-transparent border-none p-0 text-[14px] font-bold text-text-dark outline-none focus:ring-0 placeholder-gray-300"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Categories List */}
        <div className="space-y-3">
          {filteredCategories.map((cat) => (
            <div key={cat.id} className="bg-white rounded-[1.8rem] p-4 pr-5 shadow-sm border border-white flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Drag Handle */}
              <div className="text-gray-300 cursor-grab active:cursor-grabbing">
                <span className="material-symbols-outlined font-normal">drag_indicator</span>
              </div>

              {/* Icon Container */}
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner" 
                style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
              >
                <span className="material-symbols-outlined text-2xl font-normal">{cat.icon}</span>
              </div>

              {/* Labels */}
              <div className="flex-1 min-w-0">
                <h4 className="text-[14px] font-black text-text-dark truncate leading-tight uppercase tracking-tight">{cat.name}</h4>
                <p className="text-[10px] text-gray-400 font-bold tracking-widest mt-1 uppercase">
                  {cat.isActive !== false ? 'Visible to Public' : 'Draft - Hidden'}
                </p>
              </div>

              {/* Toggle & Menu */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleToggleActive(cat.id, cat.isActive !== false)}
                  className={`w-11 h-6 rounded-full transition-all relative ${cat.isActive !== false ? 'bg-accent-green' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${cat.isActive !== false ? 'left-6' : 'left-1'}`}></div>
                </button>
                
                <div className="relative">
                  <button 
                    onClick={() => setActiveMenuId(activeMenuId === cat.id ? null : cat.id)}
                    className="w-8 h-8 flex items-center justify-center text-gray-300 active:text-text-dark transition-colors"
                  >
                    <span className="material-symbols-outlined font-normal">more_vert</span>
                  </button>

                  {activeMenuId === cat.id && (
                    <>
                      <div className="fixed inset-0 z-50" onClick={() => setActiveMenuId(null)}></div>
                      <div className="absolute right-0 top-10 w-36 bg-white rounded-2xl shadow-2xl border border-gray-50 py-2 z-[60] animate-in fade-in zoom-in-95">
                        <button 
                          onClick={() => { navigate(`/admin/service/${cat.id}`); setActiveMenuId(null); }}
                          className="w-full px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-text-dark flex items-center gap-3 active:bg-gray-50"
                        >
                          <span className="material-symbols-outlined text-sm font-normal">edit</span>
                          Edit
                        </button>
                        <div className="h-[1px] bg-gray-50 mx-2 my-1"></div>
                        <button 
                          onClick={() => handleDelete(cat.id)}
                          className="w-full px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-red-500 flex items-center gap-3 active:bg-red-50"
                        >
                          <span className="material-symbols-outlined text-sm font-normal">delete</span>
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredCategories.length === 0 && (
            <div className="py-20 text-center opacity-30">
              <span className="material-symbols-outlined text-5xl font-light">inventory_2</span>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-4">No services matched</p>
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="pt-10 flex flex-col items-center text-center space-y-4 pb-12 opacity-30">
          <div className="w-16 h-16 bg-white rounded-full border border-gray-100 flex items-center justify-center text-gray-400">
             <span className="material-symbols-outlined text-2xl font-light">reorder</span>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-text-dark uppercase tracking-widest">Drag items to reorder priority.</p>
            <p className="text-[10px] font-bold text-text-dark uppercase tracking-widest">Changes are saved automatically.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminCategories;