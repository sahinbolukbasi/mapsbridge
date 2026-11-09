// Faz 7 / görev 27 — model yönlendirme sınırı (kritik yolda büyük model yok).
// Master Spec stage mimarisi: intent/anlatım küçük/hızlı model (Nova/Haiku);
// büyük model (Claude Sonnet) YALNIZCA ağır/çevrimdışı yol (tier4: replanning/
// tam optimizasyon). Bu test tier→model-sınıfı bağını dondurur: tier1-3 kritik
// yol asla Sonnet değil; Sonnet yalnız tier4.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

function loadRouter() {
  // model-router yalnız ACTION_CREDIT_COSTS'u contracts'tan çeker; tüm contracts
  // ağacını (relative domain importları) yüklemek yerine gereken sabiti stub'la.
  const contractsStub = {
    ACTION_CREDIT_COSTS: {
      ai_greeting: 0,
      ai_chat: 1,
      ai_stay_dining: 2,
      ai_deep_trip: 5,
      route_optimize: 1,
    },
  };
  const file = path.resolve(__dirname, "../src/application/model-router.ts");
  const mod = { exports: {} };
  vm.runInNewContext(
    transformSync(readFileSync(file, "utf8"), { loader: "ts", format: "cjs" }).code,
    {
      module: mod,
      exports: mod.exports,
      require: (s) => (s === "@mapsbridge/contracts" ? contractsStub : require(s)),
      console,
      Math,
      Number,
      JSON,
    },
  );
  return mod.exports.ModelRouter;
}

const ModelRouter = loadRouter();
const T = ModelRouter.TIER_CONFIGS;
const isSonnet = (id) => /sonnet/i.test(id);
const isSmallFast = (id) => /nova|haiku/i.test(id);

test("kritik yol tier'ları (1-3) küçük/hızlı model kullanır (Nova/Haiku), Sonnet DEĞİL", () => {
  for (const tier of ["tier1", "tier2", "tier3"]) {
    assert.equal(isSonnet(T[tier].modelId), false, `${tier} Sonnet olmamalı`);
    assert.equal(isSmallFast(T[tier].modelId), true, `${tier} Nova/Haiku olmalı`);
  }
});

test("büyük model (Sonnet) YALNIZCA tier4 (ağır/çevrimdışı yol)", () => {
  assert.equal(isSonnet(T.tier4.modelId), true, "tier4 Sonnet olmalı");
  // Sonnet taşıyan başka tier yok.
  const sonnetTiers = Object.keys(T).filter((k) => isSonnet(T[k].modelId));
  assert.deepEqual(sonnetTiers, ["tier4"]);
});

test("selamlama/kısa niyet → tier1 (en küçük model, kritik yol)", () => {
  assert.equal(isSmallFast(ModelRouter.resolveTier({ prompt: "merhaba" }).modelId), true);
});

test("standart sohbet (varsayılan) → tier2, Sonnet değil", () => {
  const cfg = ModelRouter.resolveTier({ prompt: "Roma'da iyi bir restoran öner" });
  assert.equal(cfg.tier, "tier2");
  assert.equal(isSonnet(cfg.modelId), false);
});

test("4+ günlük/çok şehirli plan → tier3 (Haiku), hâlâ Sonnet değil", () => {
  const cfg = ModelRouter.resolveTier({ prompt: "rota", dayCount: 5 });
  assert.equal(cfg.tier, "tier3");
  assert.equal(isSonnet(cfg.modelId), false);
});

test("yeniden planlama/tam optimizasyon → tier4 (Sonnet, ağır yol)", () => {
  // >3 kelime (kısa-sorgu tier1 kapısını geçsin) + isReplanning.
  const cfg = ModelRouter.resolveTier({
    prompt: "rotamı baştan yeniden planla lütfen",
    isReplanning: true,
  });
  assert.equal(cfg.tier, "tier4");
  assert.equal(isSonnet(cfg.modelId), true);
});

test("tier latency sıralaması küçükten büyüğe (kritik yol hızlı)", () => {
  assert.ok(T.tier1.estimatedLatencyMs < T.tier2.estimatedLatencyMs);
  assert.ok(T.tier2.estimatedLatencyMs < T.tier3.estimatedLatencyMs);
  assert.ok(T.tier3.estimatedLatencyMs < T.tier4.estimatedLatencyMs);
});

// ── Canlı kritik yol: bedrock-client model seçimi operator-config (env) ────────
test("drift guard: canlı bedrock-client modeli operator-config (BEDROCK_MODEL_ID) + chooseModel allowlist", () => {
  const src = readFileSync(
    path.resolve(__dirname, "../../../apps/web/app/lib/ai/bedrock-client.ts"),
    "utf8",
  );
  // Varsayılan model env'den gelir; hard-code büyük model yok.
  assert.ok(src.includes("process.env.BEDROCK_MODEL_ID"));
  // chooseModel AI-control allowlist'ini uygular (disabledModels).
  assert.ok(src.includes("chooseModel(await readAIControl()"));
  // Kaynakta hard-coded Sonnet model-id yok (kritik yol çağrısı).
  assert.equal(/"[^"]*sonnet[^"]*"/i.test(src), false, "bedrock-client Sonnet hard-code etmemeli");
});
