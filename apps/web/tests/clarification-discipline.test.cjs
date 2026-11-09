// Faz 5 / görev 18 — netleştirme disiplini (I3/I4) kaynak seviyesi.
// I3: generateConciergeQuestion + getNextQuestion TEK soru + 2-4 dokunulabilir seçenek.
// I4: getNextQuestion zaten yanıtlanmış (answeredSlots) veya state'te DOLU slotu
//     tekrar sormaz — "fetch/çıkar, sorma" disiplini.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");

function load(rel) {
  const cache = new Map();
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
        Date,
        console: { warn() {}, log() {} },
        require: (spec) =>
          spec.startsWith(".")
            ? loadFile(path.resolve(path.dirname(filename), spec + ".ts"))
            : require(spec),
      },
      { filename },
    );
    cache.set(filename, module.exports);
    return module.exports;
  }
  return loadFile(path.resolve(__dirname, "../app/lib/ai", rel));
}

const planning = load("planning.ts");
const tripState = load("trip-state.ts");

// ── I3: generateConciergeQuestion — tek soru + 2-4 seçenek ────────────────────

test("I3: hedef yokken tek soru + 2-4 seçenek", () => {
  const r = planning.generateConciergeQuestion({ interests: {} });
  assert.equal(typeof r.question, "string");
  assert.ok(r.question.length > 0);
  assert.ok(r.quickOptions.length >= 2 && r.quickOptions.length <= 4, "2-4 seçenek olmalı");
  for (const o of r.quickOptions) {
    assert.ok(o.label && o.prompt, "her seçenek dokunulabilir (label+prompt)");
  }
});

test("I3: gün yokken (hedef var) tek soru + 2-4 seçenek", () => {
  const r = planning.generateConciergeQuestion({ destination: "Roma", interests: {} });
  assert.ok(r.question.includes("Roma"));
  assert.ok(r.quickOptions.length >= 2 && r.quickOptions.length <= 4);
});

test("I3: ilgi yokken (hedef+gün var) tek soru + 2-4 seçenek", () => {
  const r = planning.generateConciergeQuestion({
    destination: "Roma",
    duration_days: 3,
    interests: {},
  });
  assert.ok(r.quickOptions.length >= 2 && r.quickOptions.length <= 4);
});

test("generateConciergeQuestion her zaman TEK soru döner (dizi değil)", () => {
  // Dönen yapı tek question alanı taşır; birden çok soru üretmez (I3 tur başı ≤2).
  const r = planning.generateConciergeQuestion({ interests: {} });
  assert.equal(typeof r.question === "string", true);
  assert.equal(Array.isArray(r.question), false);
});

// ── I4: getNextQuestion — yanıtlanmış/dolu slot tekrar sorulmaz ────────────────

function emptyState() {
  return tripState.tripProfileToState({ interests: {} });
}

test("I4: boş state'te ilk eksik slot sorulur, ≤4 seçenek", () => {
  const q = tripState.getNextQuestion(emptyState(), []);
  assert.ok(q, "bir soru dönmeli");
  assert.ok(q.quickOptions.length >= 2 && q.quickOptions.length <= 4);
  assert.equal(typeof q.slotKey, "string");
});

test("I4: answeredSlots'ta olan slot TEKRAR sorulmaz", () => {
  const state = emptyState();
  const first = tripState.getNextQuestion(state, []);
  // İlk slotu yanıtlanmış işaretle → bir sonraki (farklı) slot sorulmalı.
  const next = tripState.getNextQuestion(state, [
    { key: first.slotKey, value: "x", answeredAt: "2026-11-01", source: "stated" },
  ]);
  if (next) assert.notEqual(next.slotKey, first.slotKey, "aynı slot iki kez sorulmamalı");
});

test("I4: state'te DOLU olan slot sorulmaz (fetch/çıkar, sorma)", () => {
  // destination dolu bir state → destination slotu sorulmamalı.
  const state = tripState.tripProfileToState({ destination: "Roma", interests: {} });
  const q = tripState.getNextQuestion(state, []);
  if (q) assert.notEqual(q.slotKey, "destination");
});

test("I4: tüm slotlar yanıtlanmış/dolu → null (soru sormayı bırak)", () => {
  const state = emptyState();
  // SLOT_PRIORITY'deki her olası slotu yanıtlanmış işaretle.
  const allAnswered = [
    "destination",
    "dates",
    "durationDays",
    "travelers",
    "budget",
    "pace",
    "interests",
  ].map((key) => ({ key, value: "x", answeredAt: "2026-11-01", source: "stated" }));
  const q = tripState.getNextQuestion(state, allAnswered);
  assert.equal(q, null);
});
