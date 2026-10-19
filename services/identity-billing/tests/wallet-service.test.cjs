const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

function loadWallet() {
  const file = path.resolve(__dirname, "../src/application/wallet-service.ts");
  const code = readFileSync(file, "utf8");
  const transformed = transformSync(code, { loader: "ts", format: "cjs", target: "node22" }).code;
  const mod = { exports: {} };
  vm.runInNewContext(transformed, {
    module: mod, exports: mod.exports,
    require(spec) {
      // Stub out all side-effect imports (store, data)
      if (spec.includes("billing/store") || spec.includes("shared/data")) return {};
      return require(spec);
    },
    console, Math, Number, JSON,
  });
  return mod.exports.WalletService;
}

const WalletService = loadWallet();

// ─── Constants ────────────────────────────────────────────────────

test("WELCOME_CREDITS is 5", () => {
  assert.equal(WalletService.WELCOME_CREDITS, 5);
});

test("DAILY_REQUEST_LIMIT is 20", () => {
  assert.equal(WalletService.DAILY_REQUEST_LIMIT, 20);
});

test("CREDIT_COSTS has clarify=0, chat=1, route=5", () => {
  assert.equal(WalletService.CREDIT_COSTS.clarify, 0);
  assert.equal(WalletService.CREDIT_COSTS.chat, 1);
  assert.equal(WalletService.CREDIT_COSTS.route, 5);
});

// ─── isValidCreditAdjustment ──────────────────────────────────────

function validCmd(overrides = {}) {
  return {
    amount: 10,
    idempotencyKey: "adjust-1234567890123456",
    ...overrides,
  };
}

test("valid positive adjustment returns true", () => {
  assert.equal(WalletService.isValidCreditAdjustment(validCmd({ amount: 10 })), true);
});

test("valid negative adjustment returns true", () => {
  assert.equal(WalletService.isValidCreditAdjustment(validCmd({ amount: -5 })), true);
});

test("amount 0 is invalid", () => {
  assert.equal(WalletService.isValidCreditAdjustment(validCmd({ amount: 0 })), false);
});

test("amount > 10000 is invalid", () => {
  assert.equal(WalletService.isValidCreditAdjustment(validCmd({ amount: 10001 })), false);
});

test("amount exactly 10000 is valid", () => {
  assert.equal(WalletService.isValidCreditAdjustment(validCmd({ amount: 10000 })), true);
});

test("amount exactly -10000 is valid", () => {
  assert.equal(WalletService.isValidCreditAdjustment(validCmd({ amount: -10000 })), true);
});

test("amount -10001 is invalid", () => {
  assert.equal(WalletService.isValidCreditAdjustment(validCmd({ amount: -10001 })), false);
});

test("non-integer amount is invalid", () => {
  assert.equal(WalletService.isValidCreditAdjustment(validCmd({ amount: 1.5 })), false);
});

test("idempotencyKey shorter than 16 chars is invalid", () => {
  assert.equal(WalletService.isValidCreditAdjustment(validCmd({ idempotencyKey: "short" })), false);
});

test("idempotencyKey longer than 80 chars is invalid", () => {
  const key = "a".repeat(81);
  assert.equal(WalletService.isValidCreditAdjustment(validCmd({ idempotencyKey: key })), false);
});

test("idempotencyKey with spaces is invalid", () => {
  assert.equal(WalletService.isValidCreditAdjustment(validCmd({ idempotencyKey: "adjust key with space" })), false);
});

test("idempotencyKey with only valid chars (a-z, 0-9, _, -) is valid", () => {
  assert.equal(WalletService.isValidCreditAdjustment(validCmd({ idempotencyKey: "valid_key-1234567" })), true);
});

test("idempotencyKey exactly 16 chars is valid", () => {
  assert.equal(WalletService.isValidCreditAdjustment(validCmd({ idempotencyKey: "a".repeat(16) })), true);
});

test("idempotencyKey exactly 80 chars is valid", () => {
  assert.equal(WalletService.isValidCreditAdjustment(validCmd({ idempotencyKey: "a".repeat(80) })), true);
});
