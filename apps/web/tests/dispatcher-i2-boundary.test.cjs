// Faz 3 / görev 13 — deterministik sınır tip güvencesi (I2).
// Sub-agent çıktısı rota geometrisi/zamanlaması YAZAMAZ. assertNoRouteGeometry
// bu alanları söker; dispatchSubAgents uçtan uca sızan geometriyi temizler.
// (Tip-seviyesi SubAgentDATA güvencesi derleme zamanında typecheck ile kanıtlanır;
//  bu dosya çalışma zamanı savunmasını dondurur.)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");

function load(behaviors = {}) {
  const cache = new Map();
  const runnerExport = {
    "food-agent": "runFoodAgent",
    "car-rental-agent": "runCarRentalAgent",
    "city-transit-agent": "runCityTransitAgent",
    "city-intel-agent": "runCityIntelAgent",
    "hotel-deal-agent": "runHotelDealAgent",
    "flight-agent": "runFlightAgent",
  };
  function makeRunner(id) {
    return () =>
      Promise.resolve({ output: behaviors[id] ?? { id, note: "ok" }, durationMs: 5 });
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
        console: { warn() {}, log() {} },
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
  return loadFile(path.resolve(__dirname, "../app/lib/ai/sub-agents/dispatcher.ts"));
}

test("ROUTE_GEOMETRY_KEYS beklenen deterministik alanları içerir", () => {
  const d = load();
  for (const k of ["stops", "estimatedDays", "droppedStops", "day", "timeSlot", "cluster"])
    assert.ok(d.ROUTE_GEOMETRY_KEYS.includes(k), `${k} yasak listede olmalı`);
});

test("assertNoRouteGeometry rota-geometri alanlarını söker, diğerlerini korur", () => {
  const d = load();
  const cleaned = d.assertNoRouteGeometry({
    recommendations: [{ name: "Kafe" }],
    stops: [{ id: "x" }], // sızıntı — silinmeli
    estimatedDays: 3, // sızıntı
    culinaryTips: ["ipucu"],
  });
  assert.equal("stops" in cleaned, false);
  assert.equal("estimatedDays" in cleaned, false);
  assert.ok(Array.isArray(cleaned.recommendations));
  assert.ok(Array.isArray(cleaned.culinaryTips));
});

test("assertNoRouteGeometry geometri yoksa veriyi aynen döndürür", () => {
  const d = load();
  const input = { destination: "İstanbul", recommendations: [] };
  const out = d.assertNoRouteGeometry(input);
  assert.equal(out.destination, "İstanbul");
});

test("assertNoRouteGeometry obje olmayan girdiyi dokunmadan döndürür", () => {
  const d = load();
  assert.equal(d.assertNoRouteGeometry(null), null);
  assert.equal(d.assertNoRouteGeometry("metin"), "metin");
  const arr = [1, 2];
  assert.equal(d.assertNoRouteGeometry(arr), arr);
});

test("dispatchSubAgents: sızan rota geometrisi sonuç data'sından temizlenir (uçtan uca)", async () => {
  // flight agent yanlışlıkla stops+day döndürüyor → dispatcher sökmeli.
  const d = load({
    flight: { airports: ["IST"], stops: [{ id: "leak" }], day: 2, estimatedMinutes: 90 },
  });
  const results = await d.dispatchSubAgents({
    request: "uçuş öner",
    destination: "istanbul",
    profile: { dates: {}, travelers: { adults: 1 } },
    mode: "chat",
    enabledAgents: new Set(["flight"]),
    timeoutMs: 8000,
    startedAt: Date.now(),
  });
  assert.equal(results[0].status, "completed");
  assert.equal("stops" in results[0].data, false, "stops sızıntısı sökülmeli");
  assert.equal("day" in results[0].data, false);
  assert.equal("estimatedMinutes" in results[0].data, false);
  assert.ok(Array.isArray(results[0].data.airports), "alan dışı veri korunmalı");
});
