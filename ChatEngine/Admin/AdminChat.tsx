import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, ChatMessage, UserRole } from '../../types';
import { dataService } from '../../pages/services/dataService';
import { ChatService } from '../ChatService';
import { useApp } from '../../App';

interface Props { user: User; }

const AdminChat: React.FC<Props> = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { chatUnreadCount } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);

  useEffect(() => {
    const fetchMarketwide = async () => {
      const [users, quotes] = await Promise.all([dataService.getUsers(), dataService.getQuotes()]);
      const activeIds = new Set<string>();
      quotes.forEach(q => { activeIds.add(q.providerId); });
      setConversations(users.filter(u => activeIds.has(u.id)).map(u => ({
        id: u.id, name: u.name, avatar: u.avatar, role: u.role, lastMessage: 'Moderation Portal'
      })));
    };
    fetchMarketwide();
  }, []);

  useEffect(() => {
    if (id) {
      const roomID = ChatService.getChatRoomId(user.id, id);
      ChatService.markRoomAsRead(roomID, user.id);
      return ChatService.listenToMessages(roomID, (msgs) => {
        setMessages(msgs);
        ChatService.markRoomAsRead(roomID, user.id);
      });
    }
  }, [id, user.id]);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !id) return;
    const roomID = ChatService.getChatRoomId(user.id, id);
    const msgData: ChatMessage = {
      id: Date.now().toString(),
      senderId: user.id,
      recipientId: id,
      text: input,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };
    await ChatService.sendMessage(roomID, msgData, user.role, id);
    setInput('');
  };

  if (id) {
    const current = conversations.find(c => c.id === id) || { name: 'Support View', avatar: '' };
    return (
      <div className="flex flex-col h-screen bg-transparent">
        <header className="bg-white/10 backdrop-blur-md px-4 pt-12 pb-3 flex items-center gap-4 shadow-sm border-b z-10">
          <button onClick={() => navigate('/messages')} className="p-2 active:scale-90 transition-transform"><span className="material-symbols-outlined font-bold">arrow_back</span></button>
          <div className="flex items-center gap-3">
            <img src={current.avatar} className="w-10 h-10 rounded-full object-cover" alt="" />
            <div><h1 className="text-sm font-bold text-text-dark uppercase">{current.name}</h1><p className="text-[10px] text-primary font-black uppercase">Moderation Active</p></div>
          </div>
        </header>
        <main ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-4 max-w-[85%] rounded-[1.4rem] text-[13px] shadow-sm ${msg.senderId === user.id ? 'bg-primary text-white' : 'bg-white text-text-dark border'}`}>
                <p>{msg.text}</p>
              </div>
            </div>
          ))}
        </main>
        <footer className="p-4 bg-white/50 border-t pb-8 flex items-center gap-3">
          <input className="flex-1 bg-white border rounded-full py-4 px-6 text-sm outline-none" placeholder="Message as Admin..." value={input} onChange={(e) => setInput(e.target.value)}/>
          <button onClick={handleSend} className="w-12 h-12 rounded-full bg-primary text-white shadow-lg flex items-center justify-center transition-all active:scale-90"><span className="material-symbols-outlined">shield</span></button>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-24">
      <header className="px-6 pt-12 pb-4 shrink-0"><h1 className="text-2xl font-bold text-text-dark uppercase">System Inbox</h1></header>
      <main className="px-5 space-y-3 flex-1 overflow-y-auto no-scrollbar">
        {conversations.map((conv) => (
          <div key={conv.id} onClick={() => navigate(`/messages/${conv.id}`)} className="bg-white rounded-[1.5rem] p-4 flex items-center gap-4 shadow-sm border border-white">
            <img src={conv.avatar} className="w-14 h-14 rounded-2xl object-cover border shadow-sm" alt="" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5"><h2 className="text-[15px] font-bold text-text-dark truncate uppercase">{conv.name}</h2><span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md bg-primary/5 text-primary">{conv.role}</span></div>
              <p className="text-[11px] text-gray-400 truncate font-medium">{conv.lastMessage}</p>
            </div>
          </div>
        ))}
      </main>
      <nav className="fixed bottom-0 w-full max-w-md mx-auto bg-white border-t border-gray-100 pb-8 pt-3 px-4 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1 text-[#888888]">
          <span className="material-symbols-outlined text-[26px]">grid_view</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter">HOME</span>
        </button>
        <button onClick={() => navigate('/admin/users')} className="flex-1 flex flex-col items-center gap-1 text-[#888888]">
          <span className="material-symbols-outlined text-[26px]">group</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter">USERS</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 text-primary font-bold">
          <div className="relative">
            <span className="material-symbols-outlined text-[26px]">chat</span>
            {chatUnreadCount > 0 && (
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent-pink rounded-full border-2 border-white text-[8px] font-bold text-white flex items-center justify-center">
                {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
              </div>
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">MESSAGES</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1 text-[#888888]">
          <span className="material-symbols-outlined text-[26px]">settings</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter">SYSTEM</span>
        </button>
      </nav>
    </div>
  );
};

export default AdminChat;