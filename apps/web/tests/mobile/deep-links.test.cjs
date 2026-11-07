// Increment 4.7 (K4): native derin bağlantı ayrıştırma, yol tarifi URL'leri ve GPX dışa aktarma
// (saf parçalar; RN gerekmez). Koşum: node --test apps/web/tests/mobile/*.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs } = require("../helpers/load-ts.cjs");
const MOBILE = path.resolve(__dirname, "../../../mobile/src");
const links = loadTs(path.join(MOBILE, "services/deep-links.ts"));
const dir = loadTs(path.join(MOBILE, "services/directions.ts"));
const gpx = loadTs(path.join(MOBILE, "services/route-export.ts"));
const plain = (v) => JSON.parse(JSON.stringify(v));

test("paylaşım kodu: web ve uygulama şeması, eski ?kod=, boşluk temizliği; geçersiz kod null", () => {
  const cases = [
    ["https://mapsbridge.com/k/?code=AbC-123", { kind: "share", code: "AbC-123" }],
    ["https://www.mapsbridge.com/k?code=AbC1", { kind: "share", code: "AbC1" }],
    ["mapsbridge://k?code=XYZ9", { kind: "share", code: "XYZ9" }],
    ["mapsbridge:///k/?kod=XYZ9", { kind: "share", code: "XYZ9" }],
    ["https://mapsbridge.com/k/?code=AB%20CD", { kind: "share", code: "ABCD" }],
  ];
  for (const [url, want] of cases) assert.deepEqual(plain(links.parseDeepLink(url)), want, url);
  for (const url of [
    "https://mapsbridge.com/k/?code=ab",
    "https://mapsbridge.com/k/?code=<script>",
    "https://mapsbridge.com/k/",
  ])
    assert.equal(links.parseDeepLink(url), null, url);
});
test("profil ve rota bağlantıları; başka alan adı ve bilinmeyen yol açılmaz", () => {
  assert.deepEqual(plain(links.parseDeepLink("https://mapsbridge.com/traveler/?u=@Ayse_K")), {
    kind: "traveler",
    username: "ayse_k",
  });
  assert.deepEqual(plain(links.parseDeepLink("mapsbridge://maps?tripId=trip-42_a")), {
    kind: "trip",
    tripId: "trip-42_a",
  });
  for (const url of [
    "https://evil.com/k/?code=ABCD",
    "https://mapsbridge.com.evil.com/k/?code=ABCD",
    "javascript:alert(1)",
    "https://mapsbridge.com/admin/?x=1",
    "https://mapsbridge.com/traveler/?u=a",
    "https://mapsbridge.com/maps/?tripId=../../etc",
    "",
    null,
  ])
    assert.equal(links.parseDeepLink(url), null, String(url));
});
test("Google OAuth dönüşü 'oauth' olarak ayrılır (mevcut akış işler)", () => {
  assert.deepEqual(plain(links.parseDeepLink("https://mapsbridge.com/auth/callback#id_token=x")), {
    kind: "oauth",
  });
  assert.deepEqual(plain(links.parseDeepLink("mapsbridge://callback#access_token=y")), {
    kind: "oauth",
  });
});
test("yol tarifi: Apple ve Google URL'leri yalnız kayıttaki koordinatlarla", () => {
  const a = { lat: 41.0086, lng: 28.98 };
  const b = { lat: 41.0256, lng: 28.9741 };
  const c = { lat: 41.03, lng: 28.98 };
  assert.equal(dir.appleMapsUrl([a]), "https://maps.apple.com/?daddr=41.008600,28.980000&dirflg=w");
  assert.equal(
    dir.appleMapsUrl([a, b], "driving"),
    "https://maps.apple.com/?daddr=41.025600,28.974100&saddr=41.008600,28.980000&dirflg=d",
  );
  assert.equal(
    dir.googleMapsUrl([a, b, c]),
    "https://www.google.com/maps/dir/?api=1&destination=41.030000,28.980000&travelmode=walking&origin=41.008600,28.980000&waypoints=41.025600%2C28.974100",
  );
  assert.equal(dir.googleMapsUrl([]), null);
  assert.equal(dir.appleMapsUrl([{ lat: Number.NaN, lng: 1 }]), null);
});
test("GPX: XML kaçışı, yalnız ad + koordinat; güvenli dosya adı", () => {
  const out = gpx.routeToGpx("Roma & <Vatikan>", [
    { name: 'Kolezyum "giriş"', lat: 41.890251, lng: 12.492373, address: "Piazza" },
    { name: "Bozuk", lat: Number.NaN, lng: 1 },
  ]);
  assert.match(out, /<name>Roma &amp; &lt;Vatikan&gt;<\/name>/);
  assert.match(
    out,
    /<wpt lat="41\.890251" lon="12\.492373"><name>Kolezyum &quot;giriş&quot;<\/name><desc>Piazza<\/desc><\/wpt>/,
  );
  assert.doesNotMatch(out, /Bozuk/);
  assert.doesNotMatch(out, /<time>|duration|distance/);
  assert.equal(gpx.gpxFileName("İstanbul 1. gün / Kadıköy"), "istanbul-1-gun-kadikoy.gpx");
  assert.equal(gpx.gpxFileName("***"), "rota.gpx");
});
