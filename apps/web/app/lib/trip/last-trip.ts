// Ana sayfa "Son gezin" kartı için salt-okunur özet (design §10, I10). Planlayıcının yerel
// kaydını (use-travel-planner) okur; hiçbir şey yazmaz, ağ isteği atmaz. Durağı olmayan
// varsayılan gezi "gezi yok" sayılır, kart çizilmez.

/** use-travel-planner'ın gezi listesi anahtarı (tek kaynak). */
export const PLANNER_TRIPS_KEY = "mapsbridge.travelPlanner.v5";

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
  for (const trip of parsed) {
    if (!trip || typeof trip !== "object") continue;
    const { title, pins } = trip as { title?: unknown; pins?: unknown };
    if (!Array.isArray(pins) || pins.length === 0) continue;
    const name = typeof title === "string" ? title.trim().slice(0, 120) : "";
    if (!name) continue;
    return { title: name, stops: pins.length };
  }
  return null;
}
