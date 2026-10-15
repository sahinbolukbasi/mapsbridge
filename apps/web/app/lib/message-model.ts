export interface DirectMessage {
  id: string;
  fromUsername: string;
  toUsername: string;
  routeTitle: string;
  routeId?: string;
  message: string;
  createdAt: string;
  read: boolean;
}

// Read both existing inbox formats without dropping their original fields.
export function normalizeMessages(value: unknown): DirectMessage[] {
  if (!Array.isArray(value)) throw new Error("Invalid message archive");
  return value.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      typeof item.message !== "string"
    )
      throw new Error("Invalid message record");
    const sender = item.fromUsername || item.fromContact || item.fromName || "bilinmeyen";
    const recipient = item.toUsername || item.toUser || "";
    if (typeof sender !== "string" || typeof recipient !== "string")
      throw new Error("Invalid message identity");
    return {
      ...item,
      fromUsername: sender.replace(/^@/, "").split("@")[0].toLowerCase().replace(/\s+/g, "_"),
      toUsername: recipient.replace(/^@/, "").toLowerCase(),
      routeTitle: typeof item.routeTitle === "string" ? item.routeTitle : "Genel",
      read: item.read === true,
    };
  });
}

export function belongsToConversation(
  message: DirectMessage,
  username: string,
  otherUser?: string,
): boolean {
  const own = username.toLowerCase();
  const from = message.fromUsername.toLowerCase();
  const to = message.toUsername.toLowerCase();
  if (from !== own && to !== own) return false;
  return !otherUser || (from === own ? to : from) === otherUser.toLowerCase();
}
