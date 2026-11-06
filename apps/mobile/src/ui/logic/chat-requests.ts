// Mesaj istekleri saf mantığı (Increment 1.14, M1/M2). Sunucu GET /chat/threads her thread'e
// `request: {status, from, to}` ekler (REQUEST kaydı yoksa "accepted"). Ağ/DOM yok; web ve
// mobil aynı kopyayı kullanır (mobile-parity testi eşitliği zorlar).
export type RequestStatus = "pending" | "accepted" | "declined" | "blocked";
export type ServerThread = {
  threadId: string;
  otherParticipant?: string;
  lastMessageAt?: string;
  request?: { status?: string; from?: string; to?: string };
};
export type ThreadGroups<T extends ServerThread> = {
  /** Bana gelen, yanıt bekleyen istekler (Kabul / Reddet / Engelle). */
  incoming: T[];
  /** Benim gönderdiğim, karşı tarafın yanıtını bekleyen istekler. */
  outgoing: T[];
  /** Kabul edilmiş ya da eski (istek kaydı olmayan) sohbetler. */
  active: T[];
};
const STATUSES: readonly string[] = ["pending", "accepted", "declined", "blocked"];
export function requestStatus(t: ServerThread): RequestStatus {
  const s = t.request?.status;
  return s && STATUSES.includes(s) ? (s as RequestStatus) : "accepted";
}
/** Reddedilen/engellenen sohbetler listelenmez. */
export function groupThreads<T extends ServerThread>(
  threads: readonly T[],
  me: string,
): ThreadGroups<T> {
  const out: ThreadGroups<T> = { incoming: [], outgoing: [], active: [] };
  for (const t of threads) {
    const status = requestStatus(t);
    if (status === "accepted") out.active.push(t);
    else if (status === "pending")
      (t.request?.to === me
        ? out.incoming
        : t.request?.from === me
          ? out.outgoing
          : out.active
      ).push(t);
  }
  return out;
}
export type RequestAction = "accept" | "decline" | "block";
export const REQUEST_ACTIONS: readonly RequestAction[] = ["accept", "decline", "block"];
/**
 * Sunucu hatası → i18n anahtarı. 404 USER_NOT_FOUND (kayıtsız alıcı), 409 REQUEST_PENDING
 * (gönderen bekliyor / alıcı yanıtlamadı), 403 REQUEST_CLOSED (reddedildi/engellendi).
 * Diğer her şey (ağ, uç henüz canlı değil) null: çağıran yerel davranışa düşer.
 */
export function chatErrorKey(
  status: number | undefined,
  code: string | undefined,
  iAmSender?: boolean,
): string | null {
  if (status === 404 && code === "USER_NOT_FOUND") return "messages.req.userNotFound";
  if (status === 409 && code === "REQUEST_PENDING")
    return iAmSender === false ? "messages.req.respondFirst" : "messages.req.waiting";
  if (status === 403 && code === "REQUEST_CLOSED") return "messages.req.closed";
  return null;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** JWT yükündeki `sub` (yalnız gruplama/gösterim için; yetki sunucuda). Platformdan bağımsız. */
export function jwtSub(token: string | null | undefined): string {
  const part = (token || "").split(".")[1];
  if (!part) return "";
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  let bits = 0;
  let value = 0;
  let out = "";
  for (const ch of b64) {
    const idx = B64.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >> bits) & 0xff);
    }
  }
  try {
    const json = JSON.parse(decodeURIComponent(escape(out))) as { sub?: unknown };
    return typeof json.sub === "string" ? json.sub : "";
  } catch {
    return "";
  }
}
