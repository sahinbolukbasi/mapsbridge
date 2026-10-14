/**
 * Itinerary Action Tools (§12.5)
 *
 * "Rotaya ekle" must ALWAYS result in a DB mutation.
 * These are typed tool calls — not free text from the model.
 *
 * Rules:
 *  - Every action is a transaction: tool call → DB write → UI event
 *  - Model saying "ekledim" without a mutation is a consistency error
 *  - Partial add: only selected items are added (§8.2)
 *  - Every action is undoable (undo stack via state events)
 *  - Ambiguous day → default to next available day, show "X. güne ekledim — değiştir"
 */

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

export type ItineraryActionType =
  | 'itinerary.add'
  | 'itinerary.remove'
  | 'itinerary.reorder'
  | 'itinerary.move_to_day'
  | 'itinerary.pin'
  | 'itinerary.unpin';

export interface ItineraryAddPayload {
  placeId: string;
  placeName: string;
  /** Target day (1-indexed). If omitted, assigned to next available day. */
  dayIndex?: number;
  /** Suggested start time in HH:MM format */
  startTime?: string;
  /** Estimated duration in minutes */
  durationMin?: number;
  /** Source: chat message or map interaction */
  addedVia: 'chat' | 'map';
}

export interface ItineraryRemovePayload {
  placeId: string;
  placeName: string;
  dayIndex?: number;
  reason?: string;
}

export interface ItineraryReorderPayload {
  dayIndex: number;
  orderedPlaceIds: string[];
}

export interface ItineraryMoveToDayPayload {
  placeId: string;
  placeName: string;
  fromDay: number;
  toDay: number;
}

export interface ItineraryPinPayload {
  placeId: string;
  placeName: string;
  pinned: boolean;
}

export type ItineraryActionPayload =
  | ({ type: 'itinerary.add' } & ItineraryAddPayload)
  | ({ type: 'itinerary.remove' } & ItineraryRemovePayload)
  | ({ type: 'itinerary.reorder' } & ItineraryReorderPayload)
  | ({ type: 'itinerary.move_to_day' } & ItineraryMoveToDayPayload)
  | ({ type: 'itinerary.pin' } & ItineraryPinPayload)
  | ({ type: 'itinerary.unpin' } & ItineraryPinPayload);

// ---------------------------------------------------------------------------
// Action result
// ---------------------------------------------------------------------------

export interface ItineraryActionResult {
  success: boolean;
  actionType: ItineraryActionType;
  /** Human-readable confirmation shown to user */
  confirmationMessage: string;
  /** Can be undone */
  undoable: boolean;
  /** Mutation actually persisted to DB */
  mutationApplied: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Consistency guard (§12.5.3)
// ---------------------------------------------------------------------------

/**
 * Checks whether the model's text claims an action was performed.
 * If so but `mutationApplied` is false, the response must not be delivered.
 */
export function detectMutationClaim(assistantText: string): boolean {
  const MUTATION_CLAIM_PATTERNS = [
    /rotay[ae]\s+ekledim/iu,
    /plana\s+ekledim/iu,
    /ekledim\s+(?:bunu|burayi|onu)/iu,
    /güne\s+ekledim/iu,
    /kaldırdım/iu,
    /çıkardım/iu,
    /sıraladım/iu,
    /taşıdım/iu,
    /added\s+to\s+(?:the\s+)?(?:route|itinerary|plan)/iu,
    /removed\s+from\s+(?:the\s+)?(?:route|itinerary|plan)/iu,
  ];
  return MUTATION_CLAIM_PATTERNS.some((p) => p.test(assistantText));
}

/**
 * Validate that if the model claims a mutation occurred,
 * a mutation was actually applied. Returns an error string if inconsistent.
 */
export function assertMutationConsistency(
  assistantText: string,
  mutationApplied: boolean,
): string | null {
  if (detectMutationClaim(assistantText) && !mutationApplied) {
    return 'MUTATION_CLAIM_WITHOUT_DB_WRITE: Model claimed to add/remove an item but no DB mutation was applied.';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Confirmation messages
// ---------------------------------------------------------------------------

export function buildConfirmationMessage(action: ItineraryActionPayload): string {
  switch (action.type) {
    case 'itinerary.add': {
      const day = action.dayIndex ? `${action.dayIndex}. güne` : 'plana';
      return `${action.placeName} ${day} eklendi — değiştir`;
    }
    case 'itinerary.remove':
      return `${action.placeName} plandan çıkarıldı — geri al`;
    case 'itinerary.reorder':
      return `${action.dayIndex}. gün yeniden sıralandı — geri al`;
    case 'itinerary.move_to_day':
      return `${action.placeName} ${action.toDay}. güne taşındı — geri al`;
    case 'itinerary.pin':
      return `${action.placeName} sabitlendi (optimizasyondan etkilenmeyecek)`;
    case 'itinerary.unpin':
      return `${action.placeName} sabitleme kaldırıldı`;
  }
}

// ---------------------------------------------------------------------------
// Extract itinerary actions from model tool-call output
// ---------------------------------------------------------------------------

interface RawToolCall {
  name: string;
  input: Record<string, unknown>;
}

/**
 * Parse raw tool calls from the model's response into typed ItineraryActionPayload[].
 * Unknown tool calls are ignored.
 */
export function parseItineraryToolCalls(toolCalls: RawToolCall[]): ItineraryActionPayload[] {
  const actions: ItineraryActionPayload[] = [];

  for (const call of toolCalls) {
    switch (call.name) {
      case 'itinerary.add': {
        const input = call.input;
        if (typeof input.placeId === 'string' && typeof input.placeName === 'string') {
          actions.push({
            type: 'itinerary.add',
            placeId: input.placeId,
            placeName: input.placeName,
            dayIndex: typeof input.dayIndex === 'number' ? input.dayIndex : undefined,
            startTime: typeof input.startTime === 'string' ? input.startTime : undefined,
            durationMin: typeof input.durationMin === 'number' ? input.durationMin : undefined,
            addedVia: 'chat',
          });
        }
        break;
      }
      case 'itinerary.remove': {
        const input = call.input;
        if (typeof input.placeId === 'string' && typeof input.placeName === 'string') {
          actions.push({
            type: 'itinerary.remove',
            placeId: input.placeId,
            placeName: input.placeName,
            dayIndex: typeof input.dayIndex === 'number' ? input.dayIndex : undefined,
            reason: typeof input.reason === 'string' ? input.reason : undefined,
          });
        }
        break;
      }
      case 'itinerary.reorder': {
        const input = call.input;
        if (
          typeof input.dayIndex === 'number' &&
          Array.isArray(input.orderedPlaceIds) &&
          input.orderedPlaceIds.every((id: unknown) => typeof id === 'string')
        ) {
          actions.push({
            type: 'itinerary.reorder',
            dayIndex: input.dayIndex,
            orderedPlaceIds: input.orderedPlaceIds as string[],
          });
        }
        break;
      }
      case 'itinerary.move_to_day': {
        const input = call.input;
        if (
          typeof input.placeId === 'string' &&
          typeof input.placeName === 'string' &&
          typeof input.fromDay === 'number' &&
          typeof input.toDay === 'number'
        ) {
          actions.push({
            type: 'itinerary.move_to_day',
            placeId: input.placeId,
            placeName: input.placeName,
            fromDay: input.fromDay,
            toDay: input.toDay,
          });
        }
        break;
      }
      case 'itinerary.pin':
      case 'itinerary.unpin': {
        const input = call.input;
        if (typeof input.placeId === 'string' && typeof input.placeName === 'string') {
          actions.push({
            type: call.name as 'itinerary.pin' | 'itinerary.unpin',
            placeId: input.placeId,
            placeName: input.placeName,
            pinned: call.name === 'itinerary.pin',
          });
        }
        break;
      }
    }
  }

  return actions;
}

// ---------------------------------------------------------------------------
// JSON Schema for the model's tool definitions
// ---------------------------------------------------------------------------

export const ITINERARY_TOOL_SCHEMAS = [
  {
    name: 'itinerary.add',
    description: 'Bir mekanı seyahat planına ekle. Kullanıcı "rotaya ekle" veya "plana ekle" dediğinde ÇAĞRIlır. Kullanıcı hangi mekanı istediğini seçmeli — toplu ekleme yapma.',
    input_schema: {
      type: 'object',
      properties: {
        placeId: { type: 'string', description: 'Mekanın benzersiz ID\'si' },
        placeName: { type: 'string', description: 'Mekanın adı' },
        dayIndex: { type: 'number', description: 'Hedef gün (1\'den başlar). Belirsizse atla, sistem otomatik atar.' },
        startTime: { type: 'string', description: 'Başlangıç saati HH:MM formatında (opsiyonel)' },
        durationMin: { type: 'number', description: 'Tahmini ziyaret süresi dakika cinsinden' },
      },
      required: ['placeId', 'placeName'],
    },
  },
  {
    name: 'itinerary.remove',
    description: 'Bir mekanı plandan çıkar. Her çıkarma işlemi geri alınabilir.',
    input_schema: {
      type: 'object',
      properties: {
        placeId: { type: 'string' },
        placeName: { type: 'string' },
        dayIndex: { type: 'number', description: 'Hangi güne ait — bilinmiyorsa atla' },
        reason: { type: 'string', description: 'Çıkarma gerekçesi (opsiyonel)' },
      },
      required: ['placeId', 'placeName'],
    },
  },
  {
    name: 'itinerary.reorder',
    description: 'Bir günün mekanlarını yeniden sırala.',
    input_schema: {
      type: 'object',
      properties: {
        dayIndex: { type: 'number' },
        orderedPlaceIds: { type: 'array', items: { type: 'string' }, description: 'Yeni sırayla tüm place_id\'ler' },
      },
      required: ['dayIndex', 'orderedPlaceIds'],
    },
  },
  {
    name: 'itinerary.move_to_day',
    description: 'Bir mekanı başka bir güne taşı.',
    input_schema: {
      type: 'object',
      properties: {
        placeId: { type: 'string' },
        placeName: { type: 'string' },
        fromDay: { type: 'number' },
        toDay: { type: 'number' },
      },
      required: ['placeId', 'placeName', 'fromDay', 'toDay'],
    },
  },
  {
    name: 'itinerary.pin',
    description: 'Bir mekanı sabitle — optimizasyon bu mekanı yerinden oynamaz.',
    input_schema: {
      type: 'object',
      properties: {
        placeId: { type: 'string' },
        placeName: { type: 'string' },
      },
      required: ['placeId', 'placeName'],
    },
  },
  {
    name: 'itinerary.unpin',
    description: 'Bir mekanın sabitlemesini kaldır.',
    input_schema: {
      type: 'object',
      properties: {
        placeId: { type: 'string' },
        placeName: { type: 'string' },
      },
      required: ['placeId', 'placeName'],
    },
  },
] as const;
