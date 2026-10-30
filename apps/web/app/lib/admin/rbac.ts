// İstemci tarafı görünürlük (design §8.6). Otorite sunucudadır; burada yalnızca yetkisiz
// uçlar hiç çağrılmaz ve ilgili aksiyonlar gizlenir.
import {
  ADMIN_AREAS,
  ADMIN_ENDPOINTS,
  type AdminAreaId,
  type AdminEndpoint,
  type AdminPermission,
  type EndpointId,
} from "./endpoints";

type SessionLike = { permissions: readonly string[] } | null | undefined;

/**
 * Backend'den daha katı UI kuralları. grant-credits backend'de `users` izniyle (destek dahil)
 * açık; UI yalnızca `credits` iznine gösterir (F-3).
 */
export const UI_STRICTER: Partial<Record<EndpointId, AdminPermission>> = {
  "users.grantCredits": "credits",
};

export function requiredPermission(id: EndpointId): AdminPermission | null {
  const ep: AdminEndpoint = ADMIN_ENDPOINTS[id];
  return UI_STRICTER[id] ?? ep.permission;
}

export function canRun(session: SessionLike, id: EndpointId): boolean {
  if (!session) return false;
  const needed = requiredPermission(id);
  return !needed || session.permissions.includes(needed);
}

/** Alan, en az bir okuma ucunu çalıştırabiliyorsa görünür. Sıra ADMIN_AREAS'tır. */
export function visibleAreas(session: SessionLike): AdminAreaId[] {
  if (!session) return [];
  const ids = Object.keys(ADMIN_ENDPOINTS) as EndpointId[];
  return ADMIN_AREAS.filter((area) =>
    ids.some((id) => {
      const ep: AdminEndpoint = ADMIN_ENDPOINTS[id];
      return ep.area === area && ep.kind === "read" && canRun(session, id);
    }),
  );
}
