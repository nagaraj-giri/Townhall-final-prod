import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, ChatMessage, UserRole } from '../../types';
import { dataService } from '../../pages/services/dataService';
import { ChatService } from '../ChatService';
import { useApp } from '../../App';

interface Props { user: User; }

const ProviderChat: React.FC<Props> = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { chatUnreadCount, unreadCount, toggleNotifications } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  useEffect(() => {
    const unsub = ChatService.listenToConversations(user.id, async (convs) => {
      const users = await dataService.getUsers();
      const enriched = convs.map(c => {
        const partnerId = c.participants.find((p: string) => p !== user.id);
        const partner = users.find(u => u.id === partnerId);
        return { 
          ...c, 
          id: partnerId, 
          name: partner?.name || 'Customer', 
          avatar: partner?.avatar || `https://ui-avatars.com/api/?name=${partner?.name || 'C'}&background=FFD60A&color=333`,
          isUnread: c.lastMessageSenderId !== user.id
        };
      });
      setConversations(enriched);
    });
    return () => unsub();
  }, [user.id]);

  useEffect(() => {
    if (id) {
      setIsLoadingMessages(true);
      const roomID = ChatService.getChatRoomId(user.id, id);
      ChatService.markRoomAsRead(roomID, user.id);
      
      const unsub = ChatService.listenToMessages(roomID, (msgs) => {
        setMessages(msgs);
        setIsLoadingMessages(false);
        ChatService.markRoomAsRead(roomID, user.id);
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
    const roomID = ChatService.getChatRoomId(user.id, id);
    const textToSend = input.trim();
    setInput('');
    try {
      await ChatService.sendMessage(roomID, {
        id: Date.now().toString(), 
        senderId: user.id, 
        recipientId: id,
        text: textToSend, 
        timestamp: new Date().toISOString(),
        status: 'sent'
      }, user.role, id);
    } catch (err) {
      alert("Only customers can initiate a new conversation. You can reply once they message you.");
    }
  };

  if (id) {
    const current = conversations.find(c => c.id === id) || { 
      name: 'Customer', 
      avatar: `https://ui-avatars.com/api/?name=Customer&background=FFD60A&color=333` 
    };
    return (
      <div className="flex flex-col h-screen bg-transparent">
        <header className="bg-white/95 backdrop-blur-md px-4 pt-12 pb-4 flex items-center justify-between shadow-sm border-b border-gray-100 z-10 sticky top-0">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/messages')} className="p-2 text-text-dark active:scale-90 transition-transform">
              <span className="material-symbols-outlined font-bold">chevron_left</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={current.avatar} className="w-11 h-11 rounded-full object-cover border border-gray-50 shadow-sm" alt="" />
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#22C55E] border-2 border-white rounded-full"></div>
              </div>
              <div>
                <h1 className="text-[15px] font-bold text-text-dark leading-none">{current.name}</h1>
                <p className="text-[10px] text-primary font-bold uppercase mt-1 tracking-tight">Client • Online</p>
              </div>
            </div>
          </div>
        </header>
        <main ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar pb-10">
          {messages.map((msg, index) => {
            const isMe = msg.senderId === user.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200`}>
                <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}>
                  <div className={`p-4 rounded-[1.6rem] shadow-card text-[13px] leading-relaxed ${isMe ? 'bg-primary text-white rounded-br-none' : 'bg-white text-text-dark rounded-bl-none border border-gray-100'}`}>
                    <p>{msg.text}</p>
                    <div className="flex items-center justify-end gap-1 mt-1 opacity-40">
                       <p className="text-[8px] font-bold uppercase tracking-tight">
                         {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </p>
                       {isMe && (
                         <span className={`material-symbols-outlined text-[10px] ${msg.status === 'read' ? 'text-accent-green' : ''}`}>
                           {msg.status === 'read' ? 'done_all' : 'done'}
                         </span>
                       )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </main>
        <footer className="bg-white/80 backdrop-blur-md pb-8 pt-4 px-4 border-t border-gray-50">
          <div className="flex items-center gap-3">
            <input className="flex-1 bg-gray-50 border border-gray-100 rounded-[2rem] px-5 py-3.5 text-sm font-medium outline-none focus:ring-1 focus:ring-primary" placeholder="Type your reply..." value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} />
            <button onClick={handleSend} disabled={!input.trim()} className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ${input.trim() ? 'bg-primary text-white scale-105 active:scale-95' : 'bg-gray-200 text-gray-400'}`}>
              <span className="material-symbols-outlined text-[22px]">send</span>
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-28">
      <header className="px-6 pt-12 pb-6 flex justify-between items-center shrink-0 bg-white/10 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-100/50">
        <div>
          <h1 className="text-2xl font-[900] text-text-dark uppercase tracking-tighter">Client Inbox</h1>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mt-1">Active Negotiations</p>
        </div>
        <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-gray-100 active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-text-dark text-xl font-normal">notifications</span>
          {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white shadow-sm"></div>}
        </button>
      </header>
      <main className="px-5 space-y-4 flex-1 overflow-y-auto no-scrollbar pt-6">
        {conversations.map((conv) => (
          <div key={conv.id} onClick={() => navigate(`/messages/${conv.id}`)} className="bg-white rounded-[2rem] p-5 flex items-center gap-5 shadow-card border border-white hover:border-primary/20 cursor-pointer active:scale-[0.98] transition-all group">
            <div className="relative shrink-0">
              <img src={conv.avatar} className="w-16 h-16 rounded-[1.4rem] object-cover border-2 border-gray-50 shadow-sm" alt="" />
              <div className={`absolute -top-1 -right-1 w-5 h-5 ${conv.isUnread ? 'bg-accent-pink' : 'bg-accent-green'} border-4 border-white rounded-full shadow-sm`}></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <h2 className={`text-[15px] ${conv.isUnread ? 'font-black' : 'font-bold'} text-text-dark truncate uppercase tracking-tight`}>{conv.name}</h2>
                <div className="flex items-center gap-1.5">
                   <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">ACTIVE</span>
                </div>
              </div>
              <p className={`text-[12px] ${conv.isUnread ? 'text-text-dark font-black' : 'text-gray-400 font-medium'} truncate`}>{conv.lastMessage || 'Open chat to start negotiation'}</p>
            </div>
          </div>
        ))}
        {conversations.length === 0 && (
          <div className="py-24 text-center opacity-30">
             <span className="material-symbols-outlined text-6xl">forum</span>
             <p className="text-xs font-bold uppercase tracking-widest mt-4">No active client chats</p>
          </div>
        )}
      </main>
      <nav className="fixed bottom-0 w-full max-w-md mx-auto bg-white border-t border-gray-100 pb-8 pt-3 px-4 flex justify-between items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1 text-gray-400">
          <span className="material-symbols-outlined text-[26px]">home</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter">HOME</span>
        </button>
        <button onClick={() => navigate('/leads')} className="flex-1 flex flex-col items-center gap-1 text-gray-400">
          <span className="material-symbols-outlined text-[26px]">grid_view</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter">LEADS</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 text-primary font-bold">
          <div className="bg-primary/10 p-2 rounded-xl relative">
            <span className="material-symbols-outlined text-[26px]">chat_bubble</span>
            {/* 
                UX FIX: Hide redundant badge on the active tab to match the screenshot request. 
                Unread status is visible in individual items above.
            */}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">CHAT</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1 text-gray-400">
          <span className="material-symbols-outlined text-[26px]">person</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter">PROFILE</span>
        </button>
      </nav>
    </div>
  );
};

export default ProviderChat;