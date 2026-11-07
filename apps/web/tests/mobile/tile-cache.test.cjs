// Increment 4.7 (K4, I12): çevrimdışı karo önbelleği sınırları (OSM karo kullanım politikası:
// yalnız görülen karo, üst sınır, TTL; toplu/ön indirme yok). Koşum: node --test apps/web/tests/mobile/*.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("../helpers/load-ts.cjs");
const MOBILE = path.resolve(__dirname, "../../../mobile/src");
const t = loadTs(path.join(MOBILE, "services/tile-logic.ts"));
const plain = (v) => JSON.parse(JSON.stringify(v));

test("karo anahtarı geçerli z/x/y ile sınırlı", () => {
  assert.equal(t.tileKey(13, 4785, 3045), "13-4785-3045");
  assert.equal(t.tileKey(2, 0, 0), null, "minZoom altı");
  assert.equal(t.tileKey(3, 8, 0), null, "x 2^z dışında");
  assert.equal(t.tileKey(13.5, 1, 1), null);
  assert.deepEqual(plain(t.parseTileKey("13-4785-3045")), { z: 13, x: 4785, y: 3045 });
  assert.equal(t.parseTileKey("../13-1-1"), null);
  assert.equal(t.parseTileKey("13-99999-1"), null);
});
test("yalnız maxZoom'a kadar ve makul boyutta karo saklanır", () => {
  assert.equal(t.shouldStore("17-1-1", 1000), true);
  assert.equal(t.shouldStore("18-1-1", 1000), false);
  assert.equal(t.shouldStore("13-1-1", 0), false);
  assert.equal(t.shouldStore("13-1-1", 250_000), false);
});
test("temizlik: süresi geçenler + üst sınırı aşan en eskiler; deterministik", () => {
  const now = Date.UTC(2026, 10, 7);
  const day = 86_400_000;
  const { maxTiles, ttlDays } = t.TILE_CACHE;
  const entries = Array.from({ length: maxTiles + 5 }, (_, i) => ({
    key: `14-${i}-1`,
    savedAt: now - i * 1000,
  }));
  entries.push({ key: "14-9999-1", savedAt: now - (ttlDays + 1) * day });
  const drop = plain(t.evictionPlan(entries, now));
  assert.equal(drop[0], "14-9999-1", "süresi geçen önce");
  assert.equal(drop.length, 6);
  assert.deepEqual(
    drop.slice(1),
    [maxTiles, maxTiles + 1, maxTiles + 2, maxTiles + 3, maxTiles + 4].map((i) => `14-${i}-1`),
  );
  assert.deepEqual(plain(t.evictionPlan(entries.slice(0, 10), now)), []);
});
test("WebView yalnız görülen karoyu iletir (ön/toplu indirme yok); OSM atfı ve kaynağı", () => {
  const html = fs.readFileSync(path.join(MOBILE, "map/leaflet-html.ts"), "utf8");
  assert.match(html, /tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(html, /openstreetmap\.org\/copyright/);
  assert.match(html, /on\("tileload"[\s\S]*TILE_SAVE/);
  assert.match(html, /on\("tileerror"[\s\S]*TILE_MISS/);
  assert.doesNotMatch(html, /google\.com\/vt/, "Google karoları önbelleğe alınamaz; kaynak OSM");
  const cache = fs.readFileSync(path.join(MOBILE, "services/tile-cache.ts"), "utf8");
  assert.doesNotMatch(cache, /downloadFileAsync|fetch\(/, "önbellek ek ağ isteği yapmaz");
  assert.match(cache, /evictionPlan\(/);
});
