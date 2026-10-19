const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

const sourceRoot = path.resolve(__dirname, "../src");
const env = {
  AWS_REGION: "eu-central-1",
  DYNAMODB_TABLE: "test-data",
  ENVIRONMENT: "test",
};

// Build a shared module loader that resolves ../shared/* references
function makeRequire(rows, calls) {
  const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

  function makeDDB() {
    return {
      DynamoDBClient: class {
        async send(cmd) {
          calls.push({ name: cmd.constructor.name, input: cmd.input });
          if (cmd.constructor.name === "GetItemCommand") {
            const pk = cmd.input.Key?.PK?.S ?? cmd.input.Key?.["PK"]?.S;
            const sk = cmd.input.Key?.SK?.S ?? "META";
            return { Item: rows.get(`${pk}|${sk}`) || null };
          }
          if (cmd.constructor.name === "ScanCommand") {
            const items = [];
            for (const [, v] of rows) items.push(v);
            return { Items: items };
          }
          if (cmd.constructor.name === "QueryCommand") {
            return { Items: [], Count: 0 };
          }
          if (cmd.constructor.name === "PutItemCommand") {
            // Store the item
            const item = unmarshall(cmd.input.Item || {});
            if (item.PK && item.SK) rows.set(`${item.PK}|${item.SK}`, cmd.input.Item);
            return {};
          }
          if (cmd.constructor.name === "UpdateItemCommand") return {};
          if (cmd.constructor.name === "DeleteItemCommand") return {};
          if (cmd.constructor.name === "TransactWriteItemsCommand") return {};
          return {};
        }
      },
      GetItemCommand: class GetItemCommand { constructor(i) { this.input = i; } },
      PutItemCommand: class PutItemCommand { constructor(i) { this.input = i; } },
      ScanCommand: class ScanCommand { constructor(i) { this.input = i; } },
      QueryCommand: class QueryCommand { constructor(i) { this.input = i; } },
      DeleteItemCommand: class DeleteItemCommand { constructor(i) { this.input = i; } },
      UpdateItemCommand: class UpdateItemCommand { constructor(i) { this.input = i; } },
      TransactWriteItemsCommand: class TransactWriteItemsCommand { constructor(i) { this.input = i; } },
    };
  }

  const sharedCache = new Map();
  function loadShared(name) {
    if (sharedCache.has(name)) return sharedCache.get(name);
    const file = path.join(sourceRoot, "shared", `${name}.ts`);
    let code;
    try { code = readFileSync(file, "utf8"); } catch { return {}; }
    const transformed = transformSync(code, { loader: "ts", format: "cjs", target: "node22" }).code;
    const mod = { exports: {} };
    const ctx = { module: mod, exports: mod.exports, process: { env }, console, Buffer, crypto: require("crypto"), require: makeRequire(rows, calls) };
    vm.runInNewContext(transformed, ctx);
    sharedCache.set(name, mod.exports);
    return mod.exports;
  }

  return function req(spec) {
    if (spec === "@aws-sdk/client-dynamodb") return makeDDB();
    if (spec === "@aws-sdk/util-dynamodb") return { marshall, unmarshall };
    if (spec === "@aws-sdk/client-ses") return { SESClient: class { send() {} }, SendEmailCommand: class {} };
    if (spec === "@aws-sdk/client-sqs") return { SQSClient: class { send() {} }, SendMessageCommand: class {} };
    if (spec === "@aws-sdk/client-bedrock-runtime") return {
      BedrockRuntimeClient: class { async send() { return { body: Buffer.from(JSON.stringify({ content: [{ text: "test response" }] })) }; } },
      InvokeModelCommand: class {},
    };
    if (spec.startsWith("../shared/") || spec.startsWith("./")) {
      const name = spec.replace("../shared/", "").replace("./", "").replace(/\.ts$/, "").replace(/\.js$/, "");
      if (name === "auth") return {
        verifiedUserId: async (t) => t === "valid-token" ? "user-test" : null,
        getVerifiedUser: async (t) => t === "valid-token" ? { sub: "user-test", email: "test@test.com" } : null,
      };
      if (name === "dynamo") return { getDynamoClient: () => { const ddb = makeDDB(); return new ddb.DynamoDBClient(); } };
      if (name === "types") return {};
      if (name === "http") {
        const j = (code, body) => ({ statusCode: code, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        return {
          jsonResponse: j, ok: (b) => j(200, b), created: (b) => j(201, b),
          badRequest: (m = "Bad request") => j(400, { error: m }), unauthorized: (m = "Unauthorized") => j(401, { error: m }),
          forbidden: (m = "Forbidden") => j(403, { error: m }), notFound: (m = "Not found") => j(404, { error: m }),
          tooManyRequests: (m = "Too many requests") => j(429, { error: m }), serverError: (m = "Server error") => j(500, { error: m }),
          handlePreflight: () => ({ statusCode: 200, headers: {}, body: "" }),
          extractBearerToken: (e) => { const a = e.headers?.authorization || ""; return a.startsWith("Bearer ") ? a.slice(7) : null; },
          parseBody: (e) => { try { return e.body ? JSON.parse(e.body) : null; } catch { return null; } },
          getSecret: async () => "", resolveEnvSecret: async (v) => v || "", memoize: (fn) => { let p; return () => p || (p = fn()); },
        };
      }
      if (name === "router") {
        class Router {
          constructor() { this._exact = new Map(); this._params = []; }
          add(rk, h) {
            const [m, p] = rk.trim().split(/\s+/);
            if (!p.includes("{")) { this._exact.set(`${m.toUpperCase()} ${p}`, h); return this; }
            const pn = [];
            const rx = p.replace(/\{([^}]+)\}/g, (_, n) => { pn.push(n); return "([^/]+)"; });
            this._params.push({ method: m.toUpperCase(), pattern: new RegExp(`^${rx}$`), paramNames: pn, handler: h });
            return this;
          }
          async dispatch(e) {
            const m = (e.requestContext?.http?.method || "GET").toUpperCase();
            const p = (e.requestContext?.http?.path || "/").replace(/\/$/, "") || "/";
            if (m === "OPTIONS") return { statusCode: 200, headers: {}, body: "" };
            const ex = this._exact.get(`${m} ${p}`); if (ex) return ex(e);
            for (const r of this._params) {
              if (r.method !== m) continue;
              const match = p.match(r.pattern);
              if (match) { e.pathParameters = { ...(e.pathParameters || {}) }; r.paramNames.forEach((n, i) => { e.pathParameters[n] = decodeURIComponent(match[i + 1]); }); return r.handler(e); }
            }
            const j = (code, body) => ({ statusCode: code, headers: {}, body: JSON.stringify(body) });
            return j(404, { error: `Not found: ${m} ${p}` });
          }
        }
        return { Router };
      }
      // tracker-worker stub
      if (name === "tracker-worker") return {
        getScalabilityMetrics: async () => ({ totalJobs: 0, activeJobs: 0, queueDepth: 0 }),
        listUserTrackerJobs: async () => [],
        createTrackerJob: async (userId, data) => {
          const validTypes = ["flight", "hotel", "price"];
          if (!validTypes.includes(data.type)) throw Object.assign(new Error("Invalid type"), { status: 400 });
          if (!data.destination) throw Object.assign(new Error("Destination required"), { status: 400 });
          return { jobId: "job-test", ...data };
        },
        deleteTrackerJob: async () => ({ deleted: true }),
        executeTrackerCheck: async () => ({ executed: true }),
      };
      return {};
    }
    if (spec.startsWith("../admin/")) return {
      AdminError: class AdminError extends Error { constructor(status, msg) { super(msg); this.status = status; } },
      bodyOf: (e) => { try { return JSON.parse(e.body || "{}"); } catch { return {}; } },
      text: (v, _label, max) => String(v || "").slice(0, max),
      get: async (pk) => { const item = rows.get(`${pk}|META`); return item ? unmarshall(item) : null; },
      scan: async () => [],
      commit: async (e, data) => data,
    };
    return require(spec);
  };
}

function loadHandler() {
  const rows = new Map();
  const calls = [];
  const code = readFileSync(path.join(sourceRoot, "operations", "index.ts"), "utf8");
  const transformed = transformSync(code, { loader: "ts", format: "cjs", target: "node22" }).code
    .replace(/\bawait import\(([^)]+)\)/g, "require($1)");
  const mod = { exports: {} };
  vm.runInNewContext(transformed, {
    module: mod, exports: mod.exports,
    require: makeRequire(rows, calls),
    process: { env }, console, Buffer, crypto: require("crypto"), Date, Math, Number, JSON,
  });
  return { handler: mod.exports.handler, rows, calls };
}

function event(method, urlpath, opts = {}) {
  return {
    requestContext: { http: { method, path: urlpath } },
    pathParameters: opts.params || {},
    queryStringParameters: opts.query || {},
    headers: opts.headers || {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  };
}

// ─── System Status ────────────────────────────────────────────────

test("GET /system/status returns maintenance mode false by default", async () => {
  const { handler } = loadHandler();
  const res = await handler(event("GET", "/system/status"));
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.maintenanceMode, false);
  assert.ok(Array.isArray(body.announcements));
});

// ─── Support Tickets ──────────────────────────────────────────────

test("GET /support/tickets requires auth", async () => {
  const { handler } = loadHandler();
  const res = await handler(event("GET", "/support/tickets"));
  assert.equal(res.statusCode, 401);
});

test("POST /support/tickets requires auth", async () => {
  const { handler } = loadHandler();
  const res = await handler(event("POST", "/support/tickets", {
    body: { subject: "Help", message: "I need help", category: "account", requestId: "req12345678901234" },
  }));
  assert.equal(res.statusCode, 401);
});

test("POST /support/tickets rejects invalid category", async () => {
  const { handler } = loadHandler();
  const res = await handler(event("POST", "/support/tickets", {
    headers: { authorization: "Bearer valid-token" },
    body: { subject: "Help", message: "I need help", category: "unknown", requestId: "req12345678901234" },
  }));
  assert.equal(res.statusCode, 400);
});

test("POST /support/tickets rejects invalid requestId format", async () => {
  const { handler } = loadHandler();
  const res = await handler(event("POST", "/support/tickets", {
    headers: { authorization: "Bearer valid-token" },
    body: { subject: "Help", message: "I need help", category: "account", requestId: "short" },
  }));
  assert.equal(res.statusCode, 400);
});

// ─── Tracker Metrics ──────────────────────────────────────────────

test("GET /tracker/metrics returns metrics object", async () => {
  const { handler } = loadHandler();
  const res = await handler(event("GET", "/tracker/metrics"));
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.ok("metrics" in body);
});

// ─── Tracker Jobs (auth required) ────────────────────────────────

test("GET /tracker/jobs requires auth", async () => {
  const { handler } = loadHandler();
  const res = await handler(event("GET", "/tracker/jobs"));
  assert.equal(res.statusCode, 401);
});

test("POST /tracker/jobs rejects invalid job type", async () => {
  const { handler } = loadHandler();
  const res = await handler(event("POST", "/tracker/jobs", {
    headers: { authorization: "Bearer valid-token" },
    body: { type: "invalid", destination: "Istanbul" },
  }));
  assert.equal(res.statusCode, 400);
});

test("POST /tracker/jobs rejects missing destination", async () => {
  const { handler } = loadHandler();
  const res = await handler(event("POST", "/tracker/jobs", {
    headers: { authorization: "Bearer valid-token" },
    body: { type: "flight" },
  }));
  assert.equal(res.statusCode, 400);
});
