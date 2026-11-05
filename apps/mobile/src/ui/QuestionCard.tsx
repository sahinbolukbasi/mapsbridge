import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fontFamily, tokens } from "../theme";
import { Button } from "./Button";
import { Chip, ChipGroup } from "./Chip";
import { toggleChoice } from "./logic/choice";
import {
  allAnswered,
  answerLabels,
  clampQuestions,
  type CardQuestions,
  type Question,
} from "./logic/question-limits";
import { tr } from "../i18n/ui";

// AI turundaki sorular (design §4.2, I3): web QuestionCard ile aynı prop sözlüğü ve aynı kırpma
// kuralları (logic/question-limits.ts, parite testli): en fazla 2 soru, her biri 2–4 dokunulabilir
// seçenek; geçerli soru kalmazsa hiçbir şey çizilmez (I10). "Devam" her soru yanıtlanınca etkin.
export type QuestionAnswers = Record<string, string[]>;
export type { CardQuestions, Question };

export interface QuestionCardProps {
  questions: CardQuestions;
  onSubmit: (answers: QuestionAnswers, labels: string[]) => void;
  /** Kartın altındaki kısa not (ör. "Tercih netleştirme ücretsiz"). */
  note?: string;
  submitLabel?: string;
  disabled?: boolean;
}

export function QuestionCard({
  questions,
  onSubmit,
  note,
  submitLabel = tr("assistant.question.submit"),
  disabled = false,
}: QuestionCardProps) {
  const qs = useMemo(() => clampQuestions(questions).questions, [questions]);
  const [answers, setAnswers] = useState<QuestionAnswers>({});
  if (qs.length === 0) return null;
  const ready = allAnswered(qs, answers) && !disabled;
  const choose = (q: Question, optionId: string) =>
    setAnswers((prev) => ({
      ...prev,
      [q.id]: toggleChoice(prev[q.id] ?? [], optionId, q.mode, q.max ?? q.options.length),
    }));
  return (
    <View style={styles.card}>
      {qs.map((q, i) => {
        const heading = `${qs.length > 1 ? `${i + 1}. ` : ""}${q.text}`;
        const max = q.max ?? q.options.length;
        return (
          <View key={q.id} style={styles.question}>
            <Text
              accessibilityRole="header"
              style={[styles.heading, { fontFamily: fontFamily("bold", "display") }]}
              maxFontSizeMultiplier={tokens.font.maxScale.body}
            >
              {heading}
            </Text>
            {q.mode === "multi" ? (
              <Text style={styles.hint} maxFontSizeMultiplier={tokens.font.maxScale.body}>
                {tr("assistant.question.multi", { n: max })}
              </Text>
            ) : null}
            <ChipGroup label={heading} labelHidden mode={q.mode} max={max}>
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
          </View>
        );
      })}
      <View style={styles.footer}>
        {note ? (
          <Text style={styles.note} maxFontSizeMultiplier={tokens.font.maxScale.body}>
            {note}
          </Text>
        ) : null}
        <Button
          label={submitLabel}
          disabled={!ready}
          hint={
            ready
              ? undefined
              : qs.length > 1
                ? tr("assistant.question.needAll")
                : tr("assistant.question.needOne")
          }
          onPress={() => onSubmit(answers, answerLabels(qs, answers))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.space["4"],
    padding: tokens.space["4"],
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surface,
  },
  question: { gap: tokens.space["2"] },
  heading: {
    fontSize: tokens.font.size.base,
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.text,
  },
  hint: { fontSize: tokens.font.size.xs, color: tokens.color.textMuted },
  footer: { gap: tokens.space["2"] },
  note: { fontSize: tokens.font.size.xs, color: tokens.color.textMuted },
});
