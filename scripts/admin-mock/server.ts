// Yerel yönetim API mock'u (design §8.7). YALNIZCA yerel geliştirme aracıdır: 127.0.0.1'e bağlanır,
// kimlik doğrulama yoktur, deploy edilmez.
//   npm run admin:mock -- [--port 4599|0] [--role admin|moderator|support|none]
//     [--fail "GET /admin/payments=500,GET /admin/plans=404"] [--latency 800] [--empty]
//     [--session-status 404]
// Route tablosu infra/admin-runtime/routes.json'dan (salt okunur) gelir; yalnızca /admin/* servis
// edilir, diğer her şey API Gateway gibi 404 {"message":"Not Found"} döner. RBAC backend'in
// permissions.ts'i ile (salt okunur import) uygulanır.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { can, permissions, routePermission } from "../../infra/lambda/src/admin/permissions.ts";

type Role = "admin" | "moderator" | "support";
type Json = Record<string, unknown>;
type Reply = { status: number; body?: unknown };

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const FIXTURES = join(HERE, "fixtures");
const FORBIDDEN = { error: "Bu bölüm için yetkiniz bulunmuyor." };
const NOT_FOUND = { message: "Not Found" };

// ── Argümanlar ────────────────────────────────────────────────────────────────
const { values } = parseArgs({
  options: {
    port: { type: "string", default: "4599" },
    role: { type: "string" },
    fail: { type: "string" },
    latency: { type: "string" },
    empty: { type: "boolean", default: false },
    "session-status": { type: "string" },
  },
  strict: true,
});

function die(message: string): never {
  console.error(`[admin-mock] ${message}`);
  process.exit(1);
}

const port = Number(values.port);
if (!Number.isInteger(port) || (port !== 0 && (port < 1024 || port > 65535)))
  die(`--port 0 ya da 1024–65535 olmalı (verilen: ${values.port})`);
const ROLES = ["admin", "moderator", "support", "none"];
const defaultRole = values.role ?? process.env.MOCK_ROLE ?? "admin";
if (!ROLES.includes(defaultRole)) die(`--role şunlardan biri olmalı: ${ROLES.join(", ")}`);
const latencyMs = values.latency ? Number(values.latency) : 0;
if (!Number.isFinite(latencyMs) || latencyMs < 0) die("--latency milisaniye cinsinden ≥ 0 olmalı");
const sessionStatus = values["session-status"] ? Number(values["session-status"]) : null;
const failures = new Map<string, number>();
for (const part of (values.fail ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)) {
  const m = /^(GET|POST) (\/admin\/\S+)=(\d{3})$/.exec(part);
  if (!m) die(`--fail girdisi geçersiz: "${part}" (biçim: "GET /admin/payments=500")`);
  failures.set(`${m[1]} ${m[2]}`, Number(m[3]));
}

// ── Route tablosu ─────────────────────────────────────────────────────────────
const routeKeys = Object.keys(
  JSON.parse(readFileSync(join(REPO, "infra/admin-runtime/routes.json"), "utf8")) as Json,
).filter((k) => k.split(" ")[1]?.startsWith("/admin"));

type Route = { key: string; method: string; template: string; pattern: RegExp; names: string[] };
const ROUTES: Route[] = routeKeys.map((key) => {
  const [method, template] = key.split(" ");
  const names: string[] = [];
  const source = template
    .split("/")
    .map((seg) => {
      const m = /^\{(\w+)(\+?)\}$/.exec(seg);
      if (!m) return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      names.push(m[1]);
      return m[2] ? "(.+)" : "([^/]+)";
    })
    .join("/");
  return { key, method, template, pattern: new RegExp(`^${source}$`), names };
});
// Somut segmentli şablon ({id}'li olandan) önce eşleşir: /admin/ai-training/jobs vs /{id}/review.
ROUTES.sort((a, b) => a.names.length - b.names.length);

function match(method: string, path: string) {
  for (const r of ROUTES) {
    if (r.method !== method) continue;
    const m = r.pattern.exec(path);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.names.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
    return { route: r, params };
  }
  return null;
}

// ── Fixture'lar ve bellek durumu ──────────────────────────────────────────────
/** "GET /admin/users/{id}" → "GET_admin_users_id" (fixtures/<ad>.json). */
export function fixtureName(key: string): string {
  return key
    .replace(" ", "")
    .replace(/\{(\w+)\+?\}/g, "$1")
    .replace(/\//g, "_");
}

function emptied(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return [];
  if (value && typeof value === "object" && depth < 2) {
    const out: Json = {};
    for (const [k, v] of Object.entries(value as Json))
      out[k] = k === "count" || k === "total" ? 0 : emptied(v, depth + 1);
    return out;
  }
  return value;
}

const state = new Map<string, Json>();
for (const file of readdirSync(FIXTURES).filter((f) => f.endsWith(".json"))) {
  const data = JSON.parse(readFileSync(join(FIXTURES, file), "utf8")) as Json;
  state.set(file.replace(/\.json$/, ""), (values.empty ? emptied(data) : data) as Json);
}
const fixture = (key: string) => state.get(fixtureName(key));
const list = (key: string, field: string) => (fixture(key)?.[field] ?? []) as Json[];

// ── Handler doğrulamaları (özet; otorite gerçek handler'dır) ──────────────────
class MockError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
function text(value: unknown, label: string, max = 1000, required = true): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || (required && !value.trim()) || value.length > max)
    throw new MockError(400, `${label} geçersiz (en fazla ${max} karakter).`);
  return value.trim();
}
function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T))
    throw new MockError(400, `${label} geçersiz.`);
  return value as T;
}
function bool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new MockError(400, `${label} geçersiz.`);
  return value;
}
function checkVersion(row: Json | undefined, body: Json, message = "Kayıt değişti; yeniden açın.") {
  if (((row?.version as number) || 0) !== body.version) throw new MockError(409, message);
}
function findBy(rows: Json[], field: string, id: string, notFound: string): Json {
  const row = rows.find((r) => r[field] === id);
  if (!row) throw new MockError(404, notFound);
  return row;
}
const now = () => new Date().toISOString();
/** Gövdeden verilen alanları çıkarır (gerekçe/sır/sürüm kayda yazılmaz). */
function omit(body: Json, ...keys: string[]): Json {
  return Object.fromEntries(Object.entries(body).filter(([k]) => !keys.includes(k)));
}

type Ctx = { params: Record<string, string>; body: Json; role: Role };
type Handler = (ctx: Ctx) => Reply;
const ok = (body: unknown): Reply => ({ status: 200, body });

const POST: Record<string, Handler> = {
  "POST /admin/users/{id}/suspend": ({ params, body }) => {
    const user = findBy(
      list("GET /admin/users", "users"),
      "userId",
      params.id,
      "Kullanıcı bulunamadı.",
    );
    const reason =
      (typeof body.reason === "string" && body.reason.trim()) ||
      "Yönetici tarafından askıya alındı.";
    Object.assign(user, { suspended: true, suspendReason: reason });
    return ok({ status: "suspended", userId: params.id, reason, suspendedAt: now() });
  },
  "POST /admin/users/{id}/unsuspend": ({ params }) => {
    const user = findBy(
      list("GET /admin/users", "users"),
      "userId",
      params.id,
      "Kullanıcı bulunamadı.",
    );
    Object.assign(user, { suspended: false, suspendReason: undefined });
    return ok({ status: "active", userId: params.id, unsuspendedAt: now() });
  },
  "POST /admin/users/{id}/profile": ({ body }) => {
    text(body.reason, "Gerekçe");
    text(body.name, "Ad", 120);
    if (
      body.phone !== undefined &&
      body.phone !== "" &&
      !/^\+[1-9]\d{7,14}$/.test(String(body.phone))
    )
      throw new MockError(400, "Telefon E.164 biçiminde olmalı.");
    checkVersion(fixture("GET /admin/users/{id}")?.user as Json, body);
    return ok({ status: "updated" });
  },
  "POST /admin/users/{id}/sessions": ({ body }) => (
    text(body.reason, "Gerekçe"),
    ok({ status: "revoked" })
  ),
  "POST /admin/users/{id}/role": ({ body }) => {
    text(body.reason, "Gerekçe");
    const role = oneOf(body.role, ["user", "admin", "moderator", "support"] as const, "Rol");
    return ok({ status: "updated", role });
  },
  "POST /admin/users/{id}/credits": ({ body }) => {
    text(body.reason, "Gerekçe");
    const delta = body.delta;
    if (
      typeof delta !== "number" ||
      !Number.isSafeInteger(delta) ||
      delta === 0 ||
      Math.abs(delta) > 10000
    )
      throw new MockError(
        400,
        "Kredi değişimi 0 olmayan ve en fazla 10.000 olan bir tam sayı olmalı.",
      );
    if (typeof body.requestId !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(body.requestId))
      throw new MockError(400, "İşlem kimliği geçersiz.");
    return ok({ status: "applied", credits: 42 + delta });
  },
  "POST /admin/users/{id}/wallet": ({ body }) => (
    text(body.reason, "Gerekçe"),
    bool(body.frozen, "Dondurma"),
    ok({ status: "updated" })
  ),
  "POST /admin/users/{id}/subscription": ({ body }) => {
    text(body.reason, "Gerekçe");
    oneOf(body.action, ["cancel", "resume"] as const, "Abonelik işlemi");
    return ok({ status: "updated" });
  },
  "POST /admin/users/{id}/grant-credits": ({ params, body }) => {
    const credits = body.credits;
    if (
      typeof credits !== "number" ||
      !Number.isSafeInteger(credits) ||
      credits < 1 ||
      credits > 10000
    )
      throw new MockError(400, "Kredi 1–10.000 arasında bir tam sayı olmalı.");
    return ok({
      status: "granted",
      userId: params.id,
      credits,
      reason: (body.reason as string) || "Admin kredisi",
    });
  },
  "POST /admin/users/{id}/refund": ({ body }) => {
    const id = text(body.paymentIntentId, "Ödeme kimliği", 200);
    const payment = findBy(
      list("GET /admin/payments", "payments"),
      "paymentIntentId",
      id,
      "Ödeme bulunamadı.",
    );
    payment.status = "refunded";
    return ok({
      status: "succeeded",
      refundId: `re_mock_${Date.now()}`,
      amount: payment.amount,
      reason: body.reason ?? "",
    });
  },
  "POST /admin/plans/{id}": ({ params, body }) => {
    text(body.reason, "Gerekçe");
    const plan = findBy(list("GET /admin/plans", "plans"), "id", params.id, "Plan bulunamadı.");
    const rest = omit(body, "reason");
    Object.assign(plan, rest);
    return ok({ status: "updated", plan });
  },
  "POST /admin/credit-packs/{id}": ({ params, body }) => {
    text(body.reason, "Gerekçe");
    const pack = findBy(
      list("GET /admin/credit-packs", "packs"),
      "id",
      params.id,
      "Paket bulunamadı.",
    );
    const rest = omit(body, "reason");
    Object.assign(pack, rest);
    return ok({ status: "updated", pack });
  },
  "POST /admin/stripe-config": ({ body }) => {
    text(body.reason, "Gerekçe");
    const stripe = fixture("GET /admin/stripe-config")?.stripe as Json;
    const rest = omit(body, "reason", "secretKey", "webhookSecret");
    Object.assign(stripe, rest, {
      version: ((stripe.version as number) || 0) + 1,
      updatedAt: now(),
    });
    return ok({ status: "updated", stripe });
  },
  "POST /admin/reports/{id}/resolve": ({ params, body }) => {
    const action = oneOf(
      body.action,
      ["dismiss", "hide_content", "suspend_user"] as const,
      "İşlem",
    );
    const report = findBy(
      list("GET /admin/reports", "reports"),
      "reportId",
      params.id,
      "Şikâyet bulunamadı.",
    );
    if (report.status !== "pending") throw new MockError(400, "Şikâyet zaten karara bağlanmış.");
    const status = action === "dismiss" ? "dismissed" : "resolved";
    Object.assign(report, {
      status,
      resolvedAt: now(),
      resolutionAction: action,
      resolutionNotes: body.notes ?? "",
    });
    return ok({ status, reportId: params.id, action, resolvedAt: report.resolvedAt });
  },
  "POST /admin/routes/{id}/action": ({ params, body }) => {
    const action = oneOf(body.action, ["approve", "feature", "suspend"] as const, "İşlem");
    const route = findBy(
      list("GET /admin/routes", "routes"),
      "routeId",
      params.id,
      "Rota bulunamadı.",
    );
    route.adminStatus =
      action === "approve" ? "approved" : action === "feature" ? "featured" : "suspended";
    const reason = (body.reason as string) || `Yönetici rota işlemi: ${action}`;
    return ok({ status: "success", routeId: params.id, action, reason, timestamp: now() });
  },
  "POST /admin/routes/{id}/details": ({ params, body }) => {
    text(body.reason, "Gerekçe");
    const name = text(body.name, "Ad", 120);
    const route = findBy(
      list("GET /admin/routes", "routes"),
      "routeId",
      params.id,
      "Rota bulunamadı.",
    );
    checkVersion(route, body);
    Object.assign(route, {
      name,
      description: body.description ?? route.description,
      version: (route.version as number) + 1,
    });
    return ok({ status: "updated" });
  },
  "POST /admin/shares/{id}/revoke": ({ params, body }) => {
    text(body.reason, "Gerekçe");
    const share = findBy(
      list("GET /admin/shares", "shares"),
      "id",
      params.id,
      "Paylaşım bulunamadı.",
    );
    share.status = "revoked";
    return ok({ status: "revoked" });
  },
  "POST /admin/profiles/{id}/moderate": ({ params, body }) => {
    text(body.reason, "Gerekçe");
    const action = oneOf(body.action, ["approve", "suspend"] as const, "İşlem");
    const profile = findBy(
      list("GET /admin/profiles", "profiles"),
      "id",
      params.id,
      "Profil bulunamadı.",
    );
    profile.status = action === "approve" ? "active" : "suspended";
    return ok({ status: "updated" });
  },
  "POST /admin/content": ({ body }) => {
    text(body.reason, "Gerekçe");
    const row = {
      PK: `BLOG#b-${Date.now()}`,
      SK: "META",
      id: `b-${Date.now()}`,
      type: "blog",
      title: text(body.title, "Başlık", 200),
      content: text(body.content, "İçerik", 30000),
      status: "draft",
      published: false,
      version: 1,
      createdAt: now(),
    };
    list("GET /admin/content", "content").unshift(row);
    return { status: 201, body: { content: row } };
  },
  "POST /admin/content/{type}/{id}": ({ params, body }) => {
    text(body.reason, "Gerekçe");
    oneOf(params.type, ["blog", "guide"] as const, "İçerik türü");
    const status = oneOf(body.status, ["draft", "published", "archived"] as const, "Durum");
    const row = findBy(
      list("GET /admin/content", "content"),
      "id",
      params.id,
      "İçerik bulunamadı.",
    );
    checkVersion(row, body);
    Object.assign(row, {
      status,
      published: status === "published",
      title: text(body.title, "Başlık", 200),
      version: (row.version as number) + 1,
    });
    return ok({ content: row });
  },
  "POST /admin/tickets/{id}": ({ params, body, role }) => {
    text(body.reason, "Gerekçe");
    const status = oneOf(
      body.status,
      ["open", "in_progress", "resolved", "closed"] as const,
      "Durum",
    );
    const priority = oneOf(body.priority, ["low", "normal", "high", "urgent"] as const, "Öncelik");
    const tickets = list("GET /admin/tickets", "tickets");
    const ticket = tickets.find((t) => (t.id ?? String(t.PK).slice(7)) === params.id);
    if (!ticket) throw new MockError(404, "Talep bulunamadı.");
    checkVersion(ticket, body, "Talep değişti; yeniden açın.");
    const messages = (ticket.messages as Json[]) ?? [];
    if (typeof body.reply === "string" && body.reply.trim())
      messages.push({ from: "staff", text: text(body.reply, "Yanıt", 4000), at: now() });
    Object.assign(ticket, {
      status,
      priority,
      messages,
      internalNote: body.internalNote ?? ticket.internalNote,
      assignedTo: body.assignToMe ? `mock-${role}` : ticket.assignedTo,
      version: ((ticket.version as number) || 0) + 1,
      updatedAt: now(),
    });
    return ok({ ticket });
  },
  "POST /admin/announcements": ({ body }) => {
    text(body.reason, "Gerekçe");
    const title = text(body.title, "Başlık", 160);
    const message = text(body.message, "Mesaj", 1500);
    const status = oneOf(body.status, ["draft", "published", "archived"] as const, "Durum");
    if (
      body.startsAt &&
      body.endsAt &&
      Date.parse(String(body.endsAt)) <= Date.parse(String(body.startsAt))
    )
      throw new MockError(400, "Bitiş zamanı başlangıçtan sonra olmalı.");
    const rows = list("GET /admin/announcements", "announcements");
    let row = body.id ? rows.find((r) => r.id === body.id) : undefined;
    if (body.id && !row) throw new MockError(404, "Duyuru bulunamadı.");
    if (row) {
      checkVersion(row, body);
      Object.assign(row, {
        title,
        message,
        status,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        version: (row.version as number) + 1,
      });
    } else {
      row = {
        id: `an-${Date.now()}`,
        title,
        message,
        status,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        version: 1,
      };
      rows.unshift(row);
    }
    return ok({ announcement: row });
  },
  "POST /admin/system-config": ({ body }) => {
    text(body.reason, "Gerekçe");
    bool(body.maintenanceMode, "Bakım modu");
    const config = fixture("GET /admin/system-config")?.config as Json;
    if (body.version !== undefined) checkVersion(config, body);
    const rest = omit(body, "reason", "version");
    const reason = body.reason;
    Object.assign(config, rest, {
      reason,
      version: ((config.version as number) || 0) + 1,
      updatedAt: now(),
    });
    return ok({ config });
  },
  "POST /admin/module-config": ({ body, role }) => {
    text(body.reason, "Gerekçe");
    const moduleConfig = fixture("GET /admin/module-config")?.moduleConfig as Json;
    for (const k of ["mapEnabled", "aiEnabled", "communityEnabled", "messagingEnabled"])
      if (body[k] !== undefined) moduleConfig[k] = bool(body[k], k);
    Object.assign(moduleConfig, {
      updatedBy: `mock-${role}`,
      version: ((moduleConfig.version as number) || 0) + 1,
    });
    return ok({ status: "updated", moduleConfig });
  },
  "POST /admin/ai-control": ({ body }) => {
    text(body.reason, "Gerekçe");
    const ops = fixture("GET /admin/ai-operations") as Json;
    const control = ops.control as Json;
    const models = ((ops.runtime as Json)?.models as string[]) ?? [];
    checkVersion(control, body, "AI kontrolü değişti; yeniden açın.");
    bool(body.enabled, "AI durumu");
    oneOf(body.defaultModel, models, "Varsayılan model");
    if (!Array.isArray(body.disabledModels) || body.disabledModels.some((m) => !models.includes(m)))
      throw new MockError(400, "Devre dışı modeller geçersiz.");
    Object.assign(control, {
      enabled: body.enabled,
      defaultModel: body.defaultModel,
      disabledModels: body.disabledModels,
      version: (control.version as number) + 1,
    });
    return ok({ control });
  },
  "POST /admin/ai-agents/{id}/config": ({ params, body }) => {
    text(body.reason, "Gerekçe");
    const data = fixture("GET /admin/ai-agents") as Json;
    const agent = findBy(data.agents as Json[], "id", params.id, "Ajan bulunamadı.");
    const enabled = bool(body.enabled, "Ajan durumu");
    if (enabled && !agent.wired) throw new MockError(409, "Ajan çalışma ortamına bağlı değil.");
    agent.enabled = enabled;
    data.version = ((data.version as number) || 0) + 1;
    return ok({ agents: data.agents, version: data.version });
  },
  "POST /admin/ai-training/{id}/review": ({ params, body }) => {
    text(body.reason, "Gerekçe");
    const action = oneOf(body.action, ["approve", "reject", "hold"] as const, "İşlem");
    const record = findBy(
      list("GET /admin/ai-training", "records"),
      "id",
      params.id,
      "Kayıt bulunamadı ya da süresi doldu.",
    );
    record.status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "held";
    return ok({ success: true, id: params.id, action });
  },
  "POST /admin/ai-training/fine-tune": ({ body }) => {
    if (body.baseModelId !== undefined) text(body.baseModelId, "Temel model", 200);
    const approved = list("GET /admin/ai-training", "records").filter(
      (r) => r.status === "approved",
    );
    if (approved.length === 0) throw new MockError(409, "Onaylanmış eğitim kaydı yok.");
    return ok({
      jobArn: "arn:aws:bedrock:eu-central-1:000000000000:model-customization-job/mock-new",
      jobName: `mb-ft-${Date.now()}`,
      recordCount: approved.length,
      trainKey: "training/mock.jsonl",
      region: "eu-central-1",
    });
  },
  "POST /admin/ai-release/propose": ({ body }) => {
    text(body.reason, "Release gerekçesi");
    const model = text(body.model, "Aday model", 300);
    const promptVersion = text(body.promptVersion, "Prompt sürümü", 100);
    const data = fixture("GET /admin/ai-release") as Json;
    const metrics = (body.metrics ?? {}) as Record<string, number>;
    const t = data.thresholds as Record<string, number>;
    for (const k of Object.keys(t))
      if (typeof metrics[k] !== "number" || metrics[k] < 0)
        throw new MockError(400, `${k} metriği geçersiz.`);
    const passed = Object.keys(t).every((k) =>
      k === "p95LatencyMs" ? metrics[k] <= t[k] : metrics[k] >= t[k],
    );
    const release = data.release as Json;
    release.candidate = {
      id: `rel_${Date.now()}`,
      model,
      promptVersion,
      metrics,
      qualityGate: passed ? "passed" : "blocked",
      status: "candidate",
      proposedAt: now(),
    };
    release.status = passed ? "ready_to_publish" : "blocked";
    return ok({ release, qualityGate: passed ? "passed" : "blocked" });
  },
  "POST /admin/ai-release/publish": ({ body }) => {
    text(body.reason, "Gerekçe");
    const release = (fixture("GET /admin/ai-release") as Json).release as Json;
    const candidate = release.candidate as Json | null;
    if (!candidate || candidate.qualityGate !== "passed")
      throw new MockError(409, "Kalite kapısını geçen aday yok.");
    Object.assign(release, {
      previousActive: release.active,
      active: { ...candidate, publishedAt: now() },
      candidate: null,
      status: "active",
      version: (release.version as number) + 1,
    });
    return ok({ release });
  },
  "POST /admin/ai-release/rollback": ({ body }) => {
    text(body.reason, "Gerekçe");
    const release = (fixture("GET /admin/ai-release") as Json).release as Json;
    if (!release.previousActive) throw new MockError(409, "Geri alınacak önceki sürüm yok.");
    Object.assign(release, {
      active: release.previousActive,
      previousActive: null,
      candidate: null,
      status: "rolled_back",
      version: (release.version as number) + 1,
    });
    return ok({ release });
  },
  "POST /admin/analytics/track": () => ok({ tracked: true }),
};

function session(role: Role): Reply {
  return ok({
    session: {
      userId: `mock-${role}`,
      role,
      permissions: [...permissions[role]],
      paymentsConfigured: true,
      userManagement: false,
    },
  });
}

function handleGet(key: string, params: Record<string, string>, role: Role): Reply {
  if (key === "GET /admin/session") return session(role);
  if (key === "GET /admin/users/{id}") {
    const users = list("GET /admin/users", "users");
    const user = users.find((u) => u.userId === params.id);
    if (!user) return { status: 404, body: { error: "Kullanıcı bulunamadı." } };
    const detail = structuredClone(fixture(key)) as Json;
    Object.assign(detail.user as Json, user);
    return ok(detail);
  }
  if (key === "GET /admin/ai-costs") return ok(fixture("GET /admin/token-usage"));
  const data = fixture(key);
  return data
    ? ok(data)
    : { status: 500, body: { error: `Mock fixture yok: ${fixtureName(key)}.json` } };
}

// ── HTTP ──────────────────────────────────────────────────────────────────────
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, x-mock-role",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

function send(res: ServerResponse, reply: Reply) {
  const headers: Record<string, string> = { ...CORS };
  if (reply.body !== undefined) headers["content-type"] = "application/json; charset=utf-8";
  res.writeHead(reply.status, headers);
  res.end(reply.body === undefined ? undefined : JSON.stringify(reply.body));
}

async function readBody(req: IncomingMessage): Promise<Json | null> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Json) : null;
  } catch {
    return null;
  }
}

async function handle(req: IncomingMessage): Promise<Reply> {
  const method = (req.method ?? "GET").toUpperCase();
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const hit = match(method, url.pathname);
  if (!hit) return { status: 404, body: NOT_FOUND };
  if (method === "OPTIONS") return { status: 204 };
  const key = hit.route.key;
  const headerRole = req.headers["x-mock-role"];
  const roleName = (typeof headerRole === "string" && headerRole) || defaultRole;
  if (!ROLES.includes(roleName)) return { status: 400, body: { error: "x-mock-role geçersiz." } };
  if (key === "GET /admin/session" && sessionStatus)
    return {
      status: sessionStatus,
      body: sessionStatus === 404 ? NOT_FOUND : { error: "Oturum doğrulanamadı." },
    };
  if (roleName === "none") return { status: 403, body: FORBIDDEN };
  const role = roleName as Role;
  const needed = routePermission(hit.route.template, method);
  if (needed && !can(role, needed)) return { status: 403, body: FORBIDDEN };
  const injected = failures.get(key);
  if (injected)
    return {
      status: injected,
      body: injected === 404 ? NOT_FOUND : { error: `Enjekte edilmiş hata (${injected}).` },
    };
  if (method === "GET") return handleGet(key, hit.params, role);
  const body = await readBody(req);
  if (!body) return { status: 400, body: { error: "Geçerli işlem verisi gerekli." } };
  const handler = POST[key];
  if (!handler) return { status: 500, body: { error: `Mock işleyici yok: ${key}` } };
  try {
    return handler({ params: hit.params, body, role });
  } catch (err) {
    if (err instanceof MockError) return { status: err.status, body: { error: err.message } };
    throw err;
  }
}

const server = createServer((req, res) => {
  const respond = () =>
    handle(req)
      .then((reply) => send(res, reply))
      .catch((err) => {
        console.error(`[admin-mock] beklenmeyen hata: ${err instanceof Error ? err.message : err}`);
        send(res, { status: 500, body: { error: "Mock sunucu hatası." } });
      });
  if (latencyMs > 0) setTimeout(respond, latencyMs);
  else void respond();
});

server.listen(port, "127.0.0.1", () => {
  const addr = server.address();
  const actual = typeof addr === "object" && addr ? addr.port : port;
  process.stdout.write(`listening on http://127.0.0.1:${actual}\n`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const)
  process.on(sig, () => server.close(() => process.exit(0)));
