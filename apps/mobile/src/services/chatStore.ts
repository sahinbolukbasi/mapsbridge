import { storage } from './storage';
import { RouteStop, chatService } from './api';

export interface RouteEmbedData {
  title: string;
  days: string;
  stopsCount: number;
  rating: number;
  locationTag: string;
  coverImage?: string;
  waypoints?: { name: string; dist?: string; type: 'monument' | 'church' | 'food' }[];
  stopsData: RouteStop[];
}

export interface ChatBubbleItem {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text?: string;
  time: string;
  isOutgoing: boolean;
  readStatus?: string;
  routeEmbed?: RouteEmbedData;
  isAudioNote?: boolean;
  audioDuration?: string;
  audioSub?: string;
  pinnedLocation?: { name: string; coords: string };
}

export interface ChatContact {
  id: string;
  name: string;
  username: string;
  role: string;
  categoryTag: string;
  avatarText: string;
  avatarUrl?: string;
  unreadCount: number;
  online: boolean;
  isGroup: boolean;
  lastMessageSnippet: string;
  lastMessageTime: string;
  lastMessageType?: 'text' | 'route' | 'audio' | 'location';
}

const STORAGE_KEY_THREADS = 'mb_chat_threads_v3';
const STORAGE_KEY_MESSAGES_PREFIX = 'mb_chat_msgs_v3_';

class ChatStore {
  private threadListeners: Set<(threads: ChatContact[]) => void> = new Set();
  private messageListeners: Map<string, Set<(msgs: ChatBubbleItem[]) => void>> = new Map();

  public subscribeThreads(listener: (threads: ChatContact[]) => void): () => void {
    this.threadListeners.add(listener);
    return () => this.threadListeners.delete(listener);
  }

  public subscribeMessages(threadId: string, listener: (msgs: ChatBubbleItem[]) => void): () => void {
    if (!this.messageListeners.has(threadId)) {
      this.messageListeners.set(threadId, new Set());
    }
    this.messageListeners.get(threadId)!.add(listener);
    return () => {
      this.messageListeners.get(threadId)?.delete(listener);
    };
  }

  // ─── Get All Threads ──────────────────────────────────────────────────────────
  async getThreads(): Promise<ChatContact[]> {
    try {
      const raw = await storage.getItem(STORAGE_KEY_THREADS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {}
    return [];
  }

  // ─── Get Messages For A Thread ───────────────────────────────────────────────
  async getMessages(threadId: string): Promise<ChatBubbleItem[]> {
    try {
      const raw = await storage.getItem(`${STORAGE_KEY_MESSAGES_PREFIX}${threadId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {}
    return [];
  }

  // ─── Start or Retrieve Thread with a Traveler ─────────────────────────────────
  async startOrGetDirectThread(targetUser: {
    name: string;
    handle: string;
    avatar?: string;
    badge?: string;
    location?: string;
  }): Promise<{ contact: ChatContact; isNew: boolean }> {
    const threads = await this.getThreads();
    const cleanHandle = targetUser.handle.replace('@', '').toLowerCase();
    const threadId = `dm_${cleanHandle}`;

    const existing = threads.find((t) => t.id === threadId || t.username.replace('@', '').toLowerCase() === cleanHandle);
    if (existing) {
      return { contact: existing, isNew: false };
    }

    const nameParts = targetUser.name.trim().split(' ');
    const initials = nameParts.length > 1
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : targetUser.name.slice(0, 2).toUpperCase();

    const newContact: ChatContact = {
      id: threadId,
      name: targetUser.name,
      username: `@${cleanHandle}`,
      role: targetUser.badge || 'Gezgin',
      categoryTag: targetUser.location || 'Topluluk Gezgini',
      avatarText: initials,
      avatarUrl: targetUser.avatar,
      unreadCount: 0,
      online: true,
      isGroup: false,
      lastMessageSnippet: 'Sohbet başlatıldı',
      lastMessageTime: 'Şimdi',
      lastMessageType: 'text',
    };

    const nextThreads = [newContact, ...threads];
    await storage.setItem(STORAGE_KEY_THREADS, JSON.stringify(nextThreads));
    this.threadListeners.forEach((fn) => fn(nextThreads));

    return { contact: newContact, isNew: true };
  }

  // ─── Send A Message ──────────────────────────────────────────────────────────
  async sendMessage(
    threadId: string,
    message: {
      text?: string;
      routeEmbed?: RouteEmbedData;
      senderId?: string;
      senderName?: string;
      senderAvatar?: string;
    }
  ): Promise<ChatBubbleItem> {
    const currentMessages = await this.getMessages(threadId);

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newMsg: ChatBubbleItem = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: message.senderId || 'me',
      senderName: message.senderName || 'Ben',
      senderAvatar: message.senderAvatar,
      text: message.text,
      routeEmbed: message.routeEmbed,
      time: timeStr,
      isOutgoing: true,
      readStatus: 'Görüldü',
    };

    const nextMessages = [...currentMessages, newMsg];
    await storage.setItem(`${STORAGE_KEY_MESSAGES_PREFIX}${threadId}`, JSON.stringify(nextMessages));

    // Notify message listeners
    this.messageListeners.get(threadId)?.forEach((fn) => fn(nextMessages));

    // Update Thread Snippet
    const threads = await this.getThreads();
    const snippet = message.routeEmbed
      ? `🗺️ Rota: ${message.routeEmbed.title}`
      : message.text?.slice(0, 45) || 'Mesaj';

    const updatedThreads = threads.map((t) => {
      if (t.id === threadId) {
        return {
          ...t,
          lastMessageSnippet: snippet,
          lastMessageTime: timeStr,
          lastMessageType: message.routeEmbed ? ('route' as const) : ('text' as const),
        };
      }
      return t;
    });

    await storage.setItem(STORAGE_KEY_THREADS, JSON.stringify(updatedThreads));
    this.threadListeners.forEach((fn) => fn(updatedThreads));

    // Send to backend API
    try {
      await chatService.sendMessage(message.text || '');
    } catch (err) {
      console.warn('[ChatStore] Backend send failed:', err);
      // Message is already saved locally; backend sync will retry on next opportunity
    }

    return newMsg;
  }

  // ─── Delete Thread ────────────────────────────────────────────────────────────
  async deleteThread(threadId: string): Promise<void> {
    const threads = await this.getThreads();
    const nextThreads = threads.filter((t) => t.id !== threadId);
    await storage.setItem(STORAGE_KEY_THREADS, JSON.stringify(nextThreads));
    await storage.removeItem(`${STORAGE_KEY_MESSAGES_PREFIX}${threadId}`);
    this.threadListeners.forEach((fn) => fn(nextThreads));
  }
}

export const chatStore = new ChatStore();
