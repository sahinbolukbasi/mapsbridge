// Faz 4 / görev 17 — eğitim tazelik/hacim metrikleri (değer-seviyesi sabitleme).
// training-worker.ts'in yaydığı CloudWatch EMF metriklerini DEĞER olarak doğrular:
//   Exported (dışa aktarılan onaylı kayıt), SkippedThirdPartyContent (K3 eleme),
//   OldestPendingAgeSeconds (tazelik/kuyruk yaşı), Heartbeat (canlılık).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");

function harness(options = {}) {
  const calls = [],
    logs = [],
    cache = new Map(),
    rows = options.rows || [];
  const commands = Object.fromEntries(
    ["QueryCommand", "DeleteItemCommand", "PutObjectCommand"].map((name) => [
      name,
      class {
        constructor(input) {
          this.name = name;
          this.input = input;
        }
      },
    ]),
  );
  class Client {
    async send(command) {
      calls.push(command);
      if (command.name === "QueryCommand") return { Items: rows };
      if (command.name === options.fail) throw Error("provider failure");
      return {};
    }
    destroy() {}
  }
  const env = {
    AI_TRAINING_COLLECTION_ENABLED: "true",
    DYNAMODB_TABLE: "data",
    AI_TRAINING_BUCKET: "quarantine",
  };
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} };
    vm.runInNewContext(
      transformSync(fs.readFileSync(filename, "utf8"), { loader: "ts", format: "cjs" }).code,
      {
        module,
        exports: module.exports,
        process: { env },
        AbortSignal,
        Date,
        console: {
          log: (v) => {
            try {
              logs.push(JSON.parse(v));
            } catch {
              /* ignore */
            }
          },
        },
        require: (spec) => {
          if (spec === "@aws-sdk/client-dynamodb") return { ...commands, DynamoDBClient: Client };
          if (spec === "@aws-sdk/client-s3") return { ...commands, S3Client: Client };
          if (spec === "@aws-sdk/util-dynamodb")
            return { marshall: (x) => x, unmarshall: (x) => x };
          return spec.startsWith(".")
            ? load(path.resolve(path.dirname(filename), spec + ".ts"))
            : require(spec);
        },
      },
    );
    cache.set(filename, module.exports);
    return module.exports;
  }
  const outbox = load(path.resolve(__dirname, "../../../apps/web/server/ai/training-outbox.ts"));
  return {
    calls,
    logs,
    rows,
    ...outbox,
    ...load(path.resolve(__dirname, "../src/ai/training-worker.ts")),
  };
}

const input = {
  consent: true,
  userId: "u1",
  requestId: "r1",
  conversationId: "c1",
  prompt: "Roma önerisi",
  result: { modelUsed: "haiku", orchestratorSummary: "Roma müzeleri.", responseMode: "chat" },
};

function metricValue(logs, name) {
  const row = logs.find((l) => l._aws?.CloudWatchMetrics?.[0]?.Metrics?.some((m) => m.Name === name));
  return row ? row[name] : undefined;
}

test("onaylı kayıt export edilince Exported=1 + Heartbeat=1 yayılır", async () => {
  const h = harness();
  const job = h.createTrainingJob(input);
  job.record.privacyReview = "approved";
  h.rows.push(job);
  await h.handler({});
  assert.equal(metricValue(h.logs, "Exported"), 1);
  assert.equal(metricValue(h.logs, "Heartbeat"), 1);
});

test("K3: Google kaynaklı kayıt SkippedThirdPartyContent=1 yayar, export etmez", async () => {
  const h = harness();
  const job = h.createTrainingJob(input);
  job.record.privacyReview = "approved";
  job.record.metadata = { places: [{ provider: "google", name: "Kafe" }] };
  h.rows.push(job);
  await h.handler({});
  assert.equal(metricValue(h.logs, "SkippedThirdPartyContent"), 1);
  assert.equal(
    h.calls.some((c) => c.name === "PutObjectCommand"),
    false,
    "korpusa yazılmamalı",
  );
});

test("OldestPendingAgeSeconds en eski kaydın yaşını (saniye, ≥0) yayar", async () => {
  const h = harness();
  const old = h.createTrainingJob(input, Date.now() - 2 * 86400000); // 2 gün önce
  old.record.privacyReview = "approved";
  h.rows.push(old);
  await h.handler({});
  const age = metricValue(h.logs, "OldestPendingAgeSeconds");
  assert.ok(typeof age === "number" && age >= 0, "yaş sayısal ve ≥0 olmalı");
  // En eski kayıt createdAt'ten türetilir; birim saniye (Unit:Seconds).
  const row = h.logs.find((l) =>
    l._aws?.CloudWatchMetrics?.[0]?.Metrics?.some((m) => m.Name === "OldestPendingAgeSeconds"),
  );
  assert.equal(
    row._aws.CloudWatchMetrics[0].Metrics.find((m) => m.Name === "OldestPendingAgeSeconds").Unit,
    "Seconds",
  );
});

test("boş kuyruk: Exported=0 + Heartbeat=1", async () => {
  const h = harness();
  await h.handler({});
  assert.equal(metricValue(h.logs, "Exported"), 0);
  assert.equal(metricValue(h.logs, "Heartbeat"), 1);
});

test("metrikler MapsBridge/Training namespace'inde yayılır", async () => {
  const h = harness();
  await h.handler({});
  const ns = h.logs
    .filter((l) => l._aws)
    .map((l) => l._aws.CloudWatchMetrics[0].Namespace);
  assert.ok(ns.length > 0);
  assert.ok(ns.every((n) => n === "MapsBridge/Training"));
});

test("metrik logları prompt/yanıt/kimlik içermez", async () => {
  const h = harness();
  const job = h.createTrainingJob(input);
  job.record.privacyReview = "approved";
  h.rows.push(job);
  await h.handler({});
  const blob = JSON.stringify(h.logs);
  assert.equal(blob.includes("Roma müzeleri"), false);
  assert.equal(blob.includes("u1"), false);
});
