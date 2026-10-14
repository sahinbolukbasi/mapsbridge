/**
 * Entry rule audit log — §9.2 compliance.
 *
 * Every time an entry rule is surfaced to a user, an immutable audit entry is written.
 * This satisfies the requirement that visa/entry information queries are traceable.
 *
 * Storage: structured JSON log line to stdout. In production, CloudWatch Logs aggregates
 * these into an S3 export for compliance review. Log lines are never modified after write.
 */

import { createHash, randomUUID } from "node:crypto";
import type { EntryRule, EntryRuleAuditEntry } from "./types";

function coarseWeek(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Build an anonymized session reference from a session token (one-way hash). */
export function buildSessionRef(sessionToken?: string): string | undefined {
  if (!sessionToken) return undefined;
  return createHash("sha256")
    .update(`visa-audit-salt:${sessionToken}`)
    .digest("hex")
    .slice(0, 16);
}

export function buildAuditEntry(
  rule: EntryRule,
  opts: {
    surface: EntryRuleAuditEntry["surface"];
    sessionRef?: string;
  }
): EntryRuleAuditEntry {
  return {
    auditId: randomUUID(),
    ruleId: rule.id,
    destinationIso2: rule.destinationIso2,
    passportIso2: rule.passportIso2,
    requirementLevel: rule.requirementLevel,
    surfacedAt: new Date().toISOString(),
    sessionRef: opts.sessionRef,
    surface: opts.surface,
  };
}

/**
 * Write the audit entry to the structured log.
 * In production, stdout is captured by CloudWatch Logs.
 * Never throws — log failure must not affect user response.
 */
export function logEntryRuleQuery(
  rule: EntryRule,
  opts: {
    surface: EntryRuleAuditEntry["surface"];
    sessionRef?: string;
  }
): EntryRuleAuditEntry {
  const entry = buildAuditEntry(rule, opts);
  try {
    console.log(
      JSON.stringify({
        metric: "EntryRuleQuery",
        auditId: entry.auditId,
        ruleId: entry.ruleId,
        destinationIso2: entry.destinationIso2,
        passportIso2: entry.passportIso2,
        requirementLevel: entry.requirementLevel,
        surface: entry.surface,
        coarseWeek: coarseWeek(),
        // surfacedAt NOT logged to stdout — reduces risk of log-based fingerprinting
      })
    );
  } catch {
    // log write failure is non-fatal
  }
  return entry;
}
