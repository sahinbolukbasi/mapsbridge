// Faz 7 / görev 28 — değerlendirme kapısı mantığı (regresyonda bloke).
// validate-golden-eval.cjs çevrimdışı kapıdır: (1) manifest yapısını doğrular,
// (2) bir rapor verildiğinde metrikleri baseline ile karşılaştırıp regresyonda
// exit 1 (CI bloke) verir. Bu test kapının karar mantığını dondurur — gerçek
// Bedrock gerektirmez.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  compareBaseline,
  normalizeReport,
  validateManifest,
} = require(path.resolve(__dirname, "../../scripts/validate-golden-eval.cjs"));

// ── Manifest doğrulama ────────────────────────────────────────────────────────

test("geçerli manifest (100 vaka, doğru kategoriler) hatasız", () => {
  const fs = require("node:fs");
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../../apps/web/evals/golden-travel-cases.json"), "utf8"),
  );
  const r = validateManifest(manifest);
  assert.deepEqual(r.errors, []);
  assert.equal(r.total, 100);
  assert.equal(r.counts["clarify"], 15);
  assert.equal(r.counts["prompt-injection"], 10);
});

test("eksik vaka / yanlış kategori sayısı hata üretir", () => {
  const bad = {
    version: "x",
    requiredCategories: { chat: 2 },
    cases: [{ id: "a", category: "chat", prompt: "p", expect: { mode: "chat" } }],
  };
  const r = validateManifest(bad);
  assert.ok(r.errors.length > 0);
  assert.ok(r.errors.some((e) => /expected 100 cases/.test(e)));
});

test("tekrar eden id ve eksik beklenti yakalanır", () => {
  const bad = {
    version: "x",
    requiredCategories: {},
    cases: [
      { id: "dup", category: "chat", prompt: "p", expect: { mode: "chat" } },
      { id: "dup", category: "chat", prompt: "p" }, // expect yok + dup id
    ],
  };
  const r = validateManifest(bad);
  assert.ok(r.errors.some((e) => /duplicate id/.test(e)));
  assert.ok(r.errors.some((e) => /missing expectation/.test(e)));
});

// ── Baseline karşılaştırma (regresyon → bloke) ───────────────────────────────

const baseline = {
  passRate: 0.95,
  p95LatencyMs: 2000,
  averageSourceCoverage: 0.8,
  routeValidityRate: 1.0,
  safeDecisionSummaryRate: 1.0,
};

test("metrikler baseline'ı tutarsa passed", () => {
  const c = compareBaseline({ ...baseline }, baseline);
  assert.equal(c.status, "passed");
  assert.deepEqual(c.failures, []);
});

test("passRate düşerse failed (regresyonda bloke)", () => {
  const c = compareBaseline({ ...baseline, passRate: 0.9 }, baseline);
  assert.equal(c.status, "failed");
  assert.ok(c.failures.some((f) => /passRate regressed/.test(f)));
});

test("source coverage 0.05+ düşerse failed (grounding regresyonu)", () => {
  const c = compareBaseline({ ...baseline, averageSourceCoverage: 0.7 }, baseline);
  assert.equal(c.status, "failed");
  assert.ok(c.failures.some((f) => /source coverage regressed/.test(f)));
});

test("route validity düşerse failed; decision-summary güvenliği düşerse failed", () => {
  assert.equal(compareBaseline({ ...baseline, routeValidityRate: 0.9 }, baseline).status, "failed");
  assert.equal(
    compareBaseline({ ...baseline, safeDecisionSummaryRate: 0.9 }, baseline).status,
    "failed",
  );
});

test("p95 latency %20'den fazla artarsa failed (I7 bütçe koruması)", () => {
  const c = compareBaseline({ ...baseline, p95LatencyMs: 2500 }, baseline);
  assert.equal(c.status, "failed");
  assert.ok(c.failures.some((f) => /p95 latency regressed/.test(f)));
});

test("baseline yoksa karşılaştırma not_available (ilk çalıştırma bloke etmez)", () => {
  assert.equal(compareBaseline({ ...baseline }, null).status, "not_available");
});

// ── normalizeReport: grounding/netleştirme/fiyat metriklerini türetir ─────────

test("normalizeReport pass oranı + grounding + rota geçerliliğini türetir", () => {
  const report = {
    turns: [
      { category: "chat", failures: [], elapsedMs: 500, result: { responseMode: "chat", sourceCoverage: { ratio: 0.9 } } },
      { category: "route", failures: [], elapsedMs: 1500, result: { responseMode: "route", route: { stops: [{}] } } },
      { category: "clarify", failures: ["mode"], elapsedMs: 300, result: { responseMode: "clarify" } },
    ],
  };
  const m = normalizeReport(report);
  assert.equal(m.total, 3);
  assert.equal(m.passed, 2);
  assert.equal(m.routeValidityRate, 1); // tek route vakası geçerli
  assert.ok(m.averageSourceCoverage > 0);
  assert.ok(m.categoryMetrics.chat.passRate === 1);
});
