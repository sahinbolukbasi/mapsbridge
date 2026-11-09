// Faz 3 / görev 12 — sub-agent degradasyon + raporlama (I2 sınırı korunur).
// Gerçek dispatchSubAgents akışını sahte runner'larla çalıştırır:
//   - başarılı agent → status "completed" + data,
//   - hata atan agent → status "failed" (yanıt o alan olmadan tamamlanır),
//   - zaman aşan agent → status "timeout",
//   - enabledAgents'ta olmayan agent hiç tetiklenmez,
//   - tek bir agent'ın hatası diğerlerini DÜŞÜRMEZ (graceful degradation).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");

// Her sub-agent modülünü, davranışı testçe kontrol edilen sahte runner'la değiştirir.
function load(behaviors = {}) {
  const calls = [];
  const cache = new Map();
  // agent dosya adı → export edilen runner adı eşlemesi.
  const runnerExport = {
    "food-agent": "runFoodAgent",
    "car-rental-agent": "runCarRentalAgent",
    "city-transit-agent": "runCityTransitAgent",
    "city-intel-agent": "runCityIntelAgent",
    "hotel-deal-agent": "runHotelDealAgent",
    "flight-agent": "runFlightAgent",
  };
  function makeRunner(id) {
    return (...args) => {
      calls.push(id);
      const behavior = behaviors[id] || "ok";
      if (behavior === "throw") return Promise.reject(new Error("agent patladı"));
      if (behavior === "timeout")
        return new Promise((_r) => setTimeout(() => {}, 60000)); // asla çözülmez → timeout
      return Promise.resolve({ output: { id, note: "ok" }, durationMs: 5 });
    };
  }
  function loadFile(file) {
    const filename = path.resolve(file);
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} };
    cache.set(filename, module.exports);
    vm.runInNewContext(
      transformSync(fs.readFileSync(filename, "utf8"), { loader: "ts", format: "cjs" }).code,
      {
        module,
        exports: module.exports,
        setTimeout,
        clearTimeout,
        Date,
        Promise,
        Error,
        require: (spec) => {
          const base = spec.split("/").pop();
          if (runnerExport[base]) return { [runnerExport[base]]: makeRunner(base.replace("-agent", "")) };
          if (spec.startsWith("."))
            return loadFile(path.resolve(path.dirname(filename), spec + ".ts"));
          return require(spec);
        },
      },
      { filename },
    );
    cache.set(filename, module.exports);
    return module.exports;
  }
  const mod = loadFile(path.resolve(__dirname, "../app/lib/ai/sub-agents/dispatcher.ts"));
  return { ...mod, calls };
}

const PROFILE = { dates: {}, travelers: { adults: 2 } };
function opts(over = {}) {
  return {
    request: "araç kiralama ve uçuş ve otel öner",
    destination: "istanbul",
    profile: PROFILE,
    mode: "chat",
    enabledAgents: new Set(["food", "car-rental", "city-transit", "city-intel", "hotel-deal", "flight"]),
    timeoutMs: 8000,
    startedAt: Date.now(),
    ...over,
  };
}

test("başarılı agent'lar status 'completed' + data döner", async () => {
  const h = load();
  const results = await h.dispatchSubAgents(
    opts({ request: "uçuş öner", enabledAgents: new Set(["flight"]) }),
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].agentId, "flight");
  assert.equal(results[0].status, "completed");
  assert.ok(results[0].data);
});

test("hata atan agent status 'failed' olur, akış çökmez", async () => {
  const h = load({ flight: "throw" });
  const results = await h.dispatchSubAgents(
    opts({ request: "uçuş öner", enabledAgents: new Set(["flight"]) }),
  );
  assert.equal(results[0].status, "failed");
  assert.ok(results[0].summaryNote.includes("hata") || results[0].summaryNote.includes("patladı"));
});

test("bir agent'ın hatası diğerlerini düşürmez (graceful degradation)", async () => {
  const h = load({ flight: "throw" });
  const results = await h.dispatchSubAgents(
    opts({ request: "uçuş ve otel öner", enabledAgents: new Set(["flight", "hotel-deal"]) }),
  );
  const byId = Object.fromEntries(results.map((r) => [r.agentId, r.status]));
  assert.equal(byId["flight"], "failed");
  assert.equal(byId["hotel-deal"], "completed");
});

test("enabledAgents'ta olmayan agent hiç tetiklenmez", async () => {
  const h = load();
  await h.dispatchSubAgents(
    opts({ request: "uçuş ve otel öner", enabledAgents: new Set(["flight"]) }),
  );
  // Yalnızca flight çağrılmalı; hotel-deal enable değil.
  assert.ok(h.calls.includes("flight"));
  assert.equal(h.calls.includes("hotel-deal"), false);
});

test("hiç ilgili agent yoksa boş sonuç döner", async () => {
  const h = load();
  const results = await h.dispatchSubAgents(
    opts({ request: "sadece selam", enabledAgents: new Set(["flight"]) }),
  );
  assert.equal(results.length, 0);
});

test("zaman bütçesi <500ms ise agent'lar 'skipped' olur", async () => {
  const h = load();
  const results = await h.dispatchSubAgents(
    opts({
      request: "uçuş öner",
      enabledAgents: new Set(["flight"]),
      timeoutMs: 100,
      startedAt: Date.now() - 50, // kalan ~50ms < 500
    }),
  );
  assert.equal(results[0].status, "skipped");
  assert.ok(results[0].summaryNote.includes("Zaman"));
});
