// FEAT-002 (U1/U2): "Yakında ne var" saf eşleyicisi. mapNearby deterministik (I2): mesafe artan,
// eşitlikte sağlayıcı+id kararlı; origin'in kendisi elenir; kapalı (limit); kaynakta olmayan alan
// taşınmaz (I1/I10); affiliate/sponsor skora girmez — sıra yalnız mesafedir (I8). reverseLabel ilk
// yeri döndürür ya da null (uydurma yok).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");
const APP = path.resolve(__dirname, "../app");
const plain = (v) => JSON.parse(JSON.stringify(v));
const { mapNearby, reverseLabel } = loadTs(path.join(APP, "lib/trip/nearby.ts"));

const ORIGIN = { lat: 41.0082, lng: 28.9784 };
const place = (id, lat, lng, over = {}) => ({
  id,
  provider: "amazon",
  name: `Yer ${id}`,
  lat,
  lng,
  attribution: "Amazon Location Service",
  ...over,
});
// ~mesafeler: b ≈ 15 m (origin'in kendisi), near ≈ 130 m, mid ≈ 1.3 km, far ≈ 2.5 km.
const RES = {
  provider: "amazon",
  places: [
    place("far", 41.03, 29.0),
    place("mid", 41.02, 28.985),
    place("near", 41.0094, 28.9784),
    place("self", 41.00821, 28.97841),
  ],
};
const ids = (r) => plain(r).map((x) => x.id);

test("mesafe artan sıralı ve deterministik; aynı girdi/ters girdi aynı sıra (I2)", () => {
  const a = ids(mapNearby(RES, ORIGIN));
  const b = ids(mapNearby({ provider: "amazon", places: [...RES.places].reverse() }, ORIGIN));
  assert.deepEqual(a, b);
  // "self" (≈15 m) origin olarak elenir; kalanlar mesafe artan.
  assert.deepEqual(a, ["near", "mid", "far"]);
  const out = plain(mapNearby(RES, ORIGIN));
  for (let i = 1; i < out.length; i++)
    assert.ok(out[i].distanceMeters >= out[i - 1].distanceMeters);
});

test("eşit mesafede sağlayıcı+id'ye göre kararlı sıra", () => {
  const tie = {
    provider: "amazon",
    places: [place("z", 41.0094, 28.9784), place("m", 41.0094, 28.9784)],
  };
  assert.deepEqual(ids(mapNearby(tie, ORIGIN)), ["m", "z"]);
});

test("origin'in kendisi (çok yakın) elenir; eşik ayarlanabilir", () => {
  assert.equal(
    ids(mapNearby(RES, ORIGIN)).includes("self"),
    false,
    "varsayılan 25 m içindeki yer düşer",
  );
  // Eşik 0 → self (≈15 m) de listeye girer.
  assert.ok(ids(mapNearby(RES, ORIGIN, { originRadiusMeters: 0 })).includes("self"));
});

test("limit kapalı tutar (varsayılan 8, opsiyonla kısılır)", () => {
  const many = {
    provider: "amazon",
    places: Array.from({ length: 12 }, (_, i) => place(`p${i}`, 41.01 + i * 0.001, 28.98)),
  };
  assert.equal(mapNearby(many, ORIGIN).length, 8);
  assert.equal(mapNearby(many, ORIGIN, { limit: 3 }).length, 3);
});

test("I1/I10: kategori/adres yoksa alan konmaz, uydurulmaz", () => {
  const out = plain(mapNearby({ provider: "amazon", places: [place("x", 41.01, 28.98)] }, ORIGIN));
  assert.equal("category" in out[0], false);
  assert.equal("address" in out[0], false);
  const withFields = plain(
    mapNearby(
      {
        provider: "amazon",
        places: [place("y", 41.01, 28.98, { category: "Müze", address: "Sultanahmet" })],
      },
      ORIGIN,
    ),
  );
  assert.equal(withFields[0].category, "Müze");
  assert.equal(withFields[0].address, "Sultanahmet");
  // Boş/boşluk alanlar da konmaz.
  const blank = plain(
    mapNearby(
      { provider: "amazon", places: [place("z", 41.01, 28.98, { category: "  ", address: "" })] },
      ORIGIN,
    ),
  );
  assert.equal("category" in blank[0], false);
  assert.equal("address" in blank[0], false);
});

test("I8: affiliate/sponsor alanları sıralamayı etkilemez ve çıktıda yer almaz", () => {
  const monetized = {
    provider: "amazon",
    places: [
      place("far", 41.03, 29.0, { affiliateBoost: 999, sponsored: true }),
      place("near", 41.0094, 28.9784, { commissionRate: 0 }),
    ],
  };
  const out = plain(mapNearby(monetized, ORIGIN));
  // Sıra yalnız mesafeye göre (near < far); affiliate boost yok sayılır.
  assert.deepEqual(
    out.map((x) => x.id),
    ["near", "far"],
  );
  for (const item of out)
    for (const k of Object.keys(item)) assert.doesNotMatch(k, /affiliate|commission|sponsor/i);
});

test("reverseLabel ilk yeri ya da null döndürür (uydurma yok)", () => {
  assert.equal(reverseLabel({ provider: "amazon", places: [] }), null);
  const hit = reverseLabel(RES);
  assert.equal(hit.id, "far");
});
