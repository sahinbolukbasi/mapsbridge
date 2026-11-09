// Faz 0 / görev 2 — ai-operations.ts metrik şeması genişletmesi.
// aiMetric() EMF formatını ve recordAIOperation()'ın terminal istek olaylarında
// RequestLatency + RetrievalOutcome + EvidenceMerged metriklerini yaydığını,
// prompt/yanıt/kimlik SIZMADIĞINI doğrular. DYNAMODB_TABLE yok → DB yazımı atlanır,
// yalnızca metrik yolu çalışır (geriye uyumluluk: eski alanlar korunur).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");

function load(env = {}) {
  const logs = [];
  const file = path.resolve(__dirname, "../src/shared/ai-operations.ts");
  const code = transformSync(fs.readFileSync(file, "utf8"), {
    loader: "ts",
    format: "cjs",
    target: "node22",
  }).code;
  const mod = { exports: {} };
  vm.runInNewContext(code, {
    module: mod,
    exports: mod.exports,
    process: { env: { AWS_REGION: "eu-central-1", ...env } },
    crypto: require("node:crypto"),
    AbortSignal,
    Date,
    console: {
      log: (x) => {
        try {
          logs.push(JSON.parse(x));
        } catch {
          /* non-JSON log */
        }
      },
      warn() {},
      error() {},
    },
    require: (spec) => {
      if (spec === "@aws-sdk/client-dynamodb")
        return { GetItemCommand: class {}, PutItemCommand: class {} };
      if (spec === "@aws-sdk/util-dynamodb") return { marshall: (x) => x, unmarshall: (x) => x };
      if (spec === "./dynamo") return { getDynamoClient: () => ({ send: async () => ({}) }) };
      return require(spec);
    },
  });
  return { ...mod.exports, logs };
}

test("aiMetric EMF formatını MapsBridge/AI namespace ile yayar", () => {
  const h = load();
  h.aiMetric("RequestLatency", 1234, "Milliseconds", { Status: "succeeded" });
  const emf = h.logs.at(-1);
  assert.equal(emf._aws.CloudWatchMetrics[0].Namespace, "MapsBridge/AI");
  assert.equal(emf._aws.CloudWatchMetrics[0].Metrics[0].Name, "RequestLatency");
  assert.equal(emf._aws.CloudWatchMetrics[0].Metrics[0].Unit, "Milliseconds");
  assert.deepEqual(emf._aws.CloudWatchMetrics[0].Dimensions[0], ["Service", "Status"]);
  assert.equal(emf.Service, "ai");
  assert.equal(emf.Status, "succeeded");
  assert.equal(emf.RequestLatency, 1234);
});

test("başarılı istek: latency + retrievalStatus + evidenceMerged metrikleri yayılır", async () => {
  const h = load(); // DYNAMODB_TABLE yok → DB yazımı atlanır
  await h.recordAIOperation({
    kind: "request",
    status: "succeeded",
    durationMs: 820,
    retrievalStatus: "available",
    evidenceCounts: { remote: 4, local: 2, merged: 5 },
  });
  const names = h.logs.map((l) => l._aws.CloudWatchMetrics[0].Metrics[0].Name);
  assert.ok(names.includes("RequestLatency"));
  assert.ok(names.includes("RetrievalOutcome"));
  assert.ok(names.includes("EvidenceMerged"));
  const retrieval = h.logs.find(
    (l) => l._aws.CloudWatchMetrics[0].Metrics[0].Name === "RetrievalOutcome",
  );
  assert.equal(retrieval.RetrievalStatus, "available");
  const merged = h.logs.find(
    (l) => l._aws.CloudWatchMetrics[0].Metrics[0].Name === "EvidenceMerged",
  );
  assert.equal(merged.EvidenceMerged, 5);
});

test("running olayı metrik yaymaz (yalnızca terminal olaylar)", async () => {
  const h = load();
  await h.recordAIOperation({ kind: "request", status: "running" });
  assert.equal(h.logs.length, 0);
});

test("model olayı (request değil) istek metriği yaymaz", async () => {
  const h = load();
  await h.recordAIOperation({ kind: "model", status: "succeeded", durationMs: 100 });
  assert.equal(
    h.logs.some((l) => l._aws.CloudWatchMetrics[0].Metrics[0].Name === "RequestLatency"),
    false,
  );
});

test("opsiyonel alanlar yoksa yalnızca mevcut metrikler yayılır (geriye uyumlu)", async () => {
  const h = load();
  await h.recordAIOperation({ kind: "request", status: "failed", durationMs: 300 });
  const names = h.logs.map((l) => l._aws.CloudWatchMetrics[0].Metrics[0].Name);
  assert.deepEqual(names, ["RequestLatency"]);
  assert.equal(h.logs[0].Status, "failed");
});

test("metrik yayımı prompt/yanıt/kimlik içermez", async () => {
  const h = load();
  await h.recordAIOperation({
    kind: "request",
    status: "succeeded",
    durationMs: 500,
    retrievalStatus: "empty",
    model: "intake",
  });
  const blob = JSON.stringify(h.logs);
  assert.equal(blob.includes("@"), false);
  assert.equal(/prompt|userId|USER#/.test(blob), false);
});
