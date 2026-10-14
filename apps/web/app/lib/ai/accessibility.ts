/**
 * §11.7 Group / accessibility checks
 *
 * Validates whether places in a trip plan are accessible for the given
 * AccessibilityProfile and surfaces per-place issues with severity levels.
 */

export type AccessibilityNeed =
  | 'wheelchair'
  | 'stroller'
  | 'low_mobility'
  | 'visual_impairment'
  | 'hearing_impairment'
  | 'elderly'
  | 'children_under_5'
  | 'children_5_12';

export interface AccessibilityProfile {
  needs: AccessibilityNeed[];
  maxWalkingMinutes?: number;
  requiresElevator?: boolean;
  requiresRamp?: boolean;
}

export interface AccessibilityCheck {
  placeId: string;
  placeName: string;
  issue?: string;
  severity: 'info' | 'warning' | 'blocking';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type PlaceInput = {
  id: string;
  name: string;
  category: string;
  hasElevator?: boolean;
  hasRamp?: boolean;
  cobblestone?: boolean;
};

/** Categories that inherently involve stairs / uneven surfaces */
const MULTI_LEVEL_CATEGORIES = new Set([
  'museum',
  'historic_site',
  'monument',
  'palace',
  'castle',
  'cathedral',
  'basilica',
  'viewpoint',
  'tower',
]);

/** Categories that tend to have rough surfaces */
const ROUGH_SURFACE_CATEGORIES = new Set([
  'archaeological_site',
  'old_town',
  'bazaar',
  'market',
  'historic_site',
  'cobblestone_street',
]);

function needsWheelchairAccess(profile: AccessibilityProfile): boolean {
  return (
    profile.needs.includes('wheelchair') ||
    profile.needs.includes('low_mobility')
  );
}

function needsStrollerAccess(profile: AccessibilityProfile): boolean {
  return (
    profile.needs.includes('stroller') ||
    profile.needs.includes('children_under_5')
  );
}

function isHighMobilityDemand(profile: AccessibilityProfile): boolean {
  return needsWheelchairAccess(profile) || needsStrollerAccess(profile);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Checks each place against the accessibility profile and returns a list of
 * issues.  Only places with actual problems are returned (no "all clear"
 * entries), keeping the list actionable.
 */
export function checkPlanAccessibility(
  places: PlaceInput[],
  profile: AccessibilityProfile,
): AccessibilityCheck[] {
  const checks: AccessibilityCheck[] = [];

  if (profile.needs.length === 0) return checks;

  for (const place of places) {
    const issues: { message: string; severity: 'info' | 'warning' | 'blocking' }[] = [];

    // ── Wheelchair / low mobility ──────────────────────────────────────────

    if (needsWheelchairAccess(profile)) {
      if (place.hasElevator === false && MULTI_LEVEL_CATEGORIES.has(place.category)) {
        issues.push({
          message: `Asansör yok — tekerlekli sandalye ile çok katlı yapıya erişim sınırlı`,
          severity: 'blocking',
        });
      }

      if (profile.requiresRamp && place.hasRamp === false) {
        issues.push({
          message: `Rampa bulunmuyor`,
          severity: profile.needs.includes('wheelchair') ? 'blocking' : 'warning',
        });
      }

      if (place.cobblestone) {
        issues.push({
          message: `Arnavut kaldırımı — tekerlekli sandalye veya düşük mobilite için zorlu`,
          severity: 'warning',
        });
      }
    }

    // ── Stroller ──────────────────────────────────────────────────────────

    if (needsStrollerAccess(profile)) {
      if (place.hasRamp === false && MULTI_LEVEL_CATEGORIES.has(place.category)) {
        issues.push({
          message: `Bebek arabası için rampa/asansör bilgisi eksik veya yok`,
          severity: 'warning',
        });
      }

      if (place.cobblestone) {
        issues.push({
          message: `Arnavut kaldırımı — bebek arabası için zorlayıcı`,
          severity: 'info',
        });
      }
    }

    // ── Elderly ───────────────────────────────────────────────────────────

    if (profile.needs.includes('elderly')) {
      if (place.cobblestone) {
        issues.push({
          message: `Arnavut kaldırımı — yaşlı bireyler için düşme riski`,
          severity: 'warning',
        });
      }

      if (place.hasElevator === false && MULTI_LEVEL_CATEGORIES.has(place.category)) {
        issues.push({
          message: `Asansör yok — merdiven çıkışı gerekebilir`,
          severity: 'warning',
        });
      }
    }

    // ── Visual impairment ─────────────────────────────────────────────────

    if (profile.needs.includes('visual_impairment')) {
      if (ROUGH_SURFACE_CATEGORIES.has(place.category) || place.cobblestone) {
        issues.push({
          message: `Düzensiz zemin — görme engelli bireyler için rehber gerekebilir`,
          severity: 'info',
        });
      }
    }

    // ── Deduplicate by severity (keep highest) and emit ───────────────────

    if (issues.length > 0) {
      const severityRank: Record<string, number> = { blocking: 3, warning: 2, info: 1 };
      const worst = issues.reduce((a, b) =>
        severityRank[b.severity] > severityRank[a.severity] ? b : a,
      );

      checks.push({
        placeId: place.id,
        placeName: place.name,
        issue: issues.map(i => i.message).join('; '),
        severity: worst.severity,
      });
    }
  }

  return checks;
}

/**
 * Generates a compact system-prompt snippet describing the group's accessibility
 * constraints so the model can tailor its plan output accordingly.
 */
export function buildAccessibilityPromptSnippet(profile: AccessibilityProfile): string {
  if (profile.needs.length === 0) return '';

  const lines: string[] = [
    `## Erişilebilirlik Kısıtlamaları`,
    `Grup ihtiyaçları: ${profile.needs.join(', ')}`,
  ];

  if (profile.maxWalkingMinutes !== undefined) {
    lines.push(`Maksimum yürüyüş: ${profile.maxWalkingMinutes} dakika aralıksız`);
  }

  if (profile.requiresElevator) {
    lines.push(`Asansör zorunlu — merdiven içeren mekanlar önerilmesin`);
  }

  if (profile.requiresRamp) {
    lines.push(`Rampa zorunlu — kaldırımsız girişi olan mekanlar önerilmesin`);
  }

  if (
    profile.needs.includes('wheelchair') ||
    profile.needs.includes('stroller') ||
    profile.needs.includes('low_mobility')
  ) {
    lines.push(`Arnavut kaldırımı veya düzensiz yüzeyler olan güzergahlardan kaçın`);
  }

  lines.push(
    `Planı bu kısıtlamalara göre optimize et; erişilebilirlik sorunları tespit edilen duraklar için alternatif öner.`,
  );

  return lines.join('\n');
}

/**
 * Recommends a pace (tempo) given the group's accessibility profile.
 * Called by the scheduler when the user hasn't specified a tempo.
 */
export function getTempoForProfile(
  profile: AccessibilityProfile,
): 'relaxed' | 'moderate' | 'fast' {
  if (
    profile.needs.includes('wheelchair') ||
    profile.needs.includes('low_mobility') ||
    profile.needs.includes('elderly') ||
    profile.needs.includes('stroller') ||
    profile.needs.includes('children_under_5')
  ) {
    return 'relaxed';
  }

  if (
    profile.needs.includes('children_5_12') ||
    profile.needs.includes('visual_impairment') ||
    profile.needs.includes('hearing_impairment')
  ) {
    return 'moderate';
  }

  return 'fast';
}
