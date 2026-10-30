// Yönetim API'sinin tipli uç nokta tablosu (design §8.2/§8.3). Saf TS; React yok.
// Her METHOD+path infra/admin-runtime/routes.json'da vardır ve `permission` backend
// routePermission() çıktısına eşittir (apps/web/tests/admin-api.test.cjs, AC-25).
// routes.json'daki diğer /admin anahtarları gerekçesiyle not-exposed.ts'tedir.

export type AdminPermission =
  "users" | "roles" | "credits" | "content" | "support" | "finance" | "audit" | "system";

/** Kenar menüsü alanları (sıra = menü sırası, design §8.3). "kabuk" menüde görünmez. */
export const ADMIN_AREAS = [
  "genel",
  "kullanicilar",
  "moderasyon",
  "icerik",
  "destek",
  "finans",
  "fiyatlandirma",
  "ai",
  "analitik",
  "sistem",
  "gecmis",
] as const;
export type AdminAreaId = (typeof ADMIN_AREAS)[number];

export type AdminEndpoint = {
  method: "GET" | "POST";
  /** routes.json biçiminde şablon: /admin/users/{id}/suspend */
  path: string;
  /** Backend routePermission(path); null = her personel rolü. */
  permission: AdminPermission | null;
  area: AdminAreaId | "kabuk";
  kind: "read" | "write";
  /** ConfirmDialog danger tonu gerektirir (FR-7.5). */
  destructive?: boolean;
  /** Gerekçe gövdede bu alanla gönderilir (UI her zaman zorunlu tutar). */
  reasonField?: "reason" | "notes";
};

const read = (
  path: string,
  permission: AdminPermission | null,
  area: AdminEndpoint["area"],
): AdminEndpoint => ({ method: "GET", path, permission, area, kind: "read" });

const write = (
  path: string,
  permission: AdminPermission | null,
  area: AdminEndpoint["area"],
  extra: Pick<AdminEndpoint, "destructive" | "reasonField"> = {},
): AdminEndpoint => ({ method: "POST", path, permission, area, kind: "write", ...extra });

const R = { reasonField: "reason" } as const;
const D = { reasonField: "reason", destructive: true } as const;

export const ADMIN_ENDPOINTS = {
  // Kabuk ve genel bakış
  session: read("/admin/session", null, "kabuk"),
  metrics: read("/admin/metrics", null, "genel"),
  realtime: read("/admin/realtime", "system", "genel"),
  systemHealth: read("/admin/system-health", "system", "genel"),

  // Kullanıcılar
  "users.list": read("/admin/users", "users", "kullanicilar"),
  "users.detail": read("/admin/users/{id}", "users", "kullanicilar"),
  "users.suspend": write("/admin/users/{id}/suspend", "users", "kullanicilar", D),
  "users.unsuspend": write("/admin/users/{id}/unsuspend", "users", "kullanicilar", R),
  "users.profile": write("/admin/users/{id}/profile", "users", "kullanicilar", R),
  "users.sessions": write("/admin/users/{id}/sessions", "users", "kullanicilar", D),
  "users.role": write("/admin/users/{id}/role", "roles", "kullanicilar", D),
  "users.credits": write("/admin/users/{id}/credits", "credits", "kullanicilar", R),
  "users.wallet": write("/admin/users/{id}/wallet", "credits", "kullanicilar", R),
  "users.subscription": write("/admin/users/{id}/subscription", "finance", "kullanicilar", R),
  "users.grantCredits": write("/admin/users/{id}/grant-credits", "users", "kullanicilar", R),
  "users.refund": write("/admin/users/{id}/refund", "finance", "finans", D),

  // Finans
  payments: read("/admin/payments", "finance", "finans"),
  finance: read("/admin/finance", "finance", "finans"),
  subscriptions: read("/admin/subscriptions", "finance", "finans"),

  // Fiyatlandırma ve kredi
  creditStats: read("/admin/credit-stats", "system", "fiyatlandirma"),
  plans: read("/admin/plans", "system", "fiyatlandirma"),
  "plans.update": write("/admin/plans/{id}", "system", "fiyatlandirma", R),
  creditPacks: read("/admin/credit-packs", "system", "fiyatlandirma"),
  "creditPacks.update": write("/admin/credit-packs/{id}", "system", "fiyatlandirma", R),
  stripeConfig: read("/admin/stripe-config", "system", "fiyatlandirma"),
  "stripeConfig.update": write("/admin/stripe-config", "system", "fiyatlandirma", D),

  // Moderasyon
  reports: read("/admin/reports", "content", "moderasyon"),
  "reports.resolve": write("/admin/reports/{id}/resolve", "content", "moderasyon", {
    reasonField: "notes",
  }),
  routes: read("/admin/routes", "content", "moderasyon"),
  "routes.action": write("/admin/routes/{id}/action", "content", "moderasyon", R),
  "routes.details": write("/admin/routes/{id}/details", "content", "moderasyon", R),
  shares: read("/admin/shares", "content", "moderasyon"),
  "shares.revoke": write("/admin/shares/{id}/revoke", "content", "moderasyon", D),
  profiles: read("/admin/profiles", "content", "moderasyon"),
  "profiles.moderate": write("/admin/profiles/{id}/moderate", "content", "moderasyon", R),

  // İçerik
  content: read("/admin/content", "content", "icerik"),
  "content.create": write("/admin/content", "content", "icerik", R),
  "content.update": write("/admin/content/{type}/{id}", "content", "icerik", R),

  // Destek
  tickets: read("/admin/tickets", "support", "destek"),
  "tickets.update": write("/admin/tickets/{id}", "support", "destek", R),

  // Sistem
  announcements: read("/admin/announcements", "system", "sistem"),
  "announcements.save": write("/admin/announcements", "system", "sistem", R),
  systemConfig: read("/admin/system-config", "system", "sistem"),
  "systemConfig.update": write("/admin/system-config", "system", "sistem", R),
  moduleConfig: read("/admin/module-config", "system", "sistem"),
  "moduleConfig.update": write("/admin/module-config", "system", "sistem", R),

  // İşlem geçmişi
  auditLogs: read("/admin/audit-logs", "audit", "gecmis"),

  // AI operasyonları
  usage: read("/admin/usage", "system", "ai"),
  tokenUsage: read("/admin/token-usage", "system", "ai"),
  aiOperations: read("/admin/ai-operations", "system", "ai"),
  "ai.control": write("/admin/ai-control", "system", "ai", R),
  aiAgents: read("/admin/ai-agents", "system", "ai"),
  "aiAgents.config": write("/admin/ai-agents/{id}/config", "system", "ai", R),
  aiTraining: read("/admin/ai-training", "system", "ai"),
  "aiTraining.review": write("/admin/ai-training/{id}/review", "system", "ai", R),
  aiTrainingJobs: read("/admin/ai-training/jobs", "system", "ai"),
  "aiTraining.fineTune": write("/admin/ai-training/fine-tune", "system", "ai", {
    destructive: true,
  }),
  aiRelease: read("/admin/ai-release", "system", "ai"),
  "aiRelease.propose": write("/admin/ai-release/propose", "system", "ai", R),
  "aiRelease.publish": write("/admin/ai-release/publish", "system", "ai", R),
  "aiRelease.rollback": write("/admin/ai-release/rollback", "system", "ai", D),
  agentcoreStatus: read("/admin/agentcore-status", "system", "ai"),

  // Analitik
  "analytics.devices": read("/admin/analytics/devices", "system", "analitik"),
  "analytics.aiTopics": read("/admin/analytics/ai-topics", "system", "analitik"),
  "analytics.community": read("/admin/analytics/community", "system", "analitik"),
  "analytics.subscriptions": read("/admin/analytics/subscriptions", "system", "analitik"),
} as const satisfies Record<string, AdminEndpoint>;

export type EndpointId = keyof typeof ADMIN_ENDPOINTS;

export function endpointKey(id: EndpointId): string {
  const ep: AdminEndpoint = ADMIN_ENDPOINTS[id];
  return `${ep.method} ${ep.path}`;
}
