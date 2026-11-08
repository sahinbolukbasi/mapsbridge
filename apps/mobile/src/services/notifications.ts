import * as Notifications from "expo-notifications";
import { storage } from "./storage";
import type { ActiveRoute } from "./tripStore";
import { tr } from "../i18n/ui";
import { planReminders, type ReminderText } from "./notification-logic";
// Yerel bildirimler (K4): gün başı özeti + açık saati olan yaklaşan durak. Push yok; sunucuya
// hiçbir şey gönderilmez. İzin PermissionPrompt ile (ilk rota kaydında). Kurulan kimlikler cihazda
// tutulur; yeni plan eskisini iptal eder.
const IDS_KEY = "mb_route_reminders";
const TEXT: ReminderText = {
  dayStartTitle: (name) => tr("native.reminder.dayTitle", { name }),
  dayStartBody: (n, first) => tr("native.reminder.dayBody", { n, first }),
  stopTitle: (name) => tr("native.reminder.stopTitle", { name }),
  stopBody: (time) => tr("native.reminder.stopBody", { time }),
};
let configured = false;
export function configureNotifications(): void {
  if (configured) return;
  configured = true;
  // Dayanıklılık: yerli bildirim modülü eksik/bozuk olsa bile açılış throw etmemeli (App mount
  // yolunda çağrılır). Başarısız olursa bildirimler sessizce devre dışı kalır; uygulama çalışır.
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    console.warn("[notifications] setNotificationHandler başarısız:", e);
  }
}
export async function cancelRouteReminders(): Promise<void> {
  const raw = await storage.getItem(IDS_KEY).catch(() => null);
  const ids: unknown = raw ? JSON.parse(raw) : [];
  if (Array.isArray(ids))
    await Promise.all(
      ids.map((id) =>
        typeof id === "string"
          ? Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)
          : undefined,
      ),
    );
  await storage.removeItem(IDS_KEY).catch(() => undefined);
}
/** Rota için hatırlatmaları kurar; kurulan sayıyı döner (izin yoksa 0). */
export async function scheduleRouteReminders(
  route: ActiveRoute,
  now = Date.now(),
): Promise<number> {
  configureNotifications();
  await cancelRouteReminders();
  const plan = planReminders(
    { id: route.id || "route", name: route.name, stops: route.stops },
    now,
    TEXT,
  );
  const ids: string[] = [];
  for (const r of plan) {
    try {
      ids.push(
        await Notifications.scheduleNotificationAsync({
          content: { title: r.title, body: r.body, data: { routeId: route.id, kind: r.kind } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.at) },
        }),
      );
    } catch {
      // İzin yoksa ya da platform reddederse kalanı denemeye gerek yok.
      break;
    }
  }
  await storage.setItem(IDS_KEY, JSON.stringify(ids)).catch(() => undefined);
  return ids.length;
}
