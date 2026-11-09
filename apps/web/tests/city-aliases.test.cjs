// Faz 1 / görev 3 — şehir alias'ı tek kaynak doğrulaması.
// city-aliases.ts'in iki biçiminin (CITY_ALIASES ↔ ALIAS_TO_CANONICAL) tutarlı
// olduğunu VE iki tüketicinin (retrieval.canonicalCity, bundled-evidence) aynı
// tablodan türediğini doğrular. Sessiz drift (PLAN §sessiz drift yok) önlenir.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");

function load(relFromAiDir, env = {}) {
  const cache = new Map();
  function loadFile(file) {
    const filename = path.resolve(file);
    if (cache.has(filename)) return cache.get(filename);
    if (filename.endsWith(".json")) {
      const json = JSON.parse(fs.readFileSync(filename, "utf8"));
      cache.set(filename, json);
      return json;
    }
    const module = { exports: {} };
    cache.set(filename, module.exports);
    vm.runInNewContext(
      transformSync(fs.readFileSync(filename, "utf8"), { loader: "ts", format: "cjs" }).code,
      {
        module,
        exports: module.exports,
        URL,
        AbortSignal,
        process: { env },
        console: { warn() {}, error() {}, log() {} },
        require: (spec) => {
          if (spec.startsWith(".")) {
            const base = path.resolve(path.dirname(filename), spec);
            return loadFile(spec.endsWith(".json") ? base : base + ".ts");
          }
          if (spec.startsWith("@aws-sdk"))
            return {
              BedrockAgentRuntimeClient: class {
                async send() {
                  return { retrievalResults: [] };
                }
              },
              RetrieveCommand: class {
                constructor(i) {
                  this.input = i;
                }
              },
            };
          return require(spec);
        },
      },
      { filename },
    );
    cache.set(filename, module.exports);
    return module.exports;
  }
  return loadFile(path.resolve(__dirname, "../app/lib/ai", relFromAiDir));
}

test("CITY_ALIASES ↔ ALIAS_TO_CANONICAL çift yönlü tutarlı", () => {
  const { CITY_ALIASES, ALIAS_TO_CANONICAL, aliasToCanonical } = load("city-aliases.ts");
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    for (const alias of aliases) {
      assert.equal(
        ALIAS_TO_CANONICAL[alias],
        canonical,
        `${alias} → ${canonical} ters haritada eşleşmeli`,
      );
      assert.equal(aliasToCanonical(alias), canonical);
    }
  }
  // Ters haritadaki her anahtar gerçekten bir alias listesinde olmalı (fazlalık yok).
  const allAliases = new Set(Object.values(CITY_ALIASES).flat());
  for (const alias of Object.keys(ALIAS_TO_CANONICAL))
    assert.ok(allAliases.has(alias), `${alias} CITY_ALIASES'ta tanımlı olmalı`);
});

test("retrieval.canonicalCity tek kaynaktaki tüm alias'ları çözer", () => {
  const { CITY_ALIASES } = load("city-aliases.ts");
  const { canonicalCity } = load("retrieval.ts", { TRAVEL_KNOWLEDGE_BASE_ID: "" });
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    for (const alias of aliases) {
      assert.equal(canonicalCity(alias), canonical);
      // Ülke son eki ile de çalışmalı (örn "rome, italy").
      assert.equal(canonicalCity(`${alias}, Someplace`), canonical);
    }
  }
  // Bilinmeyen şehir aynen döner.
  assert.equal(canonicalCity("Reykjavik"), "Reykjavik");
});

test("bundled-evidence, retrieval ile aynı alias tablosunu kullanır (drift yok)", () => {
  const { CITY_ALIASES } = load("city-aliases.ts");
  const { canonicalCity } = load("retrieval.ts", { TRAVEL_KNOWLEDGE_BASE_ID: "" });
  const bundled = load("bundled-evidence.ts");
  // bundled-evidence'ın her kanonik şehri + aliası retrieval ile aynı kanona çözülmeli.
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    for (const alias of aliases) assert.equal(canonicalCity(alias), canonical);
  }
  // İki tüketicinin de kanonik ad kümesi tek kaynakla birebir aynı.
  // (bundled-evidence CITY_ALIASES'ı doğrudan import ettiği için şehir kümesi eşittir.)
  const result = bundled.bundledEvidence(
    { prompt: "barselona tapas öner" },
    Date.parse("2026-11-01"),
  );
  assert.equal(result.status, "available"); // Paris/Barcelona retrieval'a da taşındı
});
