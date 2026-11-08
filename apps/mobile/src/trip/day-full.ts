// U6 "gün doldu / boş" önerisi — web apps/web/app/lib/trip/planner-logic.ts dayFullSuggestion
// karşılığı (FEAT-004 mobil paritesi). Deterministik (I2); yalnız durak süreleri + OSRM bacak
// sürelerinden türetilir, veri uydurulmaz (I1). Mobilde bacaklar WebView'den dizi biçiminde gelir
// ({ duration: sn, distance: m }); web'deki leg kayıt haritası yerine bu diziyi alır. Eşik ve
// pencere web ile aynı: aktif gün 09:00 → 21:00, varsayılan durak 60 dk, tampon eşiği %20 (I9).
export type DayLeg = { duration: number; distance: number };

export type DayFullSuggestion =
  | { kind: "addExtra" }
  | { kind: "shiftStop"; stopId: string };

/** Aktif gün sonu (web ACTIVE_DAY_END_MINUTES ile aynı: 21:00). */
export const ACTIVE_DAY_END_MINUTES = 21 * 60;
/** U6/I9 eşiği: aktif pencere tamponu bunun altındaysa gün "dolu" (web ile aynı). */
export const DAY_FULL_BUFFER_THRESHOLD = 0.2;

const startMinutesOf = (startTime: string): number => {
  const [h, m] = startTime.split(":").map(Number);
  return (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0);
};

/**
 * I9 tampon oranı: aktif pencere (gün başlangıcı → 21:00) içinde ziyaret + yol dışında kalan pay.
 * YALNIZ her ardışık durak çifti için gerçek bir bacak varsa hesaplanır; eksikse null
 * ("hesaplanamadı", sayı uydurulmaz). 0–1 aralığına kırpılır.
 */
export function dayBufferRatio(
  stops: readonly { durationMinutes?: number }[],
  legs: readonly DayLeg[] | null,
  startTime = "09:00",
): number | null {
  if (stops.length === 0) return null;
  // Her ardışık çift için bir bacak gerekir; eksikse hesaplanamaz.
  if (!legs || legs.length !== stops.length - 1) return null;
  const start = startMinutesOf(startTime);
  const window = ACTIVE_DAY_END_MINUTES - start;
  if (window <= 0) return null;
  const travelMinutes = Math.round(legs.reduce((sum, l) => sum + l.duration, 0) / 60);
  const load = travelMinutes + stops.reduce((sum, s) => sum + (s.durationMinutes ?? 60), 0);
  return Math.min(1, Math.max(0, (window - load) / window));
}

/**
 * Gün boş ya da tüm duraklar gezilmişse "ekstra yer ekle" (bacak gerekmez). Aktif pencere tamponu
 * eşiğin altındaysa günün SON durağını başka güne kaydırmayı önerir. Bacaklar eksikse null döner:
 * öneri tahmine dayanmaz.
 */
export function dayFullSuggestion(
  stops: readonly { id: string; durationMinutes?: number; visited?: boolean }[],
  legs: readonly DayLeg[] | null,
  startTime = "09:00",
): DayFullSuggestion | null {
  if (stops.length === 0 || stops.every((s) => s.visited)) return { kind: "addExtra" };
  const buffer = dayBufferRatio(stops, legs, startTime);
  if (buffer === null) return null;
  if (buffer <= DAY_FULL_BUFFER_THRESHOLD) return { kind: "shiftStop", stopId: stops[stops.length - 1].id };
  return null;
}
