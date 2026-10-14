/**
 * Entry rule formatter — renders EntryRule as prompt-safe text for system prompt injection.
 *
 * §9.2 rules enforced here:
 *  - source name, retrieval date, official URL, disclaimer ALL present
 *  - "gidebilirsin" is never written — only the requirement level label
 *  - fallback (unknown rule) always redirects to official source
 */

import type { EntryRule, VisaRequirementLevel } from "./types";
import { getEntryRule, getEntryRulesForPassport } from "./rules";
import { logEntryRuleQuery } from "./audit-log";

const LEVEL_LABELS: Record<VisaRequirementLevel, string> = {
  not_required: "Vize gerekmiyor",
  evisa_required: "E-vize gerekiyor (online başvuru)",
  voa_available: "Kapıda vize mevcut (önceden doğrulayın)",
  visa_required: "Vize zorunlu (büyükelçilik/konsolosluk başvurusu)",
  entry_banned: "Giriş yasak",
  unknown: "Bilinmiyor — resmi kaynağı kontrol edin",
};

/**
 * Format an EntryRule for prompt injection.
 * Returns a compact string (≤400 chars) with all §9.2 required fields.
 * Caller MUST pass this result verbatim into the system prompt — no paraphrasing.
 */
export function formatEntryRuleForPrompt(rule: EntryRule): string {
  const levelLabel = LEVEL_LABELS[rule.requirementLevel];
  const stayNote =
    rule.maxStayDays && rule.maxStayDays > 0
      ? ` (maks. ${rule.maxStayDays} gün)`
      : "";
  const notes = rule.notes.slice(0, 2).join(" ");

  return (
    `[VİZE/GİRİŞ — ${rule.destinationCountry.toUpperCase()} — TÜRK PASAPORTU]\n` +
    `Durum: ${levelLabel}${stayNote}\n` +
    `${notes}\n` +
    `Kaynak: ${rule.sourceName} | Tarih: ${rule.retrievedAt} | ${rule.sourceUrl}\n` +
    `UYARI: ${rule.disclaimer}`
  );
}

/**
 * Returns formatted visa context for a destination if a rule exists, or a fallback
 * redirect string. Also writes to audit log.
 *
 * Returns empty string if destinationId is unknown (silent fail — prompt shortens).
 */
export function buildVisaContext(opts: {
  destinationId: string;
  passportIso2?: string;
  surface?: "chat" | "checklist" | "prepare_phase";
  sessionRef?: string;
}): string {
  const result = getEntryRule(opts.destinationId, opts.passportIso2 ?? "TR");

  if (!result.canSurface || !result.rule) {
    if (result.fallbackUrl) {
      return (
        `[VİZE — ${opts.destinationId.toUpperCase()}] ` +
        `Bu destinasyon için giriş/vize bilgisi doğrulanamadı. ` +
        `Kullanıcıyı resmî kaynağa yönlendir: ${result.fallbackUrl}`
      );
    }
    return "";
  }

  logEntryRuleQuery(result.rule, {
    surface: opts.surface ?? "unknown",
    sessionRef: opts.sessionRef,
  });

  return formatEntryRuleForPrompt(result.rule);
}

/**
 * Returns all entry rules for a passport country formatted as a checklist supplement.
 * Used by the preparation checklist to show visa requirements for each destination.
 */
export function buildVisaChecklistItems(passportIso2 = "TR"): Array<{
  destinationCountry: string;
  levelLabel: string;
  sourceUrl: string;
  disclaimer: string;
}> {
  const rules = getEntryRulesForPassport(passportIso2);
  return rules.map(r => ({
    destinationCountry: r.destinationCountry,
    levelLabel: LEVEL_LABELS[r.requirementLevel],
    sourceUrl: r.sourceUrl,
    disclaimer: r.disclaimer,
  }));
}
