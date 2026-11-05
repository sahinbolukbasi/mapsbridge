// Misafir taslağı (design §6.2, §12.1, §12.2). Yalnızca gezi niyeti tutulur (kişisel veri yok).
// Depolama enjekte edilir (testte bellek içi nesne, tarayıcıda localStorage); window okunmaz.
// Kredi durumu YOKTUR: taslak ücretli isteği tetiklemez, yalnızca kayıttan sonra kullanıcı
// dokununca sıradan bir kullanıcı mesajına dönüşür (buildGuestSummaryMessage).
import {
  guestOption,
  sanitizeAnswers,
  type DateRange,
  type GuestAnswers,
  type GuestQuestionId,
} from "./guest-script";
export const GUEST_DRAFT_KEY = "mapsbridge.guestDraft.v1";
export const GUEST_DRAFT_VERSION = 1;
export const GUEST_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const GUEST_PROMPT_MAX = 500;
export type GuestDraftTurn = 0 | 1 | 2 | 3;
export type GuestDraft = {
  v: 1;
  createdAt: string;
  q: string;
  answers: GuestAnswers;
  turn: GuestDraftTurn;
};
export type DraftStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
type Translate = (key: string, fallback?: string) => string;
// Depolama yazılamazsa (gizli mod SecurityError, QuotaExceededError) taslak bu sekmede bellekte
// yaşar; çağıran bir kez Alert gösterir (persisted: false).
let memoryDraft: GuestDraft | null = null;
function devWarn(message: string, err?: unknown) {
  if (process.env.NODE_ENV !== "production") console.warn(message, err);
}
// U+0000–U+001F ve U+007F (design §12.2) boşluğa çevrilir (satır sonu/sekme sözcükleri ayırır).
function replaceControlChars(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    out += code <= 0x1f || code === 0x7f ? " " : ch;
  }
  return out;
}
/** Hero/composer metni ve URL `q`: kontrol karakterleri atılır, boşluk tekleşir, 500'de kesilir. */
export function sanitizePrompt(text: unknown): string {
  if (typeof text !== "string") return "";
  return replaceControlChars(text)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, GUEST_PROMPT_MAX)
    .trim();
}
export function createDraft(q: string, now: number): GuestDraft {
  return {
    v: GUEST_DRAFT_VERSION,
    createdAt: new Date(now).toISOString(),
    q: sanitizePrompt(q),
    answers: {},
    turn: 0,
  };
}
/** Şemaya uyan taslak ya da null (v, createdAt, q, turn, answers temizlenir). */
function parseDraft(raw: unknown, now: number): GuestDraft | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;
  if (d.v !== GUEST_DRAFT_VERSION) return null;
  if (typeof d.createdAt !== "string") return null;
  const created = Date.parse(d.createdAt);
  if (!Number.isFinite(created) || now - created > GUEST_DRAFT_TTL_MS) return null;
  if (typeof d.q !== "string" || d.q.length > GUEST_PROMPT_MAX) return null;
  if (d.turn !== 0 && d.turn !== 1 && d.turn !== 2 && d.turn !== 3) return null;
  return {
    v: GUEST_DRAFT_VERSION,
    createdAt: d.createdAt,
    q: sanitizePrompt(d.q),
    answers: sanitizeAnswers(d.answers),
    turn: d.turn,
  };
}
function safeRemove(storage: DraftStorage | null) {
  try {
    storage?.removeItem(GUEST_DRAFT_KEY);
  } catch {
    // depolama erişilemiyor; silinecek bir şey yok
  }
}
/**
 * Taslağı okur. Süresi dolmuş (7 gün), bozuk JSON, şemaya uymayan ya da farklı `v` taslak
 * sessizce silinir ve null döner. Depolama okunamıyorsa bu sekmedeki bellek kopyası döner.
 */
export function loadDraft(storage: DraftStorage | null, now: number): GuestDraft | null {
  if (memoryDraft) {
    const mem = parseDraft(memoryDraft, now);
    if (mem) return mem;
    memoryDraft = null;
  }
  if (!storage) return null;
  let text: string | null;
  try {
    text = storage.getItem(GUEST_DRAFT_KEY);
  } catch (err) {
    devWarn("[guest-draft] taslak okunamadı", err);
    return null;
  }
  if (text === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    safeRemove(storage);
    return null;
  }
  const draft = parseDraft(parsed, now);
  if (!draft) safeRemove(storage);
  return draft;
}
/**
 * Taslağı yazar. SecurityError / QuotaExceededError (ya da depolama yok) → bellekte tutulur ve
 * { persisted: false } döner; çağıran bir kez "Taslağın bu cihazda saklanamıyor…" Alert'ini
 * gösterir.
 */
export function saveDraft(storage: DraftStorage | null, draft: GuestDraft): { persisted: boolean } {
  const clean: GuestDraft = {
    ...draft,
    q: sanitizePrompt(draft.q),
    answers: sanitizeAnswers(draft.answers),
  };
  if (storage) {
    try {
      storage.setItem(GUEST_DRAFT_KEY, JSON.stringify(clean));
      memoryDraft = null;
      return { persisted: true };
    } catch (err) {
      devWarn("[guest-draft] taslak yazılamadı, bellekte tutuluyor", err);
    }
  }
  memoryDraft = clean;
  return { persisted: false };
}
export function clearDraft(storage: DraftStorage | null): void {
  memoryDraft = null;
  safeRemove(storage);
}
function label(t: Translate, id: GuestQuestionId, optionId: string): string {
  const o = guestOption(id, optionId);
  return o ? t(o.labelKey, o.label) : "";
}
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
}
function isRange(value: GuestAnswers["duration"]): value is DateRange {
  return typeof value === "object" && value !== null;
}
/**
 * Kayıttan sonra ilk sunucu isteğine eklenen sıradan kullanıcı mesajı (design §6.1). Prompt ve
 * API sözleşmesi değişmez. Ör.: "Roma'da 3 gün. Süre: 3 gün. Karakter: Tarih ve kültür. Tempo:
 * Dengeli. İlgi: Yerel yemek, Manzara noktaları."
 */
export function buildGuestSummaryMessage(draft: GuestDraft, t: Translate): string {
  const parts: string[] = [];
  const q = sanitizePrompt(draft.q);
  if (q) parts.push(/[.!?…]$/.test(q) ? q : `${q}.`);
  const a = sanitizeAnswers(draft.answers);
  if (isRange(a.duration)) {
    parts.push(
      fill(t("guest.summary.dates", "Tarihler: {from} – {to}."), {
        from: a.duration.from,
        to: a.duration.to,
      }),
    );
  } else if (a.duration) {
    parts.push(
      fill(t("guest.summary.duration", "Süre: {value}."), {
        value: label(t, "duration", a.duration),
      }),
    );
  }
  if (a.character)
    parts.push(
      fill(t("guest.summary.character", "Karakter: {value}."), {
        value: label(t, "character", a.character),
      }),
    );
  if (a.pace)
    parts.push(
      fill(t("guest.summary.pace", "Tempo: {value}."), { value: label(t, "pace", a.pace) }),
    );
  if (a.interests?.length)
    parts.push(
      fill(t("guest.summary.interests", "İlgi: {value}."), {
        value: a.interests.map((i) => label(t, "interests", i)).join(", "),
      }),
    );
  return parts.join(" ");
}
