/**
 * Grounding validator — §9.2 output validation before response delivery.
 *
 * Scans AI-generated text for factual claims (prices, opening times, entry rules)
 * and cross-checks them against available TravelSource references.
 * Unverified claims are tagged inline; high-confidence phrases are softened.
 */

import type { TravelSource } from './retrieval';

export interface GroundingIssue {
  type:
    | 'unverified_price'
    | 'unverified_time'
    | 'unverified_rule'
    | 'stale_source'
    | 'missing_source';
  /** The substring that triggered this issue. */
  claim: string;
  severity: 'block' | 'warn' | 'tag';
}

export interface GroundingResult {
  /** false only if a 'block'-severity issue is present. */
  isGrounded: boolean;
  issues: GroundingIssue[];
  /** Original text with unverified claims tagged or softened. */
  sanitizedText: string;
}

// ── Regex patterns ────────────────────────────────────────────────────────────

/** Currency + number: €15, $30, ₺200, 150 TL, "25 euro", "10 dolar", "100 lira" */
const PRICE_RE =
  /(?:(?:€|[$₺])\s*\d[\d.,]*|\d[\d.,]*\s*(?:TL|euro|dolar|lira))/gi;

/** Clock times and Turkish colloquial time expressions */
const TIME_RE =
  /\b(?:\d{1,2}:\d{2}|sabah\s+\d{1,2}|akşam\s+\d{1,2}|gece\s+\d{1,2}|öğlen\s+\d{1,2})\b/gi;

/** Entry/travel regulation keywords + short trailing context */
const RULE_RE =
  /\b(?:vize|gümrük|giriş|ehliyet)\b[^.!?\n]*/gi;

/** High-confidence certainty phrases that must be softened */
const HIGH_RISK_RE = /\b(?:kesinlikle|garantili|her\s+zaman\s+açık)\b/gi;

/** Broad detector — used to decide whether ANY factual claim is present */
const FACTUAL_PRESENCE_RE =
  /(?:€|\$|₺|TL|euro|dolar|lira|\d{1,2}:\d{2}|sabah\s+\d|akşam\s+\d|gece\s+\d|vize|gümrük|giriş|ehliyet)/i;

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchAll(text: string, re: RegExp): string[] {
  const pattern = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    results.push(m[0]);
  }
  return results;
}

/** Replace only the FIRST occurrence (safe for sequential tagging). */
function tagFirst(text: string, claim: string, tag: string): string {
  const idx = text.indexOf(claim);
  if (idx === -1) return text;
  return text.slice(0, idx + claim.length) + tag + text.slice(idx + claim.length);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract all factual claims found in the text (prices, times, regulation keywords).
 * Returns deduplicated list of matched substrings.
 */
export function extractFactualClaims(text: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const re of [PRICE_RE, TIME_RE, RULE_RE]) {
    for (const match of matchAll(text, re)) {
      const claim = match.trim();
      if (!seen.has(claim)) {
        seen.add(claim);
        results.push(claim);
      }
    }
  }
  return results;
}

/** Standard Turkish disclaimer inserted when no sources are available. */
export function buildNoSourceWarning(): string {
  return (
    'UYARI: Bu yanıtta yer alan bilgiler doğrulanmış bir kaynakla desteklenmemiştir. ' +
    'Fiyat, saat ve kural bilgileri değişmiş olabilir. ' +
    'Lütfen resmi kaynaklardan veya ilgili kurumlardan teyit edin.'
  );
}

/**
 * Validate AI-generated text against provided sources.
 *
 * Strategy:
 *  - If sources are present, we assume they cover the claims (semantic matching
 *    would require source text, which TravelSource doesn't carry). Claims are
 *    left as-is but high-risk phrases are still softened.
 *  - If sources are absent, every detected factual claim is tagged "(doğrulanmadı)".
 *  - High-risk certainty phrases are always tagged "(doğrulanmamış)".
 *  - Rule 5: no sources + any factual claim → 'missing_source' warning appended.
 */
export function validateGrounding(
  text: string,
  sources: TravelSource[]
): GroundingResult {
  const issues: GroundingIssue[] = [];
  const noSources = sources.length === 0;
  let sanitized = text;

  // ── Rule 1: Price claims ──────────────────────────────────────────────────
  if (noSources) {
    for (const claim of matchAll(text, PRICE_RE)) {
      issues.push({ type: 'unverified_price', claim, severity: 'tag' });
      sanitized = tagFirst(sanitized, claim, ' (doğrulanmadı)');
    }
  }

  // ── Rule 2: Time claims ───────────────────────────────────────────────────
  if (noSources) {
    for (const claim of matchAll(text, TIME_RE)) {
      // Avoid double-tagging if already handled (claim might overlap price)
      if (!issues.some(i => i.claim === claim)) {
        issues.push({ type: 'unverified_time', claim, severity: 'tag' });
        sanitized = tagFirst(sanitized, claim, ' (doğrulanmadı)');
      }
    }
  }

  // ── Rule 3: Regulation/rule claims ───────────────────────────────────────
  if (noSources) {
    for (const claim of matchAll(text, RULE_RE)) {
      const trimmed = claim.trim();
      if (!issues.some(i => i.claim === trimmed)) {
        issues.push({ type: 'unverified_rule', claim: trimmed, severity: 'warn' });
      }
    }
  }

  // ── Rule 4: High-risk certainty phrases (always applied) ─────────────────
  for (const claim of matchAll(text, HIGH_RISK_RE)) {
    issues.push({ type: 'unverified_rule', claim, severity: 'tag' });
    sanitized = tagFirst(sanitized, claim, ' (doğrulanmamış)');
  }

  // ── Rule 5: No sources + factual content present ──────────────────────────
  if (noSources && FACTUAL_PRESENCE_RE.test(text)) {
    issues.push({ type: 'missing_source', claim: '(tüm metin)', severity: 'warn' });
  }

  return {
    isGrounded: !issues.some(i => i.severity === 'block'),
    issues,
    sanitizedText: sanitized,
  };
}
