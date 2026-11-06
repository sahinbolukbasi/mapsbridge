// Mesajlaşma ekranının yerel modeli (messages/page.tsx). Sunucu olayı WebSocket "message".
export interface ChatMessage {
  id: string;
  senderName: string;
  time: string;
  text?: string;
  isOutgoing?: boolean;
  isSystemEvent?: boolean;
}
export interface ChatConversation {
  id: string;
  type: "group" | "direct";
  title: string;
  subtitle?: string;
  routeTag?: string;
  lastMessage: string;
  lastTime: string;
  messages: ChatMessage[];
  /** Sunucu thread kimliği (Increment 1.14); yoksa yalnız cihazdaki sohbet. */
  serverId?: string;
  /** Gönderdiğim istek yanıt bekliyor. */
  pendingOut?: boolean;
}
