// Misafir asistan taslağı (design §6.2, §12.1, §12.2): apps/web/app/lib/guest/guest-draft.ts +
// guest-draft-owner.ts kurallarının native karşılığı. Aynı anahtar (`mapsbridge.guestDraft.v1`),
// aynı şema ve 7 günlük TTL; depolama AsyncStorage (asenkron, enjekte edilir; testte bellek içi).
// Yalnızca gezi niyeti tutulur (kişisel veri yok). Kredi durumu YOKTUR: taslak ücretli isteği
// tetiklemez; kayıttan sonra yalnızca kullanıcı dokununca sıradan bir kullanıcı mesajına dönüşür
// (buildGuestSummaryMessage). Hesap yalıtımı (web guest-draft-owner): işaretsiz/misafir taslağını
// ilk okuyan hesap sahiplenir; başka hesap ve sonraki misafir göremez; çıkışta silinir.
// Saf modül: React Native yok; eşitliği apps/web/tests/mobile-parity.test.cjs doğrular.
import { tr } from "../i18n/ui";
import {
  guestOption,
  sanitizeAnswers,
  type DateRange,
  type GuestAnswers,
  type GuestQuestionId,
} from "./guest-script";

export const GUEST_DRAFT_KEY = "mapsbridge.guestDraft.v1";
export const GUEST_DRAFT_OWNER_KEY = "mapsbridge.guestDraft.owner";
export const GUEST_DRAFT_VERSION = 1;
export const GUEST_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const GUEST_PROMPT_MAX = 500;
const GUEST_OWNER = "guest";

export type GuestDraftTurn = 0 | 1 | 2 | 3;
export type GuestDraft = {
  v: 1;
  createdAt: string;
  q: string;
  answers: GuestAnswers;
  turn: GuestDraftTurn;
};
export type AsyncDraftStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

// U+0000–U+001F ve U+007F (design §12.2) boşluğa çevrilir.
function replaceControlChars(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    out += code <= 0x1f || code === 0x7f ? " " : ch;
  }
  return out;
}

/** Hero/composer metni: kontrol karakterleri atılır, boşluk tekleşir, 500'de kesilir. */
export function sanitizePrompt(text: unknown): string {
  if (typeof text !== "string") return "";
  return replaceControlChars(text).replace(/\s+/g, " ").trim().slice(0, GUEST_PROMPT_MAX).trim();
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

/** Şemaya uyan taslak ya da null (v, createdAt + TTL, q ≤ 500, turn 0–3, answers temizlenir). */
export function parseDraft(raw: unknown, now: number): GuestDraft | null {
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

/** İşaretsiz ya da misafir taslağı herkese (ilk hesap sahiplenir); sahipli taslak yalnızca sahibine. */
export function canUseGuestDraft(stored: string | null, current: string): boolean {
  return !stored || stored === GUEST_OWNER || stored === current;
}

/**
 * Taslağı okur (`owner` = ownerFromEmail(session?.email)). Başka hesabın taslağı null; süresi
 * dolmuş, bozuk ya da şemaya uymayan taslak sessizce silinir. Oturumlu hesap okuyunca sahiplenir.
 */
export async function loadDraft(
  storage: AsyncDraftStorage,
  owner: string,
  now: number,
): Promise<GuestDraft | null> {
  try {
    const stored = await storage.getItem(GUEST_DRAFT_OWNER_KEY);
    if (!canUseGuestDraft(stored, owner)) return null;
    const text = await storage.getItem(GUEST_DRAFT_KEY);
    if (text === null) return null;
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    const draft = parseDraft(parsed, now);
    if (!draft) {
      await clearDraft(storage);
      return null;
    }
    if (owner !== GUEST_OWNER && stored !== owner)
      await storage.setItem(GUEST_DRAFT_OWNER_KEY, owner);
    return draft;
  } catch {
    return null;
  }
}

/** Taslağı yazar (yalnız misafir yazar; sahip işareti şu anki kişi). Başarısızsa false. */
export async function saveDraft(
  storage: AsyncDraftStorage,
  draft: GuestDraft,
  owner: string,
): Promise<boolean> {
  const clean: GuestDraft = {
    ...draft,
    q: sanitizePrompt(draft.q),
    answers: sanitizeAnswers(draft.answers),
  };
  try {
    await storage.setItem(GUEST_DRAFT_KEY, JSON.stringify(clean));
    await storage.setItem(GUEST_DRAFT_OWNER_KEY, owner);
    return true;
  } catch {
    return false;
  }
}

/** Taslak ve sahip işareti birlikte silinir (ücretli istek başarılı, "Taslağı sil" ya da çıkış). */
export async function clearDraft(storage: AsyncDraftStorage): Promise<void> {
  try {
    await storage.removeItem(GUEST_DRAFT_KEY);
    await storage.removeItem(GUEST_DRAFT_OWNER_KEY);
  } catch {
    // depolama erişilemiyor; silinecek bir şey yok
  }
}

function label(id: GuestQuestionId, optionId: string): string {
  return guestOption(id, optionId)?.label ?? "";
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
}

function isRange(value: GuestAnswers["duration"]): value is DateRange {
  return typeof value === "object" && value !== null;
}

/**
 * Kayıttan sonra ilk sunucu isteğine giden sıradan kullanıcı mesajı (design §6.1; web
 * buildGuestSummaryMessage ile aynı metin). Prompt ve API sözleşmesi değişmez.
 */
export function buildGuestSummaryMessage(draft: GuestDraft): string {
  const parts: string[] = [];
  const q = sanitizePrompt(draft.q);
  if (q) parts.push(/[.!?…]$/.test(q) ? q : `${q}.`);
  const a = sanitizeAnswers(draft.answers);
  if (isRange(a.duration)) {
    parts.push(fill(tr("guest.summary.dates"), { from: a.duration.from, to: a.duration.to }));
  } else if (a.duration) {
    parts.push(fill(tr("guest.summary.duration"), { value: label("duration", a.duration) }));
  }
  if (a.character)
    parts.push(fill(tr("guest.summary.character"), { value: label("character", a.character) }));
  if (a.pace) parts.push(fill(tr("guest.summary.pace"), { value: label("pace", a.pace) }));
  if (a.interests?.length)
    parts.push(
      fill(tr("guest.summary.interests"), {
        value: a.interests.map((i) => label("interests", i)).join(", "),
      }),
    );
  return parts.join(" ");
}
