"use client";
import { useId, useMemo, useState, type ReactNode } from "react";
import { useLocale } from "../../lib/locale-context";
import { Button, Chip, ChipGroup, toggleChoice } from "../ui";
import {
  allAnswered,
  answerLabels,
  clampQuestions,
  type CardQuestions,
  type Question,
} from "./logic/question-limits";
import "./assistant-ui.css";

export type QuestionAnswers = Record<string, string[]>;

/**
 * AI turundaki sorular (design §4.2, I3): en fazla 2 soru, her biri 2–4 dokunulabilir seçenek.
 * Her soru bir ChipGroup (role="group", aria-labelledby soru başlığı); "Devam" her soru
 * yanıtlanınca etkinleşir; seçimler çağırana döner ve sohbete kullanıcı mesajı olarak düşer.
 * Tip `[Q] | [Q, Q]` ister; çalışma zamanında clampQuestions fazlasını kırpar, geçerli soru
 * kalmazsa hiçbir şey çizilmez (I10).
 */
export function QuestionCard({
  questions,
  onSubmit,
  note,
  submitLabel,
  headingLevel = 2,
  disabled = false,
}: {
  questions: CardQuestions;
  onSubmit: (answers: QuestionAnswers, labels: string[]) => void;
  /** Kartın altındaki kısa not (ör. "Tercih netleştirme ücretsiz"). */
  note?: ReactNode;
  submitLabel?: string;
  headingLevel?: 2 | 3;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const uid = useId();
  const qs = useMemo(() => clampQuestions(questions).questions, [questions]);
  const [answers, setAnswers] = useState<QuestionAnswers>({});
  if (qs.length === 0) return null;
  const ready = allAnswered(qs, answers) && !disabled;
  const hintId = `${uid}-hint`;
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const choose = (q: Question, optionId: string) =>
    setAnswers((prev) => ({
      ...prev,
      [q.id]: toggleChoice(prev[q.id] ?? [], optionId, q.mode, q.max ?? q.options.length),
    }));
  return (
    <div className="as-qcard" data-surface="default">
      {qs.map((q, i) => {
        const headingId = `${uid}-${q.id}`;
        return (
          <div className="as-qcard__q" key={q.id}>
            <Heading id={headingId} className="as-qcard__text">
              {qs.length > 1 ? `${i + 1}. ` : ""}
              {q.text}
            </Heading>
            {q.mode === "multi" && (
              <p className="as-qcard__hint">
                {t("assistant.question.multi", "En fazla {n} seçebilirsin").replace(
                  "{n}",
                  String(q.max ?? q.options.length),
                )}
              </p>
            )}
            <ChipGroup labelledBy={headingId} mode={q.mode} max={q.max ?? q.options.length}>
              {q.options.map((o) => (
                <Chip
                  key={o.id}
                  pressed={(answers[q.id] ?? []).includes(o.id)}
                  disabled={disabled}
                  onPress={() => choose(q, o.id)}
                >
                  {o.label}
                </Chip>
              ))}
            </ChipGroup>
          </div>
        );
      })}
      <div className="as-qcard__footer">
        {note && <p className="as-qcard__note">{note}</p>}
        <Button
          variant="primary"
          disabled={!ready}
          aria-describedby={ready ? undefined : hintId}
          onClick={() => onSubmit(answers, answerLabels(qs, answers))}
        >
          {submitLabel ?? t("assistant.question.submit", "Devam")}
        </Button>
        {!ready && (
          <span id={hintId} className="ui-visually-hidden">
            {qs.length > 1
              ? t("assistant.question.needAll", "Devam etmek için her sorudan seçim yap.")
              : t("assistant.question.needOne", "Devam etmek için bir seçenek seç.")}
          </span>
        )}
      </div>
    </div>
  );
}
