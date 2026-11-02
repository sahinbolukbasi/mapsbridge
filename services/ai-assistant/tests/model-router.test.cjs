const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

function loadRouter() {
  // Load contracts first to get ACTION_CREDIT_COSTS
  const contractsFile = path.resolve(__dirname, "../../../packages/contracts/src/index.ts");
  let contractsExports = {};
  try {
    const contractsCode = readFileSync(contractsFile, "utf8");
    const contractsTransformed = transformSync(contractsCode, {
      loader: "ts",
      format: "cjs",
      target: "node22",
    }).code;
    const contractsMod = { exports: {} };
    vm.runInNewContext(contractsTransformed, {
      module: contractsMod,
      exports: contractsMod.exports,
      require,
      console,
      Math,
      Number,
      JSON,
    });
    contractsExports = contractsMod.exports;
  } catch {
    // Fallback if contracts not available
    contractsExports = {
      ACTION_CREDIT_COSTS: { ai_greeting: 0, ai_chat: 1, ai_stay_dining: 3, ai_deep_trip: 5 },
    };
  }

  const file = path.resolve(__dirname, "../src/application/model-router.ts");
  const code = readFileSync(file, "utf8");
  const transformed = transformSync(code, { loader: "ts", format: "cjs", target: "node22" }).code;
  const mod = { exports: {} };
  vm.runInNewContext(transformed, {
    module: mod,
    exports: mod.exports,
    require(spec) {
      if (spec === "@mapsbridge/contracts") return contractsExports;
      return require(spec);
    },
    console,
    Math,
    Number,
    JSON,
  });
  return mod.exports.ModelRouter;
}

const ModelRouter = loadRouter();

// ─── Tier 1: Simple greetings ────────────────────────────────────

test("greeting resolves to tier1", () => {
  const config = ModelRouter.resolveTier({ prompt: "merhaba" });
  assert.equal(config.tier, "tier1");
});

test("short 'selam' resolves to tier1", () => {
  const config = ModelRouter.resolveTier({ prompt: "selam" });
  assert.equal(config.tier, "tier1");
});

test("very short prompt (≤3 words) with no day/multiCity resolves to tier1", () => {
  const config = ModelRouter.resolveTier({ prompt: "nasılsın?" });
  assert.equal(config.tier, "tier1");
});

// ─── Tier 4: Replanning ───────────────────────────────────────────

test("isReplanning flag resolves to tier4", () => {
  const config = ModelRouter.resolveTier({
    prompt: "İstanbul ve Paris için rota planla lütfen",
    isReplanning: true,
  });
  assert.equal(config.tier, "tier4");
});

test("prompt with 'yeniden planla' resolves to tier4", () => {
  const config = ModelRouter.resolveTier({ prompt: "Rotamı yeniden planla lütfen" });
  assert.equal(config.tier, "tier4");
});

test("prompt with 'tam program' resolves to tier4", () => {
  const config = ModelRouter.resolveTier({ prompt: "ayrıntılı rota ve komple program hazırla" });
  assert.equal(config.tier, "tier4");
});

// ─── Tier 3: Complex plans ─────────────────────────────────────────

test("multiCity resolves to tier3", () => {
  const config = ModelRouter.resolveTier({ prompt: "İstanbul ve Ankara gezisi", multiCity: true });
  assert.equal(config.tier, "tier3");
});

test("dayCount >= 4 resolves to tier3", () => {
  const config = ModelRouter.resolveTier({ prompt: "İstanbul 5 günlük program", dayCount: 5 });
  assert.equal(config.tier, "tier3");
});

test("dayCount exactly 4 resolves to tier3", () => {
  const config = ModelRouter.resolveTier({ prompt: "Ankara 4 gün plan", dayCount: 4 });
  assert.equal(config.tier, "tier3");
});

test("constraintsCount >= 3 resolves to tier3", () => {
  const config = ModelRouter.resolveTier({
    prompt: "İstanbul için seyahat planı yapmak istiyorum",
    constraintsCount: 3,
  });
  assert.equal(config.tier, "tier3");
});

test("vegan + dayCount 2 resolves to tier3", () => {
  const config = ModelRouter.resolveTier({
    prompt: "vegan restoran 2 günlük program",
    dayCount: 2,
  });
  assert.equal(config.tier, "tier3");
});

// ─── Tier 2: Standard (default) ────────────────────────────────────

test("standard travel question resolves to tier2", () => {
  const config = ModelRouter.resolveTier({ prompt: "İstanbul'da güzel restoran önerir misin?" });
  assert.equal(config.tier, "tier2");
});

test("3-day plan resolves to tier2 (not complex enough for tier3)", () => {
  const config = ModelRouter.resolveTier({ prompt: "Ankara 3 günlük plan", dayCount: 3 });
  assert.equal(config.tier, "tier2");
});

test("hotel recommendation resolves to tier2", () => {
  const config = ModelRouter.resolveTier({ prompt: "Antalya'da otel önerir misin" });
  assert.equal(config.tier, "tier2");
});

// ─── describeCost ────────────────────────────────────────────────

test("describeCost returns string for each tier", () => {
  for (const tier of ["tier1", "tier2", "tier3", "tier4"]) {
    const result = ModelRouter.describeCost(tier);
    assert.equal(typeof result, "string");
    assert.ok(result.length > 0);
  }
});

// ─── TIER_CONFIGS completeness ───────────────────────────────────

test("all 4 tiers have required fields", () => {
  for (const [tier, config] of Object.entries(ModelRouter.TIER_CONFIGS)) {
    assert.ok(config.modelId, `${tier} missing modelId`);
    assert.ok(config.modelName, `${tier} missing modelName`);
    assert.ok(config.estimatedLatencyMs > 0, `${tier} latency should be positive`);
    assert.ok(typeof config.creditCost === "number", `${tier} creditCost should be number`);
  }
});

test("tier latencies increase tier1 < tier2 < tier3 < tier4", () => {
  const { tier1, tier2, tier3, tier4 } = ModelRouter.TIER_CONFIGS;
  assert.ok(tier1.estimatedLatencyMs < tier2.estimatedLatencyMs);
  assert.ok(tier2.estimatedLatencyMs < tier3.estimatedLatencyMs);
  assert.ok(tier3.estimatedLatencyMs < tier4.estimatedLatencyMs);
});
