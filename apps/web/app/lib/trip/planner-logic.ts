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
 * P7: haritadan (çift tıklama / Google) eklenen yerin hedefi. Gün seçili değilken ("Tümü")
 * eskiden 1. güne düşüyordu; artık Kaydedilenler'e (günsüz havuz) gider.
 */
export function addTargetFor(
  activeDayIndex: number | null | undefined,
): { kind: "day"; day: number } | { kind: "general" } {
  return activeDayIndex && activeDayIndex > 0
    ? { kind: "day", day: activeDayIndex }
    : { kind: "general" };
}
