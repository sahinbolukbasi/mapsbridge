// FEAT-004 B4: oturumlu asistan mini harita türetici (mini-map.ts). Saf/deterministik
// doğrulama (I1 uydurma yok, I2 geometri algoritmik): <2 geçerli koordinatta null; sabit
// 3 duraklı rota için sabit viewBox/points; aynı girdi → aynı çıktı.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

const MOD = loadTs(path.join(__dirname, "..", "app/travel-assistant/mini-map.ts"));
const { routeMiniMap } = MOD;

const stop = (id, lat, lng, day) => ({
  id,
  name: id,
  lat,
  lng,
  day,
  description: "",
  suggestedDuration: "1 saat",
});

const route = (stops, estimatedDays) => ({
  title: "Roma klasikleri",
  summary: "",
  estimatedDays,
  theme: "tarih",
  destination: "Roma",
  stops,
});

test("2 geçerli koordinattan az → null (harita uydurulmaz)", () => {
  assert.equal(routeMiniMap(route([], 1)), null);
  assert.equal(routeMiniMap(route([stop("s1", 41.89, 12.49, 1)], 1)), null);
  // Geçersiz koordinatlı duraklar sayılmaz.
  const bad = route([stop("s1", NaN, 12.49, 1), stop("s2", 41.9, 999, 1)], 1);
  assert.equal(routeMiniMap(bad), null);
});

test("sabit 3 duraklı rota: sabit viewBox, 3 nokta, path noktaları birleştirir", () => {
  const r = route(
    [stop("s1", 41.89, 12.49, 1), stop("s2", 41.9, 12.48, 1), stop("s3", 41.91, 12.5, 2)],
    2,
  );
  const m = routeMiniMap(r);
  assert.ok(m, "model null olmamalı");
  assert.equal(m.viewBox, "0 0 320 180");
  assert.equal(m.points.length, 3);
  assert.equal(m.title, "Roma klasikleri");
  assert.equal(m.dayCount, 2);
  assert.equal(m.stopCount, 3);
  // Gün bilgisi korunur.
  assert.deepEqual(
    m.points.map((p) => p.day),
    [1, 1, 2],
  );
  // Path M ile başlar, iki L içerir (3 nokta) ve nokta sayısıyla tutarlı.
  assert.match(m.path, /^M[\d. ]+ L[\d. ]+ L[\d. ]+$/);
  // Tüm noktalar viewBox içinde (0..320, 0..180).
  for (const p of m.points) {
    assert.ok(p.x >= 0 && p.x <= 320, `x aralıkta: ${p.x}`);
    assert.ok(p.y >= 0 && p.y <= 180, `y aralıkta: ${p.y}`);
  }
});

test("aynı girdi → aynı çıktı (deterministik, I2)", () => {
  const build = () =>
    route([stop("s1", 41.89, 12.49, 1), stop("s2", 41.9, 12.48, 1), stop("s3", 41.91, 12.5, 2)], 2);
  assert.deepEqual(routeMiniMap(build()), routeMiniMap(build()));
});

test("enlem yukarı → ekranda yukarı (y küçülür)", () => {
  const r = route([stop("low", 41.0, 12.0, 1), stop("high", 42.0, 12.0, 1)], 1);
  const m = routeMiniMap(r);
  assert.ok(m);
  const low = m.points[0];
  const high = m.points[1];
  assert.ok(high.y < low.y, "yüksek enlem ekranda daha yukarıda olmalı");
});
