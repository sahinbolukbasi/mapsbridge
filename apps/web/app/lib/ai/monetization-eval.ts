/**
 * §14 Neutrality check (tarafsızlık eval)
 *
 * Validates that partner/affiliate relationships do not distort the ranking
 * of recommendations presented to the user.  A passing check means user
 * relevance scores — not commission rates — drive ordering.
 */

export interface NeutralityCheck {
  passed: boolean;
  violations: string[];
  score: number; // 0-100; 100 = perfectly neutral
}

type Recommendation = {
  name: string;
  rank: number;
  hasPartnerLink: boolean;
  partnerCommission?: number;
  userRelevanceScore: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Pearson correlation between two equal-length numeric arrays.
 * Returns NaN when the arrays are too short or have zero variance.
 */
function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den === 0 ? NaN : num / den;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Checks whether the list of recommendations is ordered by user relevance
 * rather than by partner commission.
 *
 * Violations:
 * 1. Any partner-linked item ranked higher than a non-partner item with a
 *    higher userRelevanceScore.
 * 2. Commission correlates with rank MORE than userRelevanceScore does.
 *    (lower rank number = better position)
 */
export function checkNeutrality(recommendations: Recommendation[]): NeutralityCheck {
  const violations: string[] = [];

  if (recommendations.length === 0) {
    return { passed: true, violations: [], score: 100 };
  }

  const sorted = [...recommendations].sort((a, b) => a.rank - b.rank);

  // ── Violation 1: partner outranks more-relevant non-partner ───────────────

  const partners = sorted.filter(r => r.hasPartnerLink);
  const nonPartners = sorted.filter(r => !r.hasPartnerLink);

  for (const partner of partners) {
    for (const nonPartner of nonPartners) {
      if (
        partner.rank < nonPartner.rank && // partner has better rank (lower number)
        nonPartner.userRelevanceScore > partner.userRelevanceScore
      ) {
        violations.push(
          `"${partner.name}" (partner, sıra ${partner.rank}, alaka ${partner.userRelevanceScore}) ` +
            `"${nonPartner.name}" (sıra ${nonPartner.rank}, alaka ${nonPartner.userRelevanceScore}) ` +
            `üstünde sıralanmış`,
        );
      }
    }
  }

  // ── Violation 2: commission correlates with rank more than relevance does ──

  const partnersWithCommission = partners.filter(
    r => typeof r.partnerCommission === 'number',
  );

  if (partnersWithCommission.length >= 2) {
    const ranks = partnersWithCommission.map(r => r.rank);
    const commissions = partnersWithCommission.map(r => r.partnerCommission as number);
    const relevances = partnersWithCommission.map(r => r.userRelevanceScore);

    // Lower rank = better: negative correlation between rank and score is "good"
    const corrCommission = pearsonCorrelation(ranks, commissions);
    const corrRelevance = pearsonCorrelation(ranks, relevances);

    // If commission negatively correlates with rank more than relevance does,
    // commission is driving the ordering.
    if (
      !isNaN(corrCommission) &&
      !isNaN(corrRelevance) &&
      corrCommission < corrRelevance // both should be negative; commission more so = worse
    ) {
      violations.push(
        `Komisyon oranı alaka skorundan daha güçlü sıralama belirleyicisi ` +
          `(komisyon r=${corrCommission.toFixed(2)}, alaka r=${corrRelevance.toFixed(2)})`,
      );
    }
  }

  const score = Math.max(0, 100 - violations.length * 25);

  return {
    passed: violations.length === 0,
    violations,
    score,
  };
}

/**
 * Returns the standard partner link disclosure text to display to the user
 * whenever affiliate/partner links are present in the recommendations.
 */
export function buildNeutralityWarning(): string {
  return (
    'MapsBridge bazı önerilerde ortak bağlantılar içerebilir. ' +
    'Tüm öneriler kullanıcı alaka skoruna göre sıralanır; ' +
    'komisyon veya ortak ilişkisi sıralamayı etkilemez. ' +
    'Ortaklı bağlantılar ⭐ işareti ile gösterilir.'
  );
}
