// I3 çalışma zamanı koruması (design §13, maps-bridge-spec I3): bir AI turunda en fazla 2 soru,
// her soruda 2–4 dokunulabilir seçenek. Tip düzeyinde QuestionCard `[Q] | [Q, Q]` ve 2–4'lük
// seçenek tuple'ı ister; sunucudan/taslaktan gelen serbest veri buradan geçer. Fazlası kırpılır,
// 2'den az seçenekli soru atılır; geliştirmede console.warn (üretimde log yok, design §12).
export type QuestionMode = "single" | "multi";
export type QuestionOption = { id: string; label: string };
export type QuestionOptions =
  | readonly [QuestionOption, QuestionOption]
  | readonly [QuestionOption, QuestionOption, QuestionOption]
  | readonly [QuestionOption, QuestionOption, QuestionOption, QuestionOption];
export type Question = {
  id: string;
  text: string;
  mode: QuestionMode;
  /** multi için en fazla seçim; verilmezse seçenek sayısı. */
  max?: number;
  options: QuestionOptions;
};
export type CardQuestions = readonly [Question] | readonly [Question, Question];
/** Doğrulanmamış girdi (sunucu hızlı yanıtları, eski kayıtlar). */
export type LooseQuestion = {
  id: string;
  text: string;
  mode: QuestionMode;
  max?: number;
  options: readonly QuestionOption[];
};
export const MAX_QUESTIONS = 2;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;
function devWarn(message: string) {
  if (process.env.NODE_ENV !== "production") console.warn(message);
}
/**
 * En fazla 2 soru, her biri 2–4 seçenek. <2 seçenekli soru düşer, 4'ten fazlası kesilir, 3. ve
 * sonraki sorular atılır. Hiç geçerli soru kalmazsa `questions` boştur (kart render edilmez, I10).
 */
export function clampQuestions(qs: readonly LooseQuestion[] | null | undefined): {
  questions: CardQuestions | readonly [];
  clamped: boolean;
} {
  const input = Array.isArray(qs) ? qs : [];
  let clamped = false;
  const valid: Question[] = [];
  for (const q of input) {
    const options = Array.isArray(q?.options) ? q.options : [];
    if (options.length < MIN_OPTIONS) {
      clamped = true;
      continue;
    }
    if (options.length > MAX_OPTIONS) clamped = true;
    const kept = options.slice(0, MAX_OPTIONS) as unknown as QuestionOptions;
    const max = q.max === undefined ? undefined : Math.max(1, Math.min(q.max, kept.length));
    valid.push({ ...q, options: kept, ...(max !== undefined ? { max } : {}) });
  }
  if (valid.length > MAX_QUESTIONS) clamped = true;
  const questions = valid.slice(0, MAX_QUESTIONS);
  if (clamped)
    devWarn(
      `[QuestionCard] I3: tur başına en fazla ${MAX_QUESTIONS} soru ve soru başına ${MIN_OPTIONS}–${MAX_OPTIONS} seçenek; fazlası kırpıldı.`,
    );
  return {
    questions: questions.length === 0 ? [] : (questions as unknown as CardQuestions),
    clamped,
  };
}
/** Seçilen seçeneklerin etiketleri (soru sırasıyla), kullanıcı mesajı için. */
export function answerLabels(
  questions: readonly LooseQuestion[],
  answers: Readonly<Record<string, readonly string[]>>,
): string[] {
  const out: string[] = [];
  for (const q of questions)
    for (const id of answers[q.id] ?? []) {
      const o = q.options.find((x) => x.id === id);
      if (o) out.push(o.label);
    }
  return out;
}
/** Her soruda en az bir seçim var mı ("Devam" etkin). */
export function allAnswered(
  questions: readonly LooseQuestion[],
  answers: Readonly<Record<string, readonly string[]>>,
): boolean {
  return questions.length > 0 && questions.every((q) => (answers[q.id]?.length ?? 0) > 0);
}
