// Mesajlar ekranının saf yardımcıları: cihazdaki doğrudan mesaj kaydından (localStorage
// "mapsbridge.directMessages") sohbet listesi üretimi, süzme ve kimlik. Ağ çağrısı yapmaz.
import type { ChatConversation, ChatMessage } from "./types";

export const DIRECT_MESSAGES_KEY = "mapsbridge.directMessages";

export const CONVERSATION_FILTERS = ["all", "groups", "direct"] as const;
export type ConversationFilter = (typeof CONVERSATION_FILTERS)[number];

type StoredDirectMessage = {
  id?: unknown;
  fromUsername?: unknown;
  toUsername?: unknown;
  message?: unknown;
  createdAt?: unknown;
};

/** "@Elif Demir" → "dm_elif_demir" (eski sayfayla aynı kimlik). */
export function directConversationId(name: string): string {
  return `dm_${name
    .replace(/^@/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")}`;
}

/** Kullanıcı adı girdisi: baştaki @ ve boşluklar atılır, en fazla 40 karakter. */
export function cleanHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").trim().slice(0, 40);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Cihazdaki doğrudan mesajlardan sohbetler. `me` bu hesabın kullanıcı adıdır; "gezgin" eski
 * varsayılan ad olduğu için kendi mesajı sayılır (eski davranış korunur). Saat biçimi çağırandan.
 */
export function conversationsFromDirectMessages(
  stored: unknown,
  me: string,
  displayName: string,
  formatTime: (iso: string) => string,
): ChatConversation[] {
  if (!Array.isArray(stored)) return [];
  const isMe = (u: string) => u === me || u === "gezgin";
  const out: ChatConversation[] = [];
  const lastSeq = new Map<string, number>();
  let seq = 0;
  // Kayıt en yeni önde tutulur; akış eskiden yeniye okunur.
  for (const raw of [...stored].reverse() as StoredDirectMessage[]) {
    seq += 1;
    if (!raw || typeof raw !== "object") continue;
    const from = str(raw.fromUsername);
    const to = str(raw.toUsername);
    const text = str(raw.message);
    if (!text) continue;
    const partner = isMe(to) ? from : to;
    if (!partner) continue;
    const outgoing = isMe(from);
    const created = str(raw.createdAt);
    const msg: ChatMessage = {
      id: str(raw.id) || `${partner}-${out.length}-${created}`,
      senderName: outgoing ? displayName : partner,
      time: created ? formatTime(created) : "",
      text,
      isOutgoing: outgoing,
    };
    let conv = out.find((c) => c.title.toLowerCase() === partner.toLowerCase());
    if (!conv) {
      conv = {
        id: directConversationId(partner),
        type: "direct",
        title: partner,
        lastMessage: text,
        lastTime: msg.time,
        messages: [],
      };
      out.push(conv);
    }
    if (!conv.messages.some((m) => m.id === msg.id)) {
      conv.messages.push(msg);
      conv.lastMessage = text;
      conv.lastTime = msg.time;
      lastSeq.set(conv.id, seq);
    }
  }
  // En son yazışılan sohbet önde.
  return out.sort((a, b) => (lastSeq.get(b.id) ?? 0) - (lastSeq.get(a.id) ?? 0));
}

export function filterConversations(
  list: readonly ChatConversation[],
  filter: ConversationFilter,
  query: string,
): ChatConversation[] {
  const q = query.trim().toLowerCase();
  return list.filter((c) => {
    if (filter === "groups" && c.type !== "group") return false;
    if (filter === "direct" && c.type !== "direct") return false;
    if (!q) return true;
    return c.title.toLowerCase().includes(q) || (c.routeTag ?? "").toLowerCase().includes(q);
  });
}
