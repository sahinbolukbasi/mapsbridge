const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("../../../apps/web/node_modules/esbuild");

const sourceRoot = path.resolve(__dirname, "../src");
const env = {
  AWS_REGION: "eu-central-1",
  DYNAMODB_TABLE: "test-data",
  ENVIRONMENT: "test",
  GUIDES_BUCKET: "test-guides",
};

function harness(opts = {}) {
  const rows = new Map();
  const calls = [];

  if (opts.rows) {
    for (const [k, v] of Object.entries(opts.rows)) rows.set(k, v);
  }

  function makeDDB() {
    return {
      async send(cmd) {
        calls.push({ name: cmd.constructor.name, input: cmd.input });
        if (cmd.constructor.name === "GetItemCommand") {
          const pk = cmd.input.Key?.PK?.S;
          const sk = cmd.input.Key?.SK?.S;
          const row = rows.get(`${pk}|${sk}`);
          return { Item: row || null };
        }
        if (cmd.constructor.name === "ScanCommand") {
          const items = [];
          for (const [, v] of rows) items.push(v);
          return { Items: items.slice(0, cmd.input.Limit || 100) };
        }
        if (cmd.constructor.name === "PutItemCommand") return {};
        return {};
      },
    };
  }

  // Minimal shared module loader
  function loadShared(name) {
    const file = path.join(sourceRoot, "shared", name + ".ts");
    const code = readFileSync(file, "utf8");
    const transformed = transformSync(code, { loader: "ts", format: "cjs", target: "node22" }).code;
    const mod = { exports: {} };
    vm.runInNewContext(transformed, {
      module: mod, exports: mod.exports,
      require(spec) {
        if (spec.startsWith(".")) return loadShared(path.basename(spec));
        if (spec === "@aws-sdk/client-dynamodb") return makeAwsDDB();
        if (spec === "@aws-sdk/util-dynamodb") return require("@aws-sdk/util-dynamodb");
        return require(spec);
      },
      process: { env }, console, Buffer, crypto: require("crypto"),
    });
    return mod.exports;
  }

  function makeAwsDDB() {
    return {
      DynamoDBClient: class { async send(cmd) { return makeDDB().send(cmd); } },
      GetItemCommand: class GetItemCommand { constructor(i) { this.input = i; } },
      PutItemCommand: class PutItemCommand { constructor(i) { this.input = i; } },
      ScanCommand: class ScanCommand { constructor(i) { this.input = i; } },
      QueryCommand: class QueryCommand { constructor(i) { this.input = i; } },
      DeleteItemCommand: class DeleteItemCommand { constructor(i) { this.input = i; } },
      UpdateItemCommand: class UpdateItemCommand { constructor(i) { this.input = i; } },
      TransactWriteItemsCommand: class TransactWriteItemsCommand { constructor(i) { this.input = i; } },
    };
  }

  function loadHandler() {
    const code = readFileSync(path.join(sourceRoot, "marketplace", "index.ts"), "utf8");
    const transformed = transformSync(code, { loader: "ts", format: "cjs", target: "node22" }).code
      .replace(/\bawait import\(([^)]+)\)/g, "require($1)");
    const mod = { exports: {} };
    vm.runInNewContext(transformed, {
      module: mod, exports: mod.exports,
      require(spec) {
        if (spec === "@aws-sdk/client-dynamodb") return makeAwsDDB();
        if (spec === "@aws-sdk/util-dynamodb") {
          const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
          return { marshall, unmarshall };
        }
        if (spec === "@aws-sdk/s3-request-presigner") return { getSignedUrl: async () => "https://signed.example.com/file.pdf" };
        if (spec === "@aws-sdk/client-s3") return {
          S3Client: class { send() { return {}; } },
          PutObjectCommand: class { constructor(i) { this.input = i; } },
          GetObjectCommand: class { constructor(i) { this.input = i; } },
        };
        if (spec === "@aws-sdk/client-firehose") return {
          FirehoseClient: class { send() { return {}; } },
          PutRecordCommand: class {},
        };
        if (spec.startsWith("../shared/")) {
          const name = spec.replace("../shared/", "").replace(/\.ts$/, "");
          if (name === "auth") return {
            verifiedUserId: async (token) => token === "valid-token" ? "user-test" : null,
            getVerifiedUser: async (token) => token === "valid-token" ? { sub: "user-test" } : null,
          };
          if (name === "dynamo") return { getDynamoClient: () => makeDDB() };
          if (name === "http") {
            const j = (code, body) => ({ statusCode: code, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
            return {
              jsonResponse: j,
              ok: (b) => j(200, b),
              created: (b) => j(201, b),
              badRequest: (msg = "Bad request") => j(400, { error: msg }),
              unauthorized: (msg = "Unauthorized") => j(401, { error: msg }),
              forbidden: (msg = "Forbidden") => j(403, { error: msg }),
              notFound: (msg = "Not found") => j(404, { error: msg }),
              tooManyRequests: (msg = "Too many requests") => j(429, { error: msg }),
              serverError: (msg = "Server error") => j(500, { error: msg }),
              handlePreflight: () => ({ statusCode: 200, headers: {}, body: "" }),
              extractBearerToken: (event) => {
                const auth = event.headers?.authorization || event.headers?.Authorization || "";
                return auth.startsWith("Bearer ") ? auth.slice(7) : null;
              },
              parseBody: (event) => { try { return event.body ? JSON.parse(event.body) : null; } catch { return null; } },
              getSecret: async (path) => process.env[path] || "",
              resolveEnvSecret: async (v) => v || "",
              memoize: (fn) => { let p; return () => p || (p = fn()); },
            };
          }
          if (name === "router") {
            class Router {
              constructor() { this._exact = new Map(); this._params = []; }
              add(routeKey, handler) {
                const [method, path] = routeKey.trim().split(/\s+/);
                if (!path.includes("{")) { this._exact.set(`${method.toUpperCase()} ${path}`, handler); return this; }
                const paramNames = [];
                const rx = path.replace(/\{([^}]+)\}/g, (_, n) => { paramNames.push(n); return "([^/]+)"; });
                this._params.push({ method: method.toUpperCase(), pattern: new RegExp(`^${rx}$`), paramNames, handler });
                return this;
              }
              async dispatch(event) {
                const m = (event.requestContext?.http?.method || "GET").toUpperCase();
                const p = (event.requestContext?.http?.path || "/").replace(/\/$/, "") || "/";
                if (m === "OPTIONS") return { statusCode: 200, headers: {}, body: "" };
                const exact = this._exact.get(`${m} ${p}`);
                if (exact) return exact(event);
                for (const r of this._params) {
                  if (r.method !== m) continue;
                  const match = p.match(r.pattern);
                  if (match) {
                    event.pathParameters = { ...(event.pathParameters || {}) };
                    r.paramNames.forEach((n, i) => { event.pathParameters[n] = decodeURIComponent(match[i + 1]); });
                    return r.handler(event);
                  }
                }
                return { statusCode: 404, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: `Not found: ${m} ${p}` }) };
              }
            }
            return { Router };
          }
          return loadShared(name);
        }
        return require(spec);
      },
      process: { env }, console, Buffer, crypto: require("crypto"), Date, Math, Number, JSON,
    });
    return mod.exports.handler;
  }

  return { handler: loadHandler(), calls, rows };
}

function event(method, path, opts = {}) {
  return {
    requestContext: { http: { method, path } },
    pathParameters: opts.params || {},
    queryStringParameters: opts.query || {},
    headers: opts.headers || {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  };
}

// ─── Health check ─────────────────────────────────────────────────

test("GET /health returns ok", async () => {
  const { handler } = harness();
  const res = await handler(event("GET", "/health"));
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.status, "ok");
  assert.equal(body.service, "marketplace");
});

// ─── List guides ──────────────────────────────────────────────────

test("GET /marketplace/guides returns guide list without filePath", async () => {
  const { marshall } = require("@aws-sdk/util-dynamodb");
  const { handler } = harness({
    rows: {
      "GUIDE#g1|META": marshall({ PK: "GUIDE#g1", SK: "META", guideId: "g1", title: "Rome Guide", filePath: "/private/rome.pdf", price: 1000 }),
    },
  });
  const res = await handler(event("GET", "/marketplace/guides"));
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.ok(Array.isArray(body.guides));
  // filePath must NOT be exposed
  if (body.guides.length > 0) {
    assert.equal(body.guides[0].filePath, undefined);
  }
});

// ─── Get guide ────────────────────────────────────────────────────

test("GET /marketplace/guides/{id} returns 404 for unknown guide", async () => {
  const { handler } = harness();
  const res = await handler(event("GET", "/marketplace/guides/nonexistent", { params: { id: "nonexistent" } }));
  assert.equal(res.statusCode, 404);
});

// ─── Create guide ─────────────────────────────────────────────────

test("POST /marketplace/guides requires auth", async () => {
  const { handler } = harness();
  const res = await handler(event("POST", "/marketplace/guides", {
    body: { title: "Test", price: 10 },
  }));
  assert.equal(res.statusCode, 401);
});

test("POST /marketplace/guides with valid token requires title and price", async () => {
  const { handler } = harness();
  const res = await handler(event("POST", "/marketplace/guides", {
    headers: { authorization: "Bearer valid-token" },
    body: { description: "no title" },
  }));
  assert.equal(res.statusCode, 400);
});

test("POST /marketplace/guides with valid token and data returns 201", async () => {
  const { handler } = harness();
  const res = await handler(event("POST", "/marketplace/guides", {
    headers: { authorization: "Bearer valid-token" },
    body: { title: "Istanbul Guide", price: 9.99, description: "Great guide" },
  }));
  assert.equal(res.statusCode, 201);
  const body = JSON.parse(res.body);
  assert.ok(body.guideId);
  assert.equal(body.title, "Istanbul Guide");
});

// ─── Purchase returns 503 (disabled) ─────────────────────────────

test("POST /marketplace/guides/{id}/purchase returns 503 (disabled)", async () => {
  const { handler } = harness();
  const res = await handler(event("POST", "/marketplace/guides/g1/purchase", {
    headers: { authorization: "Bearer valid-token" },
    params: { id: "g1" },
    body: { paymentIntentId: "pi_test" },
  }));
  assert.equal(res.statusCode, 503);
});

// ─── Blog CRUD ────────────────────────────────────────────────────

test("GET /marketplace/blogs returns blog list", async () => {
  const { handler } = harness();
  const res = await handler(event("GET", "/marketplace/blogs"));
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.ok(Array.isArray(body.blogs));
});

test("POST /marketplace/blogs requires auth", async () => {
  const { handler } = harness();
  const res = await handler(event("POST", "/marketplace/blogs", {
    body: { title: "Test Blog", content: "Hello world" },
  }));
  assert.equal(res.statusCode, 401);
});

test("POST /marketplace/blogs with valid token creates blog", async () => {
  const { handler } = harness();
  const res = await handler(event("POST", "/marketplace/blogs", {
    headers: { authorization: "Bearer valid-token" },
    body: { title: "Travel Tips", content: "Content here", tags: ["travel"] },
  }));
  assert.equal(res.statusCode, 201);
  const body = JSON.parse(res.body);
  assert.ok(body.blogId);
});
