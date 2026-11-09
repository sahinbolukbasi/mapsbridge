// Faz 2 / görev 9 — KB çelişki çözümü (reliability sırası).
// resolveByReliability (saf) + applyConflictResolution (store'a uygular) doğrular:
//   official > institutional > major_publication > ugc sırası,
//   en güvenilir seviyede tek değer → otomatik çözüm,
//   en güvenilir seviyede ≥2 farklı değer → ambiguous (addConflict, çözmez).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");

function load() {
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
  return loadFile(path.resolve(__dirname, "../app/lib/ai/knowledge-base/kb-store.ts"));
}

test("RELIABILITY_RANK sırası official>institutional>major_publication>ugc", () => {
  const { RELIABILITY_RANK } = load();
  assert.ok(RELIABILITY_RANK.official > RELIABILITY_RANK.institutional);
  assert.ok(RELIABILITY_RANK.institutional > RELIABILITY_RANK.major_publication);
  assert.ok(RELIABILITY_RANK.major_publication > RELIABILITY_RANK.ugc);
});

test("resolveByReliability: en güvenilir kaynak otomatik seçilir", () => {
  const { resolveByReliability } = load();
  const r = resolveByReliability([
    { value: "09:00", sourceId: "ugc1", reliability: "ugc" },
    { value: "10:00", sourceId: "off1", reliability: "official" },
  ]);
  assert.equal(r.ambiguous, false);
  assert.equal(r.resolvedValue, "10:00");
  assert.equal(r.resolvedBySourceId, "off1");
});

test("resolveByReliability: en güvenilir seviyede aynı değerde ≥2 kaynak → çözülür", () => {
  const { resolveByReliability } = load();
  const r = resolveByReliability([
    { value: "10:00", sourceId: "off1", reliability: "official" },
    { value: "10:00", sourceId: "off2", reliability: "official" },
    { value: "09:00", sourceId: "ugc1", reliability: "ugc" },
  ]);
  assert.equal(r.ambiguous, false);
  assert.equal(r.resolvedValue, "10:00");
});

test("resolveByReliability: en güvenilir seviyede ≥2 FARKLI değer → ambiguous", () => {
  const { resolveByReliability } = load();
  const r = resolveByReliability([
    { value: "10:00", sourceId: "off1", reliability: "official" },
    { value: "11:00", sourceId: "off2", reliability: "official" },
  ]);
  assert.equal(r.ambiguous, true);
  assert.equal(r.resolvedValue, undefined);
});

test("resolveByReliability: bilinmeyen reliability rank 0 sayılır", () => {
  const { resolveByReliability } = load();
  const r = resolveByReliability([
    { value: "x", sourceId: "s1", reliability: "garip" },
    { value: "y", sourceId: "s2", reliability: "ugc" },
  ]);
  // ugc (1) > garip (0) → y seçilir.
  assert.equal(r.resolvedValue, "y");
});

test("resolveByReliability: boş girdi → ambiguous değil, değer yok", () => {
  const { resolveByReliability } = load();
  const r = resolveByReliability([]);
  assert.equal(r.ambiguous, false);
  assert.equal(r.resolvedValue, undefined);
});

test("applyConflictResolution: otomatik çözümde değer entity'ye yazılır + resolvedBy=reliability", () => {
  const store = load();
  let s = store.createKBStore();
  s = store.upsertEntity(s, {
    id: "e1",
    type: "place",
    country: "TR",
    name: "Yer",
    payload: { opening: "eski" },
    confidence: 0.8,
    ttlDays: 90,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
  });
  const { store: s2, resolution } = store.applyConflictResolution(
    s,
    "e1",
    "opening",
    [
      { value: "10:00", sourceId: "off1", reliability: "official" },
      { value: "09:00", sourceId: "ugc1", reliability: "ugc" },
    ],
    "cf1",
  );
  assert.equal(resolution.ambiguous, false);
  assert.equal(store.getEntity(s2, "e1").payload.opening, "10:00");
  const conflicts = s2.conflicts.get("e1");
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].resolvedBy, "reliability");
});

test("applyConflictResolution: ambiguous'da çelişki kaydedilir, entity değişmez", () => {
  const store = load();
  let s = store.createKBStore();
  s = store.upsertEntity(s, {
    id: "e2",
    type: "place",
    country: "TR",
    name: "Yer2",
    payload: { opening: "eski" },
    confidence: 0.8,
    ttlDays: 90,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
  });
  const { store: s2, resolution } = store.applyConflictResolution(
    s,
    "e2",
    "opening",
    [
      { value: "10:00", sourceId: "off1", reliability: "official" },
      { value: "11:00", sourceId: "off2", reliability: "official" },
    ],
    "cf2",
  );
  assert.equal(resolution.ambiguous, true);
  assert.equal(store.getEntity(s2, "e2").payload.opening, "eski", "entity değişmemeli");
  const conflicts = s2.conflicts.get("e2");
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].resolvedBy, undefined, "çözülmemiş işaretli kalmalı");
});
