// Faz 2 / görev 8 — KB TTL tazelik worker'ı.
// Bayat (expiresAt geçmiş) entity'lerin silindiğini, taze olanların korunduğunu,
// kaskad silmenin (entity+source+conflict) çalıştığını ve tazelik metriklerinin
// (KBPruned/KBScanned/KBOldestAgeSeconds/Heartbeat) yayıldığını doğrular.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");

function harness(entities) {
  const logs = [];
  const cache = new Map();
  // In-memory tek tablo: `${PK}|${SK}` → item (marshalled {S/N/...} değil, düz).
  const rows = new Map();
  // Gerçek DynamoDB item'ları PK/SK taşır; deleteEntity kaskadı bunları okur.
  for (const e of entities)
    rows.set(`KB#${e.id}|META`, { PK: `KB#${e.id}`, SK: "META", ...e, kind: "entity" });
  for (const e of entities) {
    rows.set(`KB#${e.id}|SOURCE#s1`, {
      PK: `KB#${e.id}`,
      SK: "SOURCE#s1",
      entityId: e.id,
      id: "s1",
      kind: "source",
    });
    rows.set(`KB#${e.id}|CONFLICT#c1`, {
      PK: `KB#${e.id}`,
      SK: "CONFLICT#c1",
      entityId: e.id,
      id: "c1",
      kind: "conflict",
    });
  }

  const commands = Object.fromEntries(
    ["ScanCommand", "PutItemCommand", "GetItemCommand", "QueryCommand", "DeleteItemCommand"].map(
      (name) => [
        name,
        class {
          constructor(input) {
            this.name = name;
            this.input = input;
          }
        },
      ],
    ),
  );
  class Client {
    async send(command) {
      const inp = command.input;
      if (command.name === "ScanCommand") {
        // SK=META + kind=entity süzgeci.
        const items = [];
        for (const [k, v] of rows)
          if (k.endsWith("|META") && v.kind === "entity") items.push(v);
        return { Items: items };
      }
      if (command.name === "QueryCommand") {
        const pk = inp.ExpressionAttributeValues[":pk"];
        const skPrefix = inp.ExpressionAttributeValues[":sk"];
        const out = [];
        for (const [k, v] of rows) {
          const [rpk, rsk] = k.split("|");
          if (rpk === pk && (!skPrefix || rsk.startsWith(skPrefix))) out.push(v);
        }
        return { Items: out };
      }
      if (command.name === "DeleteItemCommand") {
        rows.delete(`${inp.Key.PK}|${inp.Key.SK}`);
        return {};
      }
      return {};
    }
    destroy() {}
  }

  const env = { DYNAMODB_TABLE: "data", AWS_REGION: "eu-central-1" };
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} };
    cache.set(filename, module.exports);
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
          warn() {},
          error() {},
        },
        require: (spec) => {
          if (spec === "@aws-sdk/client-dynamodb") return { ...commands, DynamoDBClient: Client };
          if (spec === "@aws-sdk/util-dynamodb")
            // Düz passthrough: testte item'lar zaten düz obje.
            return { marshall: (x) => x, unmarshall: (x) => x };
          return spec.startsWith(".")
            ? load(path.resolve(path.dirname(filename), spec + ".ts"))
            : require(spec);
        },
      },
      { filename },
    );
    cache.set(filename, module.exports);
    return { ...module.exports };
  }
  const mod = load(path.resolve(__dirname, "../src/ai/kb-freshness-worker.ts"));
  return { ...mod, logs, rows };
}

const PAST = "2020-01-01T00:00:00Z"; // kesinlikle bayat
const FUTURE = "2099-01-01T00:00:00Z"; // kesinlikle taze
function entity(id, expiresAt, updatedAt = "2026-11-01T00:00:00Z") {
  return {
    id,
    type: "place",
    country: "TR",
    city: "İstanbul",
    name: id,
    payload: {},
    confidence: 0.8,
    ttlDays: 90,
    createdAt: updatedAt,
    updatedAt,
    expiresAt,
  };
}

test("bayat entity silinir, taze korunur", async () => {
  const h = harness([entity("stale1", PAST), entity("fresh1", FUTURE)]);
  const res = await h.handler({});
  assert.equal(res.scanned, 2);
  assert.equal(res.pruned, 1);
  assert.equal(h.rows.has("KB#stale1|META"), false, "bayat silinmeli");
  assert.equal(h.rows.has("KB#fresh1|META"), true, "taze korunmalı");
});

test("silme kaskadı: bayat entity'nin source + conflict'i de gider", async () => {
  const h = harness([entity("stale1", PAST)]);
  await h.handler({});
  assert.equal(h.rows.has("KB#stale1|SOURCE#s1"), false);
  assert.equal(h.rows.has("KB#stale1|CONFLICT#c1"), false);
});

test("tazelik metrikleri yayılır (KBPruned/KBScanned/KBOldestAgeSeconds/Heartbeat)", async () => {
  const h = harness([entity("stale1", PAST), entity("fresh1", FUTURE)]);
  await h.handler({});
  const metric = (name) =>
    h.logs.find((l) => l._aws?.CloudWatchMetrics?.[0]?.Metrics?.[0]?.Name === name);
  assert.ok(metric("KBScanned"), "KBScanned yayılmalı");
  assert.equal(metric("KBPruned").KBPruned, 1);
  assert.ok(metric("KBOldestAgeSeconds"), "yaş metriği yayılmalı");
  assert.ok(metric("Heartbeat"), "heartbeat yayılmalı");
  // MapsBridge/AI namespace.
  assert.equal(metric("KBPruned")._aws.CloudWatchMetrics[0].Namespace, "MapsBridge/AI");
});

test("geçersiz expiresAt bayat sayılır (isEntityStale: NaN → stale)", async () => {
  const h = harness([entity("bad", "not-a-date")]);
  const res = await h.handler({});
  assert.equal(res.pruned, 1);
});

test("hiç entity yoksa heartbeat yine yayılır, pruned=0", async () => {
  const h = harness([]);
  const res = await h.handler({});
  assert.equal(res.pruned, 0);
  assert.equal(res.scanned, 0);
  assert.ok(h.logs.some((l) => l._aws?.CloudWatchMetrics?.[0]?.Metrics?.[0]?.Name === "Heartbeat"));
});
