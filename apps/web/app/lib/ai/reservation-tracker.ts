/**
 * §11.2 Reservation Status Tracker
 * Pure utility functions — no AI / Bedrock calls.
 */

export type ReservationStatus =
  | 'not_required'
  | 'recommended'
  | 'required'
  | 'confirmed'
  | 'not_booked';

export interface ReservationItem {
  placeId: string;
  placeName: string;
  dayIndex?: number;         // 0-based day in the trip
  status: ReservationStatus;
  bookingUrl?: string;
  confirmationCode?: string;
  cancellationDeadline?: string;  // ISO date
  notes?: string;
}

export interface ReservationChecklist {
  items: ReservationItem[];
  urgentCount: number;  // required | not_booked with visit in < 3 days from today
  missingCount: number; // required + not yet confirmed
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const URGENT_DAY_THRESHOLD = 3;

function needsBooking(status: ReservationStatus): boolean {
  return status === 'required' || status === 'not_booked';
}

// ---------------------------------------------------------------------------
// Build checklist
// ---------------------------------------------------------------------------

/**
 * Build a ReservationChecklist from raw items.
 * Pass tripStartDate (ISO "YYYY-MM-DD") to enable urgency date calculations.
 */
export function buildReservationChecklist(
  items: ReservationItem[],
  tripStartDate?: string,
): ReservationChecklist {
  let urgentCount = 0;
  let missingCount = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const item of items) {
    // missingCount: required but not yet confirmed
    if (item.status === 'required') {
      missingCount++;
    }

    // urgentCount: needs booking AND visit is within URGENT_DAY_THRESHOLD days
    if (needsBooking(item.status)) {
      if (tripStartDate !== undefined && item.dayIndex !== undefined) {
        const tripStart = new Date(tripStartDate);
        tripStart.setHours(0, 0, 0, 0);
        const visitDate = new Date(tripStart);
        visitDate.setDate(visitDate.getDate() + item.dayIndex);
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysUntilVisit = Math.ceil((visitDate.getTime() - today.getTime()) / msPerDay);
        if (daysUntilVisit < URGENT_DAY_THRESHOLD) {
          urgentCount++;
        }
      }
    }
  }

  return { items, urgentCount, missingCount };
}

// ---------------------------------------------------------------------------
// Immutable updates
// ---------------------------------------------------------------------------

/**
 * Mark a reservation as confirmed with the given confirmation code.
 * Adjusts urgentCount and missingCount accordingly (immutable).
 */
export function markReservationConfirmed(
  checklist: ReservationChecklist,
  placeId: string,
  code: string,
): ReservationChecklist {
  const target = checklist.items.find((i) => i.placeId === placeId);
  if (!target) return checklist;

  const wasUrgent = needsBooking(target.status);
  const wasMissing = target.status === 'required';

  const updatedItems = checklist.items.map((item) =>
    item.placeId === placeId
      ? { ...item, status: 'confirmed' as ReservationStatus, confirmationCode: code }
      : item,
  );

  return {
    items: updatedItems,
    urgentCount: Math.max(0, checklist.urgentCount - (wasUrgent ? 1 : 0)),
    missingCount: Math.max(0, checklist.missingCount - (wasMissing ? 1 : 0)),
  };
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Returns items that still need booking and are urgent given how many days
 * remain until the trip starts.
 *
 * When daysUntilTrip ≤ URGENT_DAY_THRESHOLD (3): all unconfirmed required /
 * not_booked items are returned.
 * Otherwise: only items whose dayIndex falls within the first
 * URGENT_DAY_THRESHOLD days of the trip.
 */
export function getUrgentReservations(
  checklist: ReservationChecklist,
  daysUntilTrip: number,
): ReservationItem[] {
  return checklist.items.filter((item) => {
    if (!needsBooking(item.status)) return false;

    if (daysUntilTrip <= URGENT_DAY_THRESHOLD) {
      // Trip is imminent — everything unconfirmed is urgent
      return true;
    }

    // Trip is further away — only flag early-day items
    if (item.dayIndex !== undefined) {
      return item.dayIndex < URGENT_DAY_THRESHOLD;
    }

    return false;
  });
}

// ---------------------------------------------------------------------------
// AI prompt helper
// ---------------------------------------------------------------------------

/** Render checklist as a Turkish text snippet for AI context injection. */
export function reservationChecklistToPromptSnippet(checklist: ReservationChecklist): string {
  const lines: string[] = [
    'Rezervasyon Durumu:',
    `- Eksik rezervasyon: ${checklist.missingCount}`,
    `- Acil rezervasyon: ${checklist.urgentCount}`,
  ];

  const pending = checklist.items.filter((i) => needsBooking(i.status));
  if (pending.length > 0) {
    lines.push('Rezervasyon Gerekli:');
    for (const item of pending) {
      const day = item.dayIndex !== undefined ? ` (Gün ${item.dayIndex + 1})` : '';
      const url = item.bookingUrl ? ` → ${item.bookingUrl}` : '';
      const statusLabel =
        item.status === 'required' ? 'zorunlu' : 'henüz alınmadı';
      lines.push(`  • ${item.placeName}${day} — ${statusLabel}${url}`);
      if (item.notes) {
        lines.push(`    Not: ${item.notes}`);
      }
    }
  }

  const confirmed = checklist.items.filter((i) => i.status === 'confirmed');
  if (confirmed.length > 0) {
    lines.push('Onaylananlar:');
    for (const item of confirmed) {
      const code = item.confirmationCode ? ` [${item.confirmationCode}]` : '';
      lines.push(`  ✓ ${item.placeName}${code}`);
    }
  }

  const notRequired = checklist.items.filter((i) => i.status === 'not_required');
  if (notRequired.length > 0) {
    lines.push(`Rezervasyon Gerektirmeyen: ${notRequired.map((i) => i.placeName).join(', ')}`);
  }

  return lines.join('\n');
}
