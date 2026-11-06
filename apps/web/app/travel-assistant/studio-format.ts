// Oturumlu asistan metin yardımcıları (FEAT-013, I11). Saf; yalnızca çeviri sonucunu doldurur.
export type Translate = (key: string, fallback?: string) => string;

/** "{n} durak" gibi yer tutucuları doldurur (tüm geçişler). */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (all, name: string) =>
    name in values ? String(values[name]) : all,
  );
}

/** "1 stop" / "3 stops" (EN tekil/çoğul; TR her ikisi "{n} durak"). */
export function stopsLabel(t: Translate, n: number): string {
  return fill(n === 1 ? t("studio.stops.one", "{n} durak") : t("studio.stops", "{n} durak"), {
    n,
  });
}

/** "1 day" / "3 days". */
export function daysLabel(t: Translate, n: number): string {
  return fill(
    n === 1 ? t("studio.context.days.one", "{n} gün") : t("studio.context.days", "{n} gün"),
    { n },
  );
}

/** Tarih/saat biçimi kullanıcının diline göre (I11). */
export function dateLocale(locale: string): string {
  return locale === "en" ? "en-GB" : "tr-TR";
}
