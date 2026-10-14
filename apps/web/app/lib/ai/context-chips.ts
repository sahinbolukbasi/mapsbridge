/**
 * Dynamic Context Chips (§12.2)
 *
 * Chips are NOT a static list. They are generated each turn based on:
 *  - Current focus (place, day, trip, topic)
 *  - TripState (what's missing, what decisions were made)
 *  - User profile (interests, constraints)
 *
 * Rules:
 *  - Max 4 chips per turn
 *  - Each chip maps to a concrete action or a clear answer
 *  - No "Daha fazla bilgi" chips — every chip has a purpose
 *  - Used/unused chips tracked via place_interactions
 */

import type { ThreadFocus } from './focus-manager';
import type { TripState } from './trip-state';
import type { TripProfile } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextChip {
  /** Short label shown in the UI button */
  label: string;
  /** The message that gets sent when the chip is tapped */
  prompt: string;
  /** Optional: direct action without an LLM call (e.g., open modal) */
  action?: 'open_reservation' | 'open_map' | 'open_alternatives' | 'open_notes';
}

// ---------------------------------------------------------------------------
// Chip generators per focus scope
// ---------------------------------------------------------------------------

function chipsForPlace(focus: ThreadFocus, _state: TripState): ContextChip[] {
  const name = focus.label ?? 'bu mekan';
  const chips: ContextChip[] = [
    { label: 'Rezervasyon gerekir mi?', prompt: `${name} için rezervasyon gerekiyor mu?` },
    { label: 'Yakınında ne var?', prompt: `${name} yakınında başka ne önerirsin?` },
    { label: 'Ne kadar zaman ayırmalıyım?', prompt: `${name} için ne kadar zaman ayırmalıyım?` },
    { label: 'Rotaya ekle', prompt: `${name} rotama ekle`, action: 'open_map' },
  ];
  return chips;
}

function chipsForDay(focus: ThreadFocus, state: TripState): ContextChip[] {
  const dayLabel = focus.label ?? 'bu gün';
  const chips: ContextChip[] = [
    { label: 'Günü optimize et', prompt: `${dayLabel} için en verimli sıralamayı yap` },
    { label: 'Alternatif öner', prompt: `${dayLabel} için alternatif mekanlar öner`, action: 'open_alternatives' },
    { label: 'Bütçeyi hesapla', prompt: `${dayLabel} için tahmini bütçeyi hesapla` },
  ];
  if (state.needs?.localTransit) {
    chips.push({ label: 'Toplu taşıma planı', prompt: `${dayLabel} için toplu taşıma güzergahını planla` });
  } else {
    chips.push({ label: 'Not ekle', prompt: `${dayLabel} için not ekle`, action: 'open_notes' });
  }
  return chips;
}

function chipsForTrip(state: TripState, profile?: TripProfile): ContextChip[] {
  const chips: ContextChip[] = [];

  // Prioritize what's missing
  if (!state.lodgingType?.length) {
    chips.push({ label: 'Konaklama öner', prompt: 'Bütçeme ve planıma uygun konaklama önerir misin?' });
  }
  if (!state.needs?.flights && state.destination) {
    chips.push({ label: 'Uçuş fiyatı', prompt: `${state.destination} için uçuş fiyatlarına bak` });
  }
  if (state.destination) {
    chips.push({ label: 'Vize gerekir mi?', prompt: `${state.destination} için vize gerekiyor mu?` });
  }
  if ((profile?.interests?.food?.length ?? 0) > 0) {
    const dest = state.destination ?? 'bu şehir';
    chips.push({ label: 'Restoran öner', prompt: `${dest} için yemek önerileri` });
  } else {
    chips.push({ label: 'Pratik ipuçları', prompt: 'Seyahat için pratik ipuçları ver (ulaşım, para, iletişim)' });
  }

  return chips;
}

function chipsForTopic(focus: ThreadFocus): ContextChip[] {
  const topic = focus.label ?? focus.refId ?? 'konu';
  return [
    { label: 'Daha fazla detay', prompt: `${topic} hakkında daha fazla detay ver` },
    { label: 'Kaynak göster', prompt: `${topic} için resmi kaynak nedir?` },
    { label: 'Plana ekle', prompt: `Bu bilgiyi seyahat planıma not olarak ekle`, action: 'open_notes' },
    { label: 'Başka sorum var', prompt: `${topic} konusunda başka soru sormak istiyorum` },
  ];
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate up to 4 context-aware chips for the current turn.
 * Returns empty array for smalltalk turns (no chips needed).
 */
export function generateContextChips(
  focus: ThreadFocus,
  state: TripState,
  profile?: TripProfile,
): ContextChip[] {
  let chips: ContextChip[];

  switch (focus.scope) {
    case 'place':
      chips = chipsForPlace(focus, state);
      break;
    case 'day':
      chips = chipsForDay(focus, state);
      break;
    case 'topic':
      chips = chipsForTopic(focus);
      break;
    case 'trip':
    default:
      chips = chipsForTrip(state, profile);
      break;
  }

  return chips.slice(0, 4);
}
