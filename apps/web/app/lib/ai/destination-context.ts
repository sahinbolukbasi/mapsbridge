/**
 * Destination context builder — injects curated brief fields into system prompt.
 * Token-efficient: extracts only what affects planning decisions for the current trip.
 * The model reads this, never writes to it.
 */

import type { DestinationBrief as _DestinationBrief } from "../destination/types";
import { getDestinationBrief } from "../destination/index";

export interface DestinationContextOptions {
  destinationId: string;
  /** User's travel date — enables seasonal and closed-day warnings */
  travelDate?: string;
  /** Interests narrow which niche angles are injected */
  interests?: string[];
  /** Max characters to inject (keeps tokens bounded) */
  maxChars?: number;
}

/**
 * Build a compact, prompt-injectable string from the destination brief.
 * Returns empty string if brief not found.
 */
export function buildDestinationContext(opts: DestinationContextOptions): string {
  const brief = getDestinationBrief(opts.destinationId);
  if (!brief) return "";

  const parts: string[] = [];
  const MAX = opts.maxChars ?? 1800;

  parts.push(`\n━━ ${brief.name.toUpperCase()} — DANIŞMAN BRİFİNGİ ━━`);

  // City rhythm (always include — shapes meal and timing decisions)
  const rhythm = brief.cityRhythm.value;
  const rhythmLines: string[] = [`Öğle: ${rhythm.lunchTime}`, `Akşam yemeği: ${rhythm.dinnerTime}`];
  if (rhythm.siestaExists) rhythmLines.push("Öğle arası kapanma var.");
  if (rhythm.closingDayNote) rhythmLines.push(rhythm.closingDayNote);
  if (rhythm.additionalNotes) rhythmLines.push(...rhythm.additionalNotes.slice(0, 2));
  parts.push(`Şehir ritmi: ${rhythmLines.join(" | ")}`);

  // Top timing rules (severity=blocks_visit first, max 5)
  const timingRules = brief.timingRules.value
    .filter((r) => r.severity !== "fyi")
    .sort(
      (a, b) => (a.severity === "blocks_visit" ? -1 : 1) - (b.severity === "blocks_visit" ? -1 : 1),
    )
    .slice(0, 5);
  if (timingRules.length) {
    parts.push(
      "Kritik zamanlama:\n" + timingRules.map((r) => `- ${r.subject}: ${r.rule}`).join("\n"),
    );
  }

  // Rookie mistakes (max 3)
  const mistakes = brief.rookieMistakes.value.slice(0, 3);
  if (mistakes.length) {
    parts.push(
      "Acemi hataları:\n" +
        mistakes.map((m) => `- Hata: "${m.mistake}" → Doğrusu: "${m.correction}"`).join("\n"),
    );
  }

  // Overrated with alternatives (max 2)
  const overrated = brief.overratedWithAlternatives.value.slice(0, 2);
  if (overrated.length) {
    parts.push(
      "Abartılanlar:\n" +
        overrated
          .map((o) => `- ${o.overrated}: ${o.why} → Alternatif: ${o.alternative}`)
          .join("\n"),
    );
  }

  // Getting around (key points only)
  const ga = brief.gettingAround.value;
  const gaLines: string[] = [];
  if (ga.transitCardName) gaLines.push(`Toplu taşıma: ${ga.transitCardName}`);
  if (ga.hillsWarning) gaLines.push(ga.hillsWarning);
  if (!ga.carRecommended && ga.carNote) gaLines.push(ga.carNote);
  if (ga.ferryNote) gaLines.push(ga.ferryNote);
  if (gaLines.length) parts.push(`Ulaşım: ${gaLines.join(" | ")}`);

  // Niche angles — only inject if interests overlap
  if (opts.interests?.length) {
    const categoryMap: Record<string, string[]> = {
      running: ["koşu", "running", "spor"],
      cycling: ["bisiklet", "cycling", "spor"],
      food_specialty: ["yemek", "gastronomi", "food"],
      art_gallery: ["sanat", "galeri", "müze"],
      coworking: ["çalışma", "coworking", "dijital"],
    };
    const nicheMatches = brief.nicheAngles.value.filter((n) => {
      const keywords = categoryMap[n.category] ?? [];
      return opts.interests!.some((i) => keywords.some((k) => i.toLowerCase().includes(k)));
    });
    if (nicheMatches.length) {
      parts.push(
        "Niş açılar:\n" +
          nicheMatches
            .map((n) => `- ${n.description}: ${n.highlights.slice(0, 2).join(", ")}`)
            .join("\n"),
      );
    }
  }

  // Seasonal note for travel month
  if (opts.travelDate) {
    const month = new Date(opts.travelDate).getMonth() + 1;
    const note = brief.seasonality.value.byMonth?.[String(month)];
    if (note) parts.push(`${month}. ay notu: ${note}`);
  }

  const result = parts.join("\n");
  // Trim to maxChars from the end (less critical content dropped first)
  return result.length <= MAX ? result : result.slice(0, MAX) + "\n[brifing kısaltıldı]";
}

/**
 * Quick lookup — returns brief confidence for a destination.
 * Used to decide whether to note "bilgi eksik" in the response.
 */
export function getDestinationConfidence(destinationId: string): "high" | "partial" | "none" {
  const brief = getDestinationBrief(destinationId);
  if (!brief) return "none";
  const curatedFields = [
    brief.cityRhythm,
    brief.rookieMistakes,
    brief.timingRules,
    brief.gettingAround,
  ];
  const verifiedCount = curatedFields.filter((f) => f.confidence === "verified").length;
  return verifiedCount >= 3 ? "high" : verifiedCount >= 1 ? "partial" : "none";
}
