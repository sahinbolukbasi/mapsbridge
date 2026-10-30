// Tipli yönetim istemcisi (design §8.2, M9). Tüm çağrılar EndpointId üzerinden apiFetch'e gider;
// tipsiz path yoktur. lib/api-client.ts değiştirilmez (NFR-6).
import { apiFetch } from "../api-client";
import { ADMIN_ENDPOINTS, type AdminEndpoint, type EndpointId } from "./endpoints";
import type { AdminResponse } from "./types";

export type AdminRequestOptions = {
  /** Path şablonu değerleri ({id}, {type}); encodeURIComponent uygulanır. */
  params?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: Record<string, unknown>;
};

/** "/admin/users/{id}/suspend" + {id:"a/b"} → "/admin/users/a%2Fb/suspend". Eksik değer hatadır. */
export function fillPath(template: string, params: Record<string, string> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    if (typeof value !== "string" || value === "")
      throw new Error(`adminRequest: "${name}" parametresi eksik (${template})`);
    return encodeURIComponent(value);
  });
}

export function buildAdminPath(id: EndpointId, opts: AdminRequestOptions = {}): string {
  const ep: AdminEndpoint = ADMIN_ENDPOINTS[id];
  const path = fillPath(ep.path, opts.params);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export function adminRequest<Id extends EndpointId>(
  id: Id,
  opts: AdminRequestOptions = {},
): Promise<AdminResponse<Id>> {
  const ep: AdminEndpoint = ADMIN_ENDPOINTS[id];
  const path = buildAdminPath(id, opts);
  if (ep.method === "GET") return apiFetch<AdminResponse<Id>>(path);
  return apiFetch<AdminResponse<Id>>(path, {
    method: "POST",
    body: JSON.stringify(opts.body ?? {}),
  });
}
