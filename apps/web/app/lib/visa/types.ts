/**
 * Visa / entry rules — Section 9.2 compliance types.
 *
 * INVARIANTS (non-negotiable per §9.2):
 *  - Every surfaced rule carries source name, retrieval date, official URL, disclaimer.
 *  - The word "gidebilirsin" (you can go) is NEVER rendered without official confirmation.
 *  - Every query that surfaces a rule is recorded in the audit log.
 *  - `requirementLevel === "unknown"` must redirect user to official embassy site.
 */

export type VisaRequirementLevel =
  | "not_required"      // free movement (domestic or bilateral agreement)
  | "evisa_required"    // e-visa available online
  | "voa_available"     // visa on arrival available (confirm in advance)
  | "visa_required"     // consulate visa required before travel
  | "entry_banned"      // entry not permitted
  | "unknown";          // always redirect to official source

export interface EntryRule {
  id: string;
  destinationCountry: string;       // e.g. "Spain"
  destinationIso2: string;          // "ES"
  passportCountry: string;          // e.g. "Turkey"
  passportIso2: string;             // "TR"
  requirementLevel: VisaRequirementLevel;
  maxStayDays?: number;             // 0 = consult official source
  notes: string[];                  // plain-language notes, no legal claims
  // §9.2 mandatory fields — must all be non-empty before surfacing
  sourceName: string;               // e.g. "IATA Timatic", "Türkiye Dışişleri Bakanlığı"
  sourceUrl: string;                // official URL
  retrievedAt: string;              // ISO-8601 — when this record was verified
  /** Exact disclaimer text — rendered verbatim, not paraphrased. */
  disclaimer: string;
}

/**
 * Immutable record created every time an entry rule is surfaced to a user.
 * Written to audit log; never deleted.
 */
export interface EntryRuleAuditEntry {
  auditId: string;
  ruleId: string;
  destinationIso2: string;
  passportIso2: string;
  requirementLevel: VisaRequirementLevel;
  surfacedAt: string;        // ISO-8601
  /** Coarse user identity — anonymized session hash, never real userId. */
  sessionRef?: string;
  /** Which UI surface triggered this: "chat" | "checklist" | "prepare_phase" */
  surface: "chat" | "checklist" | "prepare_phase" | "unknown";
}

export interface EntryRuleQueryResult {
  rule: EntryRule | null;
  /** true = rule found and has enough data to surface; false = redirect to official source */
  canSurface: boolean;
  /** Always set when canSurface=false */
  fallbackUrl?: string;
}
