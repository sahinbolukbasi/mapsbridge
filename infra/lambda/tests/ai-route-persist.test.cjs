// Canlı hata (2026-11-08): rota üretimi her seferinde 503 AI_RESULT_UNCONFIRMED.
// Kök neden: buildResearchedRoute duraklarında isteğe bağlı alanlar (checkedAt,
// estimatedMinutes, timeSlot) undefined; finishAI gerçek `marshall` ile bunu yazarken
// "Pass options.removeUndefinedValues=true…" fırlatıyordu. Testler gerçek @aws-sdk/util-dynamodb
// marshall'ı ve gerçek supervisor.buildResearchedRoute'u kullanır (stub yok).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");
const { marshall } = require("@aws-sdk/util-dynamodb");
const { loadTs } = require("../../../apps/web/tests/helpers/load-ts.cjs");

const root = path.resolve(__dirname, "../src");
function loadPersistable() {
  const filename = path.join(root, "ai/persistable.ts");
  const module = { exports: {} };
  const code = transformSync(readFileSync(filename, "utf8"), {
    loader: "ts",
    format: "cjs",
    target: "node22",
  }).code;
  vm.runInNewContext(code, { module, exports: module.exports }, { filename });
  return module.exports;
}
const { persistable } = loadPersistable();

function loadSupervisor() {
  return loadTs(path.resolve(__dirname, "../../../apps/web/app/lib/ai/supervisor.ts"), {
    globals: {
      process: { env: {} },
      TransformStream,
      ReadableStream,
      WritableStream,
      TextEncoder,
      TextDecoder,
      URL,
      URLSearchParams,
      AbortController,
      AbortSignal,
      Buffer,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      crypto: globalThis.crypto,
      fetch: async () => ({ ok: false }),
      console,
      Headers,
      Request,
      Response,
      Blob,
      structuredClone,
      queueMicrotask,
      performance,
    },
  });
}
const RESEARCH = {
  checkedAt: "2026-11-08T00:00:00Z",
  places: [
    {
      id: "a",
      name: "Ayasofya",
      lat: 41.0086,
      lng: 28.9802,
      address: "Sultanahmet",
      category: "Müze",
    },
    {
      id: "b",
      name: "Topkapı Sarayı",
      lat: 41.0115,
      lng: 28.9834,
      address: "Fatih",
      category: "Müze",
    },
    {
      id: "c",
      name: "Galata Kulesi",
      lat: 41.0256,
      lng: 28.9741,
      address: "Beyoğlu",
      category: "Tarihi",
    },
    { id: "d", name: "Karaköy", lat: 41.0227, lng: 28.977, address: "Beyoğlu", category: "Semt" },
  ],
};
const CANDIDATE = {
  title: "İstanbul'da 2 gün",
  summary: "Tarihi yarımada ve Galata",
  theme: "kültür",
  stops: ["P1", "P2", "P3", "P4"].map((placeId) => ({
    placeId,
    description: "Kısa açıklama",
    suggestedDuration: "1 saat",
  })),
};
const undefinedPaths = (value, at = "") => {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([k, v]) =>
    v === undefined ? [`${at}.${k}`] : undefinedPaths(v, `${at}.${k}`),
  );
};

test("persistable: nesnede undefined anahtar silinir, iç içe nesne ve dizi temizlenir", () => {
  const out = persistable({
    a: 1,
    b: undefined,
    c: { d: undefined, e: "x" },
    f: [1, undefined, { g: undefined }],
  });
  // vm realm'i farklı prototip üretir; yapı JSON ile karşılaştırılır.
  assert.equal(JSON.stringify(out), JSON.stringify({ a: 1, c: { e: "x" }, f: [1, {}] }));
  assert.equal(out.f.length, 2, "dizideki undefined eleman çıkarılır");
});
test("persistable: null, 0, '', false korunur; Date ve Set gibi sınıflar dokunulmaz", () => {
  const when = new Date("2026-11-08T00:00:00Z");
  const set = new Set(["a"]);
  const out = persistable({ n: null, z: 0, s: "", f: false, when, set });
  assert.equal(out.n, null);
  assert.equal(out.z, 0);
  assert.equal(out.s, "");
  assert.equal(out.f, false);
  assert.equal(out.when, when);
  assert.equal(out.set, set);
});
test("persistable: girdi değişmez (yeni nesne döner)", () => {
  const input = { a: undefined, b: { c: undefined } };
  const out = persistable(input);
  assert.ok("a" in input && "c" in input.b);
  assert.notEqual(out, input);
});
test("persistable: ilkel değerler olduğu gibi döner", () => {
  for (const v of [1, "x", true, null, undefined]) assert.equal(persistable(v), v);
});

test("kök neden: gerçek buildResearchedRoute çıktısında undefined alan var ve gerçek marshall fırlatır", () => {
  const { buildResearchedRoute } = loadSupervisor();
  const route = buildResearchedRoute(
    CANDIDATE,
    { destination: "İstanbul", days: 2, interests: [] },
    RESEARCH,
  );
  assert.equal(route.estimatedDays, 2);
  assert.equal(route.stops.length, 4);
  assert.ok(
    undefinedPaths(route, "route").length > 0,
    "regresyon girdisi: undefined alan beklenir",
  );
  assert.throws(() => marshall({ ":response": { route } }), /removeUndefinedValues/);
});
test("düzeltme: persistable(rota yanıtı) gerçek marshall ile yazılır, rota içeriği korunur (I1/I2)", () => {
  const { buildResearchedRoute } = loadSupervisor();
  const route = buildResearchedRoute(
    CANDIDATE,
    { destination: "İstanbul", days: 2, interests: [] },
    RESEARCH,
  );
  const response = persistable({ success: true, responseMode: "route", route, cost: 5 });
  assert.deepEqual(undefinedPaths(response), []);
  assert.doesNotThrow(() => marshall({ ":response": response }));
  assert.equal(response.route.stops.length, route.stops.length);
  for (const [i, stop] of response.route.stops.entries()) {
    assert.equal(stop.id, route.stops[i].id);
    assert.equal(stop.day, route.stops[i].day);
    assert.equal(stop.lat, route.stops[i].lat);
    assert.equal(stop.lng, route.stops[i].lng);
  }
});
test("ai/index: iki finishAI başarı çağrısı da (buffered + stream) persistable ile sarılı", () => {
  const src = readFileSync(path.join(root, "ai/index.ts"), "utf8");
  const calls = src.match(/await finishAI\(\s*reservation,\s*true,\s*([a-zA-Z]+)\(/g) || [];
  assert.equal(calls.length, 2, "iki başarı çağrısı");
  for (const c of calls) assert.match(c, /persistable\($/);
  assert.match(src, /import \{ persistable \} from "\.\/persistable";/);
});
