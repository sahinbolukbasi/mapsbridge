// Durağın gün numarası (FEAT-012 review #3). tripStore rota modeli tek `day` taşır; AI rotalarında
// her durağın günü `time` metninin başında ("2. gün · Sabah") gelir. Saf modül.
const DAY_PREFIX = /^(\d+)\. gün/;

/** "N. gün…" ile başlayan `time` → N; yoksa undefined (gün bilgisi uydurulmaz). */
export function dayFromTime(time: string | undefined): number | undefined {
  const m = time ? DAY_PREFIX.exec(time) : null;
  const n = m ? Number(m[1]) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** Durağın günü: `time` önekinden, yoksa rotanın günü. */
export function stopDay(stop: { time?: string }, routeDay: number): number {
  return dayFromTime(stop.time) ?? routeDay;
}

/** Duraklar birden fazla güne yayılıyor mu (yalnız `time` önekine göre). */
export function spansSeveralDays(
  stops: ReadonlyArray<{ time?: string }>,
  routeDay: number,
): boolean {
  return new Set(stops.map((s) => stopDay(s, routeDay))).size > 1;
}
