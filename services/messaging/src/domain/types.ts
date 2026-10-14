import type { ChatMessageDto, ThreadDto } from "@mapsbridge/contracts";

export type ChatThread = ThreadDto;
export type ChatMessage = ChatMessageDto;

export interface WebSocketSession {
  connectionId: string;
  userId: string;
  connectedAt: number;
  expiresAt: number;
  authVersion: number;
}

export interface SendMessageCommand {
  threadId: string;
  senderId: string;
  text: string;
  clientMessageId?: string;
}
