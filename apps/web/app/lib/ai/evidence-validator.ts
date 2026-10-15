import type { PlaceResearch, ResearchedPlace } from "./place-research";

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export function validatePlaceResearch(value: unknown, now = Date.now()): value is PlaceResearch {
  const research = value as PlaceResearch | null;
  if (
    !research ||
    research.provider !== "Amazon Location" ||
    !["available", "empty", "unavailable"].includes(research.status) ||
    !isValidTimestamp(research.checkedAt, now)
  )
    return false;
  if (!Array.isArray(research.places) || research.places.length > 30) return false;
  if (research.status === "available" ? research.places.length === 0 : research.places.length !== 0)
    return false;

  const ids = new Set<string>();
  return research.places.every((place) => {
    if (!isValidPlace(place, now) || ids.has(place.id)) return false;
    ids.add(place.id);
    return true;
  });
}

function isValidPlace(place: ResearchedPlace, now: number): boolean {
  return (
    !!place &&
    [place.id, place.name, place.address, place.category].every(
      (value) => typeof value === "string" && value.length > 0 && value.length <= 2000,
    ) &&
    isValidTimestamp(place.checkedAt, now) &&
    Number.isFinite(place.lat) &&
    Math.abs(place.lat) <= 90 &&
    Number.isFinite(place.lng) &&
    Math.abs(place.lng) <= 180 &&
    (place.typicalDurationMins === undefined ||
      (Number.isFinite(place.typicalDurationMins) &&
        place.typicalDurationMins > 0 &&
        place.typicalDurationMins <= 1440)) &&
    (place.recommendedSlot === undefined ||
      ["morning", "afternoon", "evening"].includes(place.recommendedSlot))
  );
}

function isValidTimestamp(value: unknown, now: number): value is string {
  const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp <= now + MAX_FUTURE_SKEW_MS;
}
