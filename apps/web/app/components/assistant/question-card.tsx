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
  const [customOpen, setCustomOpen] = useState<Record<string, boolean>>({});
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});
  if (qs.length === 0) return null;

  const effectiveAnswers: QuestionAnswers = {};
  for (const q of qs) {
    const base = answers[q.id] ?? [];
    const customVal = (customTexts[q.id] || "").trim();
    effectiveAnswers[q.id] =
      customOpen[q.id] && customVal ? [...base, `custom:${customVal}`] : base;
  }
  const ready = allAnswered(qs, effectiveAnswers) && !disabled;
  const hintId = `${uid}-hint`;
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const choose = (q: Question, optionId: string) =>
    setAnswers((prev) => ({
      ...prev,
      [q.id]: toggleChoice(prev[q.id] ?? [], optionId, q.mode, q.max ?? q.options.length),
    }));

  const toggleOther = (q: Question) => {
    setCustomOpen((prev) => {
      const next = !prev[q.id];
      if (!next) {
        setCustomTexts((c) => ({ ...c, [q.id]: "" }));
      }
      return { ...prev, [q.id]: next };
    });
  };

  const handleSubmit = () => {
    const baseLabels = answerLabels(qs, answers);
    const customLabelList = qs
      .map((q) => (customOpen[q.id] ? (customTexts[q.id] || "").trim() : ""))
      .filter(Boolean);
    onSubmit(effectiveAnswers, [...baseLabels, ...customLabelList]);
  };

  return (
    <div className="as-qcard" data-surface="default">
      {qs.map((q, i) => {
        const headingId = `${uid}-${q.id}`;
        const isOtherActive = Boolean(customOpen[q.id]);
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
            <ChipGroup
              labelledBy={headingId}
              mode={q.mode}
              max={(q.max ?? q.options.length) + 1}
            >
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
              <Chip
                key={`${q.id}-other`}
                pressed={isOtherActive}
                disabled={disabled}
                onPress={() => toggleOther(q)}
              >
                {t("assistant.question.other", "Diğer…")}
              </Chip>
            </ChipGroup>
            {isOtherActive && (
              <div className="as-qcard__custom">
                <input
                  type="text"
                  className="ui-input"
                  value={customTexts[q.id] || ""}
                  onChange={(e) =>
                    setCustomTexts((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  placeholder={t(
                    "assistant.question.otherPlaceholder",
                    "Kendi tercihinizi veya detayınızı yazın…",
                  )}
                  disabled={disabled}
                  maxLength={240}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && ready) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
      <div className="as-qcard__footer">
        {note && <p className="as-qcard__note">{note}</p>}
        <Button
          variant="primary"
          disabled={!ready}
          aria-describedby={ready ? undefined : hintId}
          onClick={handleSubmit}
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
