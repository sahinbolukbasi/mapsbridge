export { threadParticipants } from "../../../../infra/lambda/src/shared/thread-access";

export class ChatService {
  static readonly MAX_MESSAGE_LENGTH = 2000;
  static readonly MAX_THREAD_LIST = 50;
  static readonly MAX_MESSAGE_HISTORY = 200;

  public static isParticipant(participants: string[], userId: string): boolean {
    return participants.includes(userId);
  }

  public static getRecipients(participants: string[], senderId: string): string[] {
    return participants.filter(p => p !== senderId);
  }

  public static truncateMessage(content: string): string {
    return content.trim().slice(0, ChatService.MAX_MESSAGE_LENGTH);
  }
}
