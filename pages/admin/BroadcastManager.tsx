
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

interface Props { user: User; }

const AdminBroadcastManager: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [target, setTarget] = useState<'ALL' | 'CUSTOMER' | 'PROVIDER'>('ALL');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      showToast("Please provide both title and message", "error");
      return;
    }
    if (window.confirm(`Broadcast this message to ${target === 'ALL' ? 'everyone' : target.toLowerCase() + 's'}?`)) {
      setIsSending(true);
      try {
        await dataService.createBroadcast(title, message, target, actionUrl.trim() || '/');
        showToast("Broadcast sent successfully", "success");
        setTitle('');
        setMessage('');
        setActionUrl('');
        setTimeout(() => navigate('/admin/broadcasts'), 1000);
      } catch (err) {
        showToast("Failed to send broadcast", "error");
      } finally {
        setIsSending(false);
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFBF7] pb-10">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-50 border-b border-gray-100 shadow-sm">
        <button 
          onClick={() => navigate('/')} 
          className="text-text-dark w-10 h-10 flex items-center justify-center -ml-2 rounded-full active:bg-gray-100 transition-all active:scale-90"
        >
          <span className="material-symbols-outlined text-2xl font-bold">arrow_back</span>
        </button>
        <h1 className="text-base font-bold text-text-dark text-center flex-1 tracking-tight">System Broadcast</h1>
        <button 
          onClick={() => navigate('/admin/broadcasts')}
          className="w-10 h-10 flex items-center justify-center text-primary active:scale-90 transition-transform"
        >
          <span className="material-symbols-outlined text-2xl font-bold">history</span>
        </button>
      </header>

      <main className="px-6 pt-6 space-y-8 flex-1 overflow-y-auto no-scrollbar">
        <div className="text-center space-y-2">
           <div className="w-20 h-20 bg-primary/10 text-primary rounded-[2.2rem] flex items-center justify-center mx-auto shadow-sm">
              <span className="material-symbols-outlined text-4xl font-black">campaign</span>
           </div>
           <h2 className="text-xl font-black text-text-dark uppercase tracking-tight">Announcement Center</h2>
           <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">Communicate with your platform users</p>
        </div>

        <section className="bg-white rounded-[2.5rem] p-8 shadow-card border border-white space-y-8">
           <div className="space-y-4">
              <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest ml-1">Target Audience</p>
              <div className="flex gap-2">
                 {(['ALL', 'CUSTOMER', 'PROVIDER'] as const).map(t => (
                   <button 
                    key={t}
                    onClick={() => setTarget(t)}
                    className={`flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                      target === t ? 'bg-primary text-white border-primary shadow-lg' : 'bg-gray-50 text-gray-400 border-gray-100'
                    }`}
                   >
                     {t}
                   </button>
                 ))}
              </div>
           </div>

           <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Subject</label>
                <input 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-6 py-4 bg-[#F9FAFB] rounded-2xl text-[14px] font-bold text-text-dark border-none focus:ring-1 focus:ring-primary shadow-inner outline-none"
                  placeholder="e.g. Ramadan Work Hours"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Message Content</label>
                <textarea 
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="w-full px-6 py-5 bg-[#F9FAFB] rounded-[1.8rem] text-[13px] font-medium text-text-dark border-none focus:ring-1 focus:ring-primary shadow-inner outline-none min-h-[120px] resize-none leading-relaxed"
                  placeholder="Type your announcement here..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Redirection URL (Optional)</label>
                <input 
                  value={actionUrl}
                  onChange={e => setActionUrl(e.target.value)}
                  className="w-full px-6 py-4 bg-[#F9FAFB] rounded-2xl text-[14px] font-bold text-text-dark border-none focus:ring-1 focus:ring-primary shadow-inner outline-none"
                  placeholder="e.g. /queries or https://example.com"
                />
              </div>
           </div>

           <button 
            onClick={handleSend}
            disabled={isSending || !title.trim() || !message.trim()}
            className="w-full bg-primary text-white py-5 rounded-full font-black text-[11px] uppercase tracking-[0.2em] shadow-btn-glow active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
           >
             {isSending ? (
               <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
             ) : (
               <>
                 <span className="material-symbols-outlined text-lg font-black">send</span>
                 Launch Global Alert
               </>
             )}
           </button>
        </section>
        
        <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 flex gap-4">
           <span className="material-symbols-outlined text-blue-500 text-2xl">info</span>
           <p className="text-[11px] text-blue-600 font-medium leading-relaxed">
             Broadcasting will instantly add a notification to the bell tray of all selected users. Use this for critical platform updates, security alerts, or promotional highlights.
           </p>
        </div>
      </main>
    </div>
  );
};

export default AdminBroadcastManager;
