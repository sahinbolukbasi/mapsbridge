/**
 * Focus Management (§12.1)
 *
 * Every conversation turn has exactly one active focus:
 *   { scope, refId, sinceT urn, updatedAt }
 *
 * Focus drives:
 *  - Anaphora resolution ("burası / orası / onu" → entity name)
 *  - Chip generation (§12.2)
 *  - Sub-agent routing (place-specific queries go to KB with refId)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FocusScope = 'trip' | 'day' | 'place' | 'topic';

export interface ThreadFocus {
  scope: FocusScope;
  /** place_id, day index (as string), or topic key */
  refId?: string;
  /** Human-readable label for this focus ("Tazza d'Oro", "2. Gün") */
  label?: string;
  /** Conversation turn number when focus was set */
  sinceTurn: number;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Default focus
// ---------------------------------------------------------------------------

export function defaultFocus(turn = 0): ThreadFocus {
  return {
    scope: 'trip',
    sinceTurn: turn,
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Anaphora patterns
// ---------------------------------------------------------------------------

// Note: Turkish characters (ı, ş, etc.) are not ASCII \w, so \b doesn't work reliably.
// Use lookahead/lookbehind with (?<!\S) / (?!\S) (preceded/followed by whitespace or start/end).
const ANAPHORA_PATTERNS = [
  // Turkish place pronouns
  /(?:^|(?<=\s))(burası|buraya|burada|orası|oraya|orada|şurası|şuraya|şurada)(?=\s|$|[,?.!])/iu,
  /(?:^|(?<=\s))(onu|bunu|şunu|onda|bunda|şunda|onun|bunun|şunun)(?=\s|$|[,?.!])/iu,
  /(?:^|(?<=\s))(o yer|bu yer|şu yer|o mekan|bu mekan)(?=\s|$|[,?.!])/iu,
  // English
  /\bthis place\b|\bthat place\b|\bhere\b|\bthere\b/iu,
];

/** Returns true if the message contains an anaphoric reference. */
export function hasAnaphora(message: string): boolean {
  return ANAPHORA_PATTERNS.some((p) => p.test(message));
}

/**
 * Resolve anaphoric references in a message using current focus.
 * Returns the message with pronouns replaced by the focus label.
 * If no anaphora or no label, returns original message unchanged.
 */
export function resolveAnaphora(message: string, focus: ThreadFocus): string {
  if (!focus.label || !hasAnaphora(message)) return message;

  let resolved = message;
  for (const pattern of ANAPHORA_PATTERNS) {
    resolved = resolved.replace(pattern, focus.label);
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Focus extraction patterns
// ---------------------------------------------------------------------------

const DAY_PATTERN = /(\d+)\.\s*gün|(\d+)\.\s*day|gün\s*(\d+)|day\s*(\d+)/iu;

// Detect if the user is asking about a specific named place (min 3 chars)
// We rely on the caller passing known place names — this just checks if any pattern
// signals place focus (leaving name extraction to the caller with the entity list).
const PLACE_FOCUS_SIGNALS = [
  /bu\s+(?:restoran|kafe|müze|mekan|yer|otel)/iu,
  /(?:restoran|kafe|müze|mekan|yer|otel)\s+hakkında/iu,
  /\b(?:açık mı|saat kaç|rezervasyon|nasıl|kapalı mı|menu|menü)\b/iu,
];

export function signalsPlaceFocus(message: string): boolean {
  return PLACE_FOCUS_SIGNALS.some((p) => p.test(message));
}

// ---------------------------------------------------------------------------
// Focus update
// ---------------------------------------------------------------------------

interface FocusUpdateInput {
  message: string;
  /** Ordered list of place names/ids referenced in the last assistant response */
  mentionedPlaces?: Array<{ id: string; name: string }>;
  /** If the user clicked a pin or a day card on the map, pass it here */
  mapEvent?: { type: 'place' | 'day'; refId: string; label: string };
  previousFocus: ThreadFocus;
  turn: number;
}

/**
 * Compute the new focus for this turn.
 *
 * Priority (highest first):
 *  1. Explicit map event (pin click, day click)
 *  2. User message references a known place by name
 *  3. User message references a day ("3. gün")
 *  4. Anaphora resolved against previous focus — keep previous focus
 *  5. No signal — keep previous focus
 */
export function updateFocus(input: FocusUpdateInput): ThreadFocus {
  const { message, mentionedPlaces = [], mapEvent, previousFocus, turn } = input;
  const now = new Date().toISOString();

  // 1. Map event overrides everything
  if (mapEvent) {
    return {
      scope: mapEvent.type === 'place' ? 'place' : 'day',
      refId: mapEvent.refId,
      label: mapEvent.label,
      sinceTurn: turn,
      updatedAt: now,
    };
  }

  // 2. Message references a known place
  for (const place of mentionedPlaces) {
    const nameEscaped = place.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(nameEscaped, 'iu').test(message)) {
      return {
        scope: 'place',
        refId: place.id,
        label: place.name,
        sinceTurn: turn,
        updatedAt: now,
      };
    }
  }

  // 3. Day reference
  const dayMatch = DAY_PATTERN.exec(message);
  if (dayMatch) {
    const dayNum = dayMatch[1] ?? dayMatch[2] ?? dayMatch[3] ?? dayMatch[4];
    return {
      scope: 'day',
      refId: String(dayNum),
      label: `${dayNum}. Gün`,
      sinceTurn: turn,
      updatedAt: now,
    };
  }

  // 4. Anaphora or place-focus signal — keep previous focus (it IS the referent)
  if (hasAnaphora(message) || signalsPlaceFocus(message)) {
    return { ...previousFocus, updatedAt: now };
  }

  // 5. Keep previous focus unchanged
  return previousFocus;
}

// ---------------------------------------------------------------------------
// Focus to prompt string
// ---------------------------------------------------------------------------

/** Short string injected into the system prompt so the model knows current focus. */
export function focusToPromptSnippet(focus: ThreadFocus): string {
  switch (focus.scope) {
    case 'place':
      return `Aktif odak: ${focus.label ?? focus.refId ?? 'bilinmeyen mekan'} (mekan)`;
    case 'day':
      return `Aktif odak: ${focus.label ?? `Gün ${focus.refId}`} (gün planı)`;
    case 'topic':
      return `Aktif odak: ${focus.label ?? focus.refId ?? 'konu'} (konu)`;
    case 'trip':
    default:
      return 'Aktif odak: genel seyahat planı';
  }
}
