// Faz 2 / görev 10 — araştırma kuyruğu planlayıcı (I7 önceden hesaplama).
// planResearchJobs: eksik entityRef'leri yüksek öncelikli işe alır, tekrar
// (pending/running + aynı çağrı) engellenir, mutasyon yok. entityRef biçimi tutarlı.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");

function load() {
  const module = { exports: {} };
  const file = path.resolve(__dirname, "../app/lib/ai/knowledge-base/research-queue.ts");
  vm.runInNewContext(
    transformSync(fs.readFileSync(file, "utf8"), { loader: "ts", format: "cjs" }).code,
    {
      module,
      exports: module.exports,
      crypto: require("node:crypto"),
      require: (spec) => require(spec),
    },
    { filename: file },
  );
  return module.exports;
}

test("entityRef 'city:kind:slug' biçimini normalize eder", () => {
  const { entityRef } = load();
  // "İ".toLowerCase() → "i" + U+0307 (combining dot); regex U+0307'yi eler → "istanbul".
  assert.equal(entityRef("İstanbul", "place", "Kapalı Çarşı"), "istanbul:place:kapalı-çarşı");
  assert.equal(entityRef("Barcelona", "type", "airport"), "barcelona:type:airport");
});

test("planResearchJobs: eksik ref'leri yüksek öncelikle işe alır", () => {
  const { createQueue, planResearchJobs } = load();
  const { queue, enqueued } = planResearchJobs(createQueue(), [
    "istanbul:place:ayasofya",
    "istanbul:place:topkapi",
  ]);
  assert.equal(enqueued.length, 2);
  assert.equal(queue.jobs.length, 2);
  assert.ok(enqueued.every((j) => j.priority === "high"));
  assert.ok(enqueued.every((j) => j.status === "pending"));
});

test("planResearchJobs: zaten pending olan ref tekrar eklenmez (dedup)", () => {
  const { createQueue, enqueueJob, planResearchJobs } = load();
  const base = enqueueJob(createQueue(), "istanbul:place:ayasofya", "normal").queue;
  const { queue, enqueued } = planResearchJobs(base, [
    "istanbul:place:ayasofya", // zaten pending → atlanmalı
    "istanbul:place:topkapi", // yeni
  ]);
  assert.equal(enqueued.length, 1);
  assert.equal(enqueued[0].entityRef, "istanbul:place:topkapi");
  assert.equal(queue.jobs.length, 2);
});

test("planResearchJobs: aynı çağrıda yinelenen ref bir kez eklenir", () => {
  const { createQueue, planResearchJobs } = load();
  const { enqueued } = planResearchJobs(createQueue(), [
    "roma:place:kolezyum",
    "roma:place:kolezyum",
  ]);
  assert.equal(enqueued.length, 1);
});

test("planResearchJobs: running iş de tekrar eklenmez", () => {
  const { createQueue, enqueueJob, markRunning, planResearchJobs } = load();
  const first = enqueueJob(createQueue(), "lima:place:huaca", "normal");
  const running = markRunning(first.queue, first.job.id);
  const { enqueued } = planResearchJobs(running, ["lima:place:huaca"]);
  assert.equal(enqueued.length, 0);
});

test("planResearchJobs: girdiyi mutasyona uğratmaz (immutable)", () => {
  const { createQueue, planResearchJobs } = load();
  const q0 = createQueue();
  planResearchJobs(q0, ["paris:place:eiffel"]);
  assert.equal(q0.jobs.length, 0, "orijinal kuyruk değişmemeli");
});

test("planResearchJobs: threadId işe taşınır", () => {
  const { createQueue, planResearchJobs } = load();
  const { enqueued } = planResearchJobs(
    createQueue(),
    ["tokyo:place:senso-ji"],
    "high",
    "thread-42",
  );
  assert.equal(enqueued[0].requestedByThreadId, "thread-42");
});
