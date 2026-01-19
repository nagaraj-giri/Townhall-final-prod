
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, ChatMessage, UserRole } from '../../types';
import { dataService } from '../services/dataService';
// Fix: Import ChatService for messaging operations
import { ChatService } from '../../ChatEngine/ChatService';

interface ChatProps {
  user: User;
}

const Chat: React.FC<ChatProps> = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [input, setInput] = useState('');

  // Real-time conversation list (Inbox)
  useEffect(() => {
    // Fix: Use ChatService.listenToConversations instead of dataService
    const unsub = ChatService.listenToConversations(user.id, async (convs) => {
      const users = await dataService.getUsers();
      const enriched = convs.map(c => {
        const partnerId = c.participants.find((p: string) => p !== user.id);
        const partner = users.find(u => u.id === partnerId);
        return {
          ...c,
          id: partnerId,
          name: partner?.name || 'Customer',
          avatar: partner?.avatar,
          lastMessage: c.lastMessage || 'Negotiation pending...',
          isOnline: true,
          category: 'Marketplace Customer'
        };
      });
      setConversations(enriched);
    });
    return () => unsub();
  }, [user.id]);

  // Real-time message history for selected room
  useEffect(() => {
    if (id) {
      // Fix: Use ChatService for room ID generation and message listening
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
    // Fix: Use ChatService for sending messages and room identification
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
    
    try {
      await ChatService.sendMessage(roomID, newMessage, user.role, id);
      setInput('');
    } catch (err) {
      // Logic for permission denied: Triggered if Provider tries to send a message to a room that hasn't been created by the Customer yet.
      alert("Permission Denied: Only customers can initiate a new conversation. You can reply once they message you.");
    }
  };

  if (id) {
    const currentPartner = conversations.find(c => c.id === id) || { name: 'Customer Chat', avatar: '', isOnline: false, category: '' };
    return (
      <div className="flex flex-col h-screen bg-[#FDF9F6]">
        <header className="bg-white px-4 pt-12 pb-3 flex items-center justify-between shrink-0 shadow-sm border-b border-gray-50 z-10">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/messages')} className="p-2 text-text-dark">
              <span className="material-symbols-outlined font-bold">arrow_back</span>
            </button>
            <div className="flex items-center gap-3">
              <img src={currentPartner.avatar} className="w-10 h-10 rounded-full object-cover" alt="" />
              <div>
                <h1 className="text-sm font-bold text-text-dark leading-none">{currentPartner.name}</h1>
                <p className="text-[10px] font-medium text-text-light mt-1">{currentPartner.category} • Client</p>
              </div>
            </div>
          </div>
        </header>

        <main ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
          {messages.map((msg) => {
            const isUser = msg.senderId === user.id;
            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2 animate-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[80%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className={`p-4 rounded-[1.6rem] text-[13px] shadow-sm ${
                    isUser ? 'bg-primary text-white rounded-tr-none' : 'bg-white text-text-dark rounded-tl-none border border-gray-50'
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

        <footer className="p-4 bg-transparent pb-8 space-y-4">
          <div className="flex items-center gap-3">
            <input 
              className="flex-1 bg-white border-none rounded-full py-4 px-6 text-[13px] font-medium shadow-soft focus:ring-1 focus:ring-primary outline-none"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend} className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ${input.trim() ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'}`}>
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFBF7] pb-24">
      <header className="px-6 pt-10 pb-4 flex justify-between items-center shrink-0">
        <h1 className="text-2xl font-bold text-[#333333]">Client Inbox</h1>
      </header>
      <main className="px-5 space-y-3 flex-1 overflow-y-auto no-scrollbar pb-6">
        <div className="relative mb-4">
          <span className="absolute inset-y-0 left-4 flex items-center text-gray-400"><span className="material-symbols-outlined">search</span></span>
          <input className="w-full py-3.5 pl-11 bg-white rounded-2xl border-none shadow-sm text-xs focus:ring-1 focus:ring-primary outline-none" placeholder="Search conversations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
        </div>
        {conversations.filter(c => (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())).map((conv) => (
          <div key={conv.id} onClick={() => navigate(`/messages/${conv.id}`)} className="bg-white rounded-[1.2rem] p-4 flex items-center gap-4 shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-transform">
            <img src={conv.avatar} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm" alt="" />
            <div className="flex-1 min-w-0">
              <h2 className="text-[15px] font-bold text-[#333333] truncate">{conv.name}</h2>
              <p className="text-[12px] text-gray-400 truncate">{conv.lastMessage}</p>
            </div>
          </div>
        ))}
        {conversations.length === 0 && (
          <div className="py-20 text-center opacity-40">
             <span className="material-symbols-outlined text-5xl">mark_chat_unread</span>
             <p className="text-xs font-bold uppercase tracking-widest mt-2">Waiting for client messages...</p>
          </div>
        )}
      </main>
      <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-100 pb-6 pt-2 px-6 flex justify-between items-center z-50">
        <button onClick={() => navigate('/')} className="flex flex-col items-center gap-1 text-text-light w-1/4 transition-colors"><span className="material-symbols-outlined text-2xl">home</span><span className="text-[10px]">Home</span></button>
        <button onClick={() => navigate('/leads')} className="flex flex-col items-center gap-1 text-text-light w-1/4 transition-colors"><span className="material-symbols-outlined text-2xl">dashboard</span><span className="text-[10px]">Leads</span></button>
        <button className="flex flex-col items-center gap-1 text-primary w-1/4 font-bold"><div className="bg-primary/10 p-1.5 rounded-xl"><span className="material-symbols-outlined text-2xl">chat_bubble</span></div><span className="text-[10px]">Chat</span></button>
        <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1 text-text-light w-1/4 transition-colors"><span className="material-symbols-outlined text-2xl">person</span><span className="text-[10px]">Profile</span></button>
      </nav>
    </div>
  );
};

export default Chat;
