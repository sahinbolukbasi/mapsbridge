import { nanoid } from "nanoid";
import type {
  Trip,
  TripMutation,
  TripMutationEvent,
  TripStop,
  TripPhase,
} from "./domain";
import { isValidPlaceRef } from "./domain";

/**
 * Pure reducer — applies a single TripMutation to a Trip and returns a new Trip.
 * Does NOT call the DB; callers persist the result.
 * Throws on invalid mutations so the assistant gets an error tool result, not a silent bad plan.
 */
export function applyMutation(trip: Trip, mut: TripMutation): Trip {
  const base: Trip = {
    ...trip,
    metadata: {
      ...trip.metadata,
      updatedAt: new Date().toISOString(),
      version: trip.metadata.version + 1,
    },
  };

  switch (mut.type) {
    case "addStop": {
      const { placeRef, day, insertAfter } = mut.payload;
      if (!isValidPlaceRef(placeRef)) {
        const anyRef = placeRef as Partial<{ id: string }>;
        throw new Error(`addStop: placeRef missing required fields or source prefix. id=${anyRef?.id}`);
      }
      if (day < 1 || day > base.duration.days) {
        throw new Error(`addStop: day ${day} out of range 1..${base.duration.days}`);
      }
      const newStop: TripStop = {
        id: nanoid(10),
        placeRef,
        day,
        order: 0, // scheduler will reorder
        duration: { p50Minutes: categoryDefaultDuration(placeRef.id), source: "category_default" },
        why: "",
        confidence: placeRef.confidence,
      };
      const days = base.days.map(d => {
        if (d.day !== day) return d;
        const stops = [...d.stops];
        const insertIdx = insertAfter
          ? stops.findIndex(s => s.id === insertAfter) + 1
          : stops.length;
        stops.splice(insertIdx, 0, newStop);
        return { ...d, stops: reorder(stops) };
      });
      return { ...base, days };
    }

    case "removeStop": {
      const { stopId } = mut.payload;
      const days = base.days.map(d => ({
        ...d,
        stops: reorder(d.stops.filter(s => s.id !== stopId)),
      }));
      return { ...base, days };
    }

    case "moveStop": {
      const { stopId, toDay, toOrder } = mut.payload;
      let movedStop: TripStop | undefined;
      // Remove from current day
      const days = base.days.map(d => {
        const idx = d.stops.findIndex(s => s.id === stopId);
        if (idx === -1) return d;
        movedStop = { ...d.stops[idx], day: toDay };
        return { ...d, stops: reorder(d.stops.filter(s => s.id !== stopId)) };
      });
      if (!movedStop) throw new Error(`moveStop: stop ${stopId} not found`);
      // Insert into target day
      const finalDays = days.map(d => {
        if (d.day !== toDay) return d;
        const stops = [...d.stops];
        stops.splice(toOrder, 0, movedStop!);
        return { ...d, stops: reorder(stops) };
      });
      return { ...base, days: finalDays };
    }

    case "replaceStop": {
      const { stopId, newPlaceRef } = mut.payload;
      if (!isValidPlaceRef(newPlaceRef)) {
        const anyRef = newPlaceRef as Partial<{ id: string }>;
        throw new Error(`replaceStop: newPlaceRef invalid. id=${anyRef?.id}`);
      }
      const days = base.days.map(d => ({
        ...d,
        stops: d.stops.map(s =>
          s.id === stopId
            ? { ...s, placeRef: newPlaceRef, confidence: newPlaceRef.confidence }
            : s
        ),
      }));
      return { ...base, days };
    }

    case "setDates": {
      return { ...base, dates: mut.payload };
    }

    case "setTempo": {
      return { ...base, tempo: mut.payload.tempo };
    }

    case "setTheme": {
      const { day, theme } = mut.payload;
      const days = base.days.map(d => d.day === day ? { ...d, theme } : d);
      return { ...base, days };
    }

    case "attachBooking": {
      const { booking } = mut.payload;
      const existing = base.bookings.findIndex(b => b.id === booking.id);
      const bookings = existing >= 0
        ? base.bookings.map((b, i) => i === existing ? booking : b)
        : [...base.bookings, booking];
      return { ...base, bookings };
    }

    case "removeBooking": {
      return {
        ...base,
        bookings: base.bookings.filter(b => b.id !== mut.payload.bookingId),
      };
    }

    case "advancePhase": {
      const { to, assumption } = mut.payload;
      const state = { ...base.conversationState, phase: to as TripPhase };
      if (assumption) state.visibleAssumptions = [...state.visibleAssumptions, assumption];
      return { ...base, conversationState: state };
    }

    default: {
      throw new Error(`Unknown mutation type: ${(mut as TripMutation).type}`);
    }
  }
}

/** Log a mutation event. In production this goes to DynamoDB audit log. */
export function buildMutationEvent(
  tripId: string,
  mutation: TripMutation,
  source: TripMutationEvent["source"]
): TripMutationEvent {
  return { tripId, mutation, source, at: new Date().toISOString() };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function reorder(stops: TripStop[]): TripStop[] {
  return stops.map((s, i) => ({ ...s, order: i }));
}

/** Category-level visit duration defaults (p50 minutes). Document these — not magic numbers. */
function categoryDefaultDuration(placeId: string): number {
  if (placeId.includes("museum") || placeId.includes("muze")) return 90;
  if (placeId.includes("restaurant") || placeId.includes("cafe")) return 60;
  if (placeId.includes("park") || placeId.includes("garden")) return 45;
  if (placeId.includes("palace") || placeId.includes("saray")) return 120;
  return 60; // generic default
}
