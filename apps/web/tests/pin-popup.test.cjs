// Pine dokununca bilgi (Increment 1.7, bug 3, P5): model alanları yalnız pin kaydı ve yer
// proxy'si ayrıntısından gelir (I1); boş alan modele girmez (I10); Google atfı yalnız Google
// kaynaklı ayrıntıda. "Rotalarım" görünümünde pin önce planı açar.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");
const APP = path.resolve(__dirname, "../app");
const plain = (v) => JSON.parse(JSON.stringify(v));
const popup = loadTs(path.join(APP, "lib/trip/pin-popup.ts"), { globals: { URL } });

const PIN = (over = {}) => ({
  id: "pin-1",
  label: "Galata Kulesi",
  address: "Bereketzade, Beyoğlu",
  lat: 41.0256,
  lng: 28.9741,
  category: "manzara",
  dayIndex: 2,
  order: 1,
  group: "Genel",
  visited: false,
  ...over,
});

test("yalnız pin kaydı: kaynak alanı (saat/puan/telefon) uydurulmaz, boş alan anahtar değil", () => {
  const m = plain(popup.pinPopupModel(PIN({ note: "\n  Gün batımında git\nikinci satır" })));
  assert.deepEqual(Object.keys(m).sort(), [
    "address",
    "category",
    "day",
    "icon",
    "id",
    "noteLine",
    "title",
    "visited",
  ]);
  assert.equal(m.noteLine, "Gün batımında git");
  assert.equal(m.day, 2);
  assert.equal(m.icon, "camera");
  const bare = plain(popup.pinPopupModel(PIN({ address: "  ", dayIndex: 0, note: "" })));
  assert.equal("address" in bare, false);
  assert.equal("day" in bare, false, "Kaydedilenler'de gün rozeti yok");
  assert.equal("noteLine" in bare, false);
});

test("ayrıntı: yalnız dönen alanlar; geçersiz puan/web atılır; puan yoksa sayı da yok", () => {
  const amazon = {
    id: "a1",
    provider: "amazon",
    name: "Galata Kulesi",
    lat: 41,
    lng: 29,
    openingHours: ["Pzt–Paz 08:30–23:00"],
    phone: "+90 212 000 00 00",
    website: "javascript:alert(1)",
    userRatingCount: 12,
    attribution: "Amazon Location Service",
  };
  const m = plain(popup.pinPopupModel(PIN(), amazon));
  assert.deepEqual(m.openingHours, ["Pzt–Paz 08:30–23:00"]);
  assert.equal(m.phone, "+90 212 000 00 00");
  assert.equal("website" in m, false, "javascript: bağlantısı atılır");
  assert.equal("rating" in m, false);
  assert.equal("userRatingCount" in m, false, "puan yokken sayı gösterilmez");
  assert.equal(popup.showsGoogleAttribution(m), false);
  assert.equal(m.address, "Bereketzade, Beyoğlu", "kullanıcı adresi önce");
});

test("Google atfı yalnız provider google iken", () => {
  const g = {
    id: "g1",
    provider: "google",
    name: "Kahve",
    lat: 41,
    lng: 29,
    rating: 4.6,
    userRatingCount: 1200,
    website: "https://ornek.example/",
    attribution: "Google",
  };
  const m = plain(popup.pinPopupModel(PIN({ address: "" }), { ...g, address: "Kadıköy" }));
  assert.equal(popup.showsGoogleAttribution(m), true);
  assert.equal(m.rating, 4.6);
  assert.equal(m.userRatingCount, 1200);
  assert.equal(m.website, "https://ornek.example/");
  assert.equal(m.address, "Kadıköy", "kullanıcı adresi yoksa kaynağın adresi");
  assert.equal("rating" in plain(popup.pinPopupModel(PIN(), { ...g, rating: 7 })), false);
});

test("openPinEffects: Rotalarım → plana geçer; mobilde harita dokunuşu sayfayı büyütmez", () => {
  assert.deepEqual(plain(popup.openPinEffects("trips", false)), {
    switchToPlan: true,
    expandSheet: false,
  });
  assert.deepEqual(plain(popup.openPinEffects("plan", true, false)), {
    switchToPlan: false,
    expandSheet: false,
  });
  assert.deepEqual(plain(popup.openPinEffects("plan", true)), {
    switchToPlan: false,
    expandSheet: true,
  });
});

test("popup DOM: React portal ile (innerHTML yok), Escape kapatır ve odak pine döner", () => {
  const src = fs.readFileSync(path.join(APP, "maps/maps-client.tsx"), "utf8");
  assert.match(src, /marker\.bindPopup\(host,/);
  assert.match(src, /createPortal\(/);
  assert.match(src, /e\.key !== "Escape"/);
  assert.match(src, /getElement\?\.\(\) as HTMLElement \| undefined\)\?\.focus\(\)/);
  assert.doesNotMatch(src, /innerHTML/);
  const css = fs.readFileSync(path.join(APP, "styles/vendor-overrides.css"), "utf8");
  assert.match(css, /\.leaflet-popup\.planner-popup \.leaflet-popup-content-wrapper/);
  const comp = fs.readFileSync(path.join(APP, "components/trip/pin-popup.tsx"), "utf8");
  assert.doesNotMatch(comp, /dangerouslySetInnerHTML/);
});
