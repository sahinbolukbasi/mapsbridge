export interface UserMemoryEntry {
  id: string;
  userId: string;
  key: string;
  value: unknown;
  source: 'stated' | 'confirmed' | 'derived';
  confidence: number;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserMemoryProfile {
  cuisinePreferences: string[];
  dietaryRestrictions: string[];
  walkingTolerance?: 'low' | 'medium' | 'high';
  crowdPreference?: 'avoid' | 'neutral' | 'enjoy';
  morningPreference?: 'early_bird' | 'late_riser' | 'flexible';
  budgetHabit?: 'budget' | 'mid' | 'luxury';
  lodgingHabit?: string;
  transportPreference?: 'public_transit' | 'car' | 'walking' | 'mixed';
  interests: string[];
  visitedCountries: string[];
  languages: string[];
  travelCompanions?: string;
}

/**
 * Determines whether a memory entry should be promoted to the user's persistent profile.
 * Only promotes after repeated mention or an explicit "remember this" request.
 */
export function shouldPromoteToProfile(
  entry: UserMemoryEntry,
  occurrenceCount: number,
  explicitRemember: boolean,
): boolean {
  if (explicitRemember) return true;
  if (entry.source === 'stated' && occurrenceCount >= 2) return true;
  if (entry.source === 'derived' && occurrenceCount >= 3) return true;
  return false;
}

/**
 * Detects whether the user's message contains an explicit "remember this" request
 * in Turkish or English.
 */
export function isExplicitRememberRequest(text: string): boolean {
  return /bunu hatırla|hatırla bunu|her zaman|her seyahat|kalıcı|remember this|always/iu.test(text);
}

/**
 * Checks whether a key/value pair represents sensitive personal data
 * that requires explicit user consent before storage.
 */
export function isSensitiveData(key: string, value: unknown): boolean {
  const sensitivePatterns = /sağlık|engellilik|disabled|health|din|religion|helal|halal|kosher|allerg/iu;
  return sensitivePatterns.test(key) || (typeof value === 'string' && sensitivePatterns.test(value));
}
