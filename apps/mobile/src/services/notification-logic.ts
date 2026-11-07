// Yerel bildirim planı (K4; push YOK). Saf: hangi hatırlatmanın ne zaman kurulacağı (test:
// apps/web/tests/mobile/notifications.test.cjs). İçerik yalnız rota kaydından (I1): ad, durak
// sayısı, ilk durak; saat yalnız durağın açık "SS:DD" saati varsa (AI'nin "Sabah" gibi dilimleri
// saate çevrilmez, I2). Gün başı özeti 08:30'da.
export type ReminderStop = { name: string; time?: string };
export type ReminderRoute = { id: string; name: string; stops: readonly ReminderStop[] };
export type Reminder = {
  id: string;
  at: number;
  kind: "dayStart" | "stop";
  title: string;
  body: string;
};
export type ReminderText = {
  dayStartTitle: (name: string) => string;
  dayStartBody: (count: number, first: string) => string;
  stopTitle: (name: string) => string;
  stopBody: (time: string) => string;
};
export const DAY_START = { hour: 8, minute: 30 } as const;
export const STOP_LEAD_MIN = 15;
export const MAX_STOP_REMINDERS = 10;
const CLOCK = /(?:^|\D)([01]\d|2[0-3]):([0-5]\d)(?!\d)/;
/** Durağın açık saati ("10:30", "1. gün · 14:00"); yoksa null. */
export function explicitTime(time: string | undefined): { hour: number; minute: number } | null {
  const m = time ? CLOCK.exec(time) : null;
  return m ? { hour: Number(m[1]), minute: Number(m[2]) } : null;
}
/** Bir sonraki gün başı (bugün 08:30 geçmediyse bugün, yoksa yarın) — yerel saat. */
export function nextDayStart(now: number): number {
  const d = new Date(now);
  d.setHours(DAY_START.hour, DAY_START.minute, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}
export function planReminders(route: ReminderRoute, now: number, text: ReminderText): Reminder[] {
  if (!route.stops.length) return [];
  const start = nextDayStart(now);
  const out: Reminder[] = [
    {
      id: `${route.id}:day`,
      at: start,
      kind: "dayStart",
      title: text.dayStartTitle(route.name),
      body: text.dayStartBody(route.stops.length, route.stops[0].name),
    },
  ];
  const day = new Date(start);
  for (const [i, stop] of route.stops.entries()) {
    const t = explicitTime(stop.time);
    if (!t) continue;
    const at = new Date(day);
    at.setHours(t.hour, t.minute, 0, 0);
    const fire = at.getTime() - STOP_LEAD_MIN * 60_000;
    if (fire <= start || fire <= now) continue;
    out.push({
      id: `${route.id}:stop:${i}`,
      at: fire,
      kind: "stop",
      title: text.stopTitle(stop.name),
      body: text.stopBody(
        `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`,
      ),
    });
    if (out.length > MAX_STOP_REMINDERS) break;
  }
  return out;
}
