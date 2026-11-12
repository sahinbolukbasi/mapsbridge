import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
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

  const choose = (q: Question, optionId: string) =>
    setAnswers((prev) => ({
      ...prev,
      [q.id]: toggleChoice(prev[q.id] ?? [], optionId, q.mode, q.max ?? q.options.length),
    }));

  const toggleOther = (q: Question) => {
    setCustomOpen((prev) => {
      const next = !prev[q.id];
      if (!next) {
        setCustomTexts((t) => ({ ...t, [q.id]: "" }));
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
    <View style={styles.card}>
      {qs.map((q, i) => {
        const heading = `${qs.length > 1 ? `${i + 1}. ` : ""}${q.text}`;
        const max = q.max ?? q.options.length;
        const isOtherActive = Boolean(customOpen[q.id]);
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
            <ChipGroup label={heading} labelHidden mode={q.mode} max={max + 1}>
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
                Diğer…
              </Chip>
            </ChipGroup>
            {isOtherActive ? (
              <TextInput
                style={[styles.customInput, { fontFamily: fontFamily("regular") }]}
                value={customTexts[q.id] || ""}
                onChangeText={(txt) => setCustomTexts((prev) => ({ ...prev, [q.id]: txt }))}
                placeholder="Kendi tercihinizi veya detayınızı yazın…"
                placeholderTextColor={tokens.color.textMuted}
                editable={!disabled}
                maxLength={240}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (ready) handleSubmit();
                }}
              />
            ) : null}
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
          onPress={handleSubmit}
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
  customInput: {
    marginTop: tokens.space["1"],
    paddingHorizontal: tokens.space["3"],
    paddingVertical: tokens.space["2"],
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.bg,
    fontSize: tokens.font.size.sm,
    color: tokens.color.text,
  },
  footer: { gap: tokens.space["2"] },
  note: { fontSize: tokens.font.size.xs, color: tokens.color.textMuted },
});
