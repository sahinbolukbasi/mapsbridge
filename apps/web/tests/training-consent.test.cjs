// Faz 4 / görev 14 — korpus büyütme: consent + karantina akışı (varsayılan opt-out).
// createTrainingJob'un GERÇEK davranışını dondurur:
//   - AI_TRAINING_COLLECTION_ENABLED!=="true" veya consent!==true → iş OLUŞMAZ,
//   - guardrail yanıtı / boş prompt / boş summary → iş oluşmaz,
//   - oluşan iş: reviewed:false, consent.scope="current_turn", privacyReview (gerçek: "required"),
//   - PII maskelenir (kimlik/e-posta korpusa girmez — I5/gizlilik).
// NOT (spec drift): design.md "pending" varsaymıştı; CANLI KOD "required" yazıyor.
// Test gerçeği (required) dondurur; spec bu turda düzeltilecek (sessiz drift yok).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");

function load(env = { AI_TRAINING_COLLECTION_ENABLED: "true" }) {
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
        process: { env },
        require: (spec) =>
          spec.startsWith(".") || spec.startsWith("../")
            ? loadFile(path.resolve(path.dirname(filename), spec + ".ts"))
            : require(spec),
      },
      { filename },
    );
    cache.set(filename, module.exports);
    return module.exports;
  }
  return loadFile(path.resolve(__dirname, "../server/ai/training-outbox.ts"));
}

function baseInput(over = {}) {
  return {
    consent: true,
    userId: "user-abc",
    requestId: "req-123",
    conversationId: "conv-1",
    prompt: "Roma'da 3 gün, gizli köşeler. iletişim: gizli@example.com",
    result: {
      modelUsed: "haiku",
      orchestratorSummary: "Trastevere ve Testaccio'yu keşfet.",
      responseMode: "chat",
      promptVersion: "v1",
      retrievalStatus: "available",
    },
    ...over,
  };
}

test("consent=false → hiçbir iş oluşmaz (varsayılan opt-out)", () => {
  const { createTrainingJob } = load();
  assert.equal(createTrainingJob(baseInput({ consent: false })), undefined);
});

test("collection flag kapalıysa → iş oluşmaz", () => {
  const { createTrainingJob } = load({ AI_TRAINING_COLLECTION_ENABLED: "false" });
  assert.equal(createTrainingJob(baseInput()), undefined);
});

test("guardrail yanıtı → iş oluşmaz", () => {
  const { createTrainingJob } = load();
  const job = createTrainingJob(
    baseInput({ result: { ...baseInput().result, modelUsed: "guardrail" } }),
  );
  assert.equal(job, undefined);
});

test("boş prompt / boş summary → iş oluşmaz", () => {
  const { createTrainingJob } = load();
  assert.equal(createTrainingJob(baseInput({ prompt: "   " })), undefined);
  assert.equal(
    createTrainingJob(baseInput({ result: { ...baseInput().result, orchestratorSummary: "" } })),
    undefined,
  );
});

test("geçerli + consent=true → iş oluşur: reviewed:false, scope=current_turn, privacyReview=required", () => {
  const { createTrainingJob } = load();
  const job = createTrainingJob(baseInput());
  assert.ok(job);
  assert.equal(job.record.reviewed, false);
  assert.equal(job.record.consent.scope, "current_turn");
  // GERÇEK değer "required" (karantina öncesi insan onayı bekler) — design "pending" demişti.
  assert.equal(job.record.privacyReview, "required");
  assert.equal(job.PK, "AI#TRAINING_PENDING");
  assert.match(job.id, /^[a-f0-9]{64}$/);
});

test("PII maskelenir — e-posta/kimlik korpusa girmez (I5/gizlilik)", () => {
  const { createTrainingJob } = load();
  const job = createTrainingJob(baseInput());
  const blob = JSON.stringify(job.record.messages);
  assert.equal(blob.includes("gizli@example.com"), false, "e-posta maskelenmeli");
});

test("consent metadata sürümlü + grantedAt damgalı", () => {
  const { createTrainingJob, TRAINING_CONSENT_VERSION } = load();
  const job = createTrainingJob(baseInput());
  assert.equal(job.record.consent.version, TRAINING_CONSENT_VERSION);
  assert.ok(Date.parse(job.record.consent.grantedAt) > 0);
});

test("aynı conversationId işleri aynı groupId'de toplanır; farklı requestId farklı id", () => {
  const { createTrainingJob } = load();
  const a = createTrainingJob(baseInput());
  const b = createTrainingJob(baseInput({ requestId: "req-456" }));
  assert.equal(a.record.groupId, b.record.groupId);
  assert.notEqual(a.id, b.id);
});
