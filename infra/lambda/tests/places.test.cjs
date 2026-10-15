// Characterization tests for places/index.ts — lock down auth/validation surface.
// Dynamic service imports (discoverCity, place-store) are NOT exercised here;
// these tests verify that auth checks and input validation run before any I/O.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("../../../apps/web/node_modules/esbuild");

const sourceRoot = path.resolve(__dirname, "../src");
const env = {
  AWS_REGION: "eu-central-1",
  COGNITO_USER_POOL_ID: "eu-central-1_test",
  COGNITO_CLIENT_ID: "test-client",
  DYNAMODB_TABLE: "test-data",
};

const token = () =>
  [
    { alg: "RS256", typ: "JWT" },
    {
      sub: "user-a",
      iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_test",
      client_id: "test-client",
      token_use: "access",
      exp: Math.floor(Date.now() / 1000) + 300,
    },
  ]
    .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
    .join(".") + ".signature";

const event = (method, route, accessToken, body) => ({
  routeKey: `${method} ${route}`,
  headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  requestContext: { http: { method, path: route }, requestId: "test-req" },
  pathParameters: route.includes("{") ? {} : undefined,
  body: body === undefined ? undefined : JSON.stringify(body),
});

function harness(options = {}) {
  const calls = [];
  const db = new Map();
  const commands = {};
  for (const name of [
    "GetItemCommand",
    "PutItemCommand",
    "UpdateItemCommand",
    "QueryCommand",
    "ScanCommand",
    "TransactWriteItemsCommand",
  ]) {
    commands[name] = class {
      constructor(input) {
        this.name = name;
        this.input = input;
      }
    };
  }
  const cache = new Map();
  const external = {
    "@aws-sdk/client-dynamodb": {
      ...commands,
      DynamoDBClient: class {
        async send(cmd) {
          calls.push(cmd);
          if (options.db) return options.db(cmd, db);
          return { Item: null, Items: [] };
        }
      },
    },
    "@aws-sdk/util-dynamodb": { marshall: (v) => v, unmarshall: (v) => v },
    jose: {
      createRemoteJWKSet: () => () => ({}),
      jwtVerify: async (_token, _jwks, _opts) => {
        if (options.rejectToken) throw new Error("invalid token");
        return {
          payload: {
            sub: "user-a",
            iss: `https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_test`,
            client_id: "test-client",
            token_use: "access",
          },
        };
      },
    },
    "@aws-sdk/client-cognito-identity-provider": {},
  };
  function load(relative) {
    const filename = path.resolve(sourceRoot, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const code = transformSync(readFileSync(filename, "utf8"), {
      loader: "ts",
      format: "cjs",
      target: "node22",
      supported: { "dynamic-import": false },
    }).code;
    vm.runInNewContext(
      code,
      {
        module: mod,
        exports: mod.exports,
        Buffer,
        URL,
        AbortSignal,
        process: { env: { ...env, ...options.env } },
        crypto: require("node:crypto").webcrypto,
        console: { log() {}, warn() {}, error() {} },
        fetch: async (url) =>
          options.fetch
            ? options.fetch(url)
            : { ok: true, json: async () => ({ UserAttributes: [{ Name: "sub", Value: "user-a" }] }) },
        require(specifier) {
          if (specifier.startsWith("."))
            return load(path.resolve(path.dirname(filename), `${specifier}.ts`));
          if (external[specifier]) return external[specifier];
          throw new Error(`Unexpected dependency: ${specifier}`);
        },
      },
      { filename },
    );
    return mod.exports;
  }
  return { load, calls };
}

// ── Auth surface ──────────────────────────────────────────────────────────────

test("POST /places/discover returns 401 without auth token", async () => {
  const h = harness();
  const res = await h.load("places/index.ts").handler(
    event("POST", "/places/discover", null, { city: "Rome" }),
  );
  assert.equal(res.statusCode, 401);
  assert.equal(h.calls.length, 0, "no DB calls before auth");
});

test("POST /places/discover returns 400 when city is missing", async () => {
  const h = harness();
  const res = await h.load("places/index.ts").handler(
    event("POST", "/places/discover", token(), {}),
  );
  assert.equal(res.statusCode, 400);
  const body = JSON.parse(res.body);
  assert.ok(body.message || body.error, "error message present");
});

test("POST /places/discover returns 400 when city is too long", async () => {
  const h = harness();
  const res = await h.load("places/index.ts").handler(
    event("POST", "/places/discover", token(), { city: "x".repeat(101) }),
  );
  assert.equal(res.statusCode, 400);
});

test("GET /places/city/{city} returns 401 without auth", async () => {
  const h = harness();
  const ev = {
    routeKey: "GET /places/city/{city}",
    headers: {},
    requestContext: { http: { method: "GET", path: "/places/city/rome" }, requestId: "r" },
    pathParameters: { city: "rome" },
  };
  const res = await h.load("places/index.ts").handler(ev);
  assert.equal(res.statusCode, 401);
});

test("GET /places/city/{city}/meta returns 401 without auth", async () => {
  const h = harness();
  const ev = {
    routeKey: "GET /places/city/{city}/meta",
    headers: {},
    requestContext: { http: { method: "GET", path: "/places/city/rome/meta" }, requestId: "r" },
    pathParameters: { city: "rome" },
  };
  const res = await h.load("places/index.ts").handler(ev);
  assert.equal(res.statusCode, 401);
});

test("POST /places/batch-discover returns 403 for non-admin user", async () => {
  const h = harness({
    db(cmd) {
      // PROFILE read — non-admin user
      return { Item: { PK: "USER#user-a", SK: "PROFILE", role: "user" } };
    },
  });
  const res = await h.load("places/index.ts").handler(
    event("POST", "/places/batch-discover", token(), { cities: ["Rome"] }),
  );
  assert.equal(res.statusCode, 403);
});

test("POST /places/batch-discover returns 403 without auth (requireAdmin returns false)", async () => {
  const h = harness();
  const res = await h.load("places/index.ts").handler(
    event("POST", "/places/batch-discover", null, { cities: [] }),
  );
  // requireAdmin() returns false for unauthenticated, handler calls forbidden() → 403
  assert.equal(res.statusCode, 403);
});
