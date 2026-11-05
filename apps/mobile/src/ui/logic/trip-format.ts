// Rota bileşenleri için saf biçimlendirme (design §4.2): apps/web/app/components/trip/
// trip-format.ts ile aynı kurallar ve web tr.json trip.unit.* metinleri (mobilde locale JSON yok).
// Değer UYDURMAZ: girdi yoksa çağıran "Süre hesaplanamadı" gibi açık bir metin gösterir (I1/I2).
import { tr } from "../../i18n/ui";

/** 90 → "1 sa 30 dk", 45 → "45 dk", 120 → "2 sa". */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hour = tr("trip.unit.hour");
  const min = tr("trip.unit.minute");
  if (h === 0) return `${m} ${min}`;
  return m === 0 ? `${h} ${hour}` : `${h} ${hour} ${m} ${min}`;
}

/** 600 → "600 m", 1500 → "1,5 km". */
export function formatMeters(meters: number): string {
  const value = Math.max(0, meters);
  if (value < 1000) return `${Math.round(value)} ${tr("trip.unit.m")}`;
  const km = (Math.round((value / 1000) * 10) / 10).toString().replace(".", ",");
  return `${km} ${tr("trip.unit.km")}`;
}

/** Gün renkleri 1…7 arasında döner (tokens.color.day1…day7). */
export function dayColorIndex(day: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const n = Math.max(1, Math.floor(Number.isFinite(day) ? day : 1));
  return (((n - 1) % 7) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/** I9: her gün en az %20 programsız tampon. */
export const MIN_BUFFER_RATIO = 0.2;
