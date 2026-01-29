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
  const { showToast, toggleNotifications, unreadCount } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
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
    const isImageOnly = !text && imageUrl;
    const messageText = isImageOnly ? "" : (text || input.trim());
    
    if ((!messageText && !imageUrl) || !id) return;

    const roomID = ChatService.getChatRoomId(user.id, id);
    const msgData: ChatMessage = { 
      id: `msg_${Date.now()}`, 
      senderId: user.id, 
      recipientId: id, 
      text: messageText, 
      timestamp: new Date().toISOString(), 
      status: 'sent' 
    };

    if (imageUrl) {
      msgData.imageUrl = imageUrl;
    }

    try {
      await ChatService.sendMessage(roomID, msgData, user.role, id);
      if (!imageUrl) setInput(''); 
      setIsTyping(false); 
      ChatService.setTypingStatus(roomID, user.id, false);
    } catch (err) {
      showToast("Message delivery failed. Try again.", "error");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && id) {
      try {
        showToast("Uploading attachment...", "info");
        const url = await dataService.uploadImage(file, `chats/${id}/${Date.now()}`);
        await handleSend('', url);
        showToast("Sent successfully", "success");
      } catch (err) {
        showToast("Upload failed. Check your internet.", "error");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  if (id) {
    const current = conversations.find(c => c.partnerId === id) || { name: 'Expert', avatar: '' };
    return (
      <div className="flex flex-col h-screen bg-white">
        <header className="bg-white px-4 pt-12 pb-4 flex items-center justify-between shadow-sm border-b border-border-light z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/messages')} className="w-10 h-10 flex items-center justify-center -ml-2 active:scale-90 transition-transform"><span className="material-symbols-outlined font-bold">arrow_back</span></button>
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={current.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(current.name)}&background=5B3D9D&color=fff`} className="w-11 h-11 rounded-full object-cover border border-border-light shadow-sm" alt="" />
                <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-accent-green border-2 border-white rounded-full"></div>
              </div>
              <div>
                <h1 className="text-[15px] font-bold text-text-dark leading-none uppercase truncate max-w-[150px]">{current.name}</h1>
                <p className={`text-[10px] font-normal uppercase tracking-tight mt-1 transition-colors ${partnerTyping ? 'text-accent-green' : 'text-text-light'}`}>{partnerTyping ? 'Typing...' : 'Online'}</p>
              </div>
            </div>
          </div>
          <button onClick={() => navigate(`/storefront/${id}`)} className="w-10 h-10 flex items-center justify-center text-primary material-symbols-outlined font-bold">info</button>
        </header>

        <main ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar pb-10 bg-gray-50/20">
          {loading ? (
             <div className="flex items-center justify-center h-full opacity-30"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
          ) : messages.length > 0 ? (
            messages.map((msg) => {
              const isMe = msg.senderId === user.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`max-w-[75%] space-y-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className={`p-4 rounded-[1.6rem] text-[13.5px] leading-relaxed shadow-sm ${isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-white text-text-dark rounded-tl-none border border-border-light'}`}>
                      {msg.imageUrl && (
                        <div className="mb-2 rounded-xl overflow-hidden border border-white/10 shadow-sm bg-gray-100 min-w-[200px] min-h-[150px] flex items-center justify-center">
                          <img src={msg.imageUrl} className="max-w-full h-auto" alt="Chat Attachment" loading="lazy" />
                        </div>
                      )}
                      {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                      <div className="flex items-center justify-end gap-1 mt-1.5 opacity-50">
                        <span className="text-[8px] font-normal uppercase">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMe && <span className={`material-symbols-outlined text-[12px] font-bold ${msg.status === 'read' ? 'text-accent-green' : 'text-white/60'}`}>{msg.status === 'read' ? 'done_all' : 'done'}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-30 text-center px-10">
               <div className="w-20 h-20 bg-gray-100 rounded-[2.5rem] flex items-center justify-center"><span className="material-symbols-outlined text-4xl font-light">forum</span></div>
               <div className="space-y-1">
                 <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-text-dark">Secure Chat</p>
                 <p className="text-[11px] font-normal text-text-light">Your messages are encrypted and private.</p>
               </div>
            </div>
          )}
          {partnerTyping && (
             <div className="flex justify-start gap-2">
                <div className="bg-white px-4 py-2.5 rounded-full border border-border-light shadow-sm flex gap-1">
                   <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></div>
                   <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                   <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
             </div>
          )}
        </main>

        <footer className="p-4 bg-white border-t border-border-light flex items-center gap-3 pb-10">
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()} 
            className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-text-light active:bg-gray-100 transition-colors"
          >
            <span className="material-symbols-outlined font-bold">add_photo_alternate</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileUpload} 
          />
          <input 
            className="flex-1 bg-gray-50 border border-border-light rounded-full py-4 px-6 text-[14px] shadow-inner outline-none font-normal focus:ring-1 focus:ring-primary placeholder-text-light/50" 
            placeholder="Type message..." 
            value={input} 
            onChange={handleInputChange} 
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }} 
          />
          <button 
            type="button"
            onClick={() => handleSend()} 
            disabled={!input.trim()} 
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${input.trim() ? 'bg-primary text-white shadow-btn-glow scale-105 active:scale-95' : 'bg-gray-100 text-gray-300'}`}
          >
            <span className="material-symbols-outlined font-bold text-xl">send</span>
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF9F6] pb-24">
      <header className="px-6 pt-14 pb-6 flex justify-between items-center shrink-0">
        <h1 className="text-2xl font-bold text-text-dark uppercase tracking-tighter">Messages</h1>
        <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 bg-white rounded-2xl shadow-card flex items-center justify-center border border-border-light active:scale-95 transition-transform"><span className="material-symbols-outlined text-text-dark text-xl font-normal">notifications</span>{unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white shadow-sm"></div>}</button>
      </header>
      <main className="px-5 space-y-3 flex-1 overflow-y-auto no-scrollbar pb-6">
        {conversations.map((conv) => (
          <div key={conv.id} onClick={() => navigate(`/messages/${conv.partnerId}`)} className="bg-white rounded-[2rem] p-5 flex items-center gap-5 shadow-card border border-border-light cursor-pointer active:scale-[0.98] transition-all group">
            <div className="relative shrink-0">
              <img src={conv.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.name)}&background=5B3D9D&color=fff`} className="w-16 h-16 rounded-[1.4rem] object-cover border-2 border-white shadow-sm" alt="" />
              {conv.isUnread && <div className="absolute -top-1 -right-1 w-5 h-5 bg-accent-pink border-4 border-white rounded-full shadow-sm"></div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <h2 className={`text-[15px] font-bold text-text-dark truncate uppercase`}>{conv.name}</h2>
                <span className="text-[9px] font-normal text-text-light uppercase">{new Date(conv.lastTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
              </div>
              <p className={`text-[12px] ${conv.isUnread ? 'text-primary font-bold' : 'text-text-light font-normal'} truncate`}>{conv.lastMessage}</p>
            </div>
          </div>
        ))}
        {conversations.length === 0 && (
          <div className="py-24 text-center opacity-30"><span className="material-symbols-outlined text-6xl font-light">forum</span><p className="text-[10px] font-normal uppercase tracking-[0.3em] mt-4">No active conversations yet</p></div>
        )}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 w-full max-md mx-auto bg-white/95 backdrop-blur-md border-t border-border-light pb-10 pt-4 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60"><span className="material-symbols-outlined text-[28px] font-normal">home</span><span className="text-[9px] font-normal uppercase tracking-widest">HOME</span></button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60"><span className="material-symbols-outlined text-[28px] font-normal">format_list_bulleted</span><span className="text-[9px] font-normal uppercase tracking-widest">QUERIES</span></button>
        <button className="flex-1 flex flex-col items-center gap-1 text-primary font-bold"><div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-xl relative"><span className="material-symbols-outlined text-[28px] font-normal">chat_bubble</span></div><span className="text-[9px] font-normal uppercase tracking-widest">CHAT</span></button>
        <button onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60"><span className="material-symbols-outlined text-[28px] font-normal">person</span><span className="text-[9px] font-normal uppercase tracking-widest">PROFILE</span></button>
      </nav>
    </div>
  );
};

export default CustomerChat;