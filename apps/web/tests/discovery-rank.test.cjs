// Mekan keşfi sıralaması (Increment 1.8, bug 5; I1, I2, I8): deterministik, affiliate'ten
// bağımsız, kaynakta olmayan puan uydurulmaz, mevcut pin cezalandırılır, açıklama yalnız
// gerçek bileşenleri anar. Ağırlıklar scoring-engine ile hizalı.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");
const APP = path.resolve(__dirname, "../app");
const ROOT = path.resolve(__dirname, "../../..");
const plain = (v) => JSON.parse(JSON.stringify(v));
const rank = loadTs(path.join(APP, "lib/trip/discovery-rank.ts"));

const ANCHOR = { lat: 41.0082, lng: 28.9784 };
const cand = (id, lat, lng, over = {}) => ({
  id,
  provider: "amazon",
  name: `Yer ${id}`,
  lat,
  lng,
  attribution: "Amazon Location Service",
  queriedCategory: "museum",
  ...over,
});
const POOL = [
  cand("c", 41.0105, 28.98),
  cand("a", 41.02, 28.99),
  cand("b", 41.0083, 28.9785, { queriedCategory: "cafe" }),
  cand("d", 41.03, 29.02, { rating: 4.8, userRatingCount: 5000 }),
];
const opts = (over = {}) => ({
  interests: ["museum"],
  anchor: ANCHOR,
  existingPins: [],
  dayPins: [],
  ...over,
});
const ids = (r) => plain(r).map((x) => x.place.id);

test("aynı girdi → aynı sıra; eşitlikte id artan", () => {
  const a = ids(rank.rankCandidates(POOL, opts()));
  const b = ids(rank.rankCandidates([...POOL].reverse(), opts()));
  assert.deepEqual(a, b);
  const tie = rank.rankCandidates(
    [cand("z", 41.0082, 28.9784), cand("m", 41.0082, 28.9784)],
    opts(),
  );
  assert.deepEqual(ids(tie), ["m", "z"]);
});

test("I8: affiliate/commission/sponsored alanı eklenince sıra ve skor değişmez, çıktıda yok", () => {
  const base = plain(rank.rankCandidates(POOL, opts()));
  const monetized = POOL.map((p, i) => ({
    ...p,
    affiliateUrl: `https://ota.example/${i}`,
    affiliateBoost: 100 - i * 30,
    commissionRate: i,
    sponsored: true,
  }));
  const out = plain(rank.rankCandidates(monetized, opts()));
  assert.deepEqual(ids(out), ids(base));
  assert.deepEqual(
    out.map((x) => x.score),
    base.map((x) => x.score),
  );
  for (const r of out)
    for (const k of Object.keys(r.place)) assert.doesNotMatch(k, /affiliate|commission|sponsor/i);
});

test("I1: puan yoksa kalite null, katkı 0, ceza yok; puan alanı uydurulmaz", () => {
  const out = plain(rank.rankCandidates([cand("x", 41.0082, 28.9784)], opts()));
  assert.equal(out[0].components.quality, null);
  assert.equal("rating" in out[0].place, false);
  assert.ok(!out[0].reasons.some((r) => r.key === "rating"));
  assert.equal(out[0].components.repetitionPenalty, 0);
  const rated = plain(
    rank.rankCandidates(
      [cand("y", 41.0082, 28.9784, { rating: 4.5, userRatingCount: 999 })],
      opts(),
    ),
  );
  assert.ok(rated[0].score > out[0].score, "gerçek puan katkı verir");
  assert.equal(rank.qualityOf({ rating: 9 }), null, "aralık dışı puan yok sayılır");
});

test("mevcut pin (aynı placeId ya da ≤60 m) ve aynı kategori yığılması cezalandırılır", () => {
  const pool = [cand("p1", 41.0083, 28.9785), cand("p2", 41.0084, 28.979)];
  const free = plain(rank.rankCandidates(pool, opts()));
  const withExisting = plain(
    rank.rankCandidates(
      pool,
      opts({
        existingPins: [{ id: "pin", lat: 41.0, lng: 28.0, category: "muze", placeId: "p1" }],
      }),
    ),
  );
  const p1 = withExisting.find((x) => x.place.id === "p1");
  assert.equal(p1.components.repetitionPenalty >= 1, true);
  assert.ok(p1.reasons.some((r) => r.key === "alreadyPlanned"));
  assert.equal(ids(withExisting).at(-1), "p1", "rotadaki yer sona düşer");
  const near = plain(
    rank.rankCandidates(
      pool,
      opts({ existingPins: [{ id: "q", lat: 41.00831, lng: 28.97851, category: "genel" }] }),
    ),
  );
  assert.ok(near.find((x) => x.place.id === "p1").reasons.some((r) => r.key === "alreadyPlanned"));
  const stacked = plain(
    rank.rankCandidates(
      pool,
      opts({ dayPins: [1, 2].map((i) => ({ id: `m${i}`, lat: 40, lng: 29, category: "muze" })) }),
    ),
  );
  assert.ok(stacked[0].score < free[0].score);
  assert.deepEqual(
    stacked[0].reasons.find((r) => r.key === "sameCategory"),
    { key: "sameCategory", count: 2 },
  );
});

test("açıklama yalnız gerçek bileşenleri anar; ilgi dışı kategori ilgi nedeni almaz", () => {
  const out = plain(rank.rankCandidates(POOL, opts()));
  for (const r of out) {
    const keys = r.reasons.map((x) => x.key);
    assert.equal(keys.includes("interest"), r.components.interestMatch === 1);
    assert.equal(keys.includes("rating"), r.components.quality !== null);
    assert.equal(keys.includes("alreadyPlanned"), r.components.repetitionPenalty >= 1);
    const d = r.reasons.find((x) => x.key === "distance");
    assert.equal(d.meters, r.distanceMeters);
  }
  const cafe = out.find((x) => x.place.id === "b");
  assert.equal(cafe.components.interestMatch, 0);
});

test("ağırlıklar ve mesafe bozunumu scoring-engine calculatePlaceScore ile hizalı", () => {
  const src = fs.readFileSync(
    path.join(ROOT, "services/ai-assistant/src/application/scoring-engine.ts"),
    "utf8",
  );
  const interestW = Number(src.match(/factors\.interestMatch \* ([\d.]+)/)[1]);
  const distanceW = Number(
    src.match(/distanceScore \* ([\d.]+) \+\s*factors\.crowdLevelAvoidance/)[1],
  );
  assert.equal(rank.DISCOVERY_WEIGHTS.interestMatch, interestW);
  assert.equal(rank.DISCOVERY_WEIGHTS.distanceScore, distanceW);
  assert.match(src, /1\.0 - factors\.distanceFromPreviousStopMeters \/ 5000/);
  assert.equal(rank.distanceScoreOf(0), 1);
  assert.equal(rank.distanceScoreOf(2500), 0.5);
  assert.equal(rank.distanceScoreOf(9000), 0.1);
});

test("centroid: boş liste null (uydurma merkez yok); yinelenen aday tek", () => {
  assert.equal(rank.centroid([]), null);
  assert.deepEqual(
    plain(
      rank.centroid([
        { lat: 40, lng: 28 },
        { lat: 42, lng: 30 },
      ]),
    ),
    { lat: 41, lng: 29 },
  );
  const dup = rank.rankCandidates(
    [cand("a", 41, 29), cand("a", 41, 29, { queriedCategory: "cafe" })],
    opts(),
  );
  assert.equal(dup.length, 1);
});
