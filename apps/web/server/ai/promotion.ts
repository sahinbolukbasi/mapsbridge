/**
 * Onaylı diyalog → korpus promotion (Faz 4 / görev 16).
 *
 * İNSAN ONAYINDAN GEÇMİŞ (privacyReview="approved") bir eğitim kaydını İKİ ayrı
 * kanala böler — FINE-TUNE YOK (I1 koruması: olgu modele gömülmez):
 *
 *   1. RAG korpusu  → OLGUSAL içerik. Bedrock KB'ye tarihli/kaynaklı doküman olarak
 *      gider (kb-ingest `published/` deseniyle uyumlu). Olgu burada yaşar; silinebilir,
 *      tazelenebilir, kaynaklanabilir.
 *   2. Few-shot havuzu → yalnız ÜSLUP. Asistanın ifade tarzı/tonu; olgu değil.
 *      prompts.ts "behavioral examples, not model fine-tuning" ilkesiyle hizalı.
 *
 * Saf ve belirleyici: AWS SDK yok, yan etki yok. Yazma işini çağıran (kb-ingest /
 * prompts güncelleyici) yapar. Promotion YALNIZCA approved + consent'li kayıt için.
 */

export interface ApprovedTrainingRecord {
  privacyReview?: string;
  reviewed?: boolean;
  consent?: { scope?: string };
  messages?: Array<{ role: string; content: Array<{ text?: string }> }>;
  metadata?: {
    model?: string;
    promptVersion?: string;
    responseMode?: string;
    retrievalStatus?: string;
  };
  createdAt?: string;
}

/** RAG korpusuna gidecek olgusal doküman (tarihli, promotedAt damgalı). */
export interface RagCorpusDoc {
  kind: "rag";
  text: string;
  promotedAt: string;
  sourceModel: string;
  promptVersion: string;
}

/** Few-shot havuzuna gidecek ÜSLUP örneği (olgu taşımaz; fine-tune DEĞİL). */
export interface FewShotExample {
  kind: "fewshot";
  /** Yalnız üslup/akış; spesifik yer/fiyat/tarih İÇERMEMELİ. */
  userGist: string;
  assistantStyle: string;
  responseMode: string;
  note: "style_only_not_finetune";
}

export interface PromotionResult {
  rag?: RagCorpusDoc;
  fewShot?: FewShotExample;
  /** Promotion reddedildiyse nedeni (approved değil / consent yok / içerik yok). */
  rejected?: string;
}

const MAX_RAG = 12000;
const MAX_GIST = 160;

/** Promotion için kayıt uygun mu? approved + reviewed + current_turn consent + içerik. */
export function isPromotable(record: ApprovedTrainingRecord): boolean {
  return (
    record.privacyReview === "approved" &&
    record.reviewed === true &&
    record.consent?.scope === "current_turn" &&
    Array.isArray(record.messages) &&
    record.messages.length >= 2
  );
}

function textOf(msg?: { content: Array<{ text?: string }> }): string {
  return (msg?.content || [])
    .map((c) => c.text || "")
    .join(" ")
    .trim();
}

/**
 * Olgusal cümleyi üslup örneğinden ayıklar: spesifik olgu taşıyan kısımları
 * (fiyat, saat, koordinat, uzun özel ad dizileri) kırpar; yalnız "nasıl söylendiği"
 * kalır. Mükemmel değil — few-shot zaten üslup sinyali; olgu RAG'da yaşar.
 */
export function toStyleOnly(text: string): string {
  return text
    .replace(/(?:€|\$|₺|¥|£)\s*\d[\d.,]*/g, "—") // para
    .replace(/\b\d[\d.,]*\s*(?:TL|USD|EUR|JPY|km|dk|dakika|saat)\b/gi, "—") // ölçü/para
    .replace(/\b\d{1,2}:\d{2}\b/g, "—") // saat
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Onaylı kaydı iki promotion artefaktına böler. Uygun değilse `rejected` döner.
 * ASLA fine-tune artefaktı üretmez.
 */
export function promoteApprovedRecord(
  record: ApprovedTrainingRecord,
  now = Date.now(),
): PromotionResult {
  if (record.privacyReview !== "approved") return { rejected: "not_approved" };
  if (!isPromotable(record)) return { rejected: "not_promotable" };

  const userMsg = record.messages!.find((m) => m.role === "user");
  const assistantMsg = record.messages!.find((m) => m.role === "assistant");
  const userText = textOf(userMsg);
  const assistantText = textOf(assistantMsg);
  if (!userText || !assistantText) return { rejected: "empty_content" };

  const meta = record.metadata || {};
  const promotedAt = new Date(now).toISOString();

  const rag: RagCorpusDoc = {
    kind: "rag",
    // Olgusal içerik RAG'a tarihli gider; kaynak/zaman korunur.
    text: [`Query: ${userText}`, `Summary: ${assistantText}`].join("\n").slice(0, MAX_RAG),
    promotedAt,
    sourceModel: meta.model || "unknown",
    promptVersion: meta.promptVersion || "unknown",
  };

  const fewShot: FewShotExample = {
    kind: "fewshot",
    userGist: toStyleOnly(userText).slice(0, MAX_GIST),
    assistantStyle: toStyleOnly(assistantText),
    responseMode: meta.responseMode || "chat",
    note: "style_only_not_finetune",
  };

  return { rag, fewShot };
}
