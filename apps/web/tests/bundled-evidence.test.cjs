// Characterization tests for app/lib/ai/bundled-evidence.ts — Faz 0 / görev 1.
// Freezes TODAY's behavior of bundledEvidence() + mergeEvidence() against the
// real reviewed corpus (data/travel/pilot.json + reviewed.json). These tests do
// NOT change behavior; they lock it so later RAG grounding changes (Faz 1) are
// provably non-regressive. House style: esbuild transformSync + vm sandbox.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");

function load() {
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
        console: { warn() {}, error() {}, log() {} },
        require: (spec) => {
          if (spec.startsWith(".")) {
            const base = path.resolve(path.dirname(filename), spec);
            return loadFile(spec.endsWith(".json") ? base : base + ".ts");
          }
          return require(spec);
        },
      },
      { filename },
    );
    cache.set(filename, module.exports);
    return module.exports;
  }
  return loadFile(path.resolve(__dirname, "../app/lib/ai/bundled-evidence.ts"));
}

// Fixtures expire 2026-12-16 (pilot) / 2026-12-18 / 2027-01-24 (reviewed).
// Pin "now" inside every window so the corpus is live and deterministic.
const NOW = Date.parse("2026-11-01");

test("gıda/rota anahtar kelimesi + tanınan şehir → kaynaklı kanıt döner", () => {
  const { bundledEvidence } = load();
  const result = bundledEvidence({ prompt: "Roma'da ne yesem, yemek öner" }, NOW);
  assert.equal(result.status, "available");
  assert.ok(result.passages.length >= 1);
  for (const p of result.passages) {
    assert.match(p.id, /^L\d+$/); // yerel kaynak etiketi
    assert.ok(p.url.startsWith("https://"));
    assert.ok(p.text.length <= 1800);
    assert.equal(typeof p.checkedAt, "string");
  }
});

test("anahtar kelime yoksa korpus taranmaz (status empty)", () => {
  const { bundledEvidence } = load();
  // "Roma" geçse de yemek/ulaşım/rota sinyali yok → erken empty.
  const result = bundledEvidence({ prompt: "Roma hakkında genel bir şey anlat" }, NOW);
  assert.equal(result.status, "empty");
  assert.equal(result.passages.length, 0);
});

test("tanınmayan şehir → empty", () => {
  const { bundledEvidence } = load();
  const result = bundledEvidence({ prompt: "Reykjavik'te yemek öner" }, NOW);
  assert.equal(result.status, "empty");
  assert.equal(result.passages.length, 0);
});

test("şehir alias'ı eşleşir (tokio→Tokyo, barselona→Barcelona)", () => {
  const { bundledEvidence } = load();
  assert.equal(bundledEvidence({ prompt: "tokio ramen nerede yenir" }, NOW).status, "available");
  assert.equal(bundledEvidence({ prompt: "barselona tapas öner" }, NOW).status, "available");
});

test("prompt şehir içermezse researchDestination'dan şehir bulunur", () => {
  const { bundledEvidence } = load();
  const result = bundledEvidence(
    { prompt: "yerel lezzet öner", researchDestination: "Istanbul, Türkiye" },
    NOW,
  );
  assert.equal(result.status, "available");
  assert.ok(result.passages.length >= 1);
});

test("bayat korpus (valid_until geçmiş) → empty", () => {
  const { bundledEvidence } = load();
  // 2027-02 tüm fixture pencerelerinin dışında.
  const future = Date.parse("2027-02-01");
  const result = bundledEvidence({ prompt: "Roma yemek öner" }, future);
  assert.equal(result.status, "empty");
});

test("mergeEvidence: URL'e göre dedupe eder ve 6 pasajda sınırlar", () => {
  const { mergeEvidence } = load();
  const src = (id, url) => ({ id, title: id, url, checkedAt: "2026-11-01", text: "x" });
  const remote = {
    status: "available",
    passages: [src("S1", "https://a"), src("S2", "https://b")],
  };
  const local = {
    status: "available",
    passages: [
      src("L1", "https://b"), // remote ile çakışır → düşer
      src("L2", "https://c"),
      src("L3", "https://d"),
      src("L4", "https://e"),
      src("L5", "https://f"),
      src("L6", "https://g"), // 6 sınırını aşar → düşer
    ],
  };
  const merged = mergeEvidence(remote, local);
  const urls = merged.passages.map((p) => p.url);
  assert.equal(merged.passages.length, 6);
  assert.equal(new Set(urls).size, 6, "URL tekilleştirilmeli");
  assert.equal(urls.includes("https://g"), false, "6 sınırı aşan düşmeli");
});

test("mergeEvidence: remote boş + local doluysa status local'den gelir", () => {
  const { mergeEvidence } = load();
  const local = {
    status: "available",
    passages: [{ id: "L1", title: "t", url: "https://z", checkedAt: "2026-11-01", text: "x" }],
  };
  const merged = mergeEvidence({ status: "empty", passages: [] }, local);
  assert.equal(merged.status, "available");
  assert.equal(merged.passages.length, 1);
});

test("mergeEvidence: ikisi de boşsa remote status korunur", () => {
  const { mergeEvidence } = load();
  assert.equal(
    mergeEvidence({ status: "disabled", passages: [] }, { status: "empty", passages: [] }).status,
    "disabled",
  );
  assert.equal(
    mergeEvidence({ status: "unavailable", passages: [] }, { status: "empty", passages: [] })
      .status,
    "unavailable",
  );
});

test("mergeEvidence: counts {remote, local, merged} doldurur (görev 4)", () => {
  const { mergeEvidence } = load();
  const src = (id, url) => ({ id, title: id, url, checkedAt: "2026-11-01", text: "x" });
  const remote = {
    status: "available",
    passages: [src("S1", "https://a"), src("S2", "https://b")],
  };
  const local = {
    status: "available",
    passages: [src("L1", "https://b"), src("L2", "https://c"), src("L3", "https://d")],
  };
  const merged = mergeEvidence(remote, local);
  // remote=2, local=3; L1 (https://b) remote ile çakışır → merged=4.
  // Alan alan karşılaştır (vm sandbox'ta cross-realm prototype farkı deepEqual'ı bozar).
  assert.equal(merged.counts.remote, 2);
  assert.equal(merged.counts.local, 3);
  assert.equal(merged.counts.merged, 4);
  assert.equal(merged.counts.merged, merged.passages.length);
});

test("mergeEvidence: boş setlerde counts sıfırdır", () => {
  const { mergeEvidence } = load();
  const merged = mergeEvidence(
    { status: "disabled", passages: [] },
    { status: "empty", passages: [] },
  );
  assert.equal(merged.counts.remote, 0);
  assert.equal(merged.counts.local, 0);
  assert.equal(merged.counts.merged, 0);
});
