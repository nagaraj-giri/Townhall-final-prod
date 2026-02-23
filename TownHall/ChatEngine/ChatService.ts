// @ts-ignore
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, onSnapshot, orderBy, writeBatch, increment } from "firebase/firestore";
// @ts-ignore
import type { Unsubscribe } from "firebase/firestore";
import { db } from "../services/firebase";
import { ChatMessage, UserRole } from "../types";
import { dataService } from "../services/dataService";

export const ChatService = {
  getChatRoomId: (uid1: string, uid2: string) => [uid1, uid2].sort().join('_'),

  listenToConversations: (userId: string, callback: (convs: any[]) => void): Unsubscribe => {
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', userId), orderBy('lastTimestamp', 'desc'));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id }))), (e) => console.debug("Listen error convs", e.message));
  },

  listenToMessages: (chatRoomId: string, callback: (msgs: ChatMessage[]) => void): Unsubscribe => {
    const q = query(collection(db, 'chats', chatRoomId, 'history'), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as ChatMessage))), (e) => console.debug("Listen error msgs", e.message));
  },

  listenToTotalUnreadMessages: (userId: string, callback: (count: number) => void): Unsubscribe => {
    return ChatService.listenToConversations(userId, (convs) => {
      callback(convs.reduce((acc, c) => acc + (c.unreadCount?.[userId] || 0), 0));
    });
  },

  listenToTypingStatus: (chatRoomId: string, callback: (typingMap: Record<string, boolean>) => void): Unsubscribe => {
    const roomRef = doc(db, 'chats', chatRoomId);
    return onSnapshot(roomRef, (s) => {
      const data = s.data();
      callback(data?.typing || {});
    }, (e) => console.debug("Listen error typing", e.message));
  },

  setTypingStatus: async (chatRoomId: string, userId: string, isTyping: boolean) => {
    const roomRef = doc(db, 'chats', chatRoomId);
    try {
      await updateDoc(roomRef, { [`typing.${userId}`]: isTyping });
    } catch (e) {}
  },

  markRoomAsRead: async (chatRoomId: string, userId: string) => {
    const roomRef = doc(db, 'chats', chatRoomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;
    const batch = writeBatch(db);
    batch.update(roomRef, { [`unreadCount.${userId}`]: 0 });
    const unreadQuery = query(collection(db, 'chats', chatRoomId, 'history'), where('recipientId', '==', userId), where('status', '==', 'sent'));
    try {
      const unreadSnap = await getDocs(unreadQuery);
      unreadSnap.docs.forEach(d => batch.update(d.ref, { status: 'read' }));
      await batch.commit();
    } catch (err) {}
  },

  sendMessage: async (chatRoomId: string, msg: any, role: UserRole, recipientId: string) => {
    try {
      const roomRef = doc(db, 'chats', chatRoomId);
      const messageRef = doc(db, 'chats', chatRoomId, 'history', msg.id);
      const roomSnap = await getDoc(roomRef);
      const lastText = msg.text || (msg.imageUrl ? "Sent an image" : "New message");

      // PRD 4.6 Initiation Guard: Only Customer can start a chat
      if (!roomSnap.exists()) {
        if (role === UserRole.PROVIDER) {
          throw new Error("PROVIDER_RESTRICTED: Only customers can initiate a conversation. You can reply once they message you.");
        }

        // PRD 4.3 Logic: Verify quote exists from this specific provider before initiation
        const quotes = await dataService.getQuotes();
        const hasQuote = quotes.some(q => 
          q.providerId === recipientId && 
          q.status !== 'REJECTED'
        );

        if (!hasQuote) {
          throw new Error("MESSAGING_LOCKED: You can only chat with providers who have submitted a proposal.");
        }

        // Create initial room metadata
        await setDoc(roomRef, { 
          id: chatRoomId, 
          participants: [msg.senderId, recipientId], 
          lastMessage: lastText, 
          lastTimestamp: msg.timestamp, 
          unreadCount: { [recipientId]: 1, [msg.senderId]: 0 },
          typing: { [msg.senderId]: false, [recipientId]: false }
        });
      } else {
        await updateDoc(roomRef, { 
          lastMessage: lastText, 
          lastTimestamp: msg.timestamp, 
          [`unreadCount.${recipientId}`]: increment(1) 
        });
      }
      
      const docData: any = { ...msg, status: 'sent' };
      Object.keys(docData).forEach(key => docData[key] === undefined && delete docData[key]);
      
      // Save message in subcollection
      await setDoc(messageRef, docData);
      
      // Notification Trigger
      await dataService.createNotification(
        recipientId, 
        "💬 New Message", 
        (msg.text?.substring(0, 40) || "Sent an attachment"), 
        "INFO", 
        role === UserRole.CUSTOMER ? UserRole.PROVIDER : UserRole.CUSTOMER, 
        `/messages/${msg.senderId}`
      );
    } catch (error) { throw error; }
  }
};
