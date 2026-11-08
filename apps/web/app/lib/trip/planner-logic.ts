// Planlayıcı için saf yardımcılar (FEAT-007, design §4.2, §6.3, §12.1). Değer UYDURMAZ: bacak
// süresi/mesafesi yalnızca OSRM yanıtından gelir; yoksa çağıran "Süre hesaplanamadı" gösterir.
import type { RouteGeometry, RouteLeg } from "./models";

/** OSRM demo sunucusuna tek istekte gönderilecek en fazla nokta (design §6.3). */
export const MAX_ROUTE_POINTS = 25;

/** Bacak eşlemesinin anahtarı: ardışık iki durak. */
export function legKey(fromId: string, toId: string): string {
  return `${fromId}>${toId}`;
}

/**
 * OSRM bacaklarını ardışık durak çiftlerine eşler. Bacak sayısı nokta sayısının bir eksiği
 * değilse (geçersiz koordinat atlandı, yedek rota vb.) boş döner: tahmin yapılmaz (I1/I2).
 */
export function buildLegMap(
  pinIds: readonly string[],
  legs: readonly RouteLeg[] | undefined,
): Record<string, RouteLeg> {
  if (!legs || pinIds.length < 2 || legs.length !== pinIds.length - 1) return {};
  const out: Record<string, RouteLeg> = {};
  for (let i = 0; i < legs.length; i++) out[legKey(pinIds[i], pinIds[i + 1])] = legs[i];
  return out;
}

/**
 * Rota isteğinin anahtarı: yalnızca durak kimliği, koordinatı ve sırası (+ ulaşım modu).
 * Not/süre/başlık düzenlemeleri anahtarı değiştirmez, böylece OSRM yalnızca durak listesi
 * değişince yeniden çağrılır (design §6.3).
 */
export function routeRequestKey(
  stops: readonly { id: string; lat: number; lng: number }[],
  mode: string,
): string {
  return `${mode}|${stops.map((s) => `${s.id}@${s.lat.toFixed(6)},${s.lng.toFixed(6)}`).join(";")}`;
}

/** Nokta sayısı OSRM sınırını aşıyorsa istek atılmaz (yedek çizim, süre "hesaplanamadı"). */
export function canRequestRoute(pointCount: number): boolean {
  return pointCount >= 2 && pointCount <= MAX_ROUTE_POINTS;
}

/**
 * Paylaşım süresi seçenekleri: yalnızca mevcut POST /shares çağrısının gerçekten uyguladığı
 * değerler. Sunucu `hours` değerini 1–168 aralığına sıkıştırır (0 = "süresiz" 1 saate düşer),
 * bu yüzden "süresiz" seçeneği sunulmaz (I10).
 */
export const SHARE_DURATIONS = [
  { hours: 1, labelKey: "planner.share.duration.1h", fallback: "1 sa" },
  { hours: 24, labelKey: "planner.share.duration.24h", fallback: "24 sa" },
  { hours: 168, labelKey: "planner.share.duration.7d", fallback: "7 gün" },
] as const;
export type ShareHours = (typeof SHARE_DURATIONS)[number]["hours"];
export const DEFAULT_SHARE_HOURS: ShareHours = 24;

/** Paylaşım bağlantısı: alıcı /k/?code= ile açar (design §5.4, S16). */
export function shareLink(origin: string, token: string): string {
  return `${origin}/k/?code=${encodeURIComponent(token)}`;
}

/**
 * Gün içi saatler ve toplamlar (deterministik, I2): gün başlangıcı + durak süreleri + OSRM bacak
 * süreleri. Ardışık çiftlerden birinin bacağı yoksa saat ve toplam üretilmez (null): tahmin
 * yapılmaz, çağıran saatleri göstermez (I1).
 */
export function dayTimeline(
  stops: readonly { id: string; durationMinutes?: number }[],
  legs: Readonly<Record<string, RouteLeg>>,
  startTime = "09:00",
): { times: string[]; travelMinutes: number; travelMeters: number } | null {
  if (stops.length === 0) return null;
  const [h, m] = startTime.split(":").map(Number);
  let cursor = (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0);
  let travelSeconds = 0;
  let travelMeters = 0;
  const times: string[] = [];
  for (let i = 0; i < stops.length; i++) {
    if (i > 0) {
      const leg = legs[legKey(stops[i - 1].id, stops[i].id)];
      if (!leg) return null;
      travelSeconds += leg.durationSeconds;
      travelMeters += leg.distanceMeters;
      cursor += Math.round(leg.durationSeconds / 60);
    }
    times.push(clock(cursor));
    cursor += stops[i].durationMinutes ?? 60;
  }
  return { times, travelMinutes: Math.round(travelSeconds / 60), travelMeters };
}

/** Aktif gün sonu (scheduler.ts ACTIVE_DAY_END_MINUTES ile aynı: 21:00). */
export const ACTIVE_DAY_END_MINUTES = 21 * 60;

/**
 * I9 tampon oranı (deterministik, I2): aktif pencere (gün başlangıcı → 21:00) içinde ziyaret +
 * yol dışında kalan pay. YALNIZ tüm bacaklar gerçek yol rotasından geliyorsa hesaplanır; bir
 * bacak eksikse ya da durak yoksa null ("hesaplanamadı", sayı uydurulmaz). 0–1 aralığına kırpılır.
 */
export function dayBufferRatio(
  stops: readonly { id: string; durationMinutes?: number }[],
  legs: Readonly<Record<string, RouteLeg>>,
  startTime = "09:00",
): number | null {
  const timeline = dayTimeline(stops, legs, startTime);
  if (!timeline) return null;
  const [h, m] = startTime.split(":").map(Number);
  const start = (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0);
  const window = ACTIVE_DAY_END_MINUTES - start;
  if (window <= 0) return null;
  const load =
    timeline.travelMinutes + stops.reduce((sum, s) => sum + (s.durationMinutes ?? 60), 0);
  return Math.min(1, Math.max(0, (window - load) / window));
}

function clock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Planlayıcı görünümü (`?view=`): plan ya da kayıtlı rotalar ("Rotalarım"). */
export const PLANNER_VIEWS = ["plan", "trips"] as const;
export type PlannerView = (typeof PLANNER_VIEWS)[number];

/**
 * P2: zaman çizelgesine giren bacaklar yalnız GERÇEK yol rotasından (isRealRoad). Yedek
 * (OSRM'e ulaşılamadı) geometri tahmini hız varsayımıyla üretilir; süresi gösterilmez,
 * Connector "Süre hesaplanamadı" der (I1/I2).
 */
export function routeLegMap(
  pinIds: readonly string[],
  geom: Pick<RouteGeometry, "isRealRoad" | "legs"> | null | undefined,
): Record<string, RouteLeg> {
  if (!geom?.isRealRoad) return {};
  return buildLegMap(pinIds, geom.legs);
}
/** P1: gezilen pin haritadan silinmez; yalnız kullanıcı "Gezilenleri gizle" derse gizlenir. */
export function pinsForMap<T extends { visited?: boolean }>(
  pins: readonly T[],
  hideVisited: boolean,
) {
  return hideVisited ? pins.filter((p) => !p.visited) : [...pins];
}
/**
 * Bir yerin ekleneceği hedef: gezinin belirli bir günü ya da günsüz "Kaydedilenler" havuzu.
 */
export type AddTarget = { kind: "day"; day: number } | { kind: "general" };

/**
 * P7: haritadan (çift tıklama / Google) eklenen yerin hedefi. Gün seçili değilken ("Tümü")
 * eskiden 1. güne düşüyordu; artık Kaydedilenler'e (günsüz havuz) gider.
 */
export function addTargetFor(activeDayIndex: number | null | undefined): AddTarget {
  return activeDayIndex && activeDayIndex > 0
    ? { kind: "day", day: activeDayIndex }
    : { kind: "general" };
}

/** U3 ekleme anı gün seçimi Select değeri için sabit: Kaydedilenler = günsüz havuz. */
export const ADD_TARGET_GENERAL = "general";

/**
 * U3: ekleme kartındaki gün <Select>'inin seçili değeri → ekleme hedefi. "general" ve geçersiz
 * (bilinmeyen / gün listesinde olmayan) değerler Kaydedilenler'e düşer; sayı bir güne eşlenir.
 */
export function parseAddTarget(value: string, days: readonly number[]): AddTarget {
  if (value === ADD_TARGET_GENERAL) return { kind: "general" };
  const day = Number(value);
  return Number.isInteger(day) && days.includes(day) ? { kind: "day", day } : { kind: "general" };
}

/**
 * U3: ekleme kartı Select'inin başlangıç değeri. Aktif gün (>0) varsa o gün, yoksa Kaydedilenler.
 * Dönen değer `days` içinde yoksa (ör. gün silinmiş) Kaydedilenler'e düşer.
 */
export function defaultAddTargetValue(
  activeDayIndex: number | null | undefined,
  days: readonly number[],
): string {
  const target = addTargetFor(activeDayIndex);
  return target.kind === "day" && days.includes(target.day)
    ? String(target.day)
    : ADD_TARGET_GENERAL;
}
/**
 * Pini içeren geziye `update` uygular; içermeyen gezi AYNI referansla döner. Böylece geri alma
 * yığını (undoSnapshots) yalnız gerçekten değişen gezi için kayıt alır; çok gezili kullanıcıda
 * "Geri al" doğru geziyi geri getirir (review-foundation B1).
 */
export function mapTripPins<T extends { pins: { id: string }[] }>(
  trips: readonly T[],
  pinId: string,
  update: (pins: T["pins"]) => T["pins"],
): T[] {
  return trips.map((t) =>
    t.pins.some((p) => p.id === pinId) ? { ...t, pins: update(t.pins) } : t,
  );
}
type UndoTrip = { id: string; pins: unknown[]; days: unknown[] };
export type UndoEntry<T extends UndoTrip> = { tripId: string; pins: T["pins"]; days: T["days"] };
/** Önceki ve sonraki gezi listesinde pins/days referansı değişen her gezi için bir anlık görüntü. */
export function undoSnapshots<T extends UndoTrip>(
  prev: readonly T[],
  next: readonly T[],
): UndoEntry<T>[] {
  const out: UndoEntry<T>[] = [];
  for (const before of prev) {
    const after = next.find((t) => t.id === before.id);
    if (!after || (after.pins === before.pins && after.days === before.days)) continue;
    out.push({ tripId: before.id, pins: before.pins, days: before.days });
  }
  return out;
}
/** Anlık görüntüyü sahibi olan geziye geri yazar; diğer geziler aynı referansla kalır. */
export function restoreSnapshot<T extends UndoTrip>(trips: readonly T[], entry: UndoEntry<T>): T[] {
  return trips.map((t) =>
    t.id === entry.tripId ? { ...t, pins: entry.pins, days: entry.days } : t,
  );
}

/** P4 "Yeni rota" gün sayısı sınırları (Stepper). */
export const NEW_TRIP_MIN_DAYS = 1;
export const NEW_TRIP_MAX_DAYS = 14;

/** P4: yeni rota için 1…N gün iskeleti (kırpılmış); renk/etiket kancada eklenir. */
export function newTripDayIndexes(count: number): number[] {
  const n = Math.min(
    NEW_TRIP_MAX_DAYS,
    Math.max(NEW_TRIP_MIN_DAYS, Number.isFinite(count) ? Math.round(count) : 1),
  );
  return Array.from({ length: n }, (_, i) => i + 1);
}

/** Başlangıç tarihi (YYYY-MM-DD) + gün sayısı → bitiş tarihi; geçersiz tarihte undefined. */
export function tripEndDate(startDate: string | undefined, days: number): string | undefined {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return undefined;
  const d = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setUTCDate(d.getUTCDate() + Math.max(0, newTripDayIndexes(days).length - 1));
  return d.toISOString().slice(0, 10);
}

/**
 * P8 sürükle-bırak: bir günün durak sırasını verilen kimlik sırasına yazar (order 1…n).
 * Diğer günlerin pinleri aynı referansla kalır; kimlik kümesi günle eşleşmezse dizi aynen döner
 * (yarım bırakılmış sürüklemede veri bozulmaz). Tek çağrı = tek geri alma kaydı.
 */
export function reorderDayPins<T extends { id: string; dayIndex: number; order: number }>(
  pins: readonly T[],
  dayIndex: number,
  orderedIds: readonly string[],
): T[] {
  const dayIds = pins.filter((p) => p.dayIndex === dayIndex).map((p) => p.id);
  if (
    dayIds.length !== orderedIds.length ||
    new Set(orderedIds).size !== orderedIds.length ||
    !orderedIds.every((id) => dayIds.includes(id))
  )
    return pins as T[];
  const rank = new Map(orderedIds.map((id, i) => [id, i + 1]));
  if (pins.every((p) => p.dayIndex !== dayIndex || p.order === rank.get(p.id))) return pins as T[];
  return pins.map((p) =>
    p.dayIndex === dayIndex ? { ...p, order: rank.get(p.id) ?? p.order } : p,
  );
}
