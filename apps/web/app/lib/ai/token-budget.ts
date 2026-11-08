/**
 * Sunucu-taraflı girdi-token bütçesi (saf, deterministik — kritik yolda model çağrısı YOK).
 *
 * Teşhis Öncelik B/C: Oturum büyüdükçe `conversationState.messages` + `tripManifestoMarkdown`
 * şişer ve prompt'u modelin bağlam sınırına ve sunucu zaman bütçesine (~24,5 sn) doğru iter.
 * Bu modül, Bedrock'a gitmeden önce transkripti sınırlar:
 *   - son N ham turu korur,
 *   - eski turları tek, deterministik bir "yuvarlanan özet" satırına indirger (yeni model
 *     çağrısı olmadan — başlıkları/ilk cümleleri birleştirir),
 *   - `tripManifestoMarkdown` için sıkı bir karakter sınırı uygular.
 *
 * Token tahmini: UTF-8 bayt / 4 (muhafazakâr üst sınır). Tüm fonksiyonlar saftır ki en küçük
 * birime kadar test edilebilsin.
 */

import type { DialogueMessage } from "./model-history";

/** Bayt → yaklaşık token (muhafazakâr: ~4 bayt/token). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(new TextEncoder().encode(text).length / 4);
}

export function estimateHistoryTokens(messages: DialogueMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

/** Varsayılan tutma: son kaç ham tur korunur (eski turlar özetlenir). */
export const DEFAULT_KEEP_TURNS = 6;
/** Manifesto markdown için sıkı üst sınır (karakter). */
export const MANIFESTO_CHAR_CAP = 4000;
/** Yuvarlanan özet satırının üst sınırı (karakter). */
export const ROLLING_SUMMARY_CHAR_CAP = 600;

/**
 * Tek bir turdan kısa, deterministik bir özet parçası çıkarır: ilk cümle ya da ilk satır,
 * en fazla 120 karakter. Model çağrısı yok.
 */
export function summarizeTurn(message: DialogueMessage): string {
  const firstLine = (message.content || "")
    .replace(/\s+/gu, " ")
    .trim()
    .split(/(?<=[.!?])\s/u)[0];
  const who = message.role === "user" ? "Kullanıcı" : "Asistan";
  const snippet = firstLine.slice(0, 120).trim();
  return snippet ? `${who}: ${snippet}` : "";
}

/**
 * Eski turların tek satırlık, deterministik yuvarlanan özetini üretir. Boşsa boş string döner.
 */
export function buildRollingSummary(olderTurns: DialogueMessage[]): string {
  const parts = olderTurns.map(summarizeTurn).filter(Boolean);
  if (!parts.length) return "";
  const joined = parts.join(" | ");
  const capped = joined.slice(0, ROLLING_SUMMARY_CHAR_CAP);
  return `Önceki konuşmanın özeti: ${capped}`;
}

export interface BudgetedHistory {
  /** Modele verilecek sınırlı tur dizisi (varsa özet, önüne yerleştirilir). */
  messages: DialogueMessage[];
  /** Eski turlar özetlendiyse özet satırı; yoksa boş. */
  rollingSummary: string;
  /** Özetlenerek düşürülen tur sayısı. */
  droppedTurns: number;
}

/**
 * Transkripti token bütçesine sığdırır: son `keepTurns` ham turu korur; daha eskileri tek
 * yuvarlanan özet mesajına indirger. Hâlâ bütçe aşılıyorsa, özet tek başına taşmadıkça en eski
 * korunan turları kırpar.
 *
 * @param maxTokens history için ayrılan token bütçesi (prompt + system HARİÇ).
 */
export function budgetHistory(
  history: DialogueMessage[] = [],
  maxTokens: number,
  keepTurns: number = DEFAULT_KEEP_TURNS,
): BudgetedHistory {
  const clean = history.filter(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim(),
  );
  if (clean.length <= keepTurns) {
    const trimmed = fitWithinBudget(clean, maxTokens);
    return { messages: trimmed, rollingSummary: "", droppedTurns: clean.length - trimmed.length };
  }
  const older = clean.slice(0, clean.length - keepTurns);
  let recent = clean.slice(clean.length - keepTurns);
  const rollingSummary = buildRollingSummary(older);
  const summaryMsg: DialogueMessage | null = rollingSummary
    ? { role: "user", content: rollingSummary }
    : null;
  const summaryTokens = summaryMsg ? estimateTokens(summaryMsg.content) : 0;
  // Özet daima korunur; kalan bütçeyi en yeni turlara ver.
  recent = fitWithinBudget(recent, Math.max(0, maxTokens - summaryTokens));
  const messages = summaryMsg ? [summaryMsg, ...recent] : recent;
  return {
    messages,
    rollingSummary,
    droppedTurns: clean.length - recent.length,
  };
}

/** En eski turları bütçeye sığana dek düşürür (saf). */
function fitWithinBudget(turns: DialogueMessage[], maxTokens: number): DialogueMessage[] {
  const out = [...turns];
  while (out.length && estimateHistoryTokens(out) > maxTokens) out.shift();
  return out;
}

/** `tripManifestoMarkdown` için sıkı karakter sınırı. */
export function capManifesto(
  manifesto: string | undefined,
  cap: number = MANIFESTO_CHAR_CAP,
): string | undefined {
  if (!manifesto) return undefined;
  const trimmed = manifesto.trim();
  if (!trimmed) return undefined;
  return trimmed.length > cap ? trimmed.slice(0, cap) : trimmed;
}
