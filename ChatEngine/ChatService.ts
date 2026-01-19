import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  collectionGroup,
  writeBatch
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";
import { db } from "../pages/services/firebase";
import { ChatMessage, UserRole } from "../types";

const COLLECTIONS = {
  CHATS: 'chats',
  USERS: 'users'
};

export const ChatService = {
  getChatRoomId: (uid1: any, uid2: any) => {
    const s1 = String(uid1 || 'unknown');
    const s2 = String(uid2 || 'unknown');
    const ids = [s1, s2].sort();
    return ids.join('_');
  },

  listenToConversations: (userId: string, callback: (convs: any[]) => void): Unsubscribe => {
    if (!userId || userId === 'undefined') return () => {};
    const uid = String(userId);
    const q = query(
      collection(db, COLLECTIONS.CHATS),
      where('participants', 'array-contains', uid),
      orderBy('lastTimestamp', 'desc')
    );
    return onSnapshot(q, (snapshot: any) => {
      callback(snapshot.docs.map(d => {
        const data = d.data();
        return { 
          ...data, 
          id: d.id,
          participants: Array.isArray(data.participants) ? data.participants : []
        };
      }));
    }, (err) => {
      if (err.code !== 'permission-denied') {
        console.warn("Conversations listener restricted:", err.message);
      }
    });
  },

  listenToMessages: (chatRoomId: string, callback: (msgs: ChatMessage[]) => void): Unsubscribe => {
    if (!chatRoomId || chatRoomId.includes('undefined')) return () => {};
    const q = query(
      collection(db, COLLECTIONS.CHATS, String(chatRoomId), 'history'), 
      orderBy('timestamp', 'asc')
    );
    return onSnapshot(q, (snapshot: any) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id } as ChatMessage;
      });
      callback(msgs);
    }, (err) => {
      if (err.code !== 'permission-denied') {
        console.warn("Messages listener restricted:", err.message);
      }
    });
  },

  listenToTotalUnreadMessages: (userId: string, callback: (count: number) => void): Unsubscribe => {
    if (!userId || userId === 'undefined') return () => {};
    const uid = String(userId);
    const q = query(
      collectionGroup(db, 'history'),
      where('status', '==', 'unread'),
      where('recipientId', '==', uid)
    );
    return onSnapshot(q, (snapshot: any) => {
      callback(snapshot.size);
    }, (err) => {
      if (err.code !== 'permission-denied') {
        console.error("Total unread listener error:", err);
      }
    });
  },

  markRoomAsRead: async (chatRoomId: string, userId: string) => {
    const rId = String(chatRoomId);
    const uId = String(userId);
    if (!rId || !uId || rId.includes('undefined') || uId === 'undefined') return;

    const historyRef = collection(db, COLLECTIONS.CHATS, rId, 'history');
    const q = query(
      historyRef,
      where('recipientId', '==', uId),
      where('status', '==', 'unread')
    );
    
    try {
      const snapshot = await getDocs(q);
      if (snapshot.empty) return;
      
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => {
        batch.update(d.ref, { status: 'read' });
      });
      await batch.commit();
      console.debug(`[ChatService] Marked ${snapshot.size} messages as read for room ${rId}`);
    } catch (e: any) {
      // Improved error logging for debugging
      console.warn(`[ChatService] Failed to mark messages as read for room ${rId}:`, e.message);
    }
  },

  sendMessage: async (chatRoomId: string, msg: ChatMessage, role: UserRole, recipientId: string) => {
    if (!chatRoomId || !recipientId || chatRoomId.includes('undefined')) return;
    const rId = String(chatRoomId);
    const targetId = String(recipientId);
    const roomRef = doc(db, COLLECTIONS.CHATS, rId);
    
    const messageData: ChatMessage = {
      ...msg,
      recipientId: targetId,
      status: 'unread'
    };

    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) {
      if (role === UserRole.PROVIDER) {
        throw new Error("Provider cannot initiate chat");
      }
      await setDoc(roomRef, {
        id: rId,
        participants: [String(msg.senderId), targetId],
        lastMessage: msg.text,
        lastTimestamp: msg.timestamp,
        lastMessageSenderId: String(msg.senderId),
        initiatedAt: new Date().toISOString(),
        status: 'ACTIVE'
      });
    } else {
      await updateDoc(roomRef, {
        lastMessage: msg.text,
        lastTimestamp: msg.timestamp,
        lastMessageSenderId: String(msg.senderId)
      });
    }
    
    await setDoc(doc(db, COLLECTIONS.CHATS, rId, 'history', String(msg.id)), messageData);
  }
};