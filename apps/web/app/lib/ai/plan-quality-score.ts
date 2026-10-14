/**
 * §11.12 Plan quality scoring
 *
 * Produces a multi-dimensional PlanQualityScore for a StructuredTripPlan so
 * that the orchestrator can log plan health, prompt the user for refinement,
 * and give the model self-reflection input.
 */

import type { StructuredTripPlan, TripProfile, FeasibilityIssue } from './types';

export interface PlanQualityScore {
  overall: number;               // 0-100
  geoEfficiency: number;         // 0-100: wasted travel ratio
  densityBalance: number;        // 0-100: not too packed, not too sparse
  profileMatch: number;          // 0-100: matches user interests/pace
  feasibilityCompliance: number; // 0-100: 100 = no feasibility issues
  sourcedInfoRatio: number;      // 0-100: % claims with sources
  userCorrectionCount: number;   // lower = better; raw count
  details: string[];             // human-readable breakdown
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Haversine great-circle distance between two lat/lng points (km).
 * We don't have real lat/lng here — the DayBlock only has `place_id` and
 * `name`. We fall back to 0 and let geo scoring be neutral when coords are
 * absent.  (Real implementation would join with a PlaceRef lookup.)
 */
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Clamp a value to [0, 100]. */
function clamp100(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// ── Scoring dimensions ────────────────────────────────────────────────────────

/**
 * geoEfficiency — penalise when average inter-stop distance > 3 km on same day.
 * Since DayBlock lacks coordinates, we rely on the optional distanceToNextKm
 * analogue embedded in the transit object. When transit data is absent the
 * score defaults to 75 (neutral assumption).
 */
function scoreGeoEfficiency(plan: StructuredTripPlan): { score: number; detail: string } {
  const dayDistances: number[] = [];

  for (const day of plan.days) {
    const blocksWithTransit = (day.blocks || []).filter(b => b.transit && b.transit.minutes > 0);
    if (blocksWithTransit.length === 0) continue;

    // Approximate km from transit minutes: 1 min walking ≈ 0.08 km, taxi/metro ≈ 0.5 km/min
    const avgDistKm =
      blocksWithTransit.reduce((sum, b) => {
        const mode = b.transit!.mode;
        const multiplier =
          mode === 'walking' ? 0.08 : mode === 'subway' ? 0.5 : mode === 'taxi' ? 0.6 : 0.3;
        return sum + b.transit!.minutes * multiplier;
      }, 0) / blocksWithTransit.length;

    dayDistances.push(avgDistKm);
  }

  if (dayDistances.length === 0) {
    return { score: 75, detail: 'Coğrafi mesafe verisi yok — varsayılan skor 75' };
  }

  const overallAvg = dayDistances.reduce((a, b) => a + b, 0) / dayDistances.length;
  const IDEAL_MAX_KM = 3;
  // Linear penalty: 0 penalty at 3 km, 100 penalty at 9 km+
  const penalty = Math.min(100, ((overallAvg - IDEAL_MAX_KM) / (IDEAL_MAX_KM * 2)) * 100);
  const score = penalty > 0 ? clamp100(100 - penalty) : 100;

  return {
    score,
    detail: `Ortalama durak arası mesafe ~${overallAvg.toFixed(1)} km/gün (ideal ≤${IDEAL_MAX_KM} km)`,
  };
}

/**
 * densityBalance — ideal 3–5 stops/day; penalise above 7 or below 2.
 */
function scoreDensityBalance(plan: StructuredTripPlan): { score: number; detail: string } {
  const stopsPerDay = plan.days.map(d =>
    (d.blocks || []).filter(b => b.type !== 'transit').length,
  );

  if (stopsPerDay.length === 0) {
    return { score: 0, detail: 'Gün bloğu bulunamadı' };
  }

  const avgStops = stopsPerDay.reduce((a, b) => a + b, 0) / stopsPerDay.length;

  let score = 100;
  let detail: string;

  if (avgStops > 7) {
    const excess = avgStops - 7;
    score = clamp100(100 - excess * 35);
    detail = `Ortalama ${avgStops.toFixed(1)} durak/gün — aşırı yoğun (ideal 3–5)`;
  } else if (avgStops < 2) {
    score = clamp100(50 + (avgStops / 2) * 50);
    detail = `Ortalama ${avgStops.toFixed(1)} durak/gün — çok seyrek (ideal 3–5)`;
  } else if (avgStops <= 5) {
    score = 100;
    detail = `Ortalama ${avgStops.toFixed(1)} durak/gün — ideal yoğunluk`;
  } else {
    // 5–7 range
    const overflow = (avgStops - 5) * 8;
    score = clamp100(100 - overflow);
    detail = `Ortalama ${avgStops.toFixed(1)} durak/gün — hafif yoğun`;
  }

  return { score, detail };
}

/**
 * profileMatch — checks interest alignment.
 *   - food interest: ≥1 food/restaurant/cafe block per day
 *   - culture interest: ≥1 museum/historic block per day
 *   - pace mismatch: slow profile with >5 stops/day
 */
function scoreProfileMatch(
  plan: StructuredTripPlan,
  profile: TripProfile,
): { score: number; detail: string } {
  const details: string[] = [];
  let deductions = 0;

  const hasFoodInterest =
    (profile.interests.food && profile.interests.food.length > 0) ||
    (profile.interests.general &&
      profile.interests.general.some(i => /food|yemek|gastro|mutfak/i.test(i)));

  const hasCultureInterest =
    profile.interests.culture && profile.interests.culture.length > 0;

  const FOOD_TYPES = new Set(['cafe', 'restaurant']);
  const CULTURE_TYPES = new Set(['museum']);

  for (const day of plan.days) {
    const blocks = day.blocks || [];
    const nonTransit = blocks.filter(b => b.type !== 'transit');

    if (hasFoodInterest) {
      const hasFoodBlock = nonTransit.some(b => FOOD_TYPES.has(b.type));
      if (!hasFoodBlock) {
        deductions += 10;
        details.push(`${day.date}: yemek ilgisi var ama yiyecek/içecek durağı yok`);
      }
    }

    if (hasCultureInterest) {
      const hasCultureBlock = nonTransit.some(b => CULTURE_TYPES.has(b.type));
      if (!hasCultureBlock) {
        deductions += 8;
        details.push(`${day.date}: kültür ilgisi var ama müze/tarihi mekan yok`);
      }
    }
  }

  // Pace mismatch
  if (profile.pace === 'relaxed') {
    const overloadedDays = plan.days.filter(
      d => (d.blocks || []).filter(b => b.type !== 'transit').length > 5,
    );
    if (overloadedDays.length > 0) {
      deductions += overloadedDays.length * 12;
      details.push(`${overloadedDays.length} gün "sakin" tempo için fazla yoğun`);
    }
  }

  const score = clamp100(100 - deductions);
  const detail =
    details.length > 0
      ? `Profil uyumu sorunları: ${details.join('; ')}`
      : `Plan profil ile uyumlu`;

  return { score, detail };
}

/**
 * feasibilityCompliance — 100 – (errors * 20) – (warnings * 5), floor 0.
 */
function scoreFeasibilityCompliance(issues: FeasibilityIssue[]): {
  score: number;
  detail: string;
} {
  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const score = clamp100(100 - errors * 20 - warnings * 5);
  const detail =
    errors + warnings === 0
      ? 'Uygunluk sorunu yok'
      : `${errors} hata, ${warnings} uyarı tespit edildi`;
  return { score, detail };
}

/**
 * sourcedInfoRatio — % of blocks that have a sourceUrl or checkedAt.
 * These fields are on DayBlock optionally via the plan sources array.
 * We proxy via plan.sources length / total blocks.
 */
function scoreSourcedInfoRatio(plan: StructuredTripPlan): { score: number; detail: string } {
  const totalBlocks = plan.days.reduce(
    (sum, d) => sum + (d.blocks || []).filter(b => b.type !== 'transit').length,
    0,
  );

  if (totalBlocks === 0) return { score: 0, detail: 'Blok yok' };

  const sourcesCount = (plan.sources || []).length;
  // Heuristic: assume each source covers ~2 blocks
  const covered = Math.min(totalBlocks, sourcesCount * 2);
  const ratio = (covered / totalBlocks) * 100;
  const score = clamp100(ratio);
  const detail = `${sourcesCount} kaynak / ${totalBlocks} durak (%${score})`;
  return { score, detail };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function scorePlan(
  plan: StructuredTripPlan,
  profile: TripProfile,
  feasibilityIssues: FeasibilityIssue[],
): PlanQualityScore {
  const geo = scoreGeoEfficiency(plan);
  const density = scoreDensityBalance(plan);
  const profileMatchResult = scoreProfileMatch(plan, profile);
  const feasibility = scoreFeasibilityCompliance(feasibilityIssues);
  const sourced = scoreSourcedInfoRatio(plan);

  const weights = {
    geoEfficiency: 0.2,
    densityBalance: 0.2,
    profileMatch: 0.25,
    feasibilityCompliance: 0.25,
    sourcedInfoRatio: 0.1,
  };

  const overall = clamp100(
    geo.score * weights.geoEfficiency +
      density.score * weights.densityBalance +
      profileMatchResult.score * weights.profileMatch +
      feasibility.score * weights.feasibilityCompliance +
      sourced.score * weights.sourcedInfoRatio,
  );

  return {
    overall,
    geoEfficiency: geo.score,
    densityBalance: density.score,
    profileMatch: profileMatchResult.score,
    feasibilityCompliance: feasibility.score,
    sourcedInfoRatio: sourced.score,
    userCorrectionCount: 0, // populated externally from mutation log
    details: [
      `Genel skor: ${overall}/100`,
      geo.detail,
      density.detail,
      profileMatchResult.detail,
      feasibility.detail,
      sourced.detail,
    ],
  };
}

/**
 * Serialises PlanQualityScore to a compact one-liner for agent_runs logging.
 */
export function qualityScoreToPromptSnippet(score: PlanQualityScore): string {
  return (
    `plan_quality | overall=${score.overall} geo=${score.geoEfficiency} ` +
    `density=${score.densityBalance} profile=${score.profileMatch} ` +
    `feasibility=${score.feasibilityCompliance} sourced=${score.sourcedInfoRatio} ` +
    `corrections=${score.userCorrectionCount}`
  );
}
