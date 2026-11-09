// Faz 6 / görev 23 — demografi yasağı (I5) + unutma akışı.
// I5: ilgi yalnız söylenen/yapılandan; demografiden ASLA (prompts.ts talimatı drift guard).
// Unutma: changeMemory({reset}) generation'ı DÖNDÜRÜR (eski requestId'ler geçersizleşir)
//   + version++ (I6 optimistic lock). Handler 'tercihlerimi unut' tetiğini ve
//   generation-mismatch 409'unu taşır (drift guard).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");

const PROMPTS_SRC = fs.readFileSync(path.resolve(__dirname, "../app/lib/ai/prompts.ts"), "utf8");
const HANDLER_SRC = fs.readFileSync(
  path.resolve(__dirname, "../../../infra/lambda/src/ai/index.ts"),
  "utf8",
);

// ── I5 demografi yasağı (prompt drift guard) ──────────────────────────────────

test("I5: INTAKE_PROMPT demografi yasağını açıkça içerir", () => {
  assert.ok(PROMPTS_SRC.includes("DEMOGRAFİ YASAĞI"));
  // yaş/cinsiyet/milliyet/aile/grup → ilgi İMA ETMEZ.
  assert.ok(/yaş, cinsiyet, milliyet/.test(PROMPTS_SRC));
  assert.ok(/aileyle gidiyorum.*EKLEMEZ/su.test(PROMPTS_SRC));
});

test("I5: ilgi yalnız açık söylenen/yapılandan gelir talimatı var", () => {
  assert.ok(/açıkça söylediği veya yaptığı/.test(PROMPTS_SRC));
  assert.ok(/Söylenmemiş ilgi 0\.0/.test(PROMPTS_SRC));
});

// ── Unutma akışı: changeMemory generation rotation ────────────────────────────

function loadMemoryService(sendImpl) {
  const cache = new Map();
  const env = {
    AI_MEMORY_TABLE: "mem",
    DYNAMODB_TABLE: "data",
    AWS_REGION: "eu-central-1",
  };
  function load(file) {
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
        crypto: require("node:crypto"),
        AbortSignal,
        Date,
        console: { warn() {}, log() {}, error() {} },
        require: (spec) => {
          if (spec === "@aws-sdk/client-dynamodb")
            return {
              DynamoDBClient: class {
                async send(cmd) {
                  return sendImpl(cmd);
                }
              },
              GetItemCommand: class {
                constructor(i) {
                  this.name = "Get";
                  this.input = i;
                }
              },
              QueryCommand: class {
                constructor(i) {
                  this.name = "Query";
                  this.input = i;
                }
              },
              TransactWriteItemsCommand: class {
                constructor(i) {
                  this.name = "Transact";
                  this.input = i;
                }
              },
              PutItemCommand: class {
                constructor(i) {
                  this.name = "Put";
                  this.input = i;
                }
              },
            };
          if (spec === "@aws-sdk/util-dynamodb")
            return {
              marshall: (x) => x,
              unmarshall: (x) => x,
            };
          if (spec.startsWith("."))
            return load(path.resolve(path.dirname(filename), spec + ".ts"));
          return require(spec);
        },
      },
      { filename },
    );
    cache.set(filename, module.exports);
    return module.exports;
  }
  return load(path.resolve(__dirname, "../server/ai/memory-service.ts"));
}

test("changeMemory({reset}) generation'ı döndürür + version++ (eski requestId geçersiz)", async () => {
  const transacts = [];
  const before = { generation: "gen-OLD", version: 2, enabled: true, changedAt: "2026-11-01" };
  const svc = loadMemoryService((cmd) => {
    if (cmd.name === "Get") return { Item: before };
    if (cmd.name === "Transact") {
      transacts.push(cmd.input);
      return {};
    }
    return {};
  });
  const next = await svc.changeMemory("u1", { reset: true });
  assert.notEqual(next.generation, "gen-OLD", "reset yeni generation üretmeli");
  assert.equal(next.version, 3, "version artmalı (optimistic lock)");
  // PURGE# işi eski generation için kuyruğa alınır.
  const items = transacts[0].TransactItems;
  assert.ok(items.some((o) => o.Put?.Item?.SK?.startsWith?.("PURGE#gen-OLD")));
});

test("changeMemory reset'te SETTINGS version koşullu yazılır (optimistic lock)", async () => {
  const transacts = [];
  const before = { generation: "g1", version: 5, enabled: true, changedAt: "2026-11-01" };
  const svc = loadMemoryService((cmd) => {
    if (cmd.name === "Get") return { Item: before };
    if (cmd.name === "Transact") {
      transacts.push(cmd.input);
      return {};
    }
    return {};
  });
  await svc.changeMemory("u1", { reset: true });
  const settingsPut = transacts[0].TransactItems.find((o) => o.Put?.Item?.SK === "SETTINGS");
  assert.ok(settingsPut.Put.ConditionExpression.includes("#version = :version"));
});

// ── Handler unutma tetiği + generation 409 (drift guard) ──────────────────────

test("handler 'tercihlerimi unut' / forgetPreferences tetiğini taşır", () => {
  assert.ok(HANDLER_SRC.includes('body.action === "forgetPreferences"'));
  assert.ok(/tercihlerimi unut|seyahat tercihlerimi sil/.test(HANDLER_SRC));
  assert.ok(HANDLER_SRC.includes("changeMemory(user.sub, { reset: true })"));
});

test("handler generation-mismatch 409 ('silinen geçmişe ait') döner", () => {
  assert.ok(HANDLER_SRC.includes("silinen geçmişe ait"));
  assert.ok(/memoryGeneration !== personal\.settings\.generation/.test(HANDLER_SRC));
  assert.ok(/reply\(409/.test(HANDLER_SRC));
});
