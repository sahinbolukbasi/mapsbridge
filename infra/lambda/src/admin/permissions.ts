export type StaffRole = "admin" | "moderator" | "support";
export const permissions = {
  admin: ["users", "roles", "credits", "content", "support", "finance", "audit", "system"],
  moderator: ["content", "support"],
  support: ["users", "support"],
} as const;
export function can(role: StaffRole | undefined, permission: string): boolean {
  return !!role && (permissions[role] as readonly string[]).includes(permission);
}
export function routePermission(path: string, method: string): string | null {
  if (["/admin/session", "/admin/metrics"].includes(path)) return null;
  if (path.includes("/role")) return "roles";
  if (/\/(credits|wallet)$/.test(path)) return "credits";
  if (path.endsWith("/subscription")) return "finance";
  if (path.includes("/refund") || /\/admin\/(finance|payments|subscriptions)/.test(path))
    return "finance";
  if (path.includes("/users")) return "users";
  if (/\/admin\/(routes|reports|content|shares|profiles)/.test(path)) return "content";
  if (path.includes("/tickets")) return "support";
  if (path.includes("/audit")) return "audit";
  return "system";
}
