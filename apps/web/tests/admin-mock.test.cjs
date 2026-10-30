// Yerel yönetim API mock'u (design §8.7): spawn + `--port 0` → "listening on …" satırı (10 sn
// zaman aşımı), ardından session şekli, RBAC, routes.json dışı 404 ve gerekçe kuralları.
// Mock süreci her durumda (after) kapatılır.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");

const REPO = path.resolve(__dirname, "../../..");
const SERVER = path.join(REPO, "scripts/admin-mock/server.ts");
const FLAGS = [
  "--experimental-strip-types",
  "--disable-warning=ExperimentalWarning",
  "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
];

let child = null;
let base = null;

function startMock(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [...FLAGS, SERVER, ...args], {
      cwd: REPO,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`mock 10 sn içinde dinlemeye başlamadı. stderr: ${err}`));
    }, 10_000);
    proc.stdout.on("data", (c) => {
      out += c;
      const m = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(out);
      if (m) {
        clearTimeout(timer);
        resolve({ proc, url: m[1] });
      }
    });
    proc.stderr.on("data", (c) => (err += c));
    proc.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`mock erken çıktı (kod ${code}): ${err}`));
    });
  });
}

function stopMock(proc) {
  return new Promise((resolve) => {
    if (!proc || proc.exitCode !== null) return resolve();
    proc.once("exit", () => resolve());
    proc.kill("SIGTERM");
    setTimeout(() => proc.exitCode === null && proc.kill("SIGKILL"), 2000).unref();
  });
}

async function call(method, p, { role, body } = {}) {
  const headers = { "content-type": "application/json" };
  if (role) headers["x-mock-role"] = role;
  const res = await fetch(base + p, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

before(async () => {
  const started = await startMock(["--port", "0"]);
  child = started.proc;
  base = started.url;
});

after(async () => {
  await stopMock(child);
});

test("GET /admin/session handler şeklini döner (admin)", async () => {
  const { status, json } = await call("GET", "/admin/session");
  assert.equal(status, 200);
  const s = json.session;
  assert.equal(s.role, "admin");
  assert.equal(typeof s.userId, "string");
  assert.ok(Array.isArray(s.permissions) && s.permissions.includes("system"));
  assert.equal(typeof s.paymentsConfigured, "boolean");
  assert.equal(typeof s.userManagement, "boolean");
});

test("support rolü GET /admin/plans → 403 (permissions.ts)", async () => {
  const { status, json } = await call("GET", "/admin/plans", { role: "support" });
  assert.equal(status, 403);
  assert.equal(json.error, "Bu bölüm için yetkiniz bulunmuyor.");
  const own = await call("GET", "/admin/tickets", { role: "support" });
  assert.equal(own.status, 200);
});

test("routes.json dışı path → 404 {message:'Not Found'}", async () => {
  for (const [m, p] of [
    ["GET", "/admin/olmayan-uc"],
    ["GET", "/stripe/plans"],
    ["POST", "/admin/metrics"],
  ]) {
    const { status, json } = await call(m, p);
    assert.equal(status, 404, `${m} ${p}`);
    assert.deepEqual(json, { message: "Not Found" });
  }
});

test("OPTIONS /admin/* → 204 + CORS", async () => {
  const res = await fetch(base + "/admin/users", { method: "OPTIONS" });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
});

test("POST /admin/shares/{id}/revoke gerekçesiz → 400", async () => {
  const { status, json } = await call("POST", "/admin/shares/sh-1/revoke", { body: {} });
  assert.equal(status, 400);
  assert.match(json.error, /Gerekçe/);
});

test("POST /admin/users/{id}/suspend gerekçesiz → 200 (handler'da opsiyonel, F-11)", async () => {
  const { status, json } = await call("POST", "/admin/users/u-1001/suspend", { body: {} });
  assert.equal(status, 200);
  assert.equal(json.status, "suspended");
  const list = await call("GET", "/admin/users");
  assert.equal(list.json.users.find((u) => u.userId === "u-1001").suspended, true);
});

test("--fail, --empty ve --session-status bayrakları", async () => {
  const extra = await startMock([
    "--port",
    "0",
    "--empty",
    "--session-status",
    "404",
    "--fail",
    "GET /admin/payments=500,GET /admin/plans=404",
  ]);
  try {
    const get = (p) =>
      fetch(extra.url + p).then(async (r) => ({ status: r.status, json: await r.json() }));
    assert.equal((await get("/admin/session")).status, 404);
    assert.equal((await get("/admin/payments")).status, 500);
    assert.deepEqual(await get("/admin/plans"), { status: 404, json: { message: "Not Found" } });
    const users = await get("/admin/users");
    assert.equal(users.status, 200);
    assert.deepEqual(users.json.users, []);
    assert.equal(users.json.count, 0);
  } finally {
    await stopMock(extra.proc);
  }
});

test("geçersiz --port reddedilir", async () => {
  await assert.rejects(startMock(["--port", "80"]), /erken çıktı/);
});
