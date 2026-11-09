// Faz 2 / görev 7 — KB kalıcılık katmanı (kb-repo.ts).
// Enjekte edilen SAHTE DynamoDeps ile (AWS'siz) entity/source/conflict round-trip,
// silme kaskadı ve makeDynamoDeps'in doğru komut/anahtar ürettiğini doğrular.
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
  return loadFile(path.resolve(__dirname, "../app/lib/ai/knowledge-base", rel));
}

// In-memory sahte DynamoDeps — tek tablo `${PK}|${SK}` haritası.
function fakeDeps() {
  const rows = new Map();
  return {
    table: "test-data",
    rows,
    async put(item) {
      rows.set(`${item.PK}|${item.SK}`, JSON.parse(JSON.stringify(item)));
    },
    async get(pk, sk) {
      return rows.get(`${pk}|${sk}`) || null;
    },
    async query(pk, skPrefix) {
      const out = [];
      for (const [k, v] of rows) {
        const [rpk, rsk] = k.split("|");
        if (rpk === pk && (!skPrefix || rsk.startsWith(skPrefix))) out.push(v);
      }
      return out;
    },
    async del(pk, sk) {
      rows.delete(`${pk}|${sk}`);
    },
  };
}

const repo = load("kb-repo.ts");

const entity = {
  id: "istanbul-ayasofya",
  type: "place",
  country: "TR",
  city: "İstanbul",
  name: "Ayasofya",
  geo: { lat: 41.0086, lng: 28.98 },
  payload: { kind: "müze" },
  confidence: 0.9,
  ttlDays: 90,
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  expiresAt: "2027-01-30T00:00:00Z",
};

test("entity round-trip: putEntity → getEntity aynı veriyi döner", async () => {
  const deps = fakeDeps();
  await repo.putEntity(deps, entity);
  const got = await repo.getEntity(deps, entity.id);
  assert.equal(got.id, "istanbul-ayasofya");
  assert.equal(got.name, "Ayasofya");
  assert.equal(got.confidence, 0.9);
  // Kayıt doğru KB_PATTERNS anahtarıyla yazıldı.
  assert.ok(deps.rows.has("KB#istanbul-ayasofya|META"));
});

test("entityToItem/itemToEntity PK/SK/kind'i ekler ve temizler", () => {
  const item = repo.entityToItem(entity);
  assert.equal(item.PK, "KB#istanbul-ayasofya");
  assert.equal(item.SK, "META");
  assert.equal(item.kind, "entity");
  const back = repo.itemToEntity(item);
  assert.equal(back.PK, undefined);
  assert.equal(back.kind, undefined);
  assert.equal(back.id, "istanbul-ayasofya");
});

test("itemToEntity geçersiz/yanlış kind için undefined", () => {
  assert.equal(repo.itemToEntity(null), undefined);
  assert.equal(repo.itemToEntity({ kind: "source", id: "x" }), undefined);
});

test("source round-trip + entity'ye göre listelenir", async () => {
  const deps = fakeDeps();
  await repo.putSource(deps, {
    id: "s1",
    entityId: entity.id,
    url: "https://goturkiye.com",
    publisher: "GoTürkiye",
    fetchedAt: "2026-11-01T00:00:00Z",
    contentHash: "abc",
    reliability: "official",
  });
  const sources = await repo.getSources(deps, entity.id);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].reliability, "official");
  assert.equal(sources[0].PK, undefined); // PK/SK temizlenmeli
});

test("conflict round-trip + entity'ye göre listelenir", async () => {
  const deps = fakeDeps();
  await repo.putConflict(deps, {
    id: "c1",
    entityId: entity.id,
    field: "payload.kind",
    values: [{ value: "müze", sourceId: "s1", reliability: "official" }],
  });
  const conflicts = await repo.getConflicts(deps, entity.id);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].field, "payload.kind");
});

test("deleteEntity entity + source + conflict'i birlikte siler (kaskad)", async () => {
  const deps = fakeDeps();
  await repo.putEntity(deps, entity);
  await repo.putSource(deps, {
    id: "s1",
    entityId: entity.id,
    url: "https://x",
    publisher: "p",
    fetchedAt: "2026-11-01T00:00:00Z",
    contentHash: "h",
    reliability: "official",
  });
  await repo.putConflict(deps, { id: "c1", entityId: entity.id, field: "f", values: [] });
  assert.equal(deps.rows.size, 3);
  await repo.deleteEntity(deps, entity.id);
  assert.equal(deps.rows.size, 0);
});

test("getSources yalnızca source kayıtlarını döner (conflict/entity sızmaz)", async () => {
  const deps = fakeDeps();
  await repo.putEntity(deps, entity);
  await repo.putConflict(deps, { id: "c1", entityId: entity.id, field: "f", values: [] });
  await repo.putSource(deps, {
    id: "s1",
    entityId: entity.id,
    url: "https://x",
    publisher: "p",
    fetchedAt: "2026-11-01T00:00:00Z",
    contentHash: "h",
    reliability: "ugc",
  });
  const sources = await repo.getSources(deps, entity.id);
  assert.equal(sources.length, 1);
});

test("makeDynamoDeps doğru komut ve KB anahtarlarını üretir", async () => {
  const sent = [];
  const deps = repo.makeDynamoDeps({
    table: "data",
    send: async (c) => {
      sent.push(c);
      if (c.__name === "Get") return { Item: { PK: { S: "KB#x" } } };
      if (c.__name === "Query") return { Items: [] };
      return {};
    },
    PutItemCommand: class {
      constructor(i) {
        this.input = i;
        this.__name = "Put";
      }
    },
    GetItemCommand: class {
      constructor(i) {
        this.input = i;
        this.__name = "Get";
      }
    },
    QueryCommand: class {
      constructor(i) {
        this.input = i;
        this.__name = "Query";
      }
    },
    DeleteItemCommand: class {
      constructor(i) {
        this.input = i;
        this.__name = "Delete";
      }
    },
    marshall: (v) => v,
    unmarshall: (v) => v,
  });
  await repo.putEntity(deps, entity);
  await repo.getEntity(deps, entity.id);
  await repo.getSources(deps, entity.id);
  const put = sent.find((c) => c.__name === "Put");
  assert.equal(put.input.TableName, "data");
  assert.equal(put.input.Item.PK, "KB#istanbul-ayasofya");
  assert.equal(put.input.Item.SK, "META");
  const query = sent.find((c) => c.__name === "Query");
  assert.ok(query.input.KeyConditionExpression.includes("begins_with(SK"));
});
