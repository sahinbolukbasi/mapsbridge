// Ana sayfa "Son gezin" kartı için salt-okunur özet (design §10, I10). Planlayıcının yerel
// kaydını (use-travel-planner) okur; hiçbir şey yazmaz, ağ isteği atmaz. Durağı olmayan
// varsayılan gezi "gezi yok" sayılır, kart çizilmez.

/** use-travel-planner'ın gezi listesi anahtarı (tek kaynak: planner-store.ts). */
export { PLANNER_TRIPS_KEY } from "./planner-store";

export type LastTripSummary = { title: string; stops: number };

export function summarizeLastTrip(raw: string | null): LastTripSummary | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  // En son güncellenen gezi (updatedAt, yoksa createdAt). Planlayıcı geziyi listenin başına da
  // sonuna da ekleyebildiği için dizi sırası "en yeni" anlamına gelmez; zaman damgası olmayan
  // kayıtlar arasında ilk geçerli gezi kalır.
  let best: (LastTripSummary & { at: number }) | null = null;
  for (const trip of parsed) {
    if (!trip || typeof trip !== "object") continue;
    const { title, pins, updatedAt, createdAt } = trip as {
      title?: unknown;
      pins?: unknown;
      updatedAt?: unknown;
      createdAt?: unknown;
    };
    if (!Array.isArray(pins) || pins.length === 0) continue;
    const name = typeof title === "string" ? title.trim().slice(0, 120) : "";
    if (!name) continue;
    const stamp = typeof updatedAt === "string" ? updatedAt : createdAt;
    const parsedAt = typeof stamp === "string" ? Date.parse(stamp) : Number.NaN;
    const at = Number.isNaN(parsedAt) ? Number.NEGATIVE_INFINITY : parsedAt;
    if (!best || at > best.at) best = { title: name, stops: pins.length, at };
  }
  return best ? { title: best.title, stops: best.stops } : null;
}
