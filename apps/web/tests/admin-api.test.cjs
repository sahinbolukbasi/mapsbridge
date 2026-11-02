// AC-25 (design §8.8): tipli yönetim istemcisi. lib/admin/*.ts load-ts.cjs ile yüklenir;
// lib/api-client.ts esbuild onResolve ile stubs/api-client.stub.cjs'e yönlendirilir.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

const REPO = path.resolve(__dirname, "../../..");
const WEB = path.join(REPO, "apps/web/app");
const ADMIN = path.join(WEB, "lib/admin");
const FIXTURES = path.join(REPO, "scripts/admin-mock/fixtures");
const ROUTES = JSON.parse(
  fs.readFileSync(path.join(REPO, "infra/admin-runtime/routes.json"), "utf8"),
);
const ADMIN_KEYS = Object.keys(ROUTES).filter((k) => k.includes("/admin"));
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), "utf8"));

const apiStub = { calls: [], respond: async () => ({}) };
const stubs = {
  [path.join(WEB, "lib/api-client.ts")]: path.join(__dirname, "stubs/api-client.stub.cjs"),
};
const globals = { __apiStub: apiStub, Error };
// vm bağlamında üretilen dizi/nesneler farklı realm'dendir; deepEqual öncesi düz JSON'a çevrilir.
const plain = (v) => JSON.parse(JSON.stringify(v));
const { ADMIN_ENDPOINTS, ADMIN_AREAS, endpointKey } = loadTs(path.join(ADMIN, "endpoints.ts"));
const { NOT_EXPOSED } = loadTs(path.join(ADMIN, "not-exposed.ts"));
const { adminRequest, fillPath } = loadTs(path.join(ADMIN, "client.ts"), { stubs, globals });
const { canRun, visibleAreas, UI_STRICTER } = loadTs(path.join(ADMIN, "rbac.ts"));
const { toAdminError } = loadTs(path.join(ADMIN, "errors.ts"), { globals: { Error } });
const mappers = loadTs(path.join(ADMIN, "mappers.ts"));
const { newRequestId, REQUEST_ID_PATTERN } = loadTs(path.join(ADMIN, "request-id.ts"));
const { routePermission, permissions } = loadTs(
  path.join(REPO, "infra/lambda/src/admin/permissions.ts"),
);
const ids = Object.keys(ADMIN_ENDPOINTS);
const sessionOf = (role) => ({ role, permissions: [...permissions[role]] });

test("AC-25a: her endpoint METHOD+path routes.json'da var", () => {
  for (const id of ids)
    assert.ok(ADMIN_KEYS.includes(endpointKey(id)), `${id} → ${endpointKey(id)}`);
});

test("AC-25b: routes.json'daki 72 /admin anahtarı = endpoints (69) ∪ NOT_EXPOSED (3), kesişim boş", () => {
  assert.equal(ADMIN_KEYS.length, 72);
  const exposed = ids.map(endpointKey);
  const hidden = NOT_EXPOSED.map((n) => n.key);
  assert.equal(exposed.length, 69);
  assert.equal(new Set(exposed).size, 69, "aynı route iki endpoint id'sinde");
  assert.equal(hidden.length, 3);
  assert.ok(hidden.includes("OPTIONS /admin/{proxy+}"));
  for (const n of NOT_EXPOSED) assert.ok(n.reason.length > 10, `${n.key} gerekçesiz`);
  assert.deepEqual(
    exposed.filter((k) => hidden.includes(k)),
    [],
  );
  assert.deepEqual([...exposed, ...hidden].sort(), [...ADMIN_KEYS].sort());
});

test("AC-25c: permission === backend routePermission(path)", () => {
  for (const id of ids) {
    const ep = ADMIN_ENDPOINTS[id];
    assert.equal(ep.permission, routePermission(ep.path, ep.method), id);
  }
});

test("AC-25d: visibleAreas üç rol için beklenen kümeler", () => {
  assert.deepEqual(plain(visibleAreas(sessionOf("admin"))), plain(ADMIN_AREAS));
  assert.equal(ADMIN_AREAS.length, 11);
  assert.deepEqual(plain(visibleAreas(sessionOf("moderator"))), [
    "genel",
    "moderasyon",
    "icerik",
    "destek",
  ]);
  assert.deepEqual(plain(visibleAreas(sessionOf("support"))), ["genel", "kullanicilar", "destek"]);
  assert.deepEqual(plain(visibleAreas(null)), []);
});

test("canRun: UI_STRICTER grant-credits'i yalnızca credits iznine açar", () => {
  assert.equal(UI_STRICTER["users.grantCredits"], "credits");
  assert.equal(canRun(sessionOf("support"), "users.suspend"), true);
  assert.equal(canRun(sessionOf("support"), "users.grantCredits"), false);
  assert.equal(canRun(sessionOf("admin"), "users.grantCredits"), true);
  assert.equal(canRun(sessionOf("moderator"), "plans"), false);
  assert.equal(canRun(sessionOf("moderator"), "metrics"), true);
  assert.equal(canRun(null, "metrics"), false);
});

test("adminRequest: path şablonu + encodeURIComponent, metod ve JSON gövde", async () => {
  apiStub.calls.length = 0;
  apiStub.respond = async () => ({ status: "suspended" });
  await adminRequest("users.suspend", { params: { id: "a/b#c" }, body: { reason: "Spam" } });
  const [call] = apiStub.calls;
  assert.equal(call.path, "/admin/users/a%2Fb%23c/suspend");
  assert.equal(call.init.method, "POST");
  assert.deepEqual(JSON.parse(call.init.body), { reason: "Spam" });

  await adminRequest("content.update", { params: { type: "blog", id: "b 1" }, body: {} });
  assert.equal(apiStub.calls[1].path, "/admin/content/blog/b%201");

  await adminRequest("users.list", { query: { limit: 200, cursor: undefined } });
  assert.equal(apiStub.calls[2].path, "/admin/users?limit=200");
  assert.equal(apiStub.calls[2].init.method, undefined, "GET'te metod/gövde yok");
  assert.equal(apiStub.calls[2].init.body, undefined);

  assert.throws(() => fillPath("/admin/users/{id}", {}), /"id" parametresi eksik/);
});

// §8.5 tablosu: [girdi, metod, kind, title, retryable, action?]
const ERR = (message) => new Error(message);
const API = (status, message) => ({
  status,
  message: message ?? `İşlem başarısız oldu (${status})`,
});
const CASES = [
  [
    ERR("Sunucuya erişilemedi. Çevrimdışı modda çalışılıyor."),
    "GET",
    "network",
    "Bağlantı kurulamadı",
    true,
  ],
  [
    ERR("Sunucuya erişilemedi. Çevrimdışı modda çalışılıyor."),
    "POST",
    "network",
    "Bağlantı kurulamadı",
    true,
  ],
  [
    ERR("İstek zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edin."),
    "GET",
    "timeout",
    "İstek zaman aşımına uğradı",
    true,
  ],
  [
    ERR("İstek zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edin."),
    "POST",
    "timeout",
    "İstek zaman aşımına uğradı",
    false,
    "refresh",
  ],
  [
    ERR("Sunucu yanıtı alınamadı. İşlemin sonucunu tekrar kontrol edin."),
    "POST",
    "uncertain",
    "İşlemin sonucu doğrulanamadı",
    false,
    "refresh",
  ],
  [
    ERR("Sunucu yanıtı alınamadı. İşlemin sonucunu tekrar kontrol edin."),
    "GET",
    "network",
    "Bağlantı kurulamadı",
    true,
  ],
  [ERR("tamamen bilinmeyen"), "GET", "unknown", "Beklenmeyen hata", true],
  [ERR("tamamen bilinmeyen"), "POST", "unknown", "Beklenmeyen hata", false, "refresh"],
  ["düz metin", "GET", "unknown", "Beklenmeyen hata", true],
  [undefined, "POST", "unknown", "Beklenmeyen hata", false, "refresh"],
  [API(400, "Telefon E.164 biçiminde olmalı."), "POST", "bad-request", "İstek geçersiz", false],
  [API(401), "GET", "unauthorized", "Oturum süresi doldu", false, "login"],
  [API(403), "GET", "forbidden", "Yetkiniz yok", false],
  [API(404), "GET", "not-deployed", "Bu özellik henüz canlıda değil", true],
  [API(404, "Kullanıcı bulunamadı."), "GET", "not-found", "Kayıt bulunamadı", false, "refresh"],
  [API(409, "Talep değişti; yeniden açın."), "POST", "conflict", "Kayıt değişti", true, "refresh"],
  [API(429), "GET", "rate-limited", "Çok fazla istek", true],
  [API(500), "GET", "server", "Sunucu hatası", true],
  [API(500), "POST", "uncertain", "İşlemin sonucu doğrulanamadı", false, "refresh"],
  [
    API(503, "Ödeme sağlayıcısı bağlı değil."),
    "POST",
    "unavailable",
    "Hizmet geçici olarak kullanılamıyor",
    true,
  ],
];

test("AC-25e: toAdminError §8.5 tablosu (endpoint metoduna göre)", () => {
  const warn = console.warn;
  const logs = [];
  console.warn = (...a) => logs.push(a.join(" "));
  try {
    for (const [input, method, kind, title, retryable, action] of CASES) {
      const id = method === "GET" ? "users.list" : "users.suspend";
      const ui = toAdminError(input, { endpointId: id });
      const label = `${method} ${JSON.stringify(input?.message ?? input)}`;
      assert.equal(ui.kind, kind, label);
      assert.equal(ui.title, title, label);
      assert.equal(ui.retryable, retryable, label);
      assert.equal(ui.action, action, label);
      assert.ok(ui.message.length > 0, label);
    }
  } finally {
    console.warn = warn;
  }
  assert.equal(
    toAdminError(API(403), { endpointId: "plans" }).message,
    "Bu bölüm için yetkiniz bulunmuyor.",
  );
  assert.equal(
    toAdminError(API(400, "Kendi yetkinizi değiştiremezsiniz."), { endpointId: "users.role" })
      .message,
    "Kendi yetkinizi değiştiremezsiniz.",
  );
  // Log PII içermez: yalnızca endpoint id + status + kind.
  assert.ok(logs.length > 0);
  for (const line of logs) assert.match(line, /^\[admin\] [\w.]+ (\d{3}|-) [a-z-]+$/);
});

test("AC-25e: api-client.ts kaynağında üç apiFetch hata öneki hâlâ var", () => {
  const src = fs.readFileSync(path.join(WEB, "lib/api-client.ts"), "utf8");
  for (const prefix of [
    "İstek zaman aşımına uğradı.",
    "Sunucuya erişilemedi.",
    "Sunucu yanıtı alınamadı.",
  ])
    assert.ok(src.includes(`throw new Error("${prefix}`), prefix);
});

test("AC-25f: users mapper — çok sayfalı Scan'den birleşmiş tam liste", () => {
  const res = fixture("GET_admin_users");
  assert.equal(res.nextCursor, null);
  const users = mappers.mapUsers(res);
  assert.equal(users.length, res.users.length);
  const u3 = users.find((u) => u.id === "u-1003");
  assert.equal(u3.suspended, true);
  assert.equal(u3.tier, "free");
  assert.equal(u3.role, "user");
  // Aynı userId'nin iki sayfadaki parçaları tek satırda birleşir.
  const merged = mappers.mapUsers({
    users: [
      { userId: "x", email: "a@example.com" },
      { userId: "x", tier: "pro", routesCount: 2 },
    ],
    nextCursor: null,
  });
  assert.deepEqual(
    [merged.length, merged[0].email, merged[0].tier, merged[0].routesCount],
    [1, "a@example.com", "pro", 2],
  );
});

test("AC-25f: token-usage iki şekil", () => {
  const ok = mappers.mapTokenUsage(fixture("GET_admin_token-usage"));
  assert.equal(ok.kind, "ok");
  assert.equal(ok.totalRequests, 4210);
  assert.deepEqual(plain(ok.activeModels), ["anthropic.claude-haiku", "amazon.nova-lite"]);
  const off = mappers.mapTokenUsage({
    usage: {
      note: "CloudWatch bağlı değil",
      totalInvocations: null,
      estimatedTokensMonth: null,
      activeModels: [],
      quotaUtilizationPct: null,
    },
  });
  assert.deepEqual(plain(off), { kind: "unavailable", note: "CloudWatch bağlı değil" });
});

test("AC-25f: payments kuruş → TL, iade edilebilirlik", () => {
  const rows = mappers.mapPayments(fixture("GET_admin_payments"));
  assert.equal(rows[0].amountTry, 149);
  assert.equal(rows[0].currency, "TRY");
  assert.equal(rows[0].refundable, true);
  assert.equal(rows[1].refundable, false, "iade edilmiş");
  assert.equal(rows[2].refundable, false, "paymentIntentId yok");
});

test("AC-25f: shares, tickets id türetme, subscriptions userId", () => {
  const shares = mappers.mapShares(fixture("GET_admin_shares"));
  assert.deepEqual(plain(shares.map((s) => s.revocable)), [true, false]);
  assert.match(shares[0].expiresAt, /^\d{4}-\d{2}-\d{2}T/);
  const tickets = mappers.mapTickets(fixture("GET_admin_tickets"));
  assert.deepEqual(plain(tickets.map((t) => t.id)), ["t-1", "t-2"]);
  const subs = mappers.mapSubscriptions(fixture("GET_admin_subscriptions"));
  assert.deepEqual(plain(subs.map((s) => s.userId)), ["u-1001", "u-1002"]);
});

test("AC-25f: release düğme görünürlüğü (I10)", () => {
  const view = mappers.mapRelease(fixture("GET_admin_ai-release"));
  assert.equal(view.canPublish, true);
  assert.equal(view.canRollback, true);
  const blocked = mappers.mapRelease({
    release: {
      version: 1,
      active: null,
      candidate: { model: "m", promptVersion: "p", qualityGate: "blocked" },
      previousActive: null,
      status: "blocked",
    },
  });
  assert.deepEqual([blocked.canPublish, blocked.canRollback], [false, false]);
});

test("newRequestId() handler regex'ine uyar ve benzersizdir", () => {
  const a = newRequestId();
  const b = newRequestId();
  assert.match(a, REQUEST_ID_PATTERN);
  assert.match(a, /^[a-zA-Z0-9_-]{16,80}$/);
  assert.equal(a.length, 32);
  assert.notEqual(a, b);
});

test("her GET endpoint'inin mock fixture'ı var (session hariç)", () => {
  for (const id of ids) {
    const ep = ADMIN_ENDPOINTS[id];
    if (ep.method !== "GET" || id === "session") continue;
    const name = `${ep.method}${ep.path}`.replace(/\{(\w+)\+?\}/g, "$1").replace(/\//g, "_");
    assert.ok(fs.existsSync(path.join(FIXTURES, `${name}.json`)), `${id}: ${name}.json yok`);
  }
});
