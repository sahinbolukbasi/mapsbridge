// Faz 4 / görev 15 — K3 lisans filtresi (isGoogleDerived) sabitleme.
// Google Places türevi içerik ve yer önbelleği kayıtları eğitim/RAG korpusuna GİRMEZ.
// training-worker + kb-ingest bu yüklemi korpus kapısında kullanır.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

function load() {
  const file = path.resolve(__dirname, "../src/places-search/google-content.ts");
  const code = transformSync(readFileSync(file, "utf8"), {
    loader: "ts",
    format: "cjs",
    target: "node22",
  }).code;
  const mod = { exports: {} };
  vm.runInNewContext(code, { module: mod, exports: mod.exports, JSON });
  return mod.exports;
}

const { isGoogleDerived, PLACE_CACHE_PREFIXES } = load();

test('provider:"google" içeren kayıt Google türevi sayılır', () => {
  assert.equal(isGoogleDerived({ places: [{ provider: "google", name: "Kafe" }] }), true);
  assert.equal(isGoogleDerived('{"provider":"google"}'), true);
  // boşluklu varyant da yakalanır
  assert.equal(isGoogleDerived('{ "provider" : "google" }'), true);
});

test("PLACECACHE# / PLACEID# anahtarlı kayıt Google türevi sayılır", () => {
  assert.equal(isGoogleDerived("PLACECACHE#google#abc"), true);
  assert.equal(isGoogleDerived({ ref: "PLACEID#ChIJ123" }), true);
  for (const p of PLACE_CACHE_PREFIXES) assert.equal(isGoogleDerived(`${p}x`), true);
});

test("Google ile ilgisi olmayan seyahat kaydı türev DEĞİL", () => {
  assert.equal(
    isGoogleDerived({ destination: "İstanbul", summary: "Trastevere gez", provider: "osm" }),
    false,
  );
  assert.equal(isGoogleDerived("Roma mutfağı rehberi"), false);
});

test("serileştirilemeyen (döngüsel) değer güvenli tarafta: türev sayılır (korpusa girmez)", () => {
  const circular = {};
  circular.self = circular;
  assert.equal(isGoogleDerived(circular), true);
});

test("boş/null değer türev değildir (korpusa engel değil)", () => {
  assert.equal(isGoogleDerived(null), false);
  assert.equal(isGoogleDerived(""), false);
});

test("provider başka ('foursquare') ise türev değil", () => {
  assert.equal(isGoogleDerived({ provider: "foursquare", name: "Bar" }), false);
});
