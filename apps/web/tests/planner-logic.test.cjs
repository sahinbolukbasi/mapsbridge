// Planlayıcı saf mantığı (FEAT-007; design §4.2, §6.3, §12.1; I1/I2/I10).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

const APP = path.resolve(__dirname, "../app");
const L = loadTs(path.join(APP, "lib/trip/planner-logic.ts"));
// vm sınırı: nesneleri bu realm'e taşı (deepEqual prototip karşılaştırır).
const plain = (x) => (x === null || x === undefined ? x : JSON.parse(JSON.stringify(x)));

test("buildLegMap: OSRM bacakları ardışık durak çiftlerine eşlenir; sayı tutmazsa boş (I1)", () => {
  const legs = [
    { distanceMeters: 600, durationSeconds: 480 },
    { distanceMeters: 900, durationSeconds: 720 },
  ];
  const map = L.buildLegMap(["a", "b", "c"], legs);
  assert.deepEqual(plain(map[L.legKey("a", "b")]), legs[0]);
  assert.deepEqual(plain(map[L.legKey("b", "c")]), legs[1]);
  assert.deepEqual(plain(L.buildLegMap(["a", "b", "c"], legs.slice(0, 1))), {});
  assert.deepEqual(plain(L.buildLegMap(["a", "b"], undefined)), {});
  assert.deepEqual(plain(L.buildLegMap(["a"], [])), {});
});

test("dayTimeline: saatler yalnızca tüm bacaklar varsa; eksik bacakta null (tahmin yok)", () => {
  const stops = [
    { id: "a", durationMinutes: 60 },
    { id: "b", durationMinutes: 30 },
  ];
  const legs = { [L.legKey("a", "b")]: { distanceMeters: 1200, durationSeconds: 600 } };
  const tl = L.dayTimeline(stops, legs, "09:00");
  assert.deepEqual(plain(tl.times), ["09:00", "10:10"]);
  assert.equal(tl.travelMinutes, 10);
  assert.equal(tl.travelMeters, 1200);
  assert.equal(L.dayTimeline(stops, {}, "09:00"), null);
  assert.deepEqual(plain(L.dayTimeline([{ id: "a" }], {}, "08:30").times), ["08:30"]);
  assert.equal(L.dayTimeline([], {}), null);
});

test("routeRequestKey: yalnız kimlik/koordinat/sıra/mod; not ve süre anahtarı değiştirmez", () => {
  const a = [
    { id: "1", lat: 41, lng: 29, note: "x", durationMinutes: 30 },
    { id: "2", lat: 41.1, lng: 29.1 },
  ];
  const b = [
    { ...a[0], note: "y", durationMinutes: 90 },
    { ...a[1], label: "değişti" },
  ];
  assert.equal(L.routeRequestKey(a, "walking"), L.routeRequestKey(b, "walking"));
  assert.notEqual(L.routeRequestKey(a, "walking"), L.routeRequestKey([a[1], a[0]], "walking"));
  assert.notEqual(L.routeRequestKey(a, "walking"), L.routeRequestKey(a, "driving"));
});

test("canRequestRoute: 2–25 nokta (OSRM demo sınırı, design §6.3)", () => {
  assert.equal(L.MAX_ROUTE_POINTS, 25);
  assert.equal(L.canRequestRoute(1), false);
  assert.equal(L.canRequestRoute(2), true);
  assert.equal(L.canRequestRoute(25), true);
  assert.equal(L.canRequestRoute(26), false);
});

test("paylaşım süreleri yalnız sunucunun uyguladığı 1–168 saat aralığında; süresiz yok (I10)", () => {
  const hours = plain(L.SHARE_DURATIONS.map((d) => d.hours));
  assert.deepEqual(hours, [1, 24, 168]);
  assert.ok(hours.every((h) => h >= 1 && h <= 168));
  assert.ok(hours.includes(L.DEFAULT_SHARE_HOURS));
  assert.equal(
    L.shareLink("https://mapsbridge.com", "ab cd"),
    "https://mapsbridge.com/k/?code=ab%20cd",
  );
});

test("planlayıcı görünümleri: plan | trips (header Rotalarım → /maps/?view=trips)", () => {
  assert.deepEqual(plain([...L.PLANNER_VIEWS]), ["plan", "trips"]);
  const header = fs.readFileSync(path.join(APP, "components/header-nav.tsx"), "utf8");
  assert.match(header, /\/maps\/\?view=trips/);
});

test("misafir planlayıcı: promo yok, AuthGate sheet var, login yönlendirmesi yok (design §6.3)", () => {
  const src = fs.readFileSync(path.join(APP, "maps/maps-client.tsx"), "utf8");
  assert.equal(fs.existsSync(path.join(APP, "travel-assistant/promo-landing.tsx")), false);
  assert.doesNotMatch(src, /AIPromoLanding|AuthGuard|promo-landing/);
  assert.doesNotMatch(src, /location\.assign\(["'`]\/login/);
  assert.match(src, /<AuthGate\b/);
  assert.match(src, /cost=\{1\}/);
});
