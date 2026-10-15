const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");
function harness(options = {}) {
  const rows = new Map(),
    calls = [],
    coreCalls = [],
    cache = new Map();
  const env = {
    AWS_REGION: "eu-central-1",
    AI_MEMORY_TABLE: "memory",
    DYNAMODB_TABLE: "app",
    AGENTCORE_MEMORY_ID: "travel-1234567890",
    MEMORY_READ_ENABLED: "true",
    MEMORY_WRITE_ENABLED: "true",
    ...options.env,
  };
  const names = [
    "GetItem",
    "PutItem",
    "Query",
    "TransactWriteItems",
    "Scan",
    "DeleteItem",
    "UpdateItem",
  ];
  const coreNames = [
    "RetrieveMemoryRecords",
    "CreateEvent",
    "ListSessions",
    "ListEvents",
    "DeleteEvent",
    "ListMemoryRecords",
    "DeleteMemoryRecord",
  ];
  const commands = (list) =>
    Object.fromEntries(
      list.map((n) => [
        n + "Command",
        class {
          constructor(input) {
            this.input = input;
            this.name = n;
          }
        },
      ]),
    );
  const key = (table, k) => `${table}|${k.PK}|${k.SK}`;
  function allowed(o) {
    const old = rows.get(key(o.TableName, o.Key || o.Item));
    if (o.ConditionExpression === "attribute_not_exists(PK)") return !old;
    if (o.ConditionExpression === "#version = :version")
      return old?.version === o.ExpressionAttributeValues[":version"];
    return true;
  }
  const external = {
    "node:crypto": require("node:crypto"),
    "@aws-sdk/util-dynamodb": {
      marshall: (x) => JSON.parse(JSON.stringify(x)),
      unmarshall: (x) => structuredClone(x),
    },
    "@aws-sdk/client-dynamodb": {
      ...commands(names),
      DynamoDBClient: class {
        async send(c) {
          calls.push(c);
          const i = c.input;
          if (c.name === "GetItem") return { Item: rows.get(key(i.TableName, i.Key)) };
          if (c.name === "Query")
            return {
              Items: [...rows.values()].filter(
                (r) =>
                  r.PK === i.ExpressionAttributeValues[":pk"] &&
                  (!i.ExpressionAttributeValues[":prefix"] ||
                    r.SK.startsWith(i.ExpressionAttributeValues[":prefix"])),
              ),
            };
          if (c.name === "TransactWriteItems") {
            const ops = i.TransactItems.map((o) => o.Put || o.ConditionCheck);
            if (options.conflict || ops.some((o) => !allowed(o)))
              throw Object.assign(Error("version conflict"), {
                name: "TransactionCanceledException",
              });
            for (const o of ops)
              if (o.Item) rows.set(key(o.TableName, o.Item), structuredClone(o.Item));
            return {};
          }
          if (c.name === "PutItem") {
            rows.set(key(i.TableName, i.Item), structuredClone(i.Item));
            return {};
          }
          if (c.name === "DeleteItem") {
            rows.delete(key(i.TableName, i.Key));
            return {};
          }
          if (c.name === "Scan")
            return { Items: [...rows.values()].filter((r) => r.status === "pending") };
          throw Error("Unexpected DB " + c.name);
        }
      },
    },
    "@aws-sdk/client-bedrock-agentcore": {
      ...commands(coreNames),
      BedrockAgentCoreClient: class {
        destroy() {}
        async send(c) {
          coreCalls.push(c);
          if (options.core) return options.core(c, rows);
          return { memoryRecordSummaries: [], sessionSummaries: [] };
        }
      },
    },
  };
  function load(file) {
    const filename = path.resolve(__dirname, "../server/ai", file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    vm.runInNewContext(
      transformSync(fs.readFileSync(filename, "utf8"), {
        loader: "ts",
        format: "cjs",
        supported: { "dynamic-import": false },
      }).code,
      {
        module,
        exports: module.exports,
        process: { env },
        Buffer,
        AbortSignal,
        console: { log() {}, warn() {} },
        require(spec) {
          if (external[spec]) return external[spec];
          if (spec.startsWith(".")) return load(path.resolve(path.dirname(filename), spec + ".ts"));
          throw Error("Unexpected " + spec);
        },
      },
    );
    return module.exports;
  }
  return { load, rows, calls, coreCalls };
}
const settings = {
  generation: "gen-a",
  version: 1,
  enabled: true,
  changedAt: "2026-01-01T00:00:00Z",
};
test("actor IDs isolate accounts and rotations without exposing identity", () => {
  const s = harness().load("memory-service.ts");
  assert.notEqual(s.actorFor("A", "1"), s.actorFor("B", "1"));
  assert.notEqual(s.actorFor("A", "1"), s.actorFor("A", "2"));
  assert.equal(s.actorFor("person@example.com", "1").includes("@"), false);
});
test("consent starts disabled and write payload excludes raw conversation or unknown preferences", async () => {
  const s = harness().load("memory-service.ts");
  assert.equal((await s.getMemorySettings("A")).enabled, false);
  assert.equal(
    s.writeJob("A", { ...settings, enabled: false }, "request1234567890", "session1234567890", {
      pace: "Sakin",
    }),
    undefined,
  );
  const job = s.writeJob("A", settings, "request1234567890", "session1234567890", {
    pace: "Sakin",
    email: "secret@example.com",
  });
  assert.equal(job.payload.includes("@"), false);
  assert.deepEqual(JSON.parse(job.payload).confirmedTravelPreferences, { pace: "Sakin" });
});
test("correction rotates actor and atomically updates only the owner profile", async () => {
  const h = harness();
  h.rows.set("memory|USER#A|SETTINGS", { PK: "USER#A", SK: "SETTINGS", ...settings });
  h.rows.set("app|USER#B|AI_PREFERENCES", { PK: "USER#B", SK: "AI_PREFERENCES", pace: "Yoğun" });
  const next = await h
    .load("memory-service.ts")
    .changeMemory("A", { preferences: { pace: "Sakin" } });
  assert.notEqual(next.generation, settings.generation);
  assert.equal(next.version, 2);
  assert.equal(h.rows.get("app|USER#B|AI_PREFERENCES").pace, "Yoğun");
  assert.equal(h.rows.get("memory|USER#A|PURGE#gen-a").status, "pending");
});
test("concurrent settings conflict leaves profile and purge jobs untouched", async () => {
  const h = harness({ conflict: true });
  await assert.rejects(() => h.load("memory-service.ts").changeMemory("A", { enabled: true }));
  assert.equal(h.rows.size, 0);
});
test("late retrieval is discarded after memory is disabled", async () => {
  const h = harness({
    core: async (c, rows) => {
      rows.set("memory|USER#A|SETTINGS", {
        ...settings,
        generation: "new",
        version: 2,
        enabled: false,
      });
      return {
        memoryRecordSummaries: [{ memoryRecordId: "old", content: { text: "Old preference" } }],
      };
    },
  });
  h.rows.set("memory|USER#A|SETTINGS", settings);
  assert.equal(
    (await h.load("memory-service.ts").retrievePersonalMemory("A", settings, "Roma")).length,
    0,
  );
  assert.ok(h.coreCalls[0].input.namespacePath.startsWith("/users/u_"));
  assert.equal(h.coreCalls[0].input.namespace, undefined);
});
test("memory failure returns empty context without failing the conversation", async () => {
  const h = harness({
    core: async () => {
      throw Error("timeout");
    },
  });
  assert.equal(
    (await h.load("memory-service.ts").retrievePersonalMemory("A", settings, "Roma")).length,
    0,
  );
});
test("retired outbox is cancelled without an AWS write and duplicate delivery is harmless", async () => {
  const h = harness(),
    s = h.load("memory-service.ts"),
    job = s.writeJob("A", settings, "request1234567890", "session1234567890", { pace: "Sakin" });
  h.rows.set(`memory|${job.PK}|${job.SK}`, job);
  h.rows.set("memory|USER#A|SETTINGS", { ...settings, generation: "new", version: 2 });
  const w = h.load("memory-worker.ts");
  await w.processMemoryJob(job.PK, job.SK);
  await w.processMemoryJob(job.PK, job.SK);
  assert.equal(h.coreCalls.length, 0);
  assert.equal(h.rows.get(`memory|${job.PK}|${job.SK}`).payload, undefined);
});
test("successful worker uses stable CreateEvent token and does not repeat completed writes", async () => {
  const h = harness(),
    s = h.load("memory-service.ts"),
    job = s.writeJob("A", settings, "request1234567890", "session1234567890", { pace: "Sakin" });
  h.rows.set(`memory|${job.PK}|${job.SK}`, job);
  h.rows.set("memory|USER#A|SETTINGS", settings);
  const w = h.load("memory-worker.ts");
  await w.processMemoryJob(job.PK, job.SK);
  await w.processMemoryJob(job.PK, job.SK);
  assert.equal(h.coreCalls.length, 1);
  assert.equal(h.coreCalls[0].input.clientToken.length, 64);
  assert.notEqual(h.coreCalls[0].input.clientToken, job.requestId);
  assert.equal(h.coreCalls[0].input.actorId, s.actorFor("A", "gen-a"));
});
test("purge deletes source events and both derived namespaces; active actor purge is refused", async () => {
  const h = harness({
    core: async (c) => {
      if (c.name === "ListSessions") return { sessionSummaries: [{ sessionId: "s" }] };
      if (c.name === "ListEvents") return { events: [{ eventId: "e" }] };
      if (c.name === "ListMemoryRecords")
        return { memoryRecordSummaries: [{ memoryRecordId: "r" }] };
      return {};
    },
  });
  h.rows.set("memory|USER#A|SETTINGS", { ...settings, generation: "new" });
  h.rows.set("memory|USER#A|PURGE#gen-a", {
    PK: "USER#A",
    SK: "PURGE#gen-a",
    kind: "purge",
    userId: "A",
    generation: "gen-a",
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  await h.load("memory-worker.ts").processMemoryJob("USER#A", "PURGE#gen-a");
  assert.equal(h.coreCalls.filter((c) => c.name === "DeleteEvent").length, 1);
  assert.equal(h.coreCalls.filter((c) => c.name === "DeleteMemoryRecord").length, 2);
  h.rows.set("memory|USER#A|SETTINGS", settings);
  await assert.rejects(
    () => h.load("memory-worker.ts").processMemoryJob("USER#A", "PURGE#gen-a"),
    /active actor/,
  );
});
test("purging an actor with no events or extracted namespace records is a successful empty pass", async () => {
  const h = harness({
    core: async () => {
      throw Object.assign(Error("Actor or namespace not found"), {
        name: "ResourceNotFoundException",
      });
    },
  });
  h.rows.set("memory|USER#A|SETTINGS", { ...settings, generation: "new" });
  h.rows.set("memory|USER#A|PURGE#gen-a", {
    PK: "USER#A",
    SK: "PURGE#gen-a",
    kind: "purge",
    userId: "A",
    generation: "gen-a",
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  await h.load("memory-worker.ts").processMemoryJob("USER#A", "PURGE#gen-a");
  const job = h.rows.get("memory|USER#A|PURGE#gen-a");
  assert.ok(job.lastCheckedAt);
  assert.ok(job.emptySince);
  assert.equal(job.status, "pending");
});
