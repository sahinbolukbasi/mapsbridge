const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

function loadModule(relativePath) {
  const fullPath = path.resolve(__dirname, relativePath);
  const code = readFileSync(fullPath, "utf8");
  const transformed = transformSync(code, { loader: "ts", format: "cjs" }).code;
  const mod = { exports: {} };
  vm.runInNewContext(transformed, {
    module: mod,
    exports: mod.exports,
    require(spec) {
      if (spec.startsWith(".")) {
        const resolved = path.resolve(
          path.dirname(fullPath),
          spec.endsWith(".ts") ? spec : spec + ".ts",
        );
        return loadModule(path.relative(__dirname, resolved));
      }
      return require(spec);
    },
    console,
    process,
    Buffer,
    setTimeout,
    clearTimeout,
  });
  return mod.exports;
}

const { AgentDispatcher } = loadModule("../src/application/agent-dispatcher.ts");

// ── Emergency intent detection ──────────────────────────────────────────────

test("detectIntent returns emergency_safety for emergency keywords", () => {
  const result = AgentDispatcher.detectIntent("Acil yardım lazım!", "Istanbul");
  assert.equal(result.action, "emergency_safety");
  assert.equal(result.recommendedSubAgents.length, 1);
  assert.equal(result.recommendedSubAgents[0], "emergency-agent");
  assert.equal(result.requiresConfirmation, false);
  assert.equal(result.targetCity, "Istanbul");
});

test("detectIntent recognizes hospital emergency keyword", () => {
  const result = AgentDispatcher.detectIntent("hastane nerede");
  assert.equal(result.action, "emergency_safety");
});

// ── Wallet / Balance intent ─────────────────────────────────────────────────

test("detectIntent returns check_wallet for credit/balance keywords", () => {
  const result = AgentDispatcher.detectIntent("Kaç kredim kaldı?");
  assert.equal(result.action, "check_wallet");
  assert.equal(result.recommendedSubAgents.length, 1);
  assert.equal(result.recommendedSubAgents[0], "billing-wallet-tool");
});

// ── Location share intent ───────────────────────────────────────────────────

test("detectIntent returns share_location and requires confirmation", () => {
  const result = AgentDispatcher.detectIntent("konum paylaş arkadaşıma");
  assert.equal(result.action, "share_location");
  assert.equal(result.requiresConfirmation, true);
  assert.equal(result.recommendedSubAgents.length, 1);
  assert.equal(result.recommendedSubAgents[0], "share-token-tool");
});

// ── Lodging intent ──────────────────────────────────────────────────────────

test("detectIntent returns find_lodging for hotel keywords", () => {
  const result = AgentDispatcher.detectIntent("Otel arıyorum merkeze yakın", "Antalya");
  assert.equal(result.action, "find_lodging");
  assert.equal(result.targetCity, "Antalya");
  assert.ok(result.recommendedSubAgents.includes("lodging-agent"));
});

// ── Food intent ─────────────────────────────────────────────────────────────

test("detectIntent returns find_food for restaurant/food keywords", () => {
  const result = AgentDispatcher.detectIntent("Güzel bir restoran öner");
  assert.equal(result.action, "find_food");
  assert.ok(result.recommendedSubAgents.includes("food-agent"));
});

// ── General chat fallback ───────────────────────────────────────────────────

test("detectIntent falls back to general_chat for unrecognized input", () => {
  const result = AgentDispatcher.detectIntent("Bugün hava nasıl olacak?", "Izmir");
  assert.equal(result.action, "general_chat");
  assert.equal(result.recommendedSubAgents.length, 1);
  assert.equal(result.recommendedSubAgents[0], "context-agent");
  assert.equal(result.targetCity, "Izmir");
});

// ── Empty / null-safe input ─────────────────────────────────────────────────

test("detectIntent handles empty string without throwing", () => {
  const result = AgentDispatcher.detectIntent("");
  assert.equal(result.action, "general_chat");
  assert.equal(result.requiresConfirmation, false);
});

test("detectIntent handles undefined-ish prompt safely", () => {
  // The implementation casts prompt via (prompt || ""), so null/undefined
  // would be caught if the caller passes them despite the type.
  const result = AgentDispatcher.detectIntent(/** @type {any} */ (undefined));
  assert.equal(result.action, "general_chat");
});
