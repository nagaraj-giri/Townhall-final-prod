
// @ts-ignore
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, onSnapshot, orderBy, writeBatch, increment } from "firebase/firestore";
// @ts-ignore
import type { Unsubscribe } from "firebase/firestore";
import { db } from "../pages/services/firebase";
import { ChatMessage, UserRole } from "../types";
import { dataService } from "../pages/services/dataService";

export const ChatService = {
  getChatRoomId: (uid1: string, uid2: string) => [uid1, uid2].sort().join('_'),

  listenToConversations: (userId: string, callback: (convs: any[]) => void): Unsubscribe => {
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', userId), orderBy('lastTimestamp', 'desc'));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id }))));
  },

  listenToMessages: (chatRoomId: string, callback: (msgs: ChatMessage[]) => void): Unsubscribe => {
    const q = query(collection(db, 'chats', chatRoomId, 'history'), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (s) => callback(s.docs.map(d => ({ ...d.data(), id: d.id } as ChatMessage))));
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
    });
  },

  setTypingStatus: async (chatRoomId: string, userId: string, isTyping: boolean) => {
    const roomRef = doc(db, 'chats', chatRoomId);
    try {
      await updateDoc(roomRef, {
        [`typing.${userId}`]: isTyping
      });
    } catch (e) {
      // Document might not exist if no message sent yet, ignore updates
    }
  },

  markRoomAsRead: async (chatRoomId: string, userId: string) => {
    const roomRef = doc(db, 'chats', chatRoomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;

    const batch = writeBatch(db);
    batch.update(roomRef, { [`unreadCount.${userId}`]: 0 });
    
    // Filter history for messages sent TO the current user that are still unread
    const unreadQuery = query(
      collection(db, 'chats', chatRoomId, 'history'), 
      where('recipientId', '==', userId), 
      where('status', '==', 'sent')
    );
    
    try {
      const unreadSnap = await getDocs(unreadQuery);
      unreadSnap.docs.forEach(d => {
        batch.update(d.ref, { status: 'read' });
      });
      await batch.commit();
    } catch (err) {
      console.warn("[ChatService] Failed to clear unread markers:", err);
    }
  },

  sendMessage: async (chatRoomId: string, msg: any, role: UserRole, recipientId: string) => {
    try {
      const roomRef = doc(db, 'chats', chatRoomId);
      const messageRef = doc(db, 'chats', chatRoomId, 'history', msg.id);
      
      const roomSnap = await getDoc(roomRef);
      const lastText = msg.text || (msg.imageUrl ? "Sent an image" : "New message");

      if (!roomSnap.exists()) {
        if (role === UserRole.PROVIDER) throw new Error("Permission Denied: Providers cannot initiate conversations.");
        await setDoc(roomRef, {
          id: chatRoomId,
          participants: [msg.senderId, recipientId],
          lastMessage: lastText,
          lastTimestamp: msg.timestamp,
          unreadCount: { [recipientId]: 1, [msg.senderId]: 0 }
        });
      } else {
        await updateDoc(roomRef, {
          lastMessage: lastText,
          lastTimestamp: msg.timestamp,
          [`unreadCount.${recipientId}`]: increment(1)
        });
      }
      
      // Sanitize object to remove undefined values for Firestore
      const docData: any = { ...msg, status: 'sent' };
      Object.keys(docData).forEach(key => docData[key] === undefined && delete docData[key]);
      
      await setDoc(messageRef, docData);
      
      const notificationMessage = (msg.text && msg.text.length > 0) 
        ? (msg.text.length > 40 ? msg.text.substring(0, 40) + "..." : msg.text)
        : (msg.imageUrl ? "Sent an attachment" : "New Message");

      await dataService.createNotification(
        recipientId, 
        "💬 New Message", 
        notificationMessage, 
        "INFO", 
        role === UserRole.CUSTOMER ? UserRole.PROVIDER : UserRole.CUSTOMER, 
        `/messages/${msg.senderId}`
      );
    } catch (error) {
      console.error("[ChatService] Send failure:", error);
      throw error;
    }
  }
};
