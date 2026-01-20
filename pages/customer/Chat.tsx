import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, ChatMessage, UserRole } from '../../types';
import { dataService } from '../services/dataService';
// Fix: Import ChatService for real-time messaging operations
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
  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);

  // Real-time conversation list
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
          name: partner?.name || 'Service Provider',
          avatar: partner?.avatar,
          lastMessage: c.lastMessage || 'Open chat to start negotiation',
          isOnline: true,
          category: 'Verified Provider'
        };
      });
      setConversations(enriched);
    });
    return () => unsub();
  }, [user.id]);

  // Real-time message history
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
    // Fix: Use ChatService for sending messages
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
    await ChatService.sendMessage(roomID, newMessage, user.role, id);
    setInput('');
  };

  if (id) {
    const currentConv = conversations.find(c => c.id === id) || { name: 'Chat', avatar: '', isOnline: false, category: '' };
    return (
      <div className="flex flex-col h-screen bg-transparent">
        <header className="bg-white px-4 pt-12 pb-3 flex items-center justify-between shrink-0 shadow-sm border-b border-gray-50 z-10">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/messages')} className="p-2 text-text-dark font-normal">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex items-center gap-3">
              <img src={currentConv.avatar} className="w-10 h-10 rounded-full object-cover" alt="" />
              <div>
                <h1 className="text-sm font-black text-text-dark leading-none uppercase">{currentConv.name}</h1>
                <p className="text-[10px] font-normal text-text-light mt-1">{currentConv.category} • Active</p>
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
                  <div className={`p-4 rounded-[1.6rem] text-[13px] leading-relaxed shadow-sm font-normal ${
                    isUser ? 'bg-primary text-white rounded-tr-none' : 'bg-white text-text-dark rounded-tl-none border border-gray-50'
                  }`}>
                    <p>{msg.text}</p>
                  </div>
                  <p className="text-[9px] font-normal text-gray-400 mt-1.5 uppercase">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
        </main>

        <footer className="p-4 bg-transparent space-y-4 pb-8">
          <div className="flex items-center gap-3">
            <input 
              className="flex-1 bg-white border-none rounded-full py-4 px-6 text-[13px] font-normal shadow-soft focus:ring-1 focus:ring-primary outline-none"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend} className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all shrink-0 font-normal ${input.trim() ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'}`}>
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-24">
      <header className="px-6 pt-10 pb-4 shrink-0"><h1 className="text-2xl font-black text-[#333333] uppercase">Messages</h1></header>
      <main className="px-5 space-y-3 flex-1 overflow-y-auto no-scrollbar pb-6">
        <div className="relative mb-4">
          <span className="absolute inset-y-0 left-4 flex items-center text-gray-400 font-normal"><span className="material-symbols-outlined">search</span></span>
          <input className="w-full py-3.5 pl-11 bg-white rounded-2xl border-none shadow-sm text-xs font-normal focus:ring-1 focus:ring-primary" placeholder="Search conversations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
        </div>
        {conversations.filter(c => (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())).map((conv) => (
          <div key={conv.id} onClick={() => navigate(`/messages/${conv.id}`)} className="bg-white rounded-[1.2rem] p-4 flex items-center gap-4 shadow-sm border border-gray-100 active:scale-[0.98] cursor-pointer transition-transform">
            <img src={conv.avatar} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm" alt="" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5"><h2 className="text-[15px] font-black text-[#333333] truncate uppercase">{conv.name}</h2><span className="text-[10px] font-normal text-gray-400 uppercase">Live</span></div>
              <p className="text-[12px] text-gray-400 truncate font-normal">{conv.lastMessage}</p>
            </div>
          </div>
        ))}
        {conversations.length === 0 && (
          <div className="py-20 text-center text-gray-300">
            <span className="material-symbols-outlined text-6xl opacity-20 font-normal">chat_bubble</span>
            <p className="mt-4 font-normal uppercase text-[10px] tracking-widest">No active chats yet</p>
          </div>
        )}
      </main>
      <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-border-light pb-6 pt-2 px-6 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] backdrop-blur-md bg-white/95">
        <button onClick={() => navigate('/')} className="flex flex-col items-center gap-1 text-text-light w-1/4 font-normal"><span className="material-symbols-outlined text-2xl">home</span><span className="text-[9px] uppercase tracking-widest">Home</span></button>
        <button onClick={() => navigate('/queries')} className="flex flex-col items-center gap-1 text-text-light w-1/4 font-normal"><span className="material-symbols-outlined text-[24px]">format_list_bulleted</span><span className="text-[9px] uppercase tracking-widest">Queries</span></button>
        <button className="flex flex-col items-center gap-1 text-primary w-1/4 font-normal"><span className="material-symbols-outlined text-2xl">chat_bubble</span><span className="text-[9px] uppercase tracking-widest">Chat</span></button>
        <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1 text-text-light w-1/4 font-normal"><span className="material-symbols-outlined text-2xl">person</span><span className="text-[9px] uppercase tracking-widest">Profile</span></button>
      </nav>
    </div>
  );
};

export default Chat;