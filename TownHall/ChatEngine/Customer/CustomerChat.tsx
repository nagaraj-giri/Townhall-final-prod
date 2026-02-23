import React, { useState, useRef, useEffect, useMemo } from 'react';
// @ts-ignore
import { useNavigate, useParams } from 'react-router-dom';
import { User, ChatMessage, RFQ } from '../../types';
import { dataService } from '../../services/dataService';
import { ChatService } from '../ChatService';
import { useApp } from '../../App';

interface Props { user: User; }

const CustomerChat: React.FC<Props> = ({ user }) => {
  // @ts-ignore
  const { id } = useParams();
  // @ts-ignore
  const navigate = useNavigate();
  const { showToast, toggleNotifications, unreadCount } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [relevantRfq, setRelevantRfq] = useState<RFQ | null>(null);
  const [hiredProviderId, setHiredProviderId] = useState<string | null>(null);
  const [coldStartPartner, setColdStartPartner] = useState<{name: string, avatar: string} | null>(null);
  
  const typingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const unsub = ChatService.listenToConversations(user.id, async (convs) => {
      const users = await dataService.getUsers();
      const enriched = convs.map(c => {
        const partnerId = c.participants?.find((p: string) => p !== user.id);
        const partner = users.find(u => u.id === partnerId);
        return { ...c, partnerId, name: partner?.name || 'Expert', avatar: partner?.avatar, isUnread: (c.unreadCount?.[user.id] || 0) > 0 };
      });
      setConversations(enriched);
    });
    return () => unsub();
  }, [user.id]);

  useEffect(() => {
    if (id) {
      setLoading(true);
      const roomID = ChatService.getChatRoomId(user.id, id);
      ChatService.markRoomAsRead(roomID, user.id);
      
      const unsubMsgs = ChatService.listenToMessages(roomID, (msgs) => { 
        setMessages(msgs); 
        setLoading(false); 
        ChatService.markRoomAsRead(roomID, user.id).catch(() => {});
      });

      const unsubTyping = ChatService.listenToTypingStatus(roomID, (typingMap) => { 
        setPartnerTyping(typingMap[id] || false); 
      });

      dataService.getUserById(id).then(u => {
        if (u) setColdStartPartner({ name: u.name, avatar: u.avatar });
      });

      return () => { unsubMsgs(); unsubTyping(); };
    }
  }, [id, user.id]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, partnerTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value); if (!id) return;
    const roomID = ChatService.getChatRoomId(user.id, id);
    if (!isTyping) { setIsTyping(true); ChatService.setTypingStatus(roomID, user.id, true); }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { setIsTyping(false); ChatService.setTypingStatus(roomID, user.id, false); }, 3000);
  };

  const handleSend = async (text?: string, imageUrl?: string) => {
    const messageText = text || input.trim();
    if ((!messageText && !imageUrl) || !id) return;

    const roomID = ChatService.getChatRoomId(user.id, id);
    const msgData: ChatMessage = { 
      id: `msg_${Date.now()}`, senderId: user.id, recipientId: id, text: messageText, 
      timestamp: new Date().toISOString(), status: 'sent', imageUrl: imageUrl 
    };

    try {
      await ChatService.sendMessage(roomID, msgData, user.role, id);
      if (!imageUrl) setInput(''); 
      setIsTyping(false); ChatService.setTypingStatus(roomID, user.id, false);
    } catch (err: any) { showToast(err.message, "error"); }
  };

  if (id) {
    const current = conversations.find(c => c.partnerId === id) || coldStartPartner || { name: 'Expert', avatar: '' };
    return (
      <div className="flex flex-col h-screen bg-white">
        <header className="bg-white px-4 pt-12 pb-4 flex items-center justify-between border-b border-gray-50 z-20 sticky top-0">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/messages')} className="w-10 h-10 flex items-center justify-center -ml-2 active:scale-90 transition-transform"><span className="material-symbols-outlined font-black">arrow_back</span></button>
            <div 
              onClick={() => navigate(`/storefront/${id}`)}
              className="flex items-center gap-3 cursor-pointer active:scale-95 transition-all group"
            >
              <div className="relative">
                <img src={current.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(current.name)}&background=5B3D9D&color=fff`} className="w-11 h-11 rounded-[1.1rem] object-cover shadow-sm group-hover:ring-2 group-hover:ring-primary/20 transition-all" alt="" />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent-green border-2 border-white rounded-full"></div>
              </div>
              <div>
                <h1 className="text-[15px] font-black text-text-dark uppercase group-hover:text-primary transition-colors">{current.name}</h1>
                <p className={`text-[9px] font-black uppercase tracking-widest ${partnerTyping ? 'text-accent-green animate-pulse' : 'text-primary opacity-60'}`}>{partnerTyping ? 'TYPING...' : 'VERIFIED EXPERT'}</p>
              </div>
            </div>
          </div>
        </header>

        <main ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar bg-[#FAF9F6]">
          {messages.map((msg) => {
            const isMe = msg.senderId === user.id;
            const isRead = msg.status === 'read';
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`max-w-[80%] space-y-1 flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`p-4 rounded-[1.8rem] text-[13.5px] leading-relaxed shadow-sm ${isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-white text-text-dark rounded-tl-none'}`}>
                    {msg.imageUrl && <img src={msg.imageUrl} className="w-full rounded-xl mb-2" alt="" />}
                    {msg.text && <p className="font-medium">{msg.text}</p>}
                    <div className="flex items-center justify-end gap-1.5 mt-2 opacity-50">
                      <span className="text-[8px] font-bold uppercase">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMe && (
                        <div className="flex items-center">
                          <span className={`material-symbols-outlined text-[16px] font-black ${isRead ? 'text-accent-green' : 'text-white/60'}`}>
                            {isRead ? 'done_all' : 'done'}
                          </span>
                          {isRead && <span className="text-[7px] font-black uppercase ml-1">Seen</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {partnerTyping && <div className="flex justify-start gap-2"><div className="bg-white px-4 py-2 rounded-full border shadow-sm flex items-center gap-1.5"><div className="w-1 h-1 bg-primary/40 rounded-full animate-bounce"></div><div className="w-1 h-1 bg-primary/40 rounded-full animate-bounce delay-100"></div><div className="w-1 h-1 bg-primary/40 rounded-full animate-bounce delay-200"></div></div></div>}
        </main>

        <footer className="p-4 bg-white border-t border-gray-50 flex items-center gap-3 pb-12">
          <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 active:bg-gray-100"><span className="material-symbols-outlined">photo_camera</span></button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file && id) {
              const url = await dataService.uploadImage(file, `chats/${Date.now()}`);
              await handleSend('', url);
            }
          }} />
          <input className="flex-1 bg-gray-50 rounded-full py-4 px-7 text-[14px] shadow-inner outline-none font-bold focus:ring-1 focus:ring-primary" placeholder="Type your message..." value={input} onChange={handleInputChange} onKeyDown={(e) => e.key === 'Enter' && handleSend()} />
          <button onClick={() => handleSend()} disabled={!input.trim()} className="w-12 h-12 rounded-full bg-primary text-white shadow-lg flex items-center justify-center active:scale-95 transition-all"><span className="material-symbols-outlined">send</span></button>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF9F6] pb-24">
      <header className="px-6 pt-14 pb-6 flex justify-between items-center shrink-0">
        <h1 className="text-[26px] font-black text-text-dark uppercase tracking-tighter">Inbox</h1>
        <button onClick={() => toggleNotifications(true)} className="relative w-12 h-12 bg-white rounded-[1.2rem] shadow-soft flex items-center justify-center"><span className="material-symbols-outlined text-text-dark">notifications</span>{unreadCount > 0 && <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white"></div>}</button>
      </header>
      <main className="px-5 space-y-4 flex-1 overflow-y-auto no-scrollbar">
        {conversations.map((conv) => (
          <div key={conv.id} onClick={() => navigate(`/messages/${conv.partnerId}`)} className="bg-white rounded-[2.2rem] p-6 flex items-center gap-5 shadow-card border border-white cursor-pointer active:scale-[0.98] transition-all">
            <div className="relative">
              <img src={conv.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.name)}&background=5B3D9D&color=fff`} className="w-16 h-16 rounded-[1.4rem] object-cover" alt="" />
              {conv.isUnread && <div className="absolute -top-1 -right-1 w-5 h-5 bg-accent-pink border-4 border-white rounded-full"></div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1"><h2 className="text-[16px] font-black text-text-dark uppercase truncate">{conv.name}</h2><span className="text-[9px] font-bold text-gray-300">{new Date(conv.lastTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span></div>
              <p className={`text-[12px] ${conv.isUnread ? 'text-primary font-black' : 'text-gray-400 font-medium'} truncate`}>{conv.lastMessage}</p>
            </div>
          </div>
        ))}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 w-full max-md mx-auto bg-white border-t border-gray-100 pb-10 pt-4 px-6 flex justify-around items-center z-50">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1 text-gray-300"><span className="material-symbols-outlined text-[28px]">home</span><span className="text-[9px] font-black uppercase">HOME</span></button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1 text-gray-300"><span className="material-symbols-outlined text-[28px]">format_list_bulleted</span><span className="text-[9px] font-black uppercase">QUERIES</span></button>
        <button className="flex-1 flex flex-col items-center gap-1 text-primary"><div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-2xl"><span className="material-symbols-outlined text-[28px] fill-1">chat_bubble</span></div><span className="text-[9px] font-black uppercase">CHAT</span></button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1 text-gray-300"><span className="material-symbols-outlined text-[28px]">person</span><span className="text-[9px] font-black uppercase">PROFILE</span></button>
      </nav>
    </div>
  );
};

export default CustomerChat;