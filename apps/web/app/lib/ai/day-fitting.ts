// Gün içi sıra ve gün bütçesi (Increment 1.11; spec S3/S4, I2, I9). DETERMİNİSTİK kod; LLM'in
// gün/sıra değeri burada kullanılmaz.
//  - Sıra: zaman dilimi (sabah < öğleden sonra < akşam < gece) korunur; aynı dilimdeki ardışık
//    duraklar 2-opt (routing-service optimizeRouteOrder) ile kısaltılır. İlk durak ve kilitli
//    durak yerinde kalır; 2-opt yalnız toplam mesafeyi azaltıyorsa uygulanır.
//  - Bütçe: aktif gün × 0,8 (≥%20 programsız tampon, I9). Ziyaret + duraklar arası yürüme
//    aşılırsa en düşük öncelikli durak (S2 sırası: araştırma havuzundaki sıra, sonra gelen daha
//    düşük) düşer ve gün yeniden çözülür. Günün son durağı düşmez.
// Yürüme süresi yalnız BÜTÇE hesabı içindir (kullanıcıya süre olarak gösterilmez).
import { calculateDistanceKm, optimizeRouteOrder } from "../trip/routing-service";
import type { RouteStop } from "./types";

export const ACTIVE_DAY_MINUTES = 600; // 09:00–19:00
export const BUFFER_RATIO = 0.2;
export const DAY_BUDGET_MINUTES = Math.round(ACTIVE_DAY_MINUTES * (1 - BUFFER_RATIO));
const BUDGET_WALK_KMH = 4.5;
const DEFAULT_STOP_MINUTES = 60;

const SLOT_RANK: Record<NonNullable<RouteStop["timeSlot"]>, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  night: 3,
};

export type FitStop = RouteStop & { locked?: boolean };

const minutesOf = (s: RouteStop) =>
  Number.isFinite(s.estimatedMinutes) && (s.estimatedMinutes as number) > 0
    ? (s.estimatedMinutes as number)
    : DEFAULT_STOP_MINUTES;

export function pathKm(stops: readonly { lat: number; lng: number }[]): number {
  let km = 0;
  for (let i = 1; i < stops.length; i++)
    km += calculateDistanceKm(stops[i - 1].lat, stops[i - 1].lng, stops[i].lat, stops[i].lng);
  return km;
}

/** Ziyaret + duraklar arası yürüme (bütçe tahmini, dakika). */
export function dayLoadMinutes(stops: readonly RouteStop[]): number {
  const visit = stops.reduce((sum, s) => sum + minutesOf(s), 0);
  const walk = (pathKm(stops) / BUDGET_WALK_KMH) * 60;
  return Math.round(visit + walk);
}

/** Zaman dilimi sırası + dilim içi 2-opt. Dilimsiz durak öncekinin dilimini alır. */
export function orderDayStops<T extends FitStop>(stops: readonly T[]): T[] {
  if (stops.length <= 1) return [...stops];
  let rank = 1;
  const ranked = stops.map((s, i) => {
    if (s.timeSlot) rank = SLOT_RANK[s.timeSlot];
    else if (i === 0) rank = 1;
    return { s, rank, i };
  });
  ranked.sort((a, b) => a.rank - b.rank || a.i - b.i);
  const out: T[] = [];
  for (let start = 0; start < ranked.length;) {
    let end = start;
    while (end < ranked.length && ranked[end].rank === ranked[start].rank) end++;
    const run = ranked.slice(start, end).map((r) => r.s);
    out.push(...twoOpt(run));
    start = end;
  }
  return out;
}

function twoOpt<T extends FitStop>(run: T[]): T[] {
  if (run.length < 3) return run;
  const pins = run.map((s, idx) => ({
    id: s.id,
    label: s.name,
    address: s.address || "",
    lat: s.lat,
    lng: s.lng,
    category: "genel" as const,
    dayIndex: s.day,
    order: idx + 1,
    group: "",
    visited: false,
    isLocked: !!s.locked,
  }));
  const preview = optimizeRouteOrder(pins, "walking");
  if (!preview) return run;
  const byId = new Map(run.map((s) => [s.id, s]));
  const next = preview.optimizedPinIds.map((id) => byId.get(id)!).filter(Boolean);
  return next.length === run.length && pathKm(next) <= pathKm(run) ? next : run;
}

/**
 * Gün bütçesine sığdır. `priority`: id → S2 sırası (küçük = daha önemli). Bütçe aşıldıkça
 * en düşük öncelikli kilitsiz durak düşer, gün yeniden sıralanır.
 */
export function fitDayBudget<T extends FitStop>(
  stops: readonly T[],
  priority: ReadonlyMap<string, number>,
  budget = DAY_BUDGET_MINUTES,
): { stops: T[]; dropped: T[] } {
  let kept = orderDayStops(stops);
  const dropped: T[] = [];
  while (kept.length > 1 && dayLoadMinutes(kept) > budget) {
    const candidates = kept.filter((s) => !s.locked);
    if (candidates.length === 0) break;
    const worst = candidates.reduce((a, b) => {
      const pa = priority.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const pb = priority.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return pb > pa || (pb === pa && b.id > a.id) ? b : a;
    });
    dropped.push(worst);
    kept = orderDayStops(kept.filter((s) => s !== worst));
  }
  return { stops: kept, dropped };
}

/** Günün programsız payı (0–1). I9: ≥ 0,2 olmalı (tek durak bütçeyi tek başına aşabilir). */
export function bufferRatio(stops: readonly RouteStop[]): number {
  return 1 - dayLoadMinutes(stops) / ACTIVE_DAY_MINUTES;
}
