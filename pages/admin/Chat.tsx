
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, ChatMessage, UserRole } from '../../types';
import { dataService } from '../services/dataService';
// Fix: Import ChatService for real-time messaging management
import { ChatService } from '../../ChatEngine/ChatService';

interface ChatProps {
  user: User;
}

const AdminChat: React.FC<ChatProps> = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const fetchMarketplaceConversations = async () => {
      // In a real app, this would query a "chats" metadata collection
      // For this implementation, we aggregate from active quotes
      const [allQuotes, allUsers, allRfqs] = await Promise.all([
        dataService.getQuotes(),
        dataService.getUsers(),
        dataService.getRFQs()
      ]);

      const activePartners = new Set<string>();
      allQuotes.forEach(q => {
        const rfq = allRfqs.find(r => r.id === q.rfqId);
        if (rfq) {
          activePartners.add(q.providerId);
          activePartners.add(rfq.customerId);
        }
      });

      const users = allUsers.filter(u => activePartners.has(u.id));
      setConversations(users.map(u => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        lastMessage: u.role === UserRole.PROVIDER ? 'Service Provider' : 'Marketplace Customer',
        isOnline: true,
        role: u.role
      })));
    };
    fetchMarketplaceConversations();
  }, []);

  useEffect(() => {
    if (id) {
      // Fix: Use ChatService for room identification and message listening
      const roomID = ChatService.getChatRoomId(user.id, id);
      const unsub = ChatService.listenToMessages(roomID, (msgs) => {
        setMessages(msgs);
      });
      return () => unsub();
    }
  }, [id, user.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !id) return;
    // Fix: Use ChatService for room identification and sending messages
    const roomID = ChatService.getChatRoomId(user.id, id);
    // Fix: Added missing recipientId to satisfy ChatMessage interface
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: user.id,
      recipientId: id,
      text: input,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };
    // FIX: Use ChatService.sendMessage with recipientId
    await ChatService.sendMessage(roomID, newMessage, user.role, id);
    setInput('');
  };

  if (id) {
    const currentPartner = conversations.find(c => c.id === id) || { name: 'Support Chat', avatar: '', isOnline: false, role: '' };
    return (
      <div className="flex flex-col h-screen bg-[#F9F6F8]">
        <header className="bg-white px-4 pt-12 pb-3 flex items-center justify-between shrink-0 shadow-sm border-b border-gray-100 z-10">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/messages')} className="p-2 text-text-dark">
              <span className="material-symbols-outlined font-bold">arrow_back</span>
            </button>
            <div className="flex items-center gap-3">
              <img src={currentPartner.avatar} className="w-10 h-10 rounded-full object-cover" alt="" />
              <div>
                <h1 className="text-sm font-bold text-text-dark leading-none">{currentPartner.name}</h1>
                <p className="text-[10px] font-medium text-primary mt-1 uppercase tracking-widest">{currentPartner.role} • Moderation Mode</p>
              </div>
            </div>
          </div>
        </header>

        <main ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
          {messages.map((msg) => {
            const isUser = msg.senderId === user.id;
            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                <div className={`max-w-[85%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className={`p-4 rounded-[1.4rem] text-[13px] shadow-sm ${
                    isUser ? 'bg-primary text-white' : 'bg-white text-text-dark border border-gray-100'
                  }`}>
                    <p>{msg.text}</p>
                  </div>
                  <p className="text-[9px] font-medium text-gray-400 mt-1.5 uppercase">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
        </main>

        <footer className="p-4 bg-white/50 pb-8">
          <div className="flex items-center gap-3">
            <input 
              className="flex-1 bg-white border border-gray-100 rounded-full py-4 px-6 text-[13px] font-medium shadow-soft outline-none"
              placeholder="Message as Administrator..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend} className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ${input.trim() ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'}`}>
              <span className="material-symbols-outlined">shield</span>
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F9F6F8] pb-24">
      <header className="px-6 pt-12 pb-4 shrink-0">
        <h1 className="text-2xl font-bold text-[#333333] tracking-tight">Moderation Inbox</h1>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Platform-Wide Communications</p>
      </header>
      <main className="px-5 space-y-3 flex-1 overflow-y-auto no-scrollbar pb-6">
        <div className="relative mb-6">
          <span className="absolute inset-y-0 left-4 flex items-center text-gray-400"><span className="material-symbols-outlined">search</span></span>
          {/* Fix: Resolved pl-11 class name typo from Holpl-11 */}
          <input className="w-full py-4 pl-11 bg-white rounded-2xl border-none shadow-card text-xs" placeholder="Search marketplace users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
        </div>
        {conversations.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map((conv) => (
          <div key={conv.id} onClick={() => navigate(`/messages/${conv.id}`)} className="bg-white rounded-[1.5rem] p-4 flex items-center gap-4 shadow-sm border border-white hover:border-primary/20 cursor-pointer active:scale-[0.98] transition-all group">
            <img src={conv.avatar} className="w-14 h-14 rounded-2xl object-cover border border-gray-50 shadow-sm" alt="" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <h2 className="text-[15px] font-bold text-[#333333] truncate">{conv.name}</h2>
                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${conv.role === 'PROVIDER' ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
                  {conv.role}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 truncate">{conv.lastMessage}</p>
            </div>
          </div>
        ))}
      </main>
      <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-100 pb-8 pt-2 px-4 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1 text-gray-400">
          <span className="material-symbols-outlined text-[26px]">grid_view</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Home</span>
        </button>
        <button onClick={() => navigate('/admin/users')} className="flex-1 flex flex-col items-center gap-1 text-gray-400">
          <span className="material-symbols-outlined text-[26px]">group</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Users</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 text-primary font-bold">
          <div className="bg-primary/10 p-2 rounded-xl"><span className="material-symbols-outlined text-[26px]">chat</span></div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Chat</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1 text-gray-400">
          <span className="material-symbols-outlined text-[26px]">settings</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter">System</span>
        </button>
      </nav>
    </div>
  );
};

export default AdminChat;
