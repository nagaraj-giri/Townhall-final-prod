
import React, { useState, useEffect } from 'react';
// Fix: Standardize react-router-dom imports to resolve "no exported member" errors
import { useNavigate, useLocation } from 'react-router-dom';
import { User, RFQ } from '../../types';
import { dataService } from '../services/dataService';
import { getAIConciergeSuggestions } from '../services/geminiService';
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
  const [isAILoading, setIsAILoading] = useState(false);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);

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

  const handleAIConcierge = async () => {
    if (!title.trim() && !description.trim()) {
      showToast("Tell me a bit about what you need first!", "info");
      return;
    }
    
    setIsAILoading(true);
    try {
      const result = await getAIConciergeSuggestions(
        title || description, 
        locationName || "Dubai"
      );
      if (result) {
        setAiSuggestion(result);
        showToast("AI Concierge has optimized your request", "success");
      }
    } catch (err) {
      showToast("AI is currently unavailable", "error");
    } finally {
      setIsAILoading(false);
    }
  };

  const applyAISuggestion = () => {
    if (!aiSuggestion) return;
    setTitle(aiSuggestion.suggestedTitle);
    setDescription(aiSuggestion.suggestedDescription);
    if (availableServices.includes(aiSuggestion.suggestedCategory)) {
      setService(aiSuggestion.suggestedCategory);
    }
    setAiSuggestion(null);
  };

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
      showToast("Query broadcasted successfully", 'success');
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
            <h1 className="text-xl font-[900] text-text-dark tracking-tight leading-none uppercase">Post a Query</h1>
            <p className="text-[9px] text-primary font-black uppercase tracking-[0.2em] mt-2">Verified UAE Marketplace</p>
          </div>
          <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white shadow-sm rounded-full flex items-center justify-center text-gray-400 active:scale-90 transition-all">
            <span className="material-symbols-outlined font-bold">close</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-8 pb-10 space-y-6 no-scrollbar pt-4">
          {/* AI Suggestion Banner */}
          {aiSuggestion && (
            <div className="bg-primary/5 border border-primary/10 rounded-[2rem] p-6 space-y-4 animate-in zoom-in-95 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                </div>
                <div>
                  <h4 className="text-[12px] font-black text-text-dark uppercase tracking-tight">AI Enhancement Ready</h4>
                  <p className="text-[10px] text-gray-500 font-medium">Documents: {aiSuggestion.requiredDocs.join(', ')}</p>
                </div>
              </div>

              {/* Fix: Explicitly display Google Maps grounding links as per Gemini SDK requirements */}
              {aiSuggestion.mapsLinks && aiSuggestion.mapsLinks.length > 0 && (
                <div className="bg-white/60 rounded-2xl p-4 space-y-2 border border-primary/5">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Location Context:</p>
                  <div className="flex flex-col gap-2">
                    {aiSuggestion.mapsLinks.map((link: any, idx: number) => (
                      <a 
                        key={idx} 
                        href={link.uri} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[11px] text-primary hover:underline font-bold flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">map</span>
                        {link.title || "View on Google Maps"}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <button 
                onClick={applyAISuggestion}
                className="w-full py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95"
              >
                Apply AI Rewrite
              </button>
            </div>
          )}

          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Requirement Title</label>
                <button 
                  onClick={handleAIConcierge}
                  disabled={isAILoading}
                  className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${isAILoading ? 'text-gray-300' : 'text-primary'}`}
                >
                  {isAILoading ? <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-[16px]">temp_preferences_custom</span>}
                  AI Concierge
                </button>
              </div>
              <input 
                type="text" 
                placeholder="e.g. Need Golden Visa for family" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="w-full px-6 py-4.5 bg-white border border-gray-100 rounded-2xl text-[14px] font-bold text-text-dark focus:ring-1 focus:ring-primary shadow-sm placeholder-gray-300 transition-all" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Official Category</label>
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
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Precise Location</label>
              <div className="relative flex items-center bg-white border border-gray-100 rounded-2xl shadow-sm px-4 min-h-[58px] focus-within:ring-1 focus-within:ring-primary transition-all">
                <span className="material-symbols-outlined text-accent-pink text-[22px] mr-2 shrink-0">location_on</span>
                <PlacesField 
                  placeholder="Select area (e.g. Business Bay)"
                  onPlaceChange={(res) => {
                    setLocationName(res.name);
                    setCoords({ lat: res.lat, lng: res.lng });
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Details & Context</label>
              <textarea 
                placeholder="List specific requirements, urgency, and any details that help providers quote accurately..." 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                className="w-full px-6 py-5 bg-white border border-gray-100 rounded-[2.2rem] text-[14px] font-medium text-text-dark focus:ring-1 focus:ring-primary shadow-sm min-h-[180px] resize-none placeholder-gray-300 leading-relaxed" 
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
                Broadcast Live
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
