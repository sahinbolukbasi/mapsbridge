/**
 * Plan B — §11.6
 *
 * Alternative-plan generation for weather disruptions, closures,
 * over-subscribed venues, and user rejections.
 *
 * buildRainAlternatives  — swap outdoor stops for indoor alternatives
 * buildLiteDay           — remove lowest-priority stops (relaxed version)
 * planBToPromptSnippet   — AI context injection
 */

import type { PlaceEntity } from "./place-entity";
import type { DayBlock, TripProfile } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanBAlternative {
  forPlaceId: string;
  reason: "rain" | "closed" | "full" | "rejected" | "accessibility";
  alternatives: PlaceEntity[];
  generatedAt: string;
}

export interface DayLiteVersion {
  dayIndex: number;
  description: string;
  removedPlaceIds: string[];
  keptPlaceIds: string[];
  estimatedWalkingMinutes: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Block types that are primarily outdoors and affected by bad weather. */
const OUTDOOR_TYPES: ReadonlySet<DayBlock["type"]> = new Set(["park", "viewpoint"]);

/**
 * Very rough walking-time heuristic: assumes each non-transit block involves
 * ~10 minutes of walking to/from the venue.
 */
function estimateWalkingMinutes(blocks: DayBlock[]): number {
  return blocks.filter((b) => b.type !== "transit").length * 10;
}

// ---------------------------------------------------------------------------
// buildRainAlternatives
// ---------------------------------------------------------------------------

/**
 * Replaces outdoor stops with indoor alternatives when rain is forecast.
 *
 * Strategy (§11.6.1):
 *  - Outdoor blocks (park, viewpoint) are swapped for indoor ones
 *  - If the block already has an `alt` field, that name is used to create
 *    a minimal placeholder block
 *  - Blocks that have no indoor swap are removed to shorten the day
 */
export function buildRainAlternatives(dayBlocks: DayBlock[]): DayBlock[] {
  return dayBlocks.map((block) => {
    // Keep indoor and transit blocks as-is
    if (!OUTDOOR_TYPES.has(block.type)) return block;

    // If the block has a named alt, create a minimal indoor replacement
    if (block.alt) {
      const altBlock: DayBlock = {
        ...block,
        type: "museum", // safe indoor fallback category
        name: block.alt,
        place_id: `alt_${block.place_id}`,
        why: `Yağmurlu hava alternatifi: ${block.alt}`,
        alt: undefined,
      };
      return altBlock;
    }

    // No alt available — convert to a cafe break (minimal disruption)
    return {
      ...block,
      type: "cafe" as DayBlock["type"],
      name: `${block.name} — Kapalı Alan Alternatifi`,
      place_id: `rain_alt_${block.place_id}`,
      why: "Yağmurlu hava için iç mekan alternatifi.",
      alt: undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// buildLiteDay
// ---------------------------------------------------------------------------

/**
 * Produces a "lite" (relaxed) version of a day by removing the
 * lowest-priority stops.
 *
 * Priority rules (§11.6.2):
 *  1. Hotel and transit blocks are always kept
 *  2. Restaurant and cafe blocks are kept (energy stops)
 *  3. Additional activity/museum/park/viewpoint blocks: keep top 2,
 *     remove the rest (they become "nice-to-have")
 *
 * The pace from TripProfile biases the cutoff:
 *  - relaxed → keep only 1 discretionary stop
 *  - moderate → keep 2
 *  - fast     → keep 3
 */
export function buildLiteDay(day: DayBlock[], profile: TripProfile, dayIndex = 1): DayLiteVersion {
  const pace = profile.pace ?? "moderate";
  const maxDiscretionary = pace === "relaxed" ? 1 : pace === "fast" ? 3 : 2;

  const ALWAYS_KEEP: ReadonlySet<DayBlock["type"]> = new Set([
    "hotel",
    "transit",
    "restaurant",
    "cafe",
  ]);

  const kept: DayBlock[] = [];
  const removed: DayBlock[] = [];
  let discretionaryCount = 0;

  for (const block of day) {
    if (ALWAYS_KEEP.has(block.type)) {
      kept.push(block);
    } else if (discretionaryCount < maxDiscretionary) {
      kept.push(block);
      discretionaryCount++;
    } else {
      removed.push(block);
    }
  }

  return {
    dayIndex,
    description: "Hafif versiyon — daha az durak, daha çok dinlenme zamanı",
    removedPlaceIds: removed.map((b) => b.place_id),
    keptPlaceIds: kept.map((b) => b.place_id),
    estimatedWalkingMinutes: estimateWalkingMinutes(kept),
  };
}

// ---------------------------------------------------------------------------
// planBToPromptSnippet
// ---------------------------------------------------------------------------

/**
 * Serialises a list of PlanBAlternatives into a compact system-prompt
 * injection so the assistant knows which alternatives are available.
 */
export function planBToPromptSnippet(alts: PlanBAlternative[]): string {
  if (alts.length === 0) return "";

  const lines: string[] = ["=== PLAN B ALTERNATIVES ==="];

  for (const alt of alts) {
    const altNames = alt.alternatives.map((a) => a.name).join(", ") || "yok";
    lines.push(`• ${alt.forPlaceId} [${alt.reason}] → alternatifler: ${altNames}`);
  }

  lines.push("=== END PLAN B ===");
  return lines.join("\n");
}
