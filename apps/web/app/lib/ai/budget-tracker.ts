/**
 * §11.5 Live Budget Tracker
 * Pure utility functions — no AI / Bedrock calls.
 */

export interface BudgetLine {
  placeId?: string;
  category: 'transport' | 'lodging' | 'entry_ticket' | 'food' | 'activity' | 'other';
  description: string;
  amount: number;
  currency: string;
  isEstimate: boolean;   // true = estimate, false = confirmed price
  addedAt: string;       // ISO timestamp
}

export interface TripBudgetSummary {
  lines: BudgetLine[];
  totalEstimate: number;
  totalConfirmed: number;
  currency: string;
  perPersonEstimate: number;
  travelers: number;
  /** Optional trip duration in days, required for per-day budget threshold checks. */
  days?: number;
  overBudgetWarning?: string;
}

// ---------------------------------------------------------------------------
// Budget thresholds per person per day (EUR) — §11.5
// ---------------------------------------------------------------------------

const THRESHOLDS_EUR_PER_PERSON_PER_DAY: Record<'budget' | 'mid' | 'luxury', number> = {
  budget: 50,
  mid: 150,
  luxury: 500,
};

// ---------------------------------------------------------------------------
// Core computations
// ---------------------------------------------------------------------------

/**
 * Compute a fresh TripBudgetSummary from raw budget lines.
 * Confirmed prices are included in both totalConfirmed and totalEstimate.
 */
export function computeBudgetSummary(
  lines: BudgetLine[],
  travelers: number,
  currency: string,
  days?: number,
): TripBudgetSummary {
  const safeT = travelers > 0 ? travelers : 1;
  let totalEstimate = 0;
  let totalConfirmed = 0;

  for (const line of lines) {
    if (line.isEstimate) {
      totalEstimate += line.amount;
    } else {
      totalConfirmed += line.amount;
      totalEstimate += line.amount; // confirmed costs roll into the estimate total
    }
  }

  return {
    lines,
    totalEstimate,
    totalConfirmed,
    currency,
    perPersonEstimate: totalEstimate / safeT,
    travelers: safeT,
    ...(days !== undefined ? { days } : {}),
  };
}

// ---------------------------------------------------------------------------
// Immutable updates
// ---------------------------------------------------------------------------

/** Add a BudgetLine and return a recomputed summary (immutable). */
export function addBudgetLine(
  summary: TripBudgetSummary,
  line: BudgetLine,
): TripBudgetSummary {
  return computeBudgetSummary(
    [...summary.lines, line],
    summary.travelers,
    summary.currency,
    summary.days,
  );
}

/**
 * Remove all lines that match the given placeId and return a recomputed
 * summary (immutable). Lines without a placeId are never removed.
 */
export function removeBudgetLine(
  summary: TripBudgetSummary,
  placeId: string,
): TripBudgetSummary {
  const filtered = summary.lines.filter((l) => l.placeId !== placeId);
  return computeBudgetSummary(filtered, summary.travelers, summary.currency, summary.days);
}

// ---------------------------------------------------------------------------
// AI prompt helpers
// ---------------------------------------------------------------------------

/** Render summary as a compact Turkish text snippet for AI context injection. */
export function budgetSummaryToPromptSnippet(summary: TripBudgetSummary): string {
  const cur = summary.currency;
  const lines: string[] = [
    `Bütçe Özeti (${cur}):`,
    `- Toplam Tahmini: ${summary.totalEstimate.toFixed(2)} ${cur}`,
    `- Onaylanmış: ${summary.totalConfirmed.toFixed(2)} ${cur}`,
    `- Kişi Başı Tahmini: ${summary.perPersonEstimate.toFixed(2)} ${cur} (${summary.travelers} kişi)`,
  ];

  if (summary.days && summary.days > 0) {
    const ppd = summary.perPersonEstimate / summary.days;
    lines.push(`- Günlük Kişi Başı: ${ppd.toFixed(2)} ${cur}`);
  }

  if (summary.overBudgetWarning) {
    lines.push(`UYARI: ${summary.overBudgetWarning}`);
  }

  if (summary.lines.length > 0) {
    lines.push('Kalemler:');
    for (const l of summary.lines) {
      const tag = l.isEstimate ? 'tahmini' : 'onaylandı';
      lines.push(`  • ${l.description} — ${l.amount.toFixed(2)} ${l.currency} (${tag})`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Budget overrun check
// ---------------------------------------------------------------------------

/**
 * Returns a Turkish warning string if the per-person-per-day spending exceeds
 * the threshold for the given budget level, or null if within budget.
 * Requires summary.days to be set for a per-day check; without it, falls back
 * to a looser total-per-person comparison (assumes a 3-day minimum trip).
 */
export function checkBudgetOverrun(
  summary: TripBudgetSummary,
  budgetLevel: 'budget' | 'mid' | 'luxury' | 'unspecified',
): string | null {
  if (budgetLevel === 'unspecified') return null;

  const threshold = THRESHOLDS_EUR_PER_PERSON_PER_DAY[budgetLevel];

  if (summary.days && summary.days > 0) {
    const perPersonPerDay = summary.perPersonEstimate / summary.days;
    if (perPersonPerDay > threshold) {
      return (
        `Günlük kişi başı tahmini harcama (${perPersonPerDay.toFixed(0)} ${summary.currency}), ` +
        `"${budgetLevel}" bütçe eşiğini (${threshold} EUR/kişi/gün) aşıyor.`
      );
    }
    return null;
  }

  // Fallback: compare total per-person against threshold × 3 days
  const looseThreshold = threshold * 3;
  if (summary.perPersonEstimate > looseThreshold) {
    return (
      `Kişi başı toplam tahmini harcama (${summary.perPersonEstimate.toFixed(0)} ${summary.currency}), ` +
      `"${budgetLevel}" bütçe seviyesiyle uyumsuz görünüyor (eşik: ~${looseThreshold} EUR/kişi).`
    );
  }
  return null;
}
