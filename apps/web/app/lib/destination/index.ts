import type { DestinationBrief } from "./types";
import { ISTANBUL_BRIEF } from "./briefs/istanbul";
import { BARCELONA_BRIEF } from "./briefs/barcelona";
import { PARIS_BRIEF } from "./briefs/paris";

const BRIEFS: Record<string, DestinationBrief> = {
  istanbul: ISTANBUL_BRIEF,
  barcelona: BARCELONA_BRIEF,
  paris: PARIS_BRIEF,
};

export function getDestinationBrief(id: string): DestinationBrief | null {
  return BRIEFS[id.toLowerCase()] ?? null;
}

export function listDestinationBriefIds(): string[] {
  return Object.keys(BRIEFS);
}

export type { DestinationBrief } from "./types";
