// Cihazdaki gezi kaydının sahibi ve hesap yalıtımı (KVKK; design §6.3/§6.4, FEAT-011 review #1).
// Web `lib/trip/planner-store.ts` ile aynı kural: sahip küçük harf e-posta ya da `guest`tir.
// Başka bir hesabın kaydı misafire ya da sonraki hesaba gösterilmez; girişte yalnızca oturumsuzken
// oluşturulan (`origin: "guest"`) duraklı taslaklar hesaba aktarılır. Saf modül (react-native yok).

export const GUEST_OWNER = "guest";
export type TripOrigin = "guest" | "user";

/** Gezi listesi, aktif gezi ve yer havuzu anahtarları + sahip işareti (tek kaynak). */
export const TRIP_KEYS = {
  routes: "mb_all_routes",
  activeRouteId: "mb_active_route_id",
  savedPool: "mb_saved_pool",
  owner: "mb_routes_owner",
  /** api.ts routeService.listRoutes çevrimdışı önbelleği (hesaba ait). */
  serverCache: "cached_routes",
} as const;

/** Oturum varsa küçük harf e-posta, yoksa `guest`. */
export function ownerFromEmail(email: string | null | undefined): string {
  const normalized = email?.trim().toLowerCase();
  return normalized ? normalized : GUEST_OWNER;
}

/**
 * Kayıtlı sahip `stored`, şu anki sahip `current` için kayıt kullanılabilir mi?
 * - aynı sahip → evet;
 * - misafir taslağı → evet (girişte hesaba aktarılır, §6.3);
 * - işaretsiz eski kayıt → yalnızca oturumlu kullanıcıya (bu sürümden önce Planla yalnızca
 *   oturumluyken açılıyordu; misafire asla gösterilmez);
 * - başka bir hesap → hayır.
 */
export function canUseTripStore(stored: string | null, current: string): boolean {
  if (stored === current || stored === GUEST_OWNER) return true;
  if (!stored) return current !== GUEST_OWNER;
  return false;
}

/** Girişte hesaba aktarılacak taslaklar: oturumsuzken oluşturulmuş, sunucuya hiç yazılmamış
 * ("route-…") ve duraklı geziler. Aktarılanlar artık hesabındır ve yüklenmeyi bekler. */
export function guestRoutesForTransfer<
  T extends { id: string; origin?: TripOrigin; pendingUpload?: boolean; stops: unknown[] },
>(routes: readonly T[]): T[] {
  return routes
    .filter((r) => r.id.startsWith("route-") && r.origin === GUEST_OWNER && r.stops.length > 0)
    .map((r) => ({ ...r, origin: "user" as const, pendingUpload: true }));
}

export type OwnerChange = "keep" | "transfer" | "clear";

/** Sahip `stored` → `next` geçişinde kayda ne olur. */
export function ownerChange(stored: string | null, next: string): OwnerChange {
  if (!canUseTripStore(stored, next)) return "clear";
  if (stored === GUEST_OWNER && next !== GUEST_OWNER) return "transfer";
  return "keep";
}
