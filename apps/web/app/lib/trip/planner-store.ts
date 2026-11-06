// Planlayıcının cihazdaki kaydı (I12) ve hesap yalıtımı (KVKK; FEAT-007 review #1).
// Gezi listesi tek bir localStorage anahtarında durur; sahibi ayrı bir işaret anahtarında
// tutulur. Başka bir hesabın kaydı misafire ya da sonraki hesaba gösterilmez, sonraki girişte
// yalnızca oturumsuzken oluşturulan ("origin: guest") taslaklar hesaba aktarılır. Bir hesap
// kaydı ilk yazdığında sahip o hesap olur; misafir taslağı böylece yalnızca bir hesaba geçer.
import { GUEST_OWNER, currentDeviceOwner, ownerFromSession } from "../device-owner";
export { GUEST_OWNER };

/** use-travel-planner'ın gezi listesi anahtarı (tek kaynak). */
export const PLANNER_TRIPS_KEY = "mapsbridge.travelPlanner.v5";
/** Güne atanmamış yerler havuzu. */
export const PLANNER_GENERAL_PINS_KEY = "mapsbridge.generalPins.v5";
/** Son harita aramaları (en çok 8; sahip bazlı, çıkışta silinir). */
export const PLANNER_RECENT_SEARCHES_KEY = "mapsbridge.recentSearches.v1";
/** Kaydın sahibi: küçük harf e-posta ya da `guest`. */
export const PLANNER_OWNER_KEY = "mapsbridge.travelPlanner.owner";
export type TripOrigin = "guest" | "user";

/** Oturum varsa küçük harf e-posta, yoksa `guest` (maps-client `mode` ile aynı kural). */
export const plannerOwner = ownerFromSession;

/**
 * Kayıtlı sahip `stored`, şu anki sahip `current` için kayıt kullanılabilir mi?
 * - aynı sahip → evet;
 * - misafir taslağı → evet (bu cihazda oturumsuz oluşturuldu; girişte hesaba aktarılır, §6.3);
 * - işaretsiz eski kayıt → yalnızca oturumlu kullanıcıya (FEAT-007 öncesi planlayıcı yalnızca
 *   oturumluyken açılıyordu; misafire asla gösterilmez);
 * - başka bir hesap → hayır.
 */
export function canUsePlannerStore(stored: string | null, current: string): boolean {
  if (stored === current || stored === GUEST_OWNER) return true;
  if (!stored) return current !== GUEST_OWNER;
  return false;
}

/** Girişte hesaba aktarılacak taslaklar: yalnızca oturumsuzken oluşturulmuş, duraklı, sunucuya
 * henüz yazılmamış ("trip-…") geziler. Aktarılanlar artık hesabındır (`origin: "user"`). */
export function guestDraftsForTransfer<
  T extends { id: string; origin?: TripOrigin; pins: unknown[] },
>(trips: readonly T[]): T[] {
  return trips
    .filter((t) => t.id.startsWith("trip-") && t.origin === GUEST_OWNER && t.pins.length > 0)
    .map((t) => ({ ...t, origin: "user" as const }));
}

/** Şu anki sahip (localStorage oturumu; cognito.getStoredSession ile aynı anahtarlar). */
export const currentPlannerOwner = currentDeviceOwner;

/** Kayıt şu anki sahibe aitse değerini, değilse null döner (başkasının verisi okunmaz). */
export function readPlannerStore(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (!canUsePlannerStore(localStorage.getItem(PLANNER_OWNER_KEY), currentPlannerOwner()))
      return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Değeri yazar ve sahibi işaretler. `expectedOwner` verilirse yalnızca şu anki sahip oysa yazar. Kayıt başka bir hesaba aitse önce tamamı silinir (iki
 * hesabın verisi karışmaz). Depolama hatasında (kota, SecurityError) false döner.
 */
export function writePlannerStore(key: string, value: string, expectedOwner?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const owner = currentPlannerOwner();
    // Bellekteki durum başka bir kimliğe aitse (ör. başka sekmede çıkış/hesap değişimi) yazılmaz.
    if (expectedOwner !== undefined && expectedOwner !== owner) return false;
    if (!canUsePlannerStore(localStorage.getItem(PLANNER_OWNER_KEY), owner)) clearPlannerStore();
    localStorage.setItem(key, value);
    localStorage.setItem(PLANNER_OWNER_KEY, owner);
    return true;
  } catch {
    return false;
  }
}

/** Çıkışta çağrılır: gezi listesi, yer havuzu ve sahip işareti silinir. */
export function clearPlannerStore(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PLANNER_TRIPS_KEY);
    localStorage.removeItem(PLANNER_GENERAL_PINS_KEY);
    localStorage.removeItem(PLANNER_RECENT_SEARCHES_KEY);
    localStorage.removeItem(PLANNER_OWNER_KEY);
  } catch {}
}
