// Misafir asistan soru seti (design §6.1, §12.2, §13; plan D3). Saf modül: ağ, window ve LLM
// yok. lib/ai/* lambda'ya paketlendiği için burada durur. Misafir turları istemcide sabit ve
// test'lidir (tests/guest.test.cjs):
//   I3: tur başına en fazla 2 soru, her soru 2–4 seçenek, her biri rotayı maddi olarak değiştirir.
//   I4: hava, vize, açılış saati gibi fetch edilebilecek şey sorulmaz.
//   I5: demografik soru yok (yaş, cinsiyet, milliyet, aile durumu, kiminle gidildiği).
// Etiketler i18n anahtarıdır (guest.q.* / guest.opt.*); `label` yalnızca TR yedeğidir.
export type DurationOption = "weekend-2d" | "3d" | "5d" | "pick-dates";
export type CharacterOption = "history-culture" | "food-drink" | "nature-views" | "slow-calm";
export type PaceOption = "calm" | "balanced" | "intense";
export type InterestOption = "museums" | "local-food" | "viewpoints" | "markets";
export type GuestQuestionId = "duration" | "character" | "pace" | "interests";
export type GuestOption = { id: string; labelKey: string; label: string };
export type GuestQuestion = {
  id: GuestQuestionId;
  textKey: string;
  text: string;
  mode: "single" | "multi";
  max?: number;
  options: readonly GuestOption[];
};
export type GuestTurn = {
  turn: 1 | 2;
  questions: readonly [GuestQuestion] | readonly [GuestQuestion, GuestQuestion];
};
/** "Tarih seç" yanıtı: ISO tarih (YYYY-MM-DD), from ≤ to, aralık ≤ 30 gün. */
export type DateRange = { from: string; to: string };
export type GuestAnswers = {
  duration?: Exclude<DurationOption, "pick-dates"> | DateRange;
  character?: CharacterOption;
  pace?: PaceOption;
  interests?: InterestOption[];
};
export const INTERESTS_MAX = 4;
export const DATE_RANGE_MAX_DAYS = 30;
const opt = (id: string, key: string, label: string): GuestOption => ({
  id,
  labelKey: `guest.opt.${key}`,
  label,
});
export const GUEST_TURNS: readonly [GuestTurn, GuestTurn] = [
  {
    turn: 1,
    questions: [
      {
        id: "duration",
        textKey: "guest.q.duration",
        text: "Ne zaman ve kaç gün?",
        mode: "single",
        options: [
          opt("weekend-2d", "weekend2d", "Hafta sonu (2 gün)"),
          opt("3d", "days3", "3 gün"),
          opt("5d", "days5", "5 gün"),
          opt("pick-dates", "pickDates", "Tarih seç"),
        ],
      },
      {
        id: "character",
        textKey: "guest.q.character",
        text: "Gezinin karakteri?",
        mode: "single",
        options: [
          opt("history-culture", "historyCulture", "Tarih ve kültür"),
          opt("food-drink", "foodDrink", "Yeme-içme"),
          opt("nature-views", "natureViews", "Doğa ve manzara"),
          opt("slow-calm", "slowCalm", "Sakin ve yavaş"),
        ],
      },
    ],
  },
  {
    turn: 2,
    questions: [
      {
        id: "pace",
        textKey: "guest.q.pace",
        text: "Tempo?",
        mode: "single",
        options: [
          opt("calm", "paceCalm", "Sakin"),
          opt("balanced", "paceBalanced", "Dengeli"),
          opt("intense", "paceIntense", "Yoğun"),
        ],
      },
      {
        id: "interests",
        textKey: "guest.q.interests",
        text: "Özellikle ilgilendiğin?",
        mode: "multi",
        max: INTERESTS_MAX,
        options: [
          opt("museums", "museums", "Müzeler"),
          opt("local-food", "localFood", "Yerel yemek"),
          opt("viewpoints", "viewpoints", "Manzara noktaları"),
          opt("markets", "markets", "Çarşı ve pazarlar"),
        ],
      },
    ],
  },
];
const ALL_QUESTIONS: readonly GuestQuestion[] = GUEST_TURNS.flatMap((t) => [...t.questions]);
export function guestQuestion(id: GuestQuestionId): GuestQuestion {
  const q = ALL_QUESTIONS.find((x) => x.id === id);
  if (!q) throw new Error(`Bilinmeyen misafir sorusu: ${id}`);
  return q;
}
function optionIds(id: GuestQuestionId): string[] {
  return guestQuestion(id).options.map((o) => o.id);
}
export function guestOption(questionId: GuestQuestionId, optionId: string): GuestOption | null {
  return guestQuestion(questionId).options.find((o) => o.id === optionId) ?? null;
}
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
function isoDay(value: string): number | null {
  if (!ISO_DATE.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) return null;
  return ms;
}
export type DateRangeError = "invalid" | "order" | "past" | "tooLong";
/**
 * "Tarih seç" alanı (design §12.2): from ≤ to, from ≥ bugün, aralık ≤ 30 gün (uçlar dahil gün
 * sayısı). `today` YYYY-MM-DD (çağıran yerel günü verir). Geçerliyse null.
 */
export function validateDateRange(from: string, to: string, today?: string): DateRangeError | null {
  const a = isoDay(from);
  const b = isoDay(to);
  if (a === null || b === null) return "invalid";
  if (a > b) return "order";
  if (today !== undefined) {
    const now = isoDay(today);
    if (now !== null && a < now) return "past";
  }
  if ((b - a) / DAY_MS + 1 > DATE_RANGE_MAX_DAYS) return "tooLong";
  return null;
}
function sanitizeDuration(raw: unknown): GuestAnswers["duration"] | undefined {
  if (typeof raw === "string") {
    return raw !== "pick-dates" && optionIds("duration").includes(raw)
      ? (raw as Exclude<DurationOption, "pick-dates">)
      : undefined;
  }
  if (raw && typeof raw === "object") {
    const { from, to } = raw as Record<string, unknown>;
    if (typeof from === "string" && typeof to === "string") {
      const err = validateDateRange(from, to);
      return err === null ? { from, to } : undefined;
    }
  }
  return undefined;
}
function sanitizeSingle<T extends string>(id: GuestQuestionId, raw: unknown): T | undefined {
  return typeof raw === "string" && optionIds(id).includes(raw) ? (raw as T) : undefined;
}
/**
 * Dış girdiden (taslak, URL, QuestionCard) yanıtları temizler: bilinmeyen kimlik ve alan atılır,
 * ilgi alanları tekilleştirilir ve en fazla 4 tutulur (design §12.2).
 */
export function sanitizeAnswers(raw: unknown): GuestAnswers {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: GuestAnswers = {};
  const duration = sanitizeDuration(r.duration);
  if (duration !== undefined) out.duration = duration;
  const character = sanitizeSingle<CharacterOption>("character", r.character);
  if (character) out.character = character;
  const pace = sanitizeSingle<PaceOption>("pace", r.pace);
  if (pace) out.pace = pace;
  if (Array.isArray(r.interests)) {
    const allowed = optionIds("interests");
    const interests = [
      ...new Set(r.interests.filter((x): x is string => typeof x === "string")),
    ].filter((x) => allowed.includes(x)) as InterestOption[];
    if (interests.length) out.interests = interests.slice(0, INTERESTS_MAX);
  }
  return out;
}
/** Sıradaki tur: 1 (süre/karakter eksik), 2 (tempo/ilgi eksik), 3 (özet + kapı). */
export function nextTurn(answers: GuestAnswers): 1 | 2 | 3 {
  if (!answers.duration || !answers.character) return 1;
  if (!answers.pace || !answers.interests?.length) return 2;
  return 3;
}
