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
        console: { log: (v) => logs.push(JSON.parse(v)) },
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
  userId: "private-user",
  requestId: "request-id",
  conversationId: "conversation-id",
  prompt: "Roma önerisi user@example.com",
  result: {
    modelUsed: "test",
    orchestratorSummary: "Roma müzelerini keşfedebilirsin.",
    responseMode: "chat",
  },
};
test("worker exports a redacted approved record before removing the durable job", async () => {
  const h = harness();
  const job = h.createTrainingJob(input);
  job.record.privacyReview = "approved";
  h.rows.push(job);
  await h.handler({});
  assert.deepEqual(
    h.calls.map((c) => c.name),
    ["QueryCommand", "PutObjectCommand", "DeleteItemCommand"],
  );
  const object = h.calls[1].input;
  assert.match(object.Key, /^quarantine\/[a-f0-9]{64}\.jsonl$/);
  assert.equal(object.Body.includes("user@example.com"), false);
  assert.equal(object.Body.includes("private-user"), false);
  assert.equal(JSON.parse(object.Body).reviewed, false);
  assert.ok(h.logs.some((l) => l.Heartbeat === 1));
  assert.equal(JSON.stringify(h.logs).includes("Roma"), false);
});
test("failed export retains job; acknowledgement failure retries the identical S3 key", async () => {
  const first = harness({ fail: "PutObjectCommand" });
  const firstJob = first.createTrainingJob(input);
  firstJob.record.privacyReview = "approved";
  first.rows.push(firstJob);
  await assert.rejects(() => first.handler({}));
  assert.equal(
    first.calls.some((c) => c.name === "DeleteItemCommand"),
    false,
  );
  const retry = harness({ rows: first.rows, fail: "DeleteItemCommand" });
  await assert.rejects(() => retry.handler({}));
  assert.equal(first.calls[1].input.Key, retry.calls[1].input.Key);
});
test("expired jobs are erased without export; empty queues produce a heartbeat", async () => {
  const h = harness();
  h.rows.push(h.createTrainingJob(input, Date.now() - 8 * 86400000));
  await h.handler({});
  assert.equal(
    h.calls.some((c) => c.name === "PutObjectCommand"),
    false,
  );
  const empty = harness();
  await empty.handler({});
  assert.ok(empty.logs.some((l) => l.Heartbeat === 1));
});
test("consent and guardrails cannot be bypassed; related turns stay in one dataset group", () => {
  const h = harness();
  assert.equal(h.createTrainingJob({ ...input, consent: false }), undefined);
  assert.equal(
    h.createTrainingJob({ ...input, result: { ...input.result, modelUsed: "guardrail" } }),
    undefined,
  );
  const a = h.createTrainingJob(input),
    b = h.createTrainingJob({ ...input, requestId: "another-request" });
  assert.equal(a.record.groupId, b.record.groupId);
  assert.notEqual(a.id, b.id);
});
// K3 (Increment 1.5): Google Places içeriği ve yer önbelleği kayıtları eğitim korpusuna girmez.
test("Google kaynaklı içerik ya da PLACECACHE#/PLACEID# kaydı dışa aktarılmaz, iş silinir", async () => {
  for (const taint of [
    (job) => (job.record.metadata = { places: [{ provider: "google", name: "Kahve" }] }),
    (job) => (job.record.metadata = { cacheKey: "PLACECACHE#google#abc" }),
    (job) => (job.record.metadata = { ref: "PLACEID#ChIJ123" }),
  ]) {
    const h = harness();
    const job = h.createTrainingJob(input);
    job.record.privacyReview = "approved";
    taint(job);
    h.rows.push(job);
    await h.handler({});
    assert.equal(
      h.calls.some((c) => c.name === "PutObjectCommand"),
      false,
      "korpusa yazılmamalı",
    );
    assert.ok(
      h.calls.some((c) => c.name === "DeleteItemCommand"),
      "iş silinmeli",
    );
  }
});
