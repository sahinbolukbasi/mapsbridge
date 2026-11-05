// Rota bileşenleri için saf biçimlendirme (design §4.2). Değer UYDURMAZ: girdi yoksa çağıran
// "Süre hesaplanamadı" gibi açık bir metin gösterir (I1/I2). Metinler i18n'den (trip.unit.*).
import type { AppLocale } from "../../lib/locale-utils";

type T = (key: string, fallback?: string) => string;

/** 90 → "1 sa 30 dk", 45 → "45 dk", 120 → "2 sa". */
export function formatMinutes(minutes: number, t: T): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hour = t("trip.unit.hour", "sa");
  const min = t("trip.unit.minute", "dk");
  if (h === 0) return `${m} ${min}`;
  return m === 0 ? `${h} ${hour}` : `${h} ${hour} ${m} ${min}`;
}

/** 600 → "600 m", 1500 → "1,5 km" (tr) / "1.5 km" (en). */
export function formatMeters(meters: number, t: T, locale: AppLocale): string {
  const value = Math.max(0, meters);
  if (value < 1000) return `${Math.round(value)} ${t("trip.unit.m", "m")}`;
  const km = new Intl.NumberFormat(locale === "en" ? "en-GB" : "tr-TR", {
    maximumFractionDigits: 1,
  }).format(value / 1000);
  return `${km} ${t("trip.unit.km", "km")}`;
}

/** Gün renkleri 1…7 arasında döner (--color-day-N). */
export function dayColorIndex(day: number): number {
  const n = Math.max(1, Math.floor(day));
  return ((n - 1) % 7) + 1;
}
