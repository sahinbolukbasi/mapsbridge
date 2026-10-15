/** Only bounded travel preferences are retained; no identity or free-form personal data. */
export const preferenceChoices = {
  pace: ["Sakin", "Dengeli", "Yoğun"],
  budget: ["Ekonomik", "Orta", "Esnek"],
  travelStyle: ["cultural", "foodie", "adventure", "budget", "luxury", "balanced"],
  interests: ["tarih", "kultur", "lezzet", "doga", "manzara", "fotograf", "alisveris"],
} as const;
export interface TravelPreferences {
  pace?: string;
  budget?: string;
  travelStyle?: string;
  interests?: string[];
}
export function sanitizePreferences(value: unknown): TravelPreferences {
  const result: TravelPreferences = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  const input = value as Record<string, unknown>;
  for (const key of ["pace", "budget", "travelStyle"] as const) {
    if (
      typeof input[key] === "string" &&
      (preferenceChoices[key] as readonly string[]).includes(input[key])
    )
      result[key] = input[key];
  }
  if (
    Array.isArray(input.interests) &&
    input.interests.every(
      (v) =>
        typeof v === "string" && (preferenceChoices.interests as readonly string[]).includes(v),
    )
  )
    result.interests = [...new Set(input.interests)].slice(0, 7);
  return result;
}
