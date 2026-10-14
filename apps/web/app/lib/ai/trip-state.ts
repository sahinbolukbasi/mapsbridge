/**
 * TripState + Slot Tracking + State Diff System
 *
 * Phase 1 of the AI architecture expansion.
 * Provides typed trip conversation state, slot tracking for guided questions,
 * state diffing, and backward-compatible conversion to/from TripProfile.
 */

import type {
  TripProfile,
  TripInterests,
  TripBudget,
  TravelerInfo,
  TripDates,
  TripNeeds,
} from './types';

// ---------------------------------------------------------------------------
// Core Interfaces
// ---------------------------------------------------------------------------

export interface TripState {
  destination?: string;
  dates?: {
    start?: string;
    end?: string;
    flexible?: boolean;
    description?: string;
  };
  durationDays?: number;
  travelers?: { adults?: number; children?: number; pets?: boolean };
  budget?: {
    level?: 'budget' | 'mid' | 'luxury' | 'unspecified';
    currency?: string;
    total?: number;
  };
  interests: {
    food?: string[];
    sports?: string[];
    culture?: string[];
    general?: string[];
  };
  constraints?: string[];
  pace?: 'relaxed' | 'moderate' | 'fast';
  lodgingType?: Array<'hotel' | 'hostel' | 'apartment' | 'boutique' | 'resort'>;
  needs?: { flights?: boolean; carRental?: boolean; localTransit?: boolean };
  decisions: TripDecision[];
  rejections: TripRejection[];
}

export interface TripDecision {
  field: string;
  value: unknown;
  reason?: string;
  decidedAt: string;
  superseded?: boolean;
  supersededAt?: string;
}

export interface TripRejection {
  type: 'place' | 'suggestion' | 'option';
  name: string;
  reason?: string;
  rejectedAt: string;
}

// ---------------------------------------------------------------------------
// Slot Tracking
// ---------------------------------------------------------------------------

export interface AnsweredSlot {
  key: string;
  value: unknown;
  askedAt?: string;
  answeredAt: string;
  source: 'stated' | 'confirmed' | 'derived' | 'assumed';
}

export const SLOT_KEYS = [
  'destination',
  'durationDays',
  'dates',
  'travelers',
  'budget',
  'pace',
  'interests',
  'lodgingType',
  'needs',
  'constraints',
] as const;

export type SlotKey = (typeof SLOT_KEYS)[number];

// ---------------------------------------------------------------------------
// State Events
// ---------------------------------------------------------------------------

export interface TripStateEvent {
  id: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEmptyState(): TripState {
  return {
    interests: {},
    decisions: [],
    rejections: [],
  };
}

/** Deep-equal comparison that handles primitives, arrays, and plain objects. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => deepEqual(aObj[k], bObj[k]));
  }

  return false;
}

/** Shallow clone for plain objects / arrays at the top level of a field. */
function cloneValue<T>(v: T): T {
  if (v == null) return v;
  if (Array.isArray(v)) return [...v] as unknown as T;
  if (typeof v === 'object') return { ...v } as T;
  return v;
}

/** Check whether a slot value is meaningfully filled. */
function isSlotFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return true;
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.values(obj).some((v) => isSlotFilled(v));
  }
  return false;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// 3. State diff
// ---------------------------------------------------------------------------

const DIFFABLE_FIELDS: string[] = [
  'destination',
  'dates',
  'durationDays',
  'travelers',
  'budget',
  'interests',
  'constraints',
  'pace',
  'lodgingType',
  'needs',
];

export function computeStateDiff(
  previous: TripState,
  current: TripState,
): TripStateEvent[] {
  const events: TripStateEvent[] = [];
  const now = nowISO();

  for (const field of DIFFABLE_FIELDS) {
    const oldVal = (previous as unknown as Record<string, unknown>)[field];
    const newVal = (current as unknown as Record<string, unknown>)[field];

    if (!deepEqual(oldVal, newVal)) {
      events.push({
        id: crypto.randomUUID(),
        field,
        oldValue: cloneValue(oldVal) ?? null,
        newValue: cloneValue(newVal) ?? null,
        createdAt: now,
      });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// 4. Slot-aware question generation
// ---------------------------------------------------------------------------

interface QuickOption {
  label: string;
  prompt: string;
  value: unknown;
}

interface NextQuestion {
  question: string;
  slotKey: SlotKey;
  quickOptions: QuickOption[];
}

/** Ordered priority for unanswered-slot questions. */
const SLOT_PRIORITY: SlotKey[] = [
  'destination',
  'durationDays',
  'interests',
  'travelers',
  'budget',
  'pace',
];

const QUESTION_MAP: Record<
  string,
  { question: string; quickOptions: QuickOption[] }
> = {
  destination: {
    question: 'Nereye gitmek istiyorsun?',
    quickOptions: [
      { label: 'Paris', prompt: "Paris'e gitmek istiyorum", value: 'Paris' },
      { label: 'Roma', prompt: "Roma'ya gitmek istiyorum", value: 'Roma' },
      { label: 'Tokyo', prompt: "Tokyo'ya gitmek istiyorum", value: 'Tokyo' },
      {
        label: 'Barselona',
        prompt: "Barselona'ya gitmek istiyorum",
        value: 'Barselona',
      },
    ],
  },
  durationDays: {
    question: 'Tatil kac gun surecek?',
    quickOptions: [
      { label: '3 gun', prompt: '3 gunluk bir tatil planliyorum', value: 3 },
      { label: '5 gun', prompt: '5 gunluk bir tatil planliyorum', value: 5 },
      { label: '7 gun', prompt: '1 haftalik bir tatil planliyorum', value: 7 },
      {
        label: '10+ gun',
        prompt: '10 gunluk bir tatil planliyorum',
        value: 10,
      },
    ],
  },
  interests: {
    question: 'Ne tur aktiviteler ilgini ceker?',
    quickOptions: [
      {
        label: 'Yemek & Kafeler',
        prompt: 'Yemek kulturunu ve kafeleri kesfetmek istiyorum',
        value: { food: ['local cuisine', 'cafes'] },
      },
      {
        label: 'Tarih & Kultur',
        prompt: 'Tarihi ve kulturel yerleri gezmek istiyorum',
        value: { culture: ['museums', 'historical sites'] },
      },
      {
        label: 'Doga & Spor',
        prompt: 'Doga yuruuyusleri ve spor aktiviteleri istiyorum',
        value: { sports: ['hiking', 'outdoor activities'] },
      },
      {
        label: 'Her seyden biraz',
        prompt: 'Yemek, kultur ve doga hepsinden biraz olsun',
        value: {
          food: ['local cuisine'],
          culture: ['museums'],
          sports: ['walking tours'],
          general: ['sightseeing'],
        },
      },
    ],
  },
  travelers: {
    question: 'Kac kisi seyahat edeceksiniz?',
    quickOptions: [
      {
        label: 'Tek basima',
        prompt: 'Tek basima seyahat edecegim',
        value: { adults: 1 },
      },
      {
        label: 'Cift',
        prompt: '2 kisi olarak gidecegiz',
        value: { adults: 2 },
      },
      {
        label: 'Aile (cocuklu)',
        prompt: '2 yetiskin ve 1 cocuk olarak gidecegiz',
        value: { adults: 2, children: 1 },
      },
      {
        label: 'Grup (4+)',
        prompt: '4 kisilik bir grupla gidecegiz',
        value: { adults: 4 },
      },
    ],
  },
  budget: {
    question: 'Butce tercihin ne yonde?',
    quickOptions: [
      {
        label: 'Ekonomik',
        prompt: 'Ekonomik bir butce planliyorum',
        value: { level: 'budget' as const },
      },
      {
        label: 'Orta',
        prompt: 'Orta butceli bir tatil istiyorum',
        value: { level: 'mid' as const },
      },
      {
        label: 'Luks',
        prompt: 'Luks bir tatil planliyorum',
        value: { level: 'luxury' as const },
      },
      {
        label: 'Farketmez',
        prompt: 'Butce konusunda esnek davranirim',
        value: { level: 'unspecified' as const },
      },
    ],
  },
  pace: {
    question: 'Nasil bir tempo istiyorsun?',
    quickOptions: [
      {
        label: 'Rahat',
        prompt: 'Rahat ve yavas tempolu bir tatil istiyorum',
        value: 'relaxed' as const,
      },
      {
        label: 'Dengeli',
        prompt: 'Ne cok yogun ne cok yavas, dengeli olsun',
        value: 'moderate' as const,
      },
      {
        label: 'Yogun',
        prompt: 'Mumkun oldugunca cok sey gormek istiyorum',
        value: 'fast' as const,
      },
    ],
  },
};

export function getNextQuestion(
  state: TripState,
  answeredSlots: AnsweredSlot[],
): NextQuestion | null {
  const answeredKeys = new Set(answeredSlots.map((s) => s.key));

  for (const slotKey of SLOT_PRIORITY) {
    // Skip if already answered
    if (answeredKeys.has(slotKey)) continue;

    // Skip if the state already has a filled value for this slot
    const stateValue = (state as unknown as Record<string, unknown>)[slotKey];
    if (isSlotFilled(stateValue)) continue;

    const template = QUESTION_MAP[slotKey];
    if (!template) continue;

    return {
      question: template.question,
      slotKey,
      quickOptions: template.quickOptions.slice(0, 4),
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// 5. TripProfile <-> TripState converters
// ---------------------------------------------------------------------------

export function tripProfileToState(profile: TripProfile): TripState {
  const state: TripState = createEmptyState();

  if (profile.destination) state.destination = profile.destination;

  if (profile.dates) {
    state.dates = {
      start: profile.dates.start,
      end: profile.dates.end,
      flexible: profile.dates.flexible,
    };
  }

  if (profile.duration_days != null) state.durationDays = profile.duration_days;

  if (profile.travelers) {
    state.travelers = {
      adults: profile.travelers.adults,
      children: profile.travelers.children,
      pets: profile.travelers.pets,
    };
  }

  if (profile.budget) {
    state.budget = {
      level: profile.budget.level,
      currency: profile.budget.currency,
      total: profile.budget.total,
    };
  }

  if (profile.interests) {
    state.interests = {
      food: profile.interests.food ? [...profile.interests.food] : undefined,
      sports: profile.interests.sports
        ? [...profile.interests.sports]
        : undefined,
      culture: profile.interests.culture
        ? [...profile.interests.culture]
        : undefined,
      general: profile.interests.general
        ? [...profile.interests.general]
        : undefined,
    };
  }

  if (profile.constraints) state.constraints = [...profile.constraints];

  if (profile.pace && profile.pace !== 'unspecified') {
    state.pace = profile.pace;
  }

  if (profile.lodging_type) state.lodgingType = [...profile.lodging_type];

  if (profile.needs) {
    state.needs = {
      flights: profile.needs.flights,
      carRental: profile.needs.car_rental,
      localTransit: profile.needs.local_transit,
    };
  }

  return state;
}

export function tripStateToProfile(state: TripState): TripProfile {
  // Calculate completeness based on filled slots
  let filled = 0;
  for (const key of SLOT_KEYS) {
    const value = (state as unknown as Record<string, unknown>)[key];
    if (isSlotFilled(value)) filled++;
  }
  const completeness = Math.round((filled / SLOT_KEYS.length) * 100);

  const profile: TripProfile = {
    interests: {
      food: state.interests.food ? [...state.interests.food] : undefined,
      sports: state.interests.sports ? [...state.interests.sports] : undefined,
      culture: state.interests.culture
        ? [...state.interests.culture]
        : undefined,
      general: state.interests.general
        ? [...state.interests.general]
        : undefined,
    },
    completeness,
  };

  if (state.destination) profile.destination = state.destination;

  if (state.dates) {
    profile.dates = {
      start: state.dates.start,
      end: state.dates.end,
      flexible: state.dates.flexible,
    };
  }

  if (state.durationDays != null) profile.duration_days = state.durationDays;

  if (state.travelers) {
    profile.travelers = {
      adults: state.travelers.adults,
      children: state.travelers.children,
      pets: state.travelers.pets,
    };
  }

  if (state.budget) {
    profile.budget = {
      level: state.budget.level,
      currency: state.budget.currency,
      total: state.budget.total,
    };
  }

  if (state.constraints) profile.constraints = [...state.constraints];

  if (state.pace) {
    profile.pace = state.pace;
  }

  if (state.lodgingType) profile.lodging_type = [...state.lodgingType];

  if (state.needs) {
    profile.needs = {
      flights: state.needs.flights,
      car_rental: state.needs.carRental,
      local_transit: state.needs.localTransit,
    };
  }

  return profile;
}

// ---------------------------------------------------------------------------
// 6. Merge function with superseding
// ---------------------------------------------------------------------------

export function mergeTripState(
  previous: TripState,
  updates: Partial<TripState>,
  userText: string,
): {
  state: TripState;
  events: TripStateEvent[];
  newSlots: AnsweredSlot[];
} {
  const now = nowISO();
  const newSlots: AnsweredSlot[] = [];

  // Deep-clone previous state
  const state: TripState = {
    ...previous,
    interests: { ...previous.interests },
    decisions: previous.decisions.map((d) => ({ ...d })),
    rejections: previous.rejections.map((r) => ({ ...r })),
  };

  if (previous.dates) state.dates = { ...previous.dates };
  if (previous.travelers) state.travelers = { ...previous.travelers };
  if (previous.budget) state.budget = { ...previous.budget };
  if (previous.needs) state.needs = { ...previous.needs };
  if (previous.constraints) state.constraints = [...previous.constraints];
  if (previous.lodgingType) state.lodgingType = [...previous.lodgingType];

  // Apply updates field by field
  for (const field of DIFFABLE_FIELDS) {
    if (!(field in updates)) continue;

    const updateVal = (updates as unknown as Record<string, unknown>)[field];
    const prevVal = (previous as unknown as Record<string, unknown>)[field];

    if (deepEqual(prevVal, updateVal)) continue;

    // Mark previous decision as superseded
    if (isSlotFilled(prevVal)) {
      for (const decision of state.decisions) {
        if (decision.field === field && !decision.superseded) {
          decision.superseded = true;
          decision.supersededAt = now;
        }
      }
    }

    // Apply the update
    if (field === 'interests' && updateVal && typeof updateVal === 'object') {
      // Merge interests rather than replacing
      const updInterests = updateVal as TripState['interests'];
      if (updInterests.food)
        state.interests.food = [...(updInterests.food ?? [])];
      if (updInterests.sports)
        state.interests.sports = [...(updInterests.sports ?? [])];
      if (updInterests.culture)
        state.interests.culture = [...(updInterests.culture ?? [])];
      if (updInterests.general)
        state.interests.general = [...(updInterests.general ?? [])];
    } else {
      (state as unknown as Record<string, unknown>)[field] = cloneValue(updateVal);
    }

    // Record new decision
    state.decisions.push({
      field,
      value: cloneValue(updateVal),
      reason: userText,
      decidedAt: now,
    });

    // Record answered slot
    if (SLOT_KEYS.includes(field as SlotKey)) {
      newSlots.push({
        key: field,
        value: cloneValue(updateVal),
        answeredAt: now,
        source: 'stated',
      });
    }
  }

  // Handle decisions and rejections arrays (append, not diff)
  if (updates.decisions) {
    for (const d of updates.decisions) {
      if (!state.decisions.some((ed) => ed.field === d.field && ed.decidedAt === d.decidedAt)) {
        state.decisions.push({ ...d });
      }
    }
  }
  if (updates.rejections) {
    for (const r of updates.rejections) {
      if (!state.rejections.some((er) => er.name === r.name && er.rejectedAt === r.rejectedAt)) {
        state.rejections.push({ ...r });
      }
    }
  }

  const events = computeStateDiff(previous, state);

  return { state, events, newSlots };
}

// ---------------------------------------------------------------------------
// 7. State-to-context-prompt
// ---------------------------------------------------------------------------

export function stateToContextPrompt(
  state: TripState,
  answeredSlots: AnsweredSlot[],
): string {
  const lines: string[] = [];
  lines.push('=== TRIP STATE ===');

  if (state.destination) {
    lines.push(`Destination: ${state.destination}`);
  }

  if (state.durationDays != null) {
    lines.push(`Duration: ${state.durationDays} days`);
  }

  if (state.dates) {
    const parts: string[] = [];
    if (state.dates.start) parts.push(`from ${state.dates.start}`);
    if (state.dates.end) parts.push(`to ${state.dates.end}`);
    if (state.dates.flexible) parts.push('(flexible)');
    if (state.dates.description) parts.push(state.dates.description);
    if (parts.length > 0) lines.push(`Dates: ${parts.join(' ')}`);
  }

  if (state.travelers) {
    const tp: string[] = [];
    if (state.travelers.adults) tp.push(`${state.travelers.adults} adults`);
    if (state.travelers.children)
      tp.push(`${state.travelers.children} children`);
    if (state.travelers.pets) tp.push('with pets');
    if (tp.length > 0) lines.push(`Travelers: ${tp.join(', ')}`);
  }

  if (state.budget) {
    const bp: string[] = [];
    if (state.budget.level) bp.push(state.budget.level);
    if (state.budget.total != null && state.budget.currency) {
      bp.push(`${state.budget.total} ${state.budget.currency}`);
    }
    if (bp.length > 0) lines.push(`Budget: ${bp.join(', ')}`);
  }

  // Interests
  const interestParts: string[] = [];
  if (state.interests.food?.length)
    interestParts.push(`food: ${state.interests.food.join(', ')}`);
  if (state.interests.sports?.length)
    interestParts.push(`sports: ${state.interests.sports.join(', ')}`);
  if (state.interests.culture?.length)
    interestParts.push(`culture: ${state.interests.culture.join(', ')}`);
  if (state.interests.general?.length)
    interestParts.push(`general: ${state.interests.general.join(', ')}`);
  if (interestParts.length > 0)
    lines.push(`Interests: ${interestParts.join('; ')}`);

  if (state.pace) {
    lines.push(`Pace: ${state.pace}`);
  }

  if (state.lodgingType?.length) {
    lines.push(`Lodging: ${state.lodgingType.join(', ')}`);
  }

  if (state.needs) {
    const np: string[] = [];
    if (state.needs.flights) np.push('flights');
    if (state.needs.carRental) np.push('car rental');
    if (state.needs.localTransit) np.push('local transit');
    if (np.length > 0) lines.push(`Needs: ${np.join(', ')}`);
  }

  if (state.constraints?.length) {
    lines.push(`Constraints: ${state.constraints.join('; ')}`);
  }

  // Active rejections
  if (state.rejections.length > 0) {
    const rejList = state.rejections
      .map(
        (r) =>
          `${r.name} (${r.type}${r.reason ? ': ' + r.reason : ''})`,
      )
      .join('; ');
    lines.push(`Rejected: ${rejList}`);
  }

  // Unanswered slots
  const answeredKeys = new Set(answeredSlots.map((s) => s.key));
  const unanswered = SLOT_KEYS.filter((k) => {
    if (answeredKeys.has(k)) return false;
    const val = (state as unknown as Record<string, unknown>)[k];
    return !isSlotFilled(val);
  });
  if (unanswered.length > 0) {
    lines.push(`Unanswered: ${unanswered.join(', ')}`);
  }

  lines.push('=== END TRIP STATE ===');
  return lines.join('\n');
}
