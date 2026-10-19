"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminApi,
  apiFetch,
  type AdminMetrics,
  type AdminUserItem,
  type AdminPaymentItem,
  type AdminReportItem,
  type AdminAuditItem,
  type AdminSystemHealthData,
  type AdminFinanceData,
  type AdminModuleConfig,
  type AdminCreditStats,
  type AdminStripeConfig,
  type AdminPlanConfig,
  type AdminCreditPackConfig,
} from "../../lib/api-client";
import { getStoredSession } from "../../lib/cognito";
import {
  managementApi,
  csvText,
  download,
  type AdminSession,
  type ManagedRecord,
} from "../../lib/admin-management";
import { AdminWorkspace, UserInspector, EditDialog, type Field } from "./workspace";
import "./admin.css";
import { AIDashboard } from "./ai-dashboard";

type Tab =
  | "overview"
  | "users"
  | "routes"
  | "payments"
  | "reports"
  | "audit"
  | "system"
  | "subscriptions"
  | "shares"
  | "profiles"
  | "content"
  | "tickets"
  | "announcements"
  | "usage"
  | "modules"
  | "credits"
  | "ai-operations"
  | "pricing"
  | "stripe"
  | "analytics-devices"
  | "analytics-ai"
  | "analytics-community"
  | "analytics-subscriptions";

type Route = {
  PK?: string;
  SK?: string;
  routeId?: string;
  name?: string;
  title?: string;
  userId?: string;
  ownerEmail?: string;
  stops?: any[];
  points?: any[];
  description?: string;
  version?: number;
  isPublic?: boolean;
  adminStatus?: string;
};
type DeviceAnalytics = {
  total: number;
  mobile: number;
  web: number;
  tablet: number;
  mobilePercent: number;
  webPercent: number;
  trend: { date: string; mobile: number; web: number }[];
};
type AIAnalytics = {
  totalRequests: number;
  totalCost: number;
  avgCostPerRequest: number;
  topTopics: { topic: string; count: number; percent: number }[];
  topDestinations: { destination: string; count: number }[];
  dailyActivity: { date: string; requests: number }[];
  periodDays: number;
};
type CommunityAnalytics = {
  totalPosts: number;
  postsLast24h: number;
  postsLast7d: number;
  totalLikes: number;
  totalComments: number;
  engagementRate: number;
  topPosts: {
    id: string;
    title: string;
    author: string;
    likes: number;
    comments: number;
    createdAt: string;
  }[];
  dailyTrend: { date: string; count: number }[];
};
type SubscriptionAnalytics = {
  total: number;
  active: number;
  cancelled: number;
  newLast30d: number;
  churnLast30d: number;
  churnRate: number;
  mrrTry: number;
  paidUsers: number;
  conversionRate: number;
  planBreakdown: { plan: string; count: number; revenue: number; percent: number }[];
};

type Data = {
  metrics?: AdminMetrics;
  users?: AdminUserItem[];
  routes?: Route[];
  payments?: AdminPaymentItem[];
  reports?: AdminReportItem[];
  audit?: AdminAuditItem[];
  health?: AdminSystemHealthData;
  finance?: AdminFinanceData;
  config?: {
    maintenanceMode: boolean;
    reason?: string;
    version?: number;
    maintenanceMessage?: string;
    routeCreationEnabled?: boolean;
    sharesEnabled?: boolean;
  };
  moduleConfig?: AdminModuleConfig;
  creditStats?: AdminCreditStats;
  stripeConfig?: AdminStripeConfig;
  plans?: AdminPlanConfig[];
  creditPacks?: AdminCreditPackConfig[];
  deviceAnalytics?: DeviceAnalytics;
  aiAnalytics?: AIAnalytics;
  communityAnalytics?: CommunityAnalytics;
  subscriptionAnalytics?: SubscriptionAnalytics;
};
type Action = { title: string; description: string; run: (reason: string) => Promise<unknown> };

const tabs: [Tab, string, string][] = [
  ["overview", "Genel bakış", "◈"],
  ["analytics-devices", "Cihaz & Kullanıcı Analizi", "📱"],
  ["analytics-ai", "AI Sohbet Analizi", "🤖"],
  ["analytics-community", "Topluluk Analizi", "🌍"],
  ["analytics-subscriptions", "Abonelik Analizi", "💳"],
  ["ai-operations", "AI Operasyon Merkezi", "✦"],
  ["modules", "Modüller", "⬡"],
  ["pricing", "Plan & Fiyatlandırma", "◆"],
  ["stripe", "Stripe Yapılandırma", "⬢"],
  ["credits", "Kredi Yönetimi", "◉"],
  ["users", "Kullanıcılar", "♙"],
  ["routes", "Rota yönetimi", "⌁"],
  ["payments", "Ödemeler", "₺"],
  ["reports", "Şikâyetler", "⚑"],
  ["audit", "İşlem geçmişi", "≡"],
  ["subscriptions", "Abonelikler", "◷"],
  ["shares", "Konum paylaşımları", "⌖"],
  ["profiles", "Profil moderasyonu", "♧"],
  ["content", "Yazılar ve rehberler", "▤"],
  ["tickets", "Destek talepleri", "☏"],
  ["announcements", "Duyurular", "◇"],
  ["usage", "AI kullanım kayıtları", "✦"],
  ["system", "Sistem ayarları", "⚙"],
];

const labels: Record<string, string> = {
  pending: "Bekliyor",
  resolved: "Çözüldü",
  dismissed: "Reddedildi",
  succeeded: "Başarılı",
  failed: "Başarısız",
  refunded: "İade edildi",
  approved: "Onaylandı",
  featured: "Öne çıkarıldı",
  active: "Aktif",
  suspended: "Askıda",
  healthy: "Çalışıyor",
  operational: "Çalışıyor",
  degraded: "Sorun var",
  outage: "Kesinti",
  unknown: "Ölçülmüyor",
  configured: "Yapılandırıldı",
  offline: "Bağlı değil",
};
const msg = (error: unknown) =>
  (error as { message?: string })?.message || "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
const date = (value?: string) =>
  value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("tr-TR") : "—";
const money = (value: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(value);
const userId = (u: AdminUserItem) => u.userId || u.sub || u.PK?.replace(/^USER#/, "") || "";
const routeId = (r: Route) =>
  r.routeId ||
  (r.SK?.startsWith("ROUTE#") ? r.SK.slice(6) : r.PK?.startsWith("ROUTE#") ? r.PK.slice(6) : "");
function Badge({ value }: { value: string }) {
  return <span className={`admin-badge ${value}`}>{labels[value] || value}</span>;
}

// ─── Data source tracking ────────────────────────────────────────────────────
type DataSourceStatus = "loaded" | "failed" | "pending";
const DATA_SOURCES = [
  "metrics",
  "users",
  "routes",
  "payments",
  "reports",
  "audit",
  "health",
  "finance",
  "config",
  "moduleConfig",
  "creditStats",
  "stripeConfig",
  "plans",
  "creditPacks",
  "deviceAnalytics",
  "aiTopics",
  "communityAnalytics",
  "subscriptionAnalytics",
] as const;
type DataSourceKey = (typeof DATA_SOURCES)[number];

// ─── Data Source Indicator ────────────────────────────────────────────────────
function SourceAlert({
  sourceKey,
  sources: s,
  label,
}: {
  sourceKey: DataSourceKey;
  sources: Record<DataSourceKey, DataSourceStatus>;
  label: string;
}) {
  if (s[sourceKey] === "loaded") return null;
  if (s[sourceKey] === "pending")
    return <p className="admin-empty">"{label}" verileri yükleniyor…</p>;
  return (
    <p className="admin-alert" role="alert">
      <strong>{label} API'si yanıt vermedi.</strong> Bu bölümdeki veriler gerçek zamanlı değil. API
      Gateway ve Lambda yapılandırmasını kontrol edin.
      <br />
      <small>Endpoint çalışır duruma geldiğinde "Yenile" ile tekrar deneyin.</small>
    </p>
  );
}

// ─── Module Toggle Card ───────────────────────────────────────────────────────
function ModuleToggle({
  icon,
  title,
  description,
  enabled,
  loading,
  onToggle,
}: {
  icon: string;
  title: string;
  description: string;
  enabled: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  return (
    <article className={`module-card ${enabled ? "module-card--on" : "module-card--off"}`}>
      <div className="module-card-top">
        <span className="module-card-icon" aria-hidden>
          {icon}
        </span>
        <div className="module-card-info">
          <strong className="module-card-title">{title}</strong>
          <p className="module-card-desc">{description}</p>
        </div>
      </div>
      <div className="module-card-footer">
        <span className={`module-status-badge ${enabled ? "on" : "off"}`}>
          {enabled ? "● Aktif" : "○ Pasif"}
        </span>
        <button
          type="button"
          className={`module-toggle-btn ${enabled ? "module-toggle-btn--disable" : "module-toggle-btn--enable"}`}
          disabled={loading}
          onClick={onToggle}
        >
          {loading ? "İşleniyor…" : enabled ? "Kapat" : "Aç"}
        </button>
      </div>
    </article>
  );
}

// ─── Credit Bar Chart ─────────────────────────────────────────────────────────
function CreditBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="credit-bar-row">
      <span className="credit-bar-label">{label}</span>
      <div className="credit-bar-track">
        <div className="credit-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="credit-bar-value">{value.toLocaleString("tr-TR")}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const [access, setAccess] = useState<"checking" | "allowed" | "denied" | "error">("checking");
  const [tab, setTab] = useState<Tab>("overview");
  const [session, setSession] = useState<AdminSession | null>(null);
  const [inspectedUser, setInspectedUser] = useState<string | null>(null);
  const [settingsEditor, setSettingsEditor] = useState<{
    title: string;
    description?: string;
    fields: Field[];
    values: ManagedRecord;
    save: (values: ManagedRecord) => Promise<unknown>;
  } | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [data, setData] = useState<Data>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [sources, setSources] = useState<Record<DataSourceKey, DataSourceStatus>>(
    () =>
      Object.fromEntries(DATA_SOURCES.map((k) => [k, "pending"])) as Record<
        DataSourceKey,
        DataSourceStatus
      >,
  );
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState("");
  const [moduleLoading, setModuleLoading] = useState<string | null>(null);
  const busy = useRef(false);
  const mutation = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);

  const load = useCallback(async () => {
    if (busy.current || mutation.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const stored = getStoredSession();
      if (!stored?.token) {
        setAccess("denied");
        setData({});
        return;
      }
      let current: AdminSession;
      try {
        current = (await managementApi.session()).session;
      } catch (err: any) {
        throw err;
      }
      setSession(current);
      setAccess("allowed");
      const allUsers = async () => {
        const users: AdminUserItem[] = [];
        let cursor: string | undefined;
        do {
          const result = await adminApi.listUsers({ limit: 200, cursor });
          users.push(...result.users);
          cursor = result.nextCursor || undefined;
        } while (cursor);
        return { users };
      };
      const tasks: [string, DataSourceKey, () => Promise<Partial<Data>>][] = [
        ["Özet", "metrics", async () => ({ metrics: (await adminApi.getMetrics()).metrics })],
        ["Kullanıcılar", "users", allUsers],
        [
          "Rotalar",
          "routes",
          async () => ({ routes: (await adminApi.listAdminRoutes(100)).routes }),
        ],
        [
          "Ödemeler",
          "payments",
          async () => ({ payments: (await adminApi.listPayments({ limit: 200 })).payments }),
        ],
        [
          "Şikâyetler",
          "reports",
          async () => ({ reports: (await adminApi.listReports()).reports }),
        ],
        [
          "İşlem geçmişi",
          "audit",
          async () => ({ audit: (await adminApi.getAuditLogs(100)).logs }),
        ],
        ["Sistem", "health", async () => ({ health: (await adminApi.getSystemHealth()).health })],
        ["Finans", "finance", async () => ({ finance: (await adminApi.getFinance()).finance })],
        ["Ayarlar", "config", async () => ({ config: (await adminApi.getSystemConfig()).config })],
        [
          "Modüller",
          "moduleConfig",
          async () => ({ moduleConfig: (await adminApi.getModuleConfig()).moduleConfig }),
        ],
        [
          "Kredi İstatistikleri",
          "creditStats",
          async () => ({ creditStats: (await adminApi.getCreditStats()).stats }),
        ],
        [
          "Stripe",
          "stripeConfig",
          async () => ({ stripeConfig: (await adminApi.getStripeConfig()).stripe }),
        ],
        ["Planlar", "plans", async () => ({ plans: (await adminApi.getPlans()).plans })],
        [
          "Kredi Paketleri",
          "creditPacks",
          async () => ({ creditPacks: (await adminApi.getCreditPacks()).packs }),
        ],
        [
          "Cihaz Analizi",
          "deviceAnalytics",
          async () => {
            const r = await apiFetch<{ devices: DeviceAnalytics }>("/admin/analytics/devices");
            return { deviceAnalytics: r.devices };
          },
        ],
        [
          "AI Analizi",
          "aiTopics",
          async () => {
            const r = await apiFetch<{ aiAnalytics: AIAnalytics }>("/admin/analytics/ai-topics");
            return { aiAnalytics: r.aiAnalytics };
          },
        ],
        [
          "Topluluk Analizi",
          "communityAnalytics",
          async () => {
            const r = await apiFetch<{ community: CommunityAnalytics }>(
              "/admin/analytics/community",
            );
            return { communityAnalytics: r.community };
          },
        ],
        [
          "Abonelik Analizi",
          "subscriptionAnalytics",
          async () => {
            const r = await apiFetch<{ subscriptions: SubscriptionAnalytics }>(
              "/admin/analytics/subscriptions",
            );
            return { subscriptionAnalytics: r.subscriptions };
          },
        ],
      ];
      const permissionFor: Record<string, string> = {
        Kullanıcılar: "users",
        Rotalar: "content",
        Ödemeler: "finance",
        Şikâyetler: "content",
        "İşlem geçmişi": "audit",
        Sistem: "system",
        Finans: "finance",
        Ayarlar: "system",
        Modüller: "system",
        "Kredi İstatistikleri": "system",
      };
      const allowedTasks = tasks.filter(
        ([label]) => !permissionFor[label] || current.permissions.includes(permissionFor[label]),
      );
      const results = await Promise.allSettled(allowedTasks.map(([, , run]) => run()));
      if (
        results.some(
          (r) => r.status === "rejected" && (r as PromiseRejectedResult).reason?.status === 401,
        )
      ) {
        setAccess("denied");
        setData({});
        return;
      }
      const failures: string[] = [];
      const next: Partial<Data> = {};
      const nextSources = {
        ...Object.fromEntries(DATA_SOURCES.map((k) => [k, "pending"])),
      } as Record<DataSourceKey, DataSourceStatus>;
      results.forEach((result, index) => {
        const [label, sourceKey] = allowedTasks[index];
        if (result.status === "fulfilled") {
          Object.assign(next, result.value);
          nextSources[sourceKey] = "loaded";
        } else {
          failures.push(`${label}: ${msg(result.reason)}`);
          nextSources[sourceKey] = "failed";
        }
      });
      setData(next);
      setErrors(failures);
      setSources(nextSources);
      if (!failures.length) setUpdated(new Date().toISOString());
    } catch (error) {
      const denied = [401, 403].includes((error as { status?: number })?.status || 0);
      setAccess(denied ? "denied" : "error");
      if (denied) setData({});
      setErrors([msg(error)]);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (!document.hidden && !document.querySelector("dialog[open]")) void load();
    }, 60000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    setPage(0);
    setSelectedIds([]);
  }, [search, filter, tab, fromDate, toDate]);
  useEffect(() => {
    if (action) dialog.current?.showModal();
    else dialog.current?.close();
  }, [action]);

  const ask = (next: Action) => {
    setReason("");
    setNotice("");
    setAction(next);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!action || !reason.trim() || mutation.current) return;
    if (busy.current) { setNotice("Arka plan yenileme devam ediyor, lütfen bekleyin…"); return; }
    mutation.current = true;
    setProcessing(true);
    setNotice("");
    let succeeded = false;
    try {
      await action.run(reason.trim());
      setAction(null);
      setNotice("İşlem başarıyla tamamlandı.");
      succeeded = true;
    } catch (error) {
      setNotice(msg(error));
    } finally {
      mutation.current = false;
      setProcessing(false);
    }
    if (succeeded) await load();
  };
  const exportData = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { exportedAt: new Date().toISOString(), lastFullSync: updated || null, errors, ...data },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mapsbridge-admin-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ── Module toggle handler ────────────────────────────────────────────────
  const handleModuleToggle = async (key: keyof AdminModuleConfig, currentValue: boolean) => {
    const moduleNames: Record<string, string> = {
      mapEnabled: "Harita & Seyahat Planlayıcı",
      aiEnabled: "AI Asistan",
      communityEnabled: "Topluluk",
      messagingEnabled: "Mesajlaşma",
    };
    ask({
      title: `${moduleNames[key] || key} modülünü ${currentValue ? "kapat" : "aç"}`,
      description: currentValue
        ? `Bu modül kapatılırsa kullanıcılar ${moduleNames[key]} özelliğine erişemez. Bakım veya geçici devre dışı bırakma için uygundur.`
        : `Bu modül açılırsa tüm kullanıcılar ${moduleNames[key]} özelliğine erişebilir hale gelir.`,
      run: async (note) => {
        setModuleLoading(key);
        try {
          const updated = await adminApi.updateModuleConfig({ [key]: !currentValue }, note);
          setData((prev) => ({ ...prev, moduleConfig: updated.moduleConfig }));
          setNotice(`✓ ${moduleNames[key]} modülü ${!currentValue ? "açıldı" : "kapatıldı"}.`);
        } finally {
          setModuleLoading(null);
        }
      },
    });
  };

  if (access !== "allowed")
    return (
      <main className="admin-access">
        <section>
          <span className="admin-eyebrow">MAPSBRIDGE / YÖNETİM</span>
          <h1>
            {access === "checking"
              ? "Yetkiniz kontrol ediliyor"
              : access === "denied"
                ? "Yönetici erişimi gerekli"
                : "Sunucuya bağlanılamadı"}
          </h1>
          <p>
            {access === "denied"
              ? "Devam etmek için yönetici yetkisine sahip hesabınızla giriş yapın."
              : access === "error"
                ? errors.join(" ")
                : "Güvenli oturum doğrulanıyor…"}
          </p>
          {access !== "checking" && (
            <div className="admin-actions">
              <a href="/login/?next=/u/admin/">Giriş yap</a>
              <button onClick={() => void load()} disabled={loading}>
                Tekrar dene
              </button>
              <a href="/">Ana sayfa</a>
            </div>
          )}
        </section>
      </main>
    );

  const source =
    tab === "users"
      ? data.users
      : tab === "routes"
        ? data.routes
        : tab === "payments"
          ? data.payments
          : tab === "reports"
            ? data.reports
            : tab === "audit"
              ? data.audit
              : undefined;
  const rows = (source || []).filter((item) => {
    const row = item as Record<string, unknown>;
    const state =
      tab === "users"
        ? row.suspended
          ? "suspended"
          : "active"
        : tab === "routes"
          ? row.adminStatus || "unreviewed"
          : row.status;
    const created = typeof row.createdAt === "string" ? row.createdAt.slice(0, 10) : "";
    if (
      (fromDate && (!created || created < fromDate)) ||
      (toDate && (!created || created > toDate))
    )
      return false;
    return (
      (filter === "all" || state === filter) &&
      JSON.stringify(item).toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR"))
    );
  });
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 20) - 1));
  const visible = rows.slice(currentPage * 20, currentPage * 20 + 20);
  const filterOptions =
    tab === "users"
      ? [
          ["active", "Aktif"],
          ["suspended", "Askıda"],
        ]
      : tab === "routes"
        ? [
            ["unreviewed", "İncelenmedi"],
            ["approved", "Onaylandı"],
            ["featured", "Öne çıkarıldı"],
            ["suspended", "Askıda"],
          ]
        : tab === "payments"
          ? [
              ["succeeded", "Başarılı"],
              ["pending", "Bekliyor"],
              ["failed", "Başarısız"],
              ["refunded", "İade edildi"],
            ]
          : tab === "reports"
            ? [
                ["pending", "Bekliyor"],
                ["resolved", "Çözüldü"],
                ["dismissed", "Reddedildi"],
              ]
            : [];
  const disabled = loading || processing;
  const permissionByTab: Record<string, string> = {
    "ai-operations": "system",
    users: "users",
    routes: "content",
    reports: "content",
    shares: "content",
    profiles: "content",
    content: "content",
    payments: "finance",
    subscriptions: "finance",
    audit: "audit",
    system: "system",
    announcements: "system",
    tickets: "support",
    usage: "system",
    modules: "system",
    credits: "system",
    pricing: "finance",
    stripe: "finance",
  };
  const hasPermission = (target: string) =>
    !permissionByTab[target] || !!session?.permissions.includes(permissionByTab[target]);
  const extraSection = [
    "shares",
    "profiles",
    "content",
    "tickets",
    "announcements",
    "subscriptions",
    "usage",
  ].includes(tab);
  const rowId = (item: unknown) =>
    tab === "users" ? userId(item as AdminUserItem) : routeId(item as Route);
  const bulk = (operation: "suspend" | "approve" | "unsuspend") =>
    ask({
      title: `${selectedIds.length} kayıt için toplu işlem`,
      description: "Her kayıt ayrı ayrı işlenir. Başarısız işlemler sonuçta belirtilir.",
      run: async (note) => {
        const failed: string[] = [];
        let succeeded = 0;
        for (const id of selectedIds) {
          try {
            if (tab === "users") {
              if (operation === "suspend") await adminApi.suspendUser(id, note);
              else await adminApi.unsuspendUser(id, note);
            } else
              await adminApi.routeAction(id, operation === "approve" ? "approve" : "suspend", note);
            succeeded++;
          } catch {
            failed.push(id);
          }
        }
        setSelectedIds([]);
        if (failed.length)
          throw new Error(
            `${succeeded} işlem tamamlandı. Başarısız kayıtlar: ${failed.join(", ")}. Listeyi yenileyin.`,
          );
      },
    });

  const mc = data.moduleConfig;
  const cs = data.creditStats;
  const maxDaily = cs
    ? Math.max(1, ...(cs.dailyConsumption ?? []).map((d) => (d.consumed ?? 0) + (d.granted ?? 0)))
    : 1;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">
          ◈ MapsBridge <small>YÖNETİM PANELİ</small>
        </a>
        <span className="admin-eyebrow">ÇALIŞMA ALANI</span>
        <nav aria-label="Yönetim menüsü">
          {tabs
            .filter(([id]) => hasPermission(id))
            .map(([id, label, icon]) => (
              <button
                key={id}
                aria-current={tab === id ? "page" : undefined}
                onClick={() => {
                  setTab(id);
                  setSearch("");
                  setFilter("all");
                  setFromDate("");
                  setToDate("");
                }}
              >
                <span aria-hidden>{icon}</span>
                {label}
                {id === "reports" &&
                  !!data.reports?.filter((r) => r.status === "pending").length && (
                    <b>{data.reports.filter((r) => r.status === "pending").length}</b>
                  )}
                {id === "modules" && mc && (
                  <b
                    style={{
                      background: mc.aiEnabled && mc.mapEnabled ? "#b5e5c5" : "#f5c6c6",
                      color: mc.aiEnabled && mc.mapEnabled ? "#173b32" : "#8b2020",
                    }}
                  >
                    {
                      [
                        mc.mapEnabled,
                        mc.aiEnabled,
                        mc.communityEnabled,
                        mc.messagingEnabled,
                      ].filter(Boolean).length
                    }
                    /4
                  </b>
                )}
                {id === "stripe" && (
                  <b
                    style={{
                      background: data.stripeConfig?.connected ? "#b5e5c5" : "#f5c6c6",
                      color: data.stripeConfig?.connected ? "#173b32" : "#8b2020",
                    }}
                  >
                    {data.stripeConfig?.connected
                      ? data.stripeConfig.mode === "live"
                        ? "LIVE"
                        : "TEST"
                      : "—"}
                  </b>
                )}
              </button>
            ))}
        </nav>
        <div className="admin-sidebar-footer">
          Operasyon kontrolü
          <small>
            {session?.role === "admin"
              ? "Yönetici"
              : session?.role === "moderator"
                ? "Moderatör"
                : "Destek ekibi"}{" "}
            · Veriler 60 saniyede yenilenir.
          </small>
          <a href="/u/">Uygulamaya dön ↗</a>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <span className="admin-eyebrow">MAPSBRIDGE / OPERASYON</span>
            <h1>{tabs.find(([id]) => id === tab)?.[1]}</h1>
            {tab !== "ai-operations" && <p>Son tam güncelleme: {date(updated)}</p>}
          </div>
          <div className="admin-actions">
            {tab !== "ai-operations" && (
              <>
                <button disabled={disabled} onClick={() => void load()}>
                  {loading ? "Yenileniyor…" : "↻ Yenile"}
                </button>
                <button onClick={exportData} disabled={loading}>
                  JSON dışa aktar
                </button>
              </>
            )}
          </div>
        </header>

        {!!errors.length && (
          <section className="admin-alert" role="alert">
            <strong>
              {errors.length >= 5
                ? "Sunucu bağlantısı kurulamıyor. API Gateway ve Lambda yapılandırmasını kontrol edin."
                : "Bazı veriler yenilenemedi. Önceki kayıtlar güncel olmayabilir."}
            </strong>
            {errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </section>
        )}
        {notice && !action && (
          <p role="status" className="admin-notice">
            {notice}
          </p>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* GENEL BAKIŞ                                               */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === "ai-operations" && hasPermission("ai-operations") && <AIDashboard />}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* ANALİTİK: CİHAZ & KULLANICI                               */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {tab === "analytics-devices" && (
          <div className="admin-section">
            <h2>Cihaz &amp; Kullanıcı Analizi</h2>
            <SourceAlert sourceKey="deviceAnalytics" sources={sources} label="Cihaz Analizi" />
            {!data.deviceAnalytics ? null : (
              <>
                <div className="admin-stats">
                  {(
                    [
                      ["Toplam Oturum", data.deviceAnalytics.total],
                      ["Mobil / Tablet", data.deviceAnalytics.mobile + data.deviceAnalytics.tablet],
                      ["Web", data.deviceAnalytics.web],
                      ["Mobil Oran", `%${data.deviceAnalytics.mobilePercent}`],
                    ] as [string, number | string][]
                  ).map(([label, value]) => (
                    <div key={label} className="admin-stat-card">
                      <div className="admin-stat-value">{value ?? "—"}</div>
                      <div className="admin-stat-label">{label}</div>
                    </div>
                  ))}
                </div>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Mobil</th>
                      <th>Web</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.deviceAnalytics.trend.slice(-14).map((r) => (
                      <tr key={r.date}>
                        <td>{r.date}</td>
                        <td>{r.mobile}</td>
                        <td>{r.web}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* ANALİTİK: AI SOHBET                                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {tab === "analytics-ai" && (
          <div className="admin-section">
            <h2>AI Sohbet Analizi — Son 30 Gün</h2>
            <SourceAlert sourceKey="aiTopics" sources={sources} label="AI Analizi" />
            {!data.aiAnalytics ? null : (
              <>
                <div className="admin-stats">
                  {(
                    [
                      ["Toplam İstek", data.aiAnalytics.totalRequests],
                      ["Toplam Kredi", data.aiAnalytics.totalCost.toFixed(2)],
                      ["Ortalama Kredi/İstek", data.aiAnalytics.avgCostPerRequest.toFixed(3)],
                    ] as [string, string | number][]
                  ).map(([label, value]) => (
                    <div key={label} className="admin-stat-card">
                      <div className="admin-stat-value">{value}</div>
                      <div className="admin-stat-label">{label}</div>
                    </div>
                  ))}
                </div>
                <h3 style={{ margin: "1.5rem 0 0.5rem" }}>En Çok Sorulan Konular</h3>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Konu</th>
                      <th>İstek</th>
                      <th>Oran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.aiAnalytics.topTopics.map((r) => (
                      <tr key={r.topic}>
                        <td>{r.topic}</td>
                        <td>{r.count}</td>
                        <td>%{r.percent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3 style={{ margin: "1.5rem 0 0.5rem" }}>En Popüler Destinasyonlar</h3>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Destinasyon</th>
                      <th>Anılma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.aiAnalytics.topDestinations.map((r) => (
                      <tr key={r.destination}>
                        <td style={{ textTransform: "capitalize" }}>{r.destination}</td>
                        <td>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3 style={{ margin: "1.5rem 0 0.5rem" }}>Günlük İstek Trendi</h3>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>İstek</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.aiAnalytics.dailyActivity.slice(-14).map((r) => (
                      <tr key={r.date}>
                        <td>{r.date}</td>
                        <td>{r.requests}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* ANALİTİK: TOPLULUK                                         */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {tab === "analytics-community" && (
          <div className="admin-section">
            <h2>Topluluk Analizi</h2>
            <SourceAlert sourceKey="communityAnalytics" sources={sources} label="Topluluk Analizi" />
            {!data.communityAnalytics ? null : (
              <>
                <div className="admin-stats">
                  {(
                    [
                      ["Toplam Gönderi", data.communityAnalytics.totalPosts],
                      ["Son 24 saat", data.communityAnalytics.postsLast24h],
                      ["Son 7 gün", data.communityAnalytics.postsLast7d],
                      ["Toplam Beğeni", data.communityAnalytics.totalLikes],
                      ["Toplam Yorum", data.communityAnalytics.totalComments],
                      ["Etkileşim Ort.", data.communityAnalytics.engagementRate],
                    ] as [string, number][]
                  ).map(([label, value]) => (
                    <div key={label} className="admin-stat-card">
                      <div className="admin-stat-value">{value}</div>
                      <div className="admin-stat-label">{label}</div>
                    </div>
                  ))}
                </div>
                <h3 style={{ margin: "1.5rem 0 0.5rem" }}>
                  Bu Haftanın En Çok Etkileşim Alan Gönderileri
                </h3>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Gönderi</th>
                      <th>Yazar</th>
                      <th>Beğeni</th>
                      <th>Yorum</th>
                      <th>Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.communityAnalytics.topPosts.map((p) => (
                      <tr key={p.id}>
                        <td
                          style={{
                            maxWidth: 200,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.title}
                        </td>
                        <td>{p.author}</td>
                        <td>{p.likes}</td>
                        <td>{p.comments}</td>
                        <td>{date(p.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3 style={{ margin: "1.5rem 0 0.5rem" }}>Günlük Gönderi Trendi (Son 14 Gün)</h3>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Gönderi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.communityAnalytics.dailyTrend.slice(-14).map((r) => (
                      <tr key={r.date}>
                        <td>{r.date}</td>
                        <td>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* ANALİTİK: ABONELİK                                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {tab === "analytics-subscriptions" && (
          <div className="admin-section">
            <h2>Abonelik &amp; Gelir Analizi</h2>
            <SourceAlert sourceKey="subscriptionAnalytics" sources={sources} label="Abonelik Analizi" />
            {!data.subscriptionAnalytics ? null : (
              <>
                <div className="admin-stats">
                  {(
                    [
                      ["Toplam Abonelik", data.subscriptionAnalytics.total],
                      ["Aktif", data.subscriptionAnalytics.active],
                      ["İptal", data.subscriptionAnalytics.cancelled],
                      ["Yeni (30g)", data.subscriptionAnalytics.newLast30d],
                      ["Churn (30g)", data.subscriptionAnalytics.churnLast30d],
                      ["MRR (₺)", data.subscriptionAnalytics.mrrTry],
                      ["Ücretli Kullanıcı", data.subscriptionAnalytics.paidUsers],
                      [`Dönüşüm %${data.subscriptionAnalytics.conversionRate}`, "oran"],
                    ] as [string, number | string][]
                  )
                    .filter(([, v]) => v !== "oran")
                    .map(([label, value]) => (
                      <div key={label} className="admin-stat-card">
                        <div className="admin-stat-value">{value}</div>
                        <div className="admin-stat-label">{label}</div>
                      </div>
                    ))}
                </div>
                <h3 style={{ margin: "1.5rem 0 0.5rem" }}>Plan Dağılımı</h3>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Kullanıcı</th>
                      <th>Oran</th>
                      <th>Gelir (₺)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subscriptionAnalytics.planBreakdown.map((r) => (
                      <tr key={r.plan}>
                        <td style={{ textTransform: "capitalize" }}>{r.plan}</td>
                        <td>{r.count}</td>
                        <td>%{r.percent}</td>
                        <td>{r.revenue.toLocaleString("tr-TR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ marginTop: "1rem", color: "#64748b", fontSize: 13 }}>
                  Tahmini Dönüşüm Oranı:{" "}
                  <strong>%{data.subscriptionAnalytics.conversionRate}</strong> &nbsp;·&nbsp; Churn
                  Oranı: <strong>%{data.subscriptionAnalytics.churnRate}</strong>
                </p>
              </>
            )}
          </div>
        )}

        {tab === "overview" && (
          <>
            <div className="admin-stats">
              {(
                [
                  ["Kayıtlı kullanıcı", data.metrics?.totalUsers],
                  ["Aktif abonelik", data.metrics?.activeSubscriptions],
                  ["Yayınlanan rehber", data.metrics?.totalGuides],
                  ["Bugünkü ödeme", data.metrics?.todayPayments],
                ] as [string, number | undefined][]
              ).map(([label, value]) => (
                <article key={label} className="admin-card">
                  <span>{label}</span>
                  <strong>{typeof value === "number" ? value.toLocaleString("tr-TR") : "—"}</strong>
                </article>
              ))}
            </div>
            {/* Modül Durumu Özeti */}
            <section className="admin-card">
              <h2>Aktif Modüller</h2>
              {!mc ? (
                <SourceAlert
                  sourceKey="moduleConfig"
                  sources={sources}
                  label="Modül yapılandırması"
                />
              ) : (
                <div className="module-overview-grid">
                  {(
                    [
                      ["🗺️", "Harita", mc.mapEnabled],
                      ["🤖", "AI Asistan", mc.aiEnabled],
                      ["👥", "Topluluk", mc.communityEnabled],
                      ["💬", "Mesajlaşma", mc.messagingEnabled],
                    ] as [string, string, boolean][]
                  ).map(([icon, name, on]) => (
                    <div key={name} className={`module-overview-pill ${on ? "on" : "off"}`}>
                      <span>{icon}</span>
                      <span>{name}</span>
                      <span className={`module-status-dot ${on ? "on" : "off"}`} />
                    </div>
                  ))}
                  <button onClick={() => setTab("modules")} className="module-overview-manage">
                    Modülleri Yönet →
                  </button>
                </div>
              )}
            </section>
            <section className="admin-card">
              <h2>Operasyon özeti</h2>
              <div className="admin-summary">
                <div>
                  <span>Bekleyen şikâyet</span>
                  <strong>
                    {data.reports?.filter((r) => r.status === "pending").length ?? "—"}
                  </strong>
                  <button
                    onClick={() => {
                      setTab("reports");
                      setFilter("pending");
                    }}
                  >
                    Şikâyetleri incele →
                  </button>
                </div>
                <div>
                  <span>Başarılı ödeme toplamı</span>
                  <strong>{data.finance ? money(data.finance.totalRevenueTRY) : "—"}</strong>
                  <button onClick={() => setTab("payments")}>Ödemeleri incele →</button>
                </div>
                <div>
                  <span>Sistem durumu</span>
                  <strong>{data.health ? labels[data.health.status] : "—"}</strong>
                  <button onClick={() => setTab("system")}>Servisleri görüntüle →</button>
                </div>
                <div>
                  <span>Kredi bakiyesi (toplam)</span>
                  <strong>{cs ? cs.totalCreditsRemaining.toLocaleString("tr-TR") : "—"}</strong>
                  <button onClick={() => setTab("credits")}>Kredi yönetimi →</button>
                </div>
                <div>
                  <span>Aktif rota</span>
                  <strong>{data.routes?.length ?? "—"}</strong>
                  <button onClick={() => setTab("routes")}>Rotaları yönet →</button>
                </div>
                <div>
                  <span>Stripe durumu</span>
                  <strong>
                    {sources.stripeConfig === "loaded"
                      ? data.stripeConfig?.connected
                        ? data.stripeConfig.mode === "live"
                          ? "Canlı"
                          : "Test"
                        : "Bağlı değil"
                      : sources.stripeConfig === "failed"
                        ? "API hatası"
                        : "—"}
                  </strong>
                  <button onClick={() => setTab("stripe")}>Stripe ayarları →</button>
                </div>
                <div>
                  <span>Aktif plan sayısı</span>
                  <strong>
                    {sources.plans === "loaded"
                      ? (data.plans?.filter((p) => p.enabled).length ?? 0)
                      : sources.plans === "failed"
                        ? "API hatası"
                        : "—"}
                  </strong>
                  <button onClick={() => setTab("pricing")}>Fiyatlandırma →</button>
                </div>
              </div>
            </section>
            <section className="admin-card">
              <h2>Hızlı İşlemler</h2>
              <div className="admin-actions" style={{ flexWrap: "wrap", gap: 8 }}>
                <button onClick={() => setTab("users")}>Kullanıcı ara</button>
                <button
                  onClick={() => {
                    setTab("reports");
                    setFilter("pending");
                  }}
                >
                  Bekleyen şikâyetler
                </button>
                <button onClick={() => setTab("tickets")}>Destek talepleri</button>
                <button onClick={() => setTab("announcements")}>Duyuru oluştur</button>
                <button onClick={() => setTab("system")}>Bakım modu</button>
                <button onClick={() => setTab("ai-operations")}>AI operasyonları</button>
                <button onClick={() => setTab("pricing")}>Plan ve fiyatlar</button>
                <button onClick={() => setTab("stripe")}>Stripe yapılandır</button>
                <button onClick={() => setTab("audit")}>İşlem geçmişi</button>
              </div>
            </section>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* MODÜLLER SEKMESİ                                          */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === "modules" && (
          <div>
            <SourceAlert sourceKey="moduleConfig" sources={sources} label="Modül yapılandırması" />
            {!mc ? (
              <section className="admin-card">
                <h2>Modül Yönetimi</h2>
                <p className="admin-empty">
                  Modül yapılandırması yüklenemedi. <code>/admin/module-config</code>{" "}
                  endpoint&apos;inin çalıştığını doğrulayın.
                </p>
                <div className="admin-actions">
                  <button disabled={disabled} onClick={() => void load()}>
                    Tekrar dene
                  </button>
                </div>
              </section>
            ) : (
              <>
                <section className="admin-card">
                  <h2>Modül Yönetimi</h2>
                  <p>
                    Her modülü bağımsız olarak açıp kapatabilirsiniz. Değişiklikler anında tüm
                    kullanıcılara yansır. Tüm değişiklikler işlem geçmişine kaydedilir.
                  </p>
                  {data.moduleConfig?.updatedAt && (
                    <p style={{ fontSize: 12, color: "var(--admin-muted)" }}>
                      Son güncelleme: {date(data.moduleConfig.updatedAt)}
                      {data.moduleConfig.updatedBy ? ` · ${data.moduleConfig.updatedBy}` : ""}
                    </p>
                  )}
                  <div className="module-cards-grid">
                    <ModuleToggle
                      icon="🗺️"
                      title="Harita & Seyahat Planlayıcı"
                      description="Kullanıcıların harita masasına, gezi planlamasına ve OSRM rota çizimine erişimini kontrol eder. Temel özellik — kapatmak kullanıcı deneyimini önemli ölçüde etkiler."
                      enabled={mc.mapEnabled}
                      loading={moduleLoading === "mapEnabled"}
                      onToggle={() => handleModuleToggle("mapEnabled", mc.mapEnabled)}
                    />
                    <ModuleToggle
                      icon="🤖"
                      title="AI Asistan"
                      description="Yapay zeka ile seyahat planlama, rota oluşturma ve AI sohbet özelliklerini kontrol eder. Kapatıldığında kredi tüketimi durur."
                      enabled={mc.aiEnabled}
                      loading={moduleLoading === "aiEnabled"}
                      onToggle={() => handleModuleToggle("aiEnabled", mc.aiEnabled)}
                    />
                    <ModuleToggle
                      icon="👥"
                      title="Topluluk"
                      description="Topluluk keşif sayfası, rehberler ve kullanıcı profillerinin herkese açık görünümünü kontrol eder."
                      enabled={mc.communityEnabled}
                      loading={moduleLoading === "communityEnabled"}
                      onToggle={() => handleModuleToggle("communityEnabled", mc.communityEnabled)}
                    />
                    <ModuleToggle
                      icon="💬"
                      title="Mesajlaşma"
                      description="Kullanıcılar arası doğrudan mesajlaşma ve sohbet iş parçacıklarını kontrol eder. Kapatıldığında mevcut mesajlar korunur."
                      enabled={mc.messagingEnabled}
                      loading={moduleLoading === "messagingEnabled"}
                      onToggle={() => handleModuleToggle("messagingEnabled", mc.messagingEnabled)}
                    />
                  </div>
                </section>

                <section className="admin-card">
                  <h2>Modül Durum Özeti</h2>
                  <div className="module-status-table">
                    <div className="module-status-header">
                      <span>Modül</span>
                      <span>Durum</span>
                      <span>Etki</span>
                    </div>
                    {(
                      [
                        ["🗺️ Harita", mc.mapEnabled, "Panel, rota çizimi, pin yönetimi"],
                        ["🤖 AI Asistan", mc.aiEnabled, "Sohbet, rota planlama, kredi tüketimi"],
                        [
                          "👥 Topluluk",
                          mc.communityEnabled,
                          "Rehberler, profil sayfaları, keşif feed'i",
                        ],
                        [
                          "💬 Mesajlaşma",
                          mc.messagingEnabled,
                          "DM, sohbet başlıkları, bildirimler",
                        ],
                      ] as [string, boolean, string][]
                    ).map(([name, on, impact]) => (
                      <div key={name} className="module-status-row">
                        <span className="module-status-name">{name}</span>
                        <span className={`module-status-badge ${on ? "on" : "off"}`}>
                          {on ? "● Aktif" : "○ Pasif"}
                        </span>
                        <span className="module-status-impact">{impact}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* KREDİ YÖNETİMİ                                            */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === "credits" && (
          <div>
            <SourceAlert sourceKey="creditStats" sources={sources} label="Kredi istatistikleri" />
            {/* Özet Kartlar */}
            <div className="admin-stats">
              {(
                [
                  ["Toplam Dağıtılan Kredi", cs?.totalCreditsGranted],
                  ["Toplam Tüketilen Kredi", cs?.totalCreditsConsumed],
                  ["Aktif Kullanıcı Bakiyesi", cs?.totalCreditsRemaining],
                  ["Kredi Sahibi Kullanıcı", cs?.activeWallets],
                ] as [string, number | undefined][]
              ).map(([label, value]) => (
                <article key={label} className="admin-card">
                  <span>{label}</span>
                  <strong>{typeof value === "number" ? value.toLocaleString("tr-TR") : "—"}</strong>
                </article>
              ))}
            </div>

            {/* Plan Dağılımı */}
            <section className="admin-card">
              <h2>Plan Dağılımı & Ortalama Bakiye</h2>
              {cs?.planDistribution?.length ? (
                <div className="plan-dist-grid">
                  {cs.planDistribution.map((p) => (
                    <article key={p.tier} className="plan-dist-card">
                      <span className="plan-dist-tier">
                        {p.tier === "free"
                          ? "Gezgin (Free)"
                          : p.tier === "explorer"
                            ? "Kaşif"
                            : p.tier === "pro"
                              ? "Pro Kaşif"
                              : p.tier === "agency"
                                ? "Tur Lideri"
                                : p.tier}
                      </span>
                      <strong className="plan-dist-count">
                        {p.userCount.toLocaleString("tr-TR")} kullanıcı
                      </strong>
                      <span className="plan-dist-avg">Ort. {p.avgCredits.toFixed(0)} kredi</span>
                      <div className="plan-dist-bar-wrap">
                        <div
                          className="plan-dist-bar"
                          style={{
                            width: `${Math.min(100, (p.userCount / Math.max(1, ...cs.planDistribution.map((x) => x.userCount))) * 100)}%`,
                          }}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="admin-empty">Plan dağılımı verisi yüklenemedi.</p>
              )}
            </section>

            {/* Modül Bazlı Tüketim */}
            <section className="admin-card">
              <h2>Modül Bazlı Kredi Tüketimi</h2>
              {cs?.byModule ? (
                <div className="credit-bars-section">
                  {(() => {
                    const maxVal = Math.max(
                      1,
                      cs.byModule.ai_chat,
                      cs.byModule.ai_deep_trip,
                      cs.byModule.ai_stay_dining,
                      cs.byModule.route_optimize,
                    );
                    return (
                      <>
                        <CreditBar
                          label="AI Sohbet (1 kredi)"
                          value={cs.byModule.ai_chat}
                          max={maxVal}
                          color="#10b981"
                        />
                        <CreditBar
                          label="Derin Rota Planlama (5 kredi)"
                          value={cs.byModule.ai_deep_trip}
                          max={maxVal}
                          color="#2563eb"
                        />
                        <CreditBar
                          label="Konaklama & Gastronomi (2 kredi)"
                          value={cs.byModule.ai_stay_dining}
                          max={maxVal}
                          color="#8b5cf6"
                        />
                        <CreditBar
                          label="Rota Optimizasyonu (1 kredi)"
                          value={cs.byModule.route_optimize}
                          max={maxVal}
                          color="#f59e0b"
                        />
                      </>
                    );
                  })()}
                </div>
              ) : (
                <p className="admin-empty">Modül tüketim verisi yüklenemedi.</p>
              )}
            </section>

            {/* Günlük Tüketim Grafiği */}
            <section className="admin-card">
              <h2>Son 30 Günlük Kredi Akışı</h2>
              {cs?.dailyConsumption?.length ? (
                <div className="daily-chart-wrap">
                  {cs.dailyConsumption.slice(-30).map((d) => (
                    <div
                      key={d.date}
                      className="daily-chart-col"
                      title={`${d.date}: ${d.consumed} tüketilen, ${d.granted} verilen`}
                    >
                      <div
                        className="daily-chart-bar daily-chart-bar--granted"
                        style={{ height: `${Math.round((d.granted / maxDaily) * 80)}px` }}
                      />
                      <div
                        className="daily-chart-bar daily-chart-bar--consumed"
                        style={{ height: `${Math.round((d.consumed / maxDaily) * 80)}px` }}
                      />
                      <span className="daily-chart-date">{d.date.slice(5)}</span>
                    </div>
                  ))}
                  <div className="daily-chart-legend">
                    <span className="legend-item legend-granted">▪ Verilen</span>
                    <span className="legend-item legend-consumed">▪ Tüketilen</span>
                  </div>
                </div>
              ) : (
                <p className="admin-empty">
                  Günlük kredi verisi yüklenemedi. API bağlantısını kontrol edin.
                </p>
              )}
            </section>

            {/* En Çok Tüketen Kullanıcılar */}
            <section className="admin-card">
              <h2>En Çok Kredi Tüketen Kullanıcılar</h2>
              {cs?.topConsumers?.length ? (
                <div className="admin-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Kullanıcı</th>
                        <th>Plan</th>
                        <th>Tüketim</th>
                        <th>İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cs.topConsumers.map((u, i) => (
                        <tr key={u.userId}>
                          <td>
                            <strong>
                              #{i + 1} {u.email || u.userId}
                            </strong>
                          </td>
                          <td>
                            <Badge value={u.tier} />
                          </td>
                          <td>
                            <strong>{u.consumed.toLocaleString("tr-TR")} kredi</strong>
                          </td>
                          <td>
                            <button onClick={() => setInspectedUser(u.userId)}>Profil</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="admin-empty">Tüketim verisi yüklenemedi.</p>
              )}
            </section>

            {/* Toplu Kredi İşlemleri */}
            <section className="admin-card">
              <h2>Toplu Kredi İşlemleri</h2>
              <p>
                Belirli bir plana ait tüm kullanıcılara aynı anda kredi ekleyebilir veya
                düşebilirsiniz. İşlemler tek tek uygulanır ve başarısız olanlar raporlanır.
              </p>
              <div className="admin-actions">
                <button
                  disabled={disabled}
                  onClick={() =>
                    setSettingsEditor({
                      title: "Plana göre toplu kredi ver",
                      description:
                        "Seçilen plandaki tüm aktif kullanıcıların cüzdanına belirtilen miktarda kredi eklenir. Dondurulmuş cüzdanlar atlanır.",
                      fields: [
                        {
                          key: "tier",
                          label: "Hedef plan",
                          type: "select",
                          options: [
                            ["free", "Gezgin (Free)"],
                            ["explorer", "Kaşif"],
                            ["pro", "Pro Kaşif"],
                            ["agency", "Tur Lideri"],
                          ],
                          required: true,
                        },
                        {
                          key: "amount",
                          label: "Kredi miktarı (pozitif)",
                          type: "number",
                          required: true,
                        },
                      ],
                      values: { tier: "free", amount: 10 },
                      save: async (values) => {
                        const amount = Number(values.amount);
                        if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000)
                          throw new Error("Miktar 1–1000 arasında olmalıdır.");
                        const reason = String(values.reason || "").trim();
                        if (!reason) throw new Error("Gerekçe zorunludur.");
                        const targetUsers = (data.users || []).filter(
                          (u) => !u.suspended && u.tier === values.tier,
                        );
                        if (!targetUsers.length)
                          throw new Error("Bu planda aktif kullanıcı bulunamadı.");
                        let succeeded = 0;
                        const failed: string[] = [];
                        for (const u of targetUsers) {
                          const uid = userId(u);
                          if (!uid) continue;
                          try {
                            await managementApi.save(`users/${encodeURIComponent(uid)}/credits`, {
                              delta: amount,
                              requestId: `bulk_${Date.now()}_${uid}`,
                              reason,
                            });
                            succeeded++;
                          } catch {
                            failed.push(u.email || uid);
                          }
                        }
                        if (failed.length)
                          throw new Error(
                            `${succeeded} kullanıcıya kredi eklendi. Başarısız: ${failed.join(", ")}`,
                          );
                      },
                    })
                  }
                >
                  Plana göre toplu kredi ver
                </button>
              </div>
            </section>

            {/* Kredi Planlama Önerileri */}
            <section className="admin-card">
              <h2>Kredi Planlama Tavsiyeleri</h2>
              <div className="credit-advice-grid">
                {cs && cs.averageBalancePerUser < 5 && (
                  <div className="credit-advice-card credit-advice--warn">
                    <span className="credit-advice-icon">⚠️</span>
                    <div>
                      <strong>Düşük Ortalama Bakiye</strong>
                      <p>
                        Kullanıcı başına ortalama kredi {cs.averageBalancePerUser.toFixed(1)} — bu
                        değer 5'in altında. Ücretsiz kredi kampanyası veya hoş geldin paketi
                        artırımı düşünün.
                      </p>
                    </div>
                  </div>
                )}
                {cs && cs.byModule.ai_deep_trip > cs.byModule.ai_chat * 2 && (
                  <div className="credit-advice-card credit-advice--info">
                    <span className="credit-advice-icon">💡</span>
                    <div>
                      <strong>Yoğun Rota Planlama Talebi</strong>
                      <p>
                        Derin rota planlama (5 kredi) sohbetten 2 kat fazla kullanılıyor. Pro planı
                        teşviki veya rota planı fiyatını düşürme değerlendirilebilir.
                      </p>
                    </div>
                  </div>
                )}
                {cs && mc && !mc.aiEnabled && (
                  <div className="credit-advice-card credit-advice--warn">
                    <span className="credit-advice-icon">🔴</span>
                    <div>
                      <strong>AI Modülü Kapalı</strong>
                      <p>
                        AI Asistan modülü kapalı olduğu için kredi tüketimi durmuştur. Modülü açmak
                        için{" "}
                        <button className="credit-advice-link" onClick={() => setTab("modules")}>
                          Modüller sekmesine
                        </button>{" "}
                        gidin.
                      </p>
                    </div>
                  </div>
                )}
                {(!cs || !cs.averageBalancePerUser || cs.averageBalancePerUser >= 5) &&
                  mc?.aiEnabled && (
                    <div className="credit-advice-card credit-advice--ok">
                      <span className="credit-advice-icon">✅</span>
                      <div>
                        <strong>Sistem Sağlıklı</strong>
                        <p>
                          Kredi dağılımı ve tüketim oranları normal görünüyor. Aylık raporları
                          düzenli takip edin.
                        </p>
                      </div>
                    </div>
                  )}
              </div>
            </section>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* PLAN & FİYATLANDIRMA                                      */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === "pricing" && (
          <div>
            {/* Abonelik Planları */}
            <section className="admin-card">
              <div className="admin-header" style={{ marginBottom: 16 }}>
                <div>
                  <h2>Abonelik Planları</h2>
                  <p>
                    Kullanıcılara sunulan aylık/yıllık üyelik seçenekleri. Stripe bağlantısı
                    kurulduktan sonra fiyat değişiklikleri doğrudan yansır.
                  </p>
                </div>
              </div>
              <SourceAlert sourceKey="plans" sources={sources} label="Plan" />
              {sources.stripeConfig === "loaded" && !data.stripeConfig?.connected && (
                <p className="admin-alert">
                  Stripe henüz bağlı değil. Plan düzenlemeleri kaydedilir ancak ödeme alınamaz.{" "}
                  <button onClick={() => setTab("stripe")}>Stripe yapılandır →</button>
                </p>
              )}
              {!data.plans?.length && sources.plans !== "pending" && sources.plans !== "loaded" ? (
                <p className="admin-empty">
                  Plan verileri yüklenemedi. API endpoint&apos;ini kontrol edip &quot;Yenile&quot;
                  düğmesini kullanın.
                </p>
              ) : null}
              <div className="pricing-plans-grid">
                {(data.plans || []).map((plan) => (
                  <article
                    key={plan.id}
                    className={`pricing-plan-card ${plan.highlight ? "pricing-plan-card--highlight" : ""} ${!plan.enabled ? "pricing-plan-card--disabled" : ""}`}
                    style={{ borderTopColor: plan.color }}
                  >
                    <div className="pricing-plan-header">
                      <span className="pricing-plan-badge" style={{ background: plan.color }}>
                        {plan.badge || plan.id.toUpperCase()}
                      </span>
                      <span className={`module-status-badge ${plan.enabled ? "on" : "off"}`}>
                        {plan.enabled ? "● Aktif" : "○ Pasif"}
                      </span>
                    </div>
                    <h3 className="pricing-plan-name">{plan.name}</h3>
                    <p className="pricing-plan-tagline">{plan.tagline}</p>
                    <div className="pricing-plan-prices">
                      <div className="pricing-plan-price">
                        <strong>{money(plan.monthlyPriceTry)}</strong>
                        <span>/ay</span>
                      </div>
                      <div className="pricing-plan-price pricing-plan-price--yearly">
                        <strong>{money(plan.yearlyPriceTry)}</strong>
                        <span>/ay (yıllık)</span>
                      </div>
                    </div>
                    <div className="pricing-plan-meta">
                      <span>
                        Aylık kredi: <strong>{plan.monthlyCredits.toLocaleString("tr-TR")}</strong>
                      </span>
                      <span>
                        Aktif abone:{" "}
                        <strong>{plan.activeSubscribers.toLocaleString("tr-TR")}</strong>
                      </span>
                    </div>
                    {plan.stripePriceIdMonthly && (
                      <small className="pricing-stripe-id">
                        Stripe: {plan.stripePriceIdMonthly}
                      </small>
                    )}
                    <div className="admin-actions" style={{ marginTop: 12 }}>
                      <button
                        disabled={disabled}
                        onClick={() =>
                          setSettingsEditor({
                            title: `${plan.name} — Plan Düzenle`,
                            description:
                              "Fiyat değişiklikleri mevcut abonelikleri etkilemez, yalnızca yeni abonelikler için geçerlidir.",
                            fields: [
                              { key: "name", label: "Plan adı", required: true, max: 60 },
                              { key: "tagline", label: "Açıklama", max: 200 },
                              {
                                key: "monthlyPriceTry",
                                label: "Aylık fiyat (₺)",
                                type: "number",
                                required: true,
                              },
                              {
                                key: "yearlyPriceTry",
                                label: "Yıllık aylık fiyat (₺)",
                                type: "number",
                                required: true,
                              },
                              {
                                key: "monthlyCredits",
                                label: "Aylık kredi",
                                type: "number",
                                required: true,
                              },
                              { key: "badge", label: "Rozet metni", max: 20 },
                              { key: "enabled", label: "Satışa açık", type: "checkbox" },
                              { key: "stripePriceIdMonthly", label: "Stripe aylık Price ID" },
                              { key: "stripePriceIdYearly", label: "Stripe yıllık Price ID" },
                            ],
                            values: { ...plan, version: 0 },
                            save: (values) =>
                              adminApi.updatePlan(plan.id, {
                                name: String(values.name || ""),
                                tagline: String(values.tagline || ""),
                                monthlyPriceTry: Number(values.monthlyPriceTry) || 0,
                                yearlyPriceTry: Number(values.yearlyPriceTry) || 0,
                                monthlyCredits: Number(values.monthlyCredits) || 0,
                                badge: String(values.badge || ""),
                                enabled: !!values.enabled,
                                stripePriceIdMonthly: String(values.stripePriceIdMonthly || ""),
                                stripePriceIdYearly: String(values.stripePriceIdYearly || ""),
                                reason: String(values.reason || ""),
                              }),
                          })
                        }
                      >
                        Düzenle
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* Kredi Paketleri */}
            <section className="admin-card">
              <div className="admin-header" style={{ marginBottom: 16 }}>
                <div>
                  <h2>Kredi Paketleri</h2>
                  <p>
                    Tek seferlik satın alınabilen kredi paketleri. Birim fiyat otomatik hesaplanır.
                  </p>
                </div>
              </div>
              <SourceAlert sourceKey="creditPacks" sources={sources} label="Kredi Paketleri" />
              {!data.creditPacks?.length &&
              sources.creditPacks !== "pending" &&
              sources.creditPacks !== "loaded" ? (
                <p className="admin-empty">
                  Kredi paketi verileri yüklenemedi. API endpoint&apos;ini kontrol edip
                  &quot;Yenile&quot; düğmesini kullanın.
                </p>
              ) : null}
              <div className="pricing-packs-grid">
                {(data.creditPacks || []).map((pack) => (
                  <article
                    key={pack.id}
                    className={`pricing-pack-card ${pack.popular ? "pricing-pack-card--popular" : ""} ${!pack.enabled ? "pricing-pack-card--disabled" : ""}`}
                  >
                    <div className="pricing-pack-header">
                      {pack.popular && <span className="pricing-pack-popular">POPÜLER</span>}
                      <span className={`module-status-badge ${pack.enabled ? "on" : "off"}`}>
                        {pack.enabled ? "● Aktif" : "○ Pasif"}
                      </span>
                    </div>
                    <h3 className="pricing-pack-title">{pack.title}</h3>
                    <p className="pricing-pack-desc">{pack.description}</p>
                    <div className="pricing-pack-stats">
                      <div className="pricing-pack-stat">
                        <strong>{pack.credits.toLocaleString("tr-TR")}</strong>
                        <span>kredi</span>
                      </div>
                      {pack.bonusCredits > 0 && (
                        <div className="pricing-pack-stat pricing-pack-stat--bonus">
                          <strong>+{pack.bonusCredits.toLocaleString("tr-TR")}</strong>
                          <span>bonus</span>
                        </div>
                      )}
                      <div className="pricing-pack-stat">
                        <strong>{money(pack.priceTry)}</strong>
                        <span>fiyat</span>
                      </div>
                      <div className="pricing-pack-stat">
                        <strong>{money(pack.unitPriceTry)}</strong>
                        <span>/kredi</span>
                      </div>
                    </div>
                    <div className="pricing-pack-meta">
                      <span>
                        Toplam satış: <strong>{pack.totalPurchases.toLocaleString("tr-TR")}</strong>
                      </span>
                      {pack.stripeProductId && <small>Stripe: {pack.stripeProductId}</small>}
                    </div>
                    <div className="admin-actions" style={{ marginTop: 12 }}>
                      <button
                        disabled={disabled}
                        onClick={() =>
                          setSettingsEditor({
                            title: `${pack.title} — Paket Düzenle`,
                            description:
                              "Fiyat değişiklikleri yalnızca yeni satışlarda geçerlidir.",
                            fields: [
                              { key: "title", label: "Paket adı", required: true, max: 60 },
                              { key: "description", label: "Açıklama", max: 200 },
                              {
                                key: "credits",
                                label: "Kredi miktarı",
                                type: "number",
                                required: true,
                              },
                              { key: "bonusCredits", label: "Bonus kredi", type: "number" },
                              {
                                key: "priceTry",
                                label: "Fiyat (₺)",
                                type: "number",
                                required: true,
                              },
                              {
                                key: "popular",
                                label: "Popüler olarak işaretle",
                                type: "checkbox",
                              },
                              { key: "enabled", label: "Satışa açık", type: "checkbox" },
                              { key: "stripeProductId", label: "Stripe Product ID" },
                            ],
                            values: { ...pack, version: 0 },
                            save: (values) =>
                              adminApi.updateCreditPack(pack.id, {
                                title: String(values.title || ""),
                                description: String(values.description || ""),
                                credits: Number(values.credits) || 0,
                                bonusCredits: Number(values.bonusCredits) || 0,
                                priceTry: Number(values.priceTry) || 0,
                                popular: !!values.popular,
                                enabled: !!values.enabled,
                                stripeProductId: String(values.stripeProductId || ""),
                                reason: String(values.reason || ""),
                              }),
                          })
                        }
                      >
                        Düzenle
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* Fiyatlandırma Karşılaştırma */}
            <section className="admin-card">
              <h2>Plan Karşılaştırma Tablosu</h2>
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Aylık</th>
                      <th>Yıllık (aylık)</th>
                      <th>Kredi/ay</th>
                      <th>₺/Kredi</th>
                      <th>Abone</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.plans || []).map((plan) => (
                      <tr key={plan.id}>
                        <td>
                          <strong>{plan.name}</strong>
                        </td>
                        <td>{money(plan.monthlyPriceTry)}</td>
                        <td>{money(plan.yearlyPriceTry)}</td>
                        <td>{plan.monthlyCredits.toLocaleString("tr-TR")}</td>
                        <td>
                          {plan.monthlyCredits > 0
                            ? money(plan.monthlyPriceTry / plan.monthlyCredits)
                            : "—"}
                        </td>
                        <td>{plan.activeSubscribers.toLocaleString("tr-TR")}</td>
                        <td>
                          <Badge value={plan.enabled ? "approved" : "suspended"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* STRIPE YAPILANDIRMA                                       */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === "stripe" &&
          (() => {
            const sc = data.stripeConfig;
            if (!sc && sources.stripeConfig === "pending")
              return <p className="admin-empty">Stripe yapılandırması yükleniyor…</p>;
            if (!sc)
              return (
                <section className="admin-card">
                  <SourceAlert sourceKey="stripeConfig" sources={sources} label="Stripe" />
                  <p className="admin-empty">
                    Stripe yapılandırması yüklenemedi. <code>/admin/stripe-config</code>{" "}
                    endpoint&apos;inin çalıştığını doğrulayın.
                  </p>
                  <div className="admin-actions">
                    <button disabled={disabled} onClick={() => void load()}>
                      Tekrar dene
                    </button>
                  </div>
                </section>
              );
            return (
              <div>
                {/* Bağlantı Durumu */}
                <div className="admin-stats">
                  <article className="admin-card">
                    <span>Bağlantı durumu</span>
                    <strong style={{ color: sc.connected ? "#237146" : "#a34627" }}>
                      {sc.connected ? "Bağlı" : "Bağlı değil"}
                    </strong>
                  </article>
                  <article className="admin-card">
                    <span>Çalışma modu</span>
                    <strong>
                      {sc.mode === "live"
                        ? "Canlı (Production)"
                        : sc.mode === "test"
                          ? "Test (Sandbox)"
                          : "Yapılandırılmamış"}
                    </strong>
                  </article>
                  <article className="admin-card">
                    <span>Webhook</span>
                    <strong style={{ color: sc.webhookConfigured ? "#237146" : "#a34627" }}>
                      {sc.webhookConfigured ? "Yapılandırılmış" : "Yapılandırılmamış"}
                    </strong>
                  </article>
                  <article className="admin-card">
                    <span>Varsayılan para birimi</span>
                    <strong>{sc.defaultCurrency.toUpperCase()}</strong>
                  </article>
                </div>

                {/* Stripe API Ayarları */}
                <section className="admin-card">
                  <h2>Stripe API Yapılandırması</h2>
                  <p>
                    Stripe hesabınızı bağlamak için API anahtarlarını girin. Test modunda önce
                    sandbox anahtarlarıyla deneyin, ardından canlıya geçin.
                  </p>
                  {!sc.connected && (
                    <div className="stripe-setup-steps">
                      <h3>Kurulum Adımları</h3>
                      <ol className="stripe-steps">
                        <li>
                          <b>Stripe hesabı oluşturun</b>
                          <span>
                            dashboard.stripe.com adresinden hesap açın veya mevcut hesabınıza giriş
                            yapın.
                          </span>
                        </li>
                        <li>
                          <b>API anahtarlarını alın</b>
                          <span>
                            Developers → API keys bölümünden Publishable key ve Secret key'i
                            kopyalayın.
                          </span>
                        </li>
                        <li>
                          <b>Webhook endpoint ekleyin</b>
                          <span>
                            Developers → Webhooks → Add endpoint. URL:{" "}
                            <code>
                              {sc.webhookUrl || "https://api.mapsbridge.com/stripe/webhook"}
                            </code>
                          </span>
                        </li>
                        <li>
                          <b>Bu panelden yapılandırın</b>
                          <span>
                            Aşağıdaki formu kullanarak anahtarları kaydedin. Önce Test modunda
                            deneyin.
                          </span>
                        </li>
                      </ol>
                    </div>
                  )}
                  <div className="admin-actions" style={{ marginTop: 16 }}>
                    <button
                      disabled={disabled}
                      onClick={() =>
                        setSettingsEditor({
                          title: "Stripe API Yapılandırması",
                          description:
                            "Secret key sunucu tarafında güvenli olarak saklanır. Publishable key istemci tarafında kullanılır. Yanlış anahtar girişi ödeme hatalarına yol açabilir.",
                          fields: [
                            {
                              key: "publishableKey",
                              label: "Publishable Key (pk_test_... veya pk_live_...)",
                              required: true,
                              max: 200,
                            },
                            {
                              key: "secretKey",
                              label: "Secret Key (sk_test_... veya sk_live_...)",
                              required: true,
                              max: 200,
                              help: "Bu değer sunucuda şifrelenerek saklanır.",
                            },
                            {
                              key: "webhookSecret",
                              label: "Webhook Signing Secret (whsec_...)",
                              max: 200,
                              help: "Webhook endpoint'inden alınan doğrulama anahtarı.",
                            },
                            {
                              key: "defaultCurrency",
                              label: "Varsayılan para birimi",
                              type: "select",
                              options: [
                                ["try", "TRY (Türk Lirası)"],
                                ["usd", "USD (Amerikan Doları)"],
                                ["eur", "EUR (Euro)"],
                              ],
                            },
                            {
                              key: "taxEnabled",
                              label: "Vergi hesaplamasını etkinleştir (Stripe Tax)",
                              type: "checkbox",
                            },
                          ],
                          values: {
                            publishableKey: sc.publishableKey || "",
                            secretKey: "",
                            webhookSecret: "",
                            defaultCurrency: sc.defaultCurrency,
                            taxEnabled: sc.taxEnabled,
                            version: sc.version,
                          },
                          save: (values) =>
                            adminApi.updateStripeConfig({
                              publishableKey: String(values.publishableKey || ""),
                              defaultCurrency: String(values.defaultCurrency || "try"),
                              taxEnabled: !!values.taxEnabled,
                              reason: String(values.reason || ""),
                            }),
                        })
                      }
                    >
                      {sc.connected ? "Stripe ayarlarını güncelle" : "Stripe bağlantısını kur"}
                    </button>
                    {sc.connected && (
                      <button
                        disabled={disabled}
                        onClick={() =>
                          ask({
                            title: sc.mode === "live" ? "Test moduna geç" : "Canlı moda geç",
                            description:
                              sc.mode === "live"
                                ? "Canlı ödemeler durur, test modunda yalnızca test kartları çalışır."
                                : "Gerçek kartlardan ödeme alınmaya başlanır. Stripe hesabınızın aktif olduğundan emin olun.",
                            run: (note) =>
                              adminApi.updateStripeConfig({
                                mode: sc.mode === "live" ? "test" : "live",
                                reason: note,
                              }),
                          })
                        }
                      >
                        {sc.mode === "live" ? "Test moduna geç" : "Canlı moda geç"}
                      </button>
                    )}
                  </div>
                </section>

                {/* Webhook Durumu */}
                <section className="admin-card">
                  <h2>Webhook Durumu</h2>
                  <dl className="admin-details">
                    <div>
                      <dt>Endpoint URL</dt>
                      <dd>
                        <code>{sc.webhookUrl || "https://api.mapsbridge.com/stripe/webhook"}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Yapılandırma</dt>
                      <dd>{sc.webhookConfigured ? "Doğrulanmış" : "Bekliyor"}</dd>
                    </div>
                    <div>
                      <dt>Son webhook</dt>
                      <dd>{date(sc.lastWebhookAt)}</dd>
                    </div>
                    <div>
                      <dt>Desteklenen olaylar</dt>
                      <dd>
                        checkout.session.completed, customer.subscription.updated,
                        customer.subscription.deleted, invoice.paid, invoice.payment_failed
                      </dd>
                    </div>
                  </dl>
                </section>

                {/* Ürün Eşleştirme */}
                <section className="admin-card">
                  <h2>Stripe Ürün Eşleştirmesi</h2>
                  <p>
                    Her abonelik planı ve kredi paketi için Stripe Product/Price ID eşleştirmesi
                    gereklidir. Eşleştirme yapılmamış ürünlerde ödeme alınamaz.
                  </p>
                  <div className="admin-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Ürün</th>
                          <th>Tür</th>
                          <th>Fiyat</th>
                          <th>Stripe ID</th>
                          <th>Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.plans || [])
                          .filter((p) => p.id !== "free")
                          .map((plan) => (
                            <tr key={plan.id}>
                              <td>
                                <strong>{plan.name}</strong>
                              </td>
                              <td>Abonelik</td>
                              <td>{money(plan.monthlyPriceTry)}/ay</td>
                              <td>
                                <code>{plan.stripePriceIdMonthly || "—"}</code>
                              </td>
                              <td>
                                <Badge
                                  value={plan.stripePriceIdMonthly ? "configured" : "pending"}
                                />
                              </td>
                            </tr>
                          ))}
                        {(data.creditPacks || []).map((pack) => (
                          <tr key={pack.id}>
                            <td>
                              <strong>{pack.title}</strong>
                            </td>
                            <td>Tek seferlik</td>
                            <td>{money(pack.priceTry)}</td>
                            <td>
                              <code>{pack.stripeProductId || "—"}</code>
                            </td>
                            <td>
                              <Badge value={pack.stripeProductId ? "configured" : "pending"} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--admin-muted)", marginTop: 8 }}>
                    Ürün eşleştirmesi için &quot;Plan &amp; Fiyatlandırma&quot; sekmesinde her
                    ürünün Stripe ID alanını doldurun.
                  </p>
                </section>

                {/* Güvenlik */}
                <section className="admin-card">
                  <h2>Güvenlik ve Uyum</h2>
                  <div className="stripe-security-grid">
                    <div className="stripe-security-item">
                      <span className={`ai-pill ${sc.connected ? "neutral" : "off"}`}>
                        {sc.connected ? "Aktif" : "Bekliyor"}
                      </span>
                      <strong>PCI DSS Uyumu</strong>
                      <p>Stripe Elements kullanılır; kart verileri sunuculara ulaşmaz.</p>
                    </div>
                    <div className="stripe-security-item">
                      <span className={`ai-pill ${sc.webhookConfigured ? "neutral" : "off"}`}>
                        {sc.webhookConfigured ? "Aktif" : "Bekliyor"}
                      </span>
                      <strong>Webhook İmza Doğrulama</strong>
                      <p>Her webhook isteği signing secret ile doğrulanır.</p>
                    </div>
                    <div className="stripe-security-item">
                      <span className="ai-pill neutral">Aktif</span>
                      <strong>Idempotency</strong>
                      <p>Her ödeme isteğinde benzersiz idempotency key kullanılır.</p>
                    </div>
                    <div className="stripe-security-item">
                      <span className="ai-pill neutral">Aktif</span>
                      <strong>URL Doğrulama</strong>
                      <p>Checkout URL'leri checkout.stripe.com alan adıyla doğrulanır.</p>
                    </div>
                  </div>
                </section>
              </div>
            );
          })()}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ÖDEMELER                                                  */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === "payments" && !session?.paymentsConfigured && (
          <p className="admin-alert">
            Ödeme sağlayıcısı bağlı değil. Kayıtları inceleyebilirsiniz; gerçek iade işlemleri
            bağlantı kurulana kadar kapalıdır.
          </p>
        )}
        {tab === "payments" && data.finance && (
          <div className="admin-stats">
            <article className="admin-card">
              <span>Başarılı ödeme toplamı</span>
              <strong>{money(data.finance.totalRevenueTRY)}</strong>
            </article>
            <article className="admin-card">
              <span>Toplam işlem</span>
              <strong>{data.finance.totalTransactions}</strong>
            </article>
            <article className="admin-card">
              <span>Başarısız işlem</span>
              <strong>{data.finance.failedTransactions}</strong>
            </article>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* EXTRA SECTIONS (workspace component handles these)        */}
        {/* ══════════════════════════════════════════════════════════ */}
        {extraSection && session && hasPermission(tab) && (
          <AdminWorkspace key={tab} section={tab} session={session} changed={() => void load()} />
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TABLE-BASED SECTIONS                                      */}
        {/* ══════════════════════════════════════════════════════════ */}
        {![
          "overview",
          "system",
          "modules",
          "credits",
          "ai-operations",
          "pricing",
          "stripe",
        ].includes(tab) &&
          !extraSection && (
            <section className="admin-card admin-records">
              <div className="admin-toolbar">
                <label>
                  Kaydı ara
                  <input
                    type="search"
                    placeholder="Ad, kimlik veya açıklama…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                {!!filterOptions.length && (
                  <label>
                    Durum
                    <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                      <option value="all">Tümü</option>
                      {filterOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Başlangıç
                  <input
                    aria-label="Başlangıç tarihi"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </label>
                <label>
                  Bitiş
                  <input
                    aria-label="Bitiş tarihi"
                    type="date"
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </label>
                <button
                  disabled={!rows.length}
                  onClick={() =>
                    download(
                      `${tab}.csv`,
                      csvText(
                        rows,
                        Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).filter(
                          (key) => !["PK", "SK"].includes(key),
                        ),
                      ),
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  CSV indir
                </button>
                <span>{rows.length} kayıt</span>
              </div>
              {["users", "routes"].includes(tab) && (
                <div className="admin-bulk">
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        !!visible.length && visible.every((row) => selectedIds.includes(rowId(row)))
                      }
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? visible.map(rowId).filter(Boolean) : [])
                      }
                    />{" "}
                    Bu sayfayı seç
                  </label>
                  <span>{selectedIds.length} seçili</span>
                  <button
                    disabled={disabled || !selectedIds.length}
                    onClick={() => bulk("suspend")}
                  >
                    Seçilenleri askıya al
                  </button>
                  <button
                    disabled={disabled || !selectedIds.length}
                    onClick={() => bulk(tab === "users" ? "unsuspend" : "approve")}
                  >
                    {tab === "users" ? "Seçilenlerin askısını kaldır" : "Seçilenleri onayla"}
                  </button>
                </div>
              )}
              {!source ? (
                <p className="admin-empty">
                  {loading
                    ? "Kayıtlar yükleniyor…"
                    : "Veriler yüklenemedi. Yenile düğmesiyle tekrar deneyin."}
                </p>
              ) : !rows.length ? (
                <p className="admin-empty">
                  {search || filter !== "all"
                    ? "Bu arama ve filtreye uygun kayıt bulunamadı."
                    : "Henüz kayıt bulunmuyor."}
                </p>
              ) : (
                <div className="admin-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {(tab === "users"
                          ? ["Kullanıcı", "Kimlik", "Durum", "İşlem"]
                          : tab === "routes"
                            ? ["Rota", "Sahibi / Durak", "Durum", "İşlem"]
                            : tab === "payments"
                              ? ["Ödeme / Kullanıcı", "Tutar", "Durum / Tarih", "İşlem"]
                              : tab === "reports"
                                ? ["İçerik", "Gerekçe", "Durum", "İşlem"]
                                : ["Tarih", "İşlem / Hedef", "Yönetici", "Gerekçe"]
                        ).map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((item, index) => {
                        if (tab === "users") {
                          const u = item as AdminUserItem;
                          const id = userId(u);
                          return (
                            <tr key={id || index}>
                              <td>
                                <input
                                  aria-label={`${u.email || id} seç`}
                                  type="checkbox"
                                  checked={selectedIds.includes(id)}
                                  onChange={(e) =>
                                    setSelectedIds(
                                      e.target.checked
                                        ? [...selectedIds, id].slice(0, 20)
                                        : selectedIds.filter((v) => v !== id),
                                    )
                                  }
                                />{" "}
                                <strong>{u.name || "İsimsiz kullanıcı"}</strong>
                                <small>{u.email || "E-posta yok"}</small>
                              </td>
                              <td>{id}</td>
                              <td>
                                <Badge value={u.suspended ? "suspended" : "active"} />
                              </td>
                              <td>
                                <div className="admin-actions">
                                  <button disabled={!id} onClick={() => setInspectedUser(id)}>Ayrıntılar</button>
                                  <button
                                    disabled={disabled || !id || id === session?.userId}
                                    onClick={() =>
                                      ask({
                                        title: u.suspended
                                          ? "Hesap askısını kaldır"
                                          : "Hesabı askıya al",
                                        description: u.email || id,
                                        run: (note) =>
                                          u.suspended
                                            ? adminApi.unsuspendUser(id, note)
                                            : adminApi.suspendUser(id, note),
                                      })
                                    }
                                  >
                                    {u.suspended ? "Askıyı kaldır" : "Askıya al"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        if (tab === "routes") {
                          const r = item as Route;
                          const id = routeId(r);
                          return (
                            <tr key={id || index}>
                              <td>
                                <input
                                  aria-label={`${r.name || id} seç`}
                                  type="checkbox"
                                  checked={selectedIds.includes(id)}
                                  onChange={(e) =>
                                    setSelectedIds(
                                      e.target.checked
                                        ? [...selectedIds, id].slice(0, 20)
                                        : selectedIds.filter((v) => v !== id),
                                    )
                                  }
                                />{" "}
                                <strong>{r.name || r.title || "İsimsiz rota"}</strong>
                                <small>{id}</small>
                              </td>
                              <td>
                                {r.ownerEmail || r.userId || r.PK?.replace(/^USER#/, "") || "—"}
                                <small>
                                  {(r.stops || r.points || []).length} durak ·{" "}
                                  {r.isPublic ? "Herkese açık" : "Özel"}
                                </small>
                              </td>
                              <td>
                                <Badge value={r.adminStatus || "İncelenmedi"} />
                              </td>
                              <td>
                                <div className="admin-actions">
                                  <button
                                    onClick={() =>
                                      setSettingsEditor({
                                        title: "Rota ayrıntıları",
                                        description:
                                          (r.stops || r.points || [])
                                            .map(
                                              (stop, i) =>
                                                `${i + 1}. ${stop.name || stop.label || "Durak"}`,
                                            )
                                            .join(" · ") || "Durak bulunmuyor.",
                                        fields: [
                                          {
                                            key: "name",
                                            label: "Rota adı",
                                            required: true,
                                            max: 120,
                                          },
                                          {
                                            key: "description",
                                            label: "Açıklama",
                                            type: "textarea",
                                            max: 2000,
                                          },
                                        ],
                                        values: {
                                          name: r.name || r.title || "",
                                          description: r.description || "",
                                          version: r.version || 0,
                                        },
                                        save: (values) =>
                                          managementApi.save(
                                            `routes/${encodeURIComponent(id)}/details`,
                                            values,
                                          ),
                                      })
                                    }
                                  >
                                    Ayrıntılar / Düzenle
                                  </button>
                                  {(
                                    [
                                      ["approve", "Onayla"],
                                      ["feature", "Öne çıkar"],
                                      ["suspend", "Askıya al"],
                                    ] as const
                                  ).map(([op, title]) => (
                                    <button
                                      key={op}
                                      disabled={disabled || !id}
                                      onClick={() =>
                                        ask({
                                          title,
                                          description: r.name || r.title || id,
                                          run: (note) => adminApi.routeAction(id, op, note),
                                        })
                                      }
                                    >
                                      {title}
                                    </button>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        if (tab === "payments") {
                          const p = item as AdminPaymentItem;
                          const id = p.paymentIntentId || p.id || "";
                          return (
                            <tr key={id || index}>
                              <td>
                                {id || "Kimlik eksik"}
                                <small>{p.userId || "Kullanıcı bilinmiyor"}</small>
                              </td>
                              <td>{money(p.amount / 100)}</td>
                              <td>
                                <Badge value={p.status} />
                                <small>{date(p.createdAt)}</small>
                              </td>
                              <td>
                                <button
                                  disabled={
                                    disabled ||
                                    p.status !== "succeeded" ||
                                    !p.paymentIntentId ||
                                    !p.userId ||
                                    !session?.paymentsConfigured
                                  }
                                  onClick={() =>
                                    ask({
                                      title: "Ödemeyi iade et",
                                      description: `${id} · ${money(p.amount / 100)} tutarında tam iade yapılacak.`,
                                      run: async (note) => {
                                        const result = await adminApi.refundPayment(
                                          p.userId!,
                                          id,
                                          note,
                                        );
                                        if (result.status !== "refunded")
                                          throw new Error(
                                            `İade talebi alındı; durum: ${result.status}.`,
                                          );
                                        return result;
                                      },
                                    })
                                  }
                                >
                                  İade et
                                </button>
                              </td>
                            </tr>
                          );
                        }
                        if (tab === "reports") {
                          const r = item as AdminReportItem;
                          return (
                            <tr key={r.reportId}>
                              <td>
                                {r.contentType}
                                <small>{r.contentId}</small>
                              </td>
                              <td>{r.reason}</td>
                              <td>
                                <Badge value={r.status} />
                              </td>
                              <td>
                                <div className="admin-actions">
                                  <button
                                    disabled={disabled || r.status !== "pending"}
                                    onClick={() =>
                                      ask({
                                        title: "Şikâyeti reddet",
                                        description: r.reason,
                                        run: (note) =>
                                          adminApi.resolveReport(r.reportId, "dismiss", note),
                                      })
                                    }
                                  >
                                    Reddet
                                  </button>
                                  {r.contentType === "route" && (
                                    <button
                                      disabled={disabled || r.status !== "pending"}
                                      onClick={() =>
                                        ask({
                                          title: "Rotayı gizle",
                                          description: r.contentId,
                                          run: (note) =>
                                            adminApi.resolveReport(
                                              r.reportId,
                                              "hide_content",
                                              note,
                                            ),
                                        })
                                      }
                                    >
                                      Rotayı gizle
                                    </button>
                                  )}
                                  {r.contentType === "user" && (
                                    <button
                                      disabled={disabled || r.status !== "pending"}
                                      onClick={() =>
                                        ask({
                                          title: "Kullanıcıyı askıya al",
                                          description: r.contentId,
                                          run: (note) =>
                                            adminApi.resolveReport(
                                              r.reportId,
                                              "suspend_user",
                                              note,
                                            ),
                                        })
                                      }
                                    >
                                      Askıya al
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        const log = item as AdminAuditItem;
                        return (
                          <tr key={log.auditId}>
                            <td>{date(log.createdAt)}</td>
                            <td>
                              {log.action}
                              <small>{log.targetId}</small>
                            </td>
                            <td>{log.actorSub}</td>
                            <td>{log.reason}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <footer className="admin-pagination">
                <span>
                  Sayfa {currentPage + 1} / {Math.max(1, Math.ceil(rows.length / 20))}
                </span>
                <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
                  Önceki
                </button>
                <button
                  disabled={(currentPage + 1) * 20 >= rows.length}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Sonraki
                </button>
              </footer>
            </section>
          )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* SİSTEM AYARLARI                                           */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === "system" && (
          <>
            <section className="admin-card">
              <h2>Admin API Veri Kaynakları</h2>
              <p>
                Her veri kaynağının son yükleme durumu. Başarısız kaynaklar ilgili sekmelerde uyarı
                gösterir.
              </p>
              <div className="admin-service-grid">
                {DATA_SOURCES.map((key) => (
                  <article key={key}>
                    <strong>{key}</strong>
                    <Badge
                      value={
                        sources[key] === "loaded"
                          ? "operational"
                          : sources[key] === "failed"
                            ? "degraded"
                            : "unknown"
                      }
                    />
                    <small>
                      {sources[key] === "loaded"
                        ? "Başarılı"
                        : sources[key] === "failed"
                          ? "Yanıt alınamadı"
                          : "Bekleniyor"}
                    </small>
                  </article>
                ))}
              </div>
            </section>
            <section className="admin-card">
              <h2>Servis durumu</h2>
              <p>Yalnızca ölçülen servislerde gecikme gösterilir.</p>
              <div className="admin-service-grid">
                {Object.entries(data.health?.services || {}).map(([name, service]) => (
                  <article key={name}>
                    <strong>{name}</strong>
                    <Badge value={service.status} />
                    <small>
                      {service.latencyMs !== undefined ? `${service.latencyMs} ms` : "Ölçüm yok"}
                    </small>
                  </article>
                ))}
              </div>
            </section>
            <section className="admin-card">
              <h2>Bakım ve özellik ayarları</h2>
              <dl className="admin-details">
                <div>
                  <dt>Bakım modu</dt>
                  <dd>
                    {data.config?.maintenanceMode
                      ? "Açık — kullanıcı yazma işlemleri durduruldu"
                      : "Kapalı"}
                  </dd>
                </div>
                <div>
                  <dt>Yeni rota oluşturma</dt>
                  <dd>{data.config?.routeCreationEnabled === false ? "Kapalı" : "Açık"}</dd>
                </div>
                <div>
                  <dt>Yeni konum paylaşımı</dt>
                  <dd>{data.config?.sharesEnabled === false ? "Kapalı" : "Açık"}</dd>
                </div>
              </dl>
              <p>{data.config?.maintenanceMessage}</p>
              <button
                disabled={disabled || !data.config}
                onClick={() =>
                  setSettingsEditor({
                    title: "Sistem ayarlarını düzenle",
                    description:
                      "Bakım modu rota, konum paylaşımı ve profil yazma işlemlerini durdurur. Giriş, okuma, destek ve admin işlemleri açık kalır.",
                    fields: [
                      {
                        key: "maintenanceMode",
                        label: "Bakım modunu etkinleştir",
                        type: "checkbox",
                      },
                      {
                        key: "maintenanceMessage",
                        label: "Kullanıcılara gösterilecek bakım mesajı",
                        type: "textarea",
                        max: 500,
                        required: true,
                      },
                      {
                        key: "routeCreationEnabled",
                        label: "Yeni rota oluşturmaya izin ver",
                        type: "checkbox",
                      },
                      {
                        key: "sharesEnabled",
                        label: "Yeni konum paylaşımına izin ver",
                        type: "checkbox",
                      },
                    ],
                    values: {
                      ...data.config,
                      maintenanceMessage:
                        data.config?.maintenanceMessage ||
                        "Kısa süreli bakım yapılıyor. Lütfen daha sonra tekrar deneyin.",
                      version: data.config?.version || 0,
                      routeCreationEnabled: data.config?.routeCreationEnabled !== false,
                      sharesEnabled: data.config?.sharesEnabled !== false,
                    },
                    save: (values) => managementApi.save("system-config", values),
                  })
                }
              >
                Ayarları düzenle
              </button>
            </section>
          </>
        )}

        {tab === "overview" && data.finance && (
          <section className="admin-card">
            <h2>Aylık başarılı ödemeler</h2>
            {data.finance.monthlyRevenue?.length ? (
              <div className="admin-revenue">
                {data.finance.monthlyRevenue
                  .slice()
                  .sort((a, b) => a.month.localeCompare(b.month))
                  .slice(-12)
                  .map((month) => (
                    <div key={month.month}>
                      <span>{month.month}</span>
                      <meter
                        min={0}
                        max={Math.max(
                          1,
                          ...(data.finance?.monthlyRevenue || []).map((m) => m.amount),
                        )}
                        value={month.amount}
                      />
                      <strong>{money(month.amount)}</strong>
                    </div>
                  ))}
              </div>
            ) : (
              <p>Henüz ödeme kaydı yok.</p>
            )}
          </section>
        )}

        {inspectedUser && session && (
          <UserInspector
            id={inspectedUser}
            session={session}
            close={() => setInspectedUser(null)}
            changed={() => void load()}
          />
        )}
        {settingsEditor && (
          <EditDialog
            editor={settingsEditor}
            close={() => setSettingsEditor(null)}
            saved={() => {
              void load();
              setNotice("Değişiklik kaydedildi.");
            }}
          />
        )}
      </main>

      <dialog
        ref={dialog}
        className="admin-dialog"
        aria-labelledby="admin-action-title"
        onCancel={(e) => {
          if (processing) e.preventDefault();
          else setAction(null);
        }}
      >
        <form onSubmit={submit}>
          <span className="admin-eyebrow">İŞLEM ONAYI</span>
          <h2 id="admin-action-title">{action?.title}</h2>
          <p>{action?.description}</p>
          <label htmlFor="admin-reason">İşlem gerekçesi</label>
          <textarea
            id="admin-reason"
            autoFocus
            required
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={processing}
            placeholder="Kararınızın gerekçesini yazın…"
          />
          <small>Gerekçe yönetici işlem geçmişine kaydedilir.</small>
          {notice && (
            <p role="alert" className="admin-alert">
              {notice}
            </p>
          )}
          <div className="admin-actions">
            <button type="button" disabled={processing} onClick={() => setAction(null)}>
              Vazgeç
            </button>
            <button className="admin-primary" disabled={processing || loading || !reason.trim()}>
              {processing ? "İşleniyor…" : "Onayla ve uygula"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
