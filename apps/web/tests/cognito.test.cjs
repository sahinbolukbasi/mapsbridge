const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

function makeBase64url(obj) {
  const json = JSON.stringify(obj);
  return Buffer.from(json).toString("base64url");
}

function makeJwt(payload) {
  const header = makeBase64url({ alg: "RS256", typ: "JWT" });
  const body = makeBase64url(payload);
  return `${header}.${body}.fakesig`;
}

function loadModule() {
  const file = path.resolve(__dirname, "../app/lib/cognito.ts");
  const code = readFileSync(file, "utf8");
  const transformed = transformSync(code, { loader: "ts", format: "cjs", target: "node22" }).code;
  const mod = { exports: {} };

  // Create a mock localStorage for migrateLegacyStorageKeys tests
  const store = {};
  const mockLocalStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
    _store: store,
  };
  const mockSessionStorage = {
    getItem: () => null,
    removeItem: () => {},
  };

  vm.runInNewContext(transformed, {
    module: mod, exports: mod.exports,
    require,
    process: { env: { NEXT_PUBLIC_COGNITO_REGION: "eu-central-1", NEXT_PUBLIC_COGNITO_CLIENT_ID: "test-client" } },
    console, Buffer, JSON,
    window: {}, // truthy so migrateLegacyStorageKeys runs
    localStorage: mockLocalStorage,
    sessionStorage: mockSessionStorage,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    decodeURIComponent,
  });
  mod.exports._localStorage = mockLocalStorage;
  return mod.exports;
}

const { decodeJwtPayload, migrateLegacyStorageKeys, _localStorage } = loadModule();

// ─── decodeJwtPayload ─────────────────────────────────────────────

test("decodes a valid JWT payload", () => {
  const payload = { sub: "user-123", email: "test@test.com", exp: 9999999999 };
  const jwt = makeJwt(payload);
  const decoded = decodeJwtPayload(jwt);
  assert.equal(decoded.sub, "user-123");
  assert.equal(decoded.email, "test@test.com");
});

test("returns null for invalid JWT (< 2 parts)", () => {
  assert.equal(decodeJwtPayload("invalid"), null);
  assert.equal(decodeJwtPayload(""), null);
  assert.equal(decodeJwtPayload("one."), null);
});

test("returns null for malformed base64 payload", () => {
  const result = decodeJwtPayload("header.!!notbase64!!.sig");
  assert.equal(result, null);
});

test("handles JWT with padding issues (base64url)", () => {
  // Payload with length that requires padding
  const payload = { a: "x" };
  const jwt = makeJwt(payload);
  const decoded = decodeJwtPayload(jwt);
  assert.equal(decoded.a, "x");
});

test("decodes JWT with unicode characters in payload", () => {
  const payload = { name: "Şahin Bölükbaşı" };
  const jwt = makeJwt(payload);
  const decoded = decodeJwtPayload(jwt);
  assert.equal(decoded.name, "Şahin Bölükbaşı");
});

test("returns null for dot-only string", () => {
  assert.equal(decodeJwtPayload("..."), null);
});

// ─── migrateLegacyStorageKeys ─────────────────────────────────────
// These tests run directly against the module's internal localStorage mock
// since window is defined in the VM context

test("migrateLegacyStorageKeys copies old keys to new keys", () => {
  // Load a fresh module instance for isolation
  const code = readFileSync(path.resolve(__dirname, "../app/lib/cognito.ts"), "utf8");
  const transformed = transformSync(code, { loader: "ts", format: "cjs", target: "node22" }).code;
  const mod = { exports: {} };
  const store = { "adreskopru.accessToken": "old-token-abc" };
  const mockLS = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
  };
  vm.runInNewContext(transformed, {
    module: mod, exports: mod.exports,
    require,
    process: { env: {} },
    console, Buffer, JSON,
    window: {},
    localStorage: mockLS,
    sessionStorage: { getItem: () => null, removeItem: () => {} },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    decodeURIComponent,
  });
  mod.exports.migrateLegacyStorageKeys();
  assert.equal(store["mapsbridge.accessToken"], "old-token-abc");
  assert.equal(store["adreskopru.accessToken"], undefined);
});

test("migrateLegacyStorageKeys does not overwrite existing new key", () => {
  const code = readFileSync(path.resolve(__dirname, "../app/lib/cognito.ts"), "utf8");
  const transformed = transformSync(code, { loader: "ts", format: "cjs", target: "node22" }).code;
  const mod = { exports: {} };
  const store = {
    "adreskopru.accessToken": "old-token",
    "mapsbridge.accessToken": "existing-new-token",
  };
  const mockLS = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
  };
  vm.runInNewContext(transformed, {
    module: mod, exports: mod.exports,
    require,
    process: { env: {} },
    console, Buffer, JSON,
    window: {},
    localStorage: mockLS,
    sessionStorage: { getItem: () => null, removeItem: () => {} },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    decodeURIComponent,
  });
  mod.exports.migrateLegacyStorageKeys();
  assert.equal(store["mapsbridge.accessToken"], "existing-new-token");
  assert.equal(store["adreskopru.accessToken"], undefined);
});
