import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, ChatMessage } from '../../types';
import { dataService } from '../../pages/services/dataService';
import { ChatService } from '../ChatService';
import { useApp } from '../../App';

interface Props { user: User; }

const CustomerChat: React.FC<Props> = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { chatUnreadCount, unreadCount, toggleNotifications } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);

  useEffect(() => {
    const unsub = ChatService.listenToConversations(user.id, async (convs) => {
      const users = await dataService.getUsers();
      const enriched = convs.map(c => {
        const partnerId = c.participants?.find((p: string) => p !== user.id);
        const partner = users.find(u => u.id === partnerId);
        return { 
          ...c, 
          id: partnerId, 
          name: partner?.name || 'Expert', 
          avatar: partner?.avatar,
          isUnread: c.lastMessageSenderId !== user.id
        };
      });
      setConversations(enriched);
    });
    return () => unsub();
  }, [user.id]);

  useEffect(() => {
    if (id) {
      const roomID = ChatService.getChatRoomId(user.id, id);
      ChatService.markRoomAsRead(roomID, user.id);
      
      const unsub = ChatService.listenToMessages(roomID, (msgs) => {
        setMessages(msgs);
        ChatService.markRoomAsRead(roomID, user.id);
      });
      return () => unsub();
    }
  }, [id, user.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

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
    const current = conversations.find(c => c.id === id) || { id, name: 'Expert Chat', avatar: '' };
    return (
      <div className="flex flex-col h-screen bg-transparent">
        <header className="bg-white/10 backdrop-blur-md px-4 pt-12 pb-3 flex items-center gap-4 shadow-sm border-b z-10">
          <button onClick={() => navigate('/messages')} className="p-2 active:scale-90 transition-transform">
            <span className="material-symbols-outlined font-bold">arrow_back</span>
          </button>
          <button onClick={() => navigate(`/storefront/${current.id}`)} className="flex items-center gap-3 text-left active:opacity-70 transition-opacity">
            <div className="relative">
              <img src={current.avatar || `https://ui-avatars.com/api/?name=${current.name}&background=5B3D9D&color=fff`} className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm" alt="" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent-green border-2 border-white rounded-full"></div>
            </div>
            <div>
              <h1 className="text-sm font-bold text-text-dark leading-tight">{current.name}</h1>
              <p className="text-[10px] text-primary font-bold uppercase tracking-tight">Provider • Online</p>
            </div>
          </button>
        </header>
        <main ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-4 max-w-[80%] rounded-[1.6rem] text-[13px] shadow-sm ${msg.senderId === user.id ? 'bg-primary text-white rounded-tr-none' : 'bg-white text-text-dark rounded-tl-none border'}`}>
                <p>{msg.text}</p>
                <div className="flex items-center justify-end gap-1 mt-1 opacity-60">
                   <p className="text-[8px] font-bold uppercase">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                   {msg.senderId === user.id && (
                     <span className={`material-symbols-outlined text-[10px] ${msg.status === 'read' ? 'text-blue-400' : ''}`}>
                       {msg.status === 'read' ? 'done_all' : 'done'}
                     </span>
                   )}
                </div>
              </div>
            </div>
          ))}
        </main>
        <footer className="p-4 bg-white/50 border-t flex items-center gap-3 pb-8">
          <input className="flex-1 bg-white border-none rounded-full py-4 px-6 text-sm shadow-soft outline-none font-medium focus:ring-1 focus:ring-primary" placeholder="Type message..." value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()}/>
          <button onClick={handleSend} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${input.trim() ? 'bg-primary text-white shadow-lg scale-105' : 'bg-gray-200 text-gray-400'}`}>
            <span className="material-symbols-outlined">send</span>
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-24">
      <header className="px-6 pt-12 pb-4 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-text-dark uppercase">Inbox</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Chat History</p>
        </div>
        <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-gray-100 active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-text-dark text-xl font-normal">notifications</span>
          {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white shadow-sm"></div>}
        </button>
      </header>
      <main className="px-5 space-y-3 flex-1 overflow-y-auto no-scrollbar">
        {conversations.map((conv) => (
          <div key={conv.id} onClick={() => navigate(`/messages/${conv.id}`)} className="bg-white rounded-[1.5rem] p-4 flex items-center gap-4 shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-all hover:border-primary/20 group relative">
            <img src={conv.avatar || `https://ui-avatars.com/api/?name=${conv.name}&background=5B3D9D&color=fff`} className="w-14 h-14 rounded-2xl object-cover border shadow-sm" alt="" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <h2 className={`text-[15px] ${conv.isUnread ? 'font-black' : 'font-bold'} text-text-dark truncate uppercase tracking-tight`}>{conv.name}</h2>
                {conv.isUnread && <div className="w-2.5 h-2.5 bg-accent-pink rounded-full shadow-sm"></div>}
              </div>
              <p className={`text-[11px] ${conv.isUnread ? 'text-text-dark font-bold' : 'text-gray-400 font-medium'} truncate`}>{conv.lastMessage}</p>
            </div>
          </div>
        ))}
        {conversations.length === 0 && (
          <div className="py-24 text-center opacity-30">
             <span className="material-symbols-outlined text-6xl">chat_bubble_outline</span>
             <p className="text-xs font-bold uppercase tracking-widest mt-4">Your inbox is empty</p>
          </div>
        )}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white border-t border-gray-100 pb-8 pt-3 px-4 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1 text-text-light">
          <div className="w-11 h-11 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">home</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">HOME</span>
        </button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1 text-text-light">
          <div className="w-11 h-11 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">format_list_bulleted</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">QUERIES</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 text-primary">
          <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-primary/10 relative">
            <span className="material-symbols-outlined text-[24px]">chat_bubble</span>
            {/* 
                UX FIX: We hide the global unread badge on the bottom nav when the CHAT tab is active 
                to avoid redundancy, as the unread status is already visible in the list items above.
            */}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">CHAT</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1 text-text-light">
          <div className="w-11 h-11 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">person</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">PROFILE</span>
        </button>
      </nav>
    </div>
  );
};

export default CustomerChat;