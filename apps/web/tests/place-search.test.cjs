// Harita araması (Increment 1.6, bug 4): koordinat ayrıştırma, son aramalar, durum makinesi,
// searchPlaces katman sırası (proxy → Nominatim → Photon) ve hata ≠ boş sonuç ayrımı.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");
const APP = path.resolve(__dirname, "../app");
const plain = (v) => JSON.parse(JSON.stringify(v));
const stubs = {
  [path.join(APP, "lib/api-client.ts")]: path.join(__dirname, "stubs/api-client.stub.cjs"),
};

const logic = loadTs(path.join(APP, "lib/trip/place-search-logic.ts"));

/** geocoding-service'i verilen proxy yanıtı ve fetch davranışıyla yükler. */
function loadGeo({ respond, fetchImpl }) {
  const apiStub = { calls: [], respond };
  const fetchCalls = [];
  const geo = loadTs(path.join(APP, "lib/trip/geocoding-service.ts"), {
    stubs,
    globals: {
      __apiStub: apiStub,
      AbortController,
      setTimeout,
      clearTimeout,
      URLSearchParams,
      fetch: async (url, init) => {
        fetchCalls.push(String(url));
        return fetchImpl(String(url), init);
      },
    },
  });
  return { geo, apiStub, fetchCalls };
}
const blocked = async () => {
  throw new TypeError("Failed to fetch (CSP connect-src)");
};
const PROXY_OK = (places) => ({ status: "ok", provider: "amazon", places, cached: false });
const GALATA = {
  id: "a1",
  provider: "amazon",
  name: "Galata Kulesi",
  lat: 41.0256,
  lng: 28.9741,
  address: "Bereketzade, Beyoğlu, İstanbul",
  attribution: "Amazon Location Service",
};

test("parseCoordinates: yaygın biçimler; geçersiz aralık ve metin reddedilir", () => {
  assert.deepEqual(plain(logic.parseCoordinates("41.0, 28.97")), { lat: 41, lng: 28.97 });
  assert.deepEqual(plain(logic.parseCoordinates(" 41.0082;28.9784 ")), {
    lat: 41.0082,
    lng: 28.9784,
  });
  assert.deepEqual(plain(logic.parseCoordinates("41,0082 28,9784")), {
    lat: 41.0082,
    lng: 28.9784,
  });
  assert.deepEqual(plain(logic.parseCoordinates("-33.86 151.21")), { lat: -33.86, lng: 151.21 });
  for (const bad of ["", "Galata", "91, 10", "10, 181", "41.0", "41.0, 28.9, 3", "41a, 29"])
    assert.equal(logic.parseCoordinates(bad), null, bad);
});

test("son aramalar: en yeni başta, tekrarsız, en çok 8; bozuk kayıt atılır", () => {
  let list = [];
  for (let i = 0; i < 10; i++)
    list = logic.pushRecent(list, { label: `Yer ${i}`, address: "", lat: 41 + i / 100, lng: 29 });
  assert.equal(list.length, logic.RECENT_SEARCH_MAX);
  assert.equal(list[0].label, "Yer 9");
  list = logic.pushRecent(list, { label: "yer 5", address: "x", lat: 41.05, lng: 29 });
  assert.equal(list.filter((r) => r.label.toLowerCase() === "yer 5").length, 1, "tekrar yok");
  assert.equal(list[0].label, "yer 5");
  assert.deepEqual(plain(logic.parseRecent("{bozuk")), []);
  assert.deepEqual(
    plain(
      logic.parseRecent(JSON.stringify([{ label: "A", address: "", lat: 1, lng: 2 }, { x: 1 }])),
    ),
    [{ label: "A", address: "", lat: 1, lng: 2 }],
  );
});

test("durum makinesi: boş → empty, hata → error; eski yanıt yok sayılır", () => {
  let s = logic.initialSearchState();
  s = logic.searchReducer(s, { type: "start", requestId: 1 });
  assert.equal(s.status, "loading");
  s = logic.searchReducer(s, { type: "start", requestId: 2 });
  const stale = logic.searchReducer(s, { type: "success", requestId: 1, results: [{ a: 1 }] });
  assert.equal(stale.status, "loading", "eski istek durumu değiştirmez");
  assert.equal(
    logic.searchReducer(s, { type: "success", requestId: 2, results: [] }).status,
    "empty",
  );
  assert.equal(logic.searchReducer(s, { type: "failure", requestId: 2 }).status, "error");
  const ok = logic.searchReducer(s, { type: "success", requestId: 2, results: [{ a: 1 }] });
  assert.equal(ok.status, "results");
  assert.equal(logic.searchReducer(ok, { type: "reset" }).status, "idle");
});

test("searchPlaces: proxy 200 → sonuçlar (doğrudan sağlayıcı çağrılmaz), sorgu ?op=places", async () => {
  const { geo, apiStub, fetchCalls } = loadGeo({
    respond: () => PROXY_OK([GALATA]),
    fetchImpl: blocked,
  });
  const res = plain(await geo.searchPlaces("Galata", 5, { near: { lat: 41, lng: 29 } }));
  assert.equal(res.length, 1);
  assert.equal(res[0].label, "Galata Kulesi");
  assert.equal(res[0].placeId, "a1");
  assert.equal(res[0].provider, "amazon");
  assert.equal(fetchCalls.length, 0);
  const url = new URL(apiStub.calls[0].path, "https://x");
  assert.equal(url.pathname, "/ai/chat");
  assert.equal(url.searchParams.get("op"), "places");
  assert.equal(url.searchParams.get("action"), "search");
  assert.equal(url.searchParams.get("q"), "Galata");
  assert.equal(url.searchParams.get("lat"), "41");
  assert.equal(apiStub.calls[0].init.timeoutMs, 8000);
  assert.equal(apiStub.calls[0].init.skipAuth, true, "misafirde oturumsuz");
});

test("searchPlaces: tüm katmanlar reddedilirse PlaceSearchError (boş dizi DEĞİL)", async () => {
  const { geo, fetchCalls } = loadGeo({
    respond: () => {
      throw { status: 503, message: "Yer servisi şu an yanıt vermiyor." };
    },
    fetchImpl: blocked,
  });
  await assert.rejects(
    () => geo.searchPlaces("Galata"),
    (err) => err.name === "PlaceSearchError",
  );
  assert.equal(fetchCalls.length, 2, "Nominatim ve Photon denendi");
});

test("searchPlaces: gerçek boş sonuç → [] (hata değil)", async () => {
  const proxyEmpty = loadGeo({ respond: () => PROXY_OK([]), fetchImpl: blocked });
  assert.deepEqual(plain(await proxyEmpty.geo.searchPlaces("zzqx")), []);
  const nominatimEmpty = loadGeo({
    respond: () => {
      throw new Error("Sunucuya erişilemedi.");
    },
    fetchImpl: async (url) =>
      url.includes("nominatim")
        ? { ok: true, json: async () => [] }
        : { ok: true, json: async () => ({ features: [] }) },
  });
  assert.deepEqual(plain(await nominatimEmpty.geo.searchPlaces("zzqx")), []);
});

test("searchPlaces: proxy düşerse Nominatim sonucu; ülke uydurulmaz", async () => {
  const { geo } = loadGeo({
    respond: () => {
      throw { status: 500 };
    },
    fetchImpl: async (url) => {
      if (!url.includes("nominatim")) throw new Error("unexpected");
      return {
        ok: true,
        json: async () => [{ lat: "41.0256", lon: "28.9741", name: "Galata Kulesi", address: {} }],
      };
    },
  });
  const res = plain(await geo.searchPlaces("Galata"));
  assert.equal(res[0].label, "Galata Kulesi");
  assert.equal(res[0].country, undefined, "varsayılan 'Türkiye' yazılmaz");
});

test("reverseGeocodeLocation: proxy adı; tüm katmanlar düşerse yalnız koordinat metni", async () => {
  const ok = loadGeo({ respond: () => PROXY_OK([GALATA]), fetchImpl: blocked });
  const place = plain(await ok.geo.reverseGeocodeLocation(41.0257, 28.9742));
  assert.equal(place.label, "Galata Kulesi");
  assert.equal(place.lat, 41.0257, "dokunulan nokta korunur");
  const down = loadGeo({
    respond: () => {
      throw { status: 503 };
    },
    fetchImpl: blocked,
  });
  const fallback = plain(await down.geo.reverseGeocodeLocation(41.0257, 28.9742));
  assert.equal(fallback.label, "Nokta (41.0257, 28.9742)");
  assert.equal(fallback.category, "genel");
  assert.equal(fallback.country, undefined);
});

test("sabit POI listesi (getCuratedNearbyPOIs) kaldırıldı (I1)", () => {
  const src = require("node:fs").readFileSync(
    path.join(APP, "lib/trip/geocoding-service.ts"),
    "utf8",
  );
  assert.doesNotMatch(src, /getCuratedNearbyPOIs|Shibuya|sampleAnchors/);
});

test("places-api: yanıt şeması doğrulanır; geçersiz yer atılır, alan tamamlanmaz", () => {
  const api = loadTs(path.join(APP, "lib/trip/places-api.ts"), {
    stubs,
    globals: { URLSearchParams },
  });
  const out = plain(
    api.parsePlacesResponse({
      status: "ok",
      provider: "amazon",
      places: [GALATA, { ...GALATA, id: "b", name: "" }, { ...GALATA, id: "c", lat: "41" }],
    }),
  );
  assert.deepEqual(
    out.places.map((p) => p.id),
    ["a1"],
  );
  assert.throws(() => api.parsePlacesResponse({ status: "unavailable" }), /beklenmeyen/);
  assert.equal(
    api.placesPath("detail", { id: "ChIJ x", provider: "google", reviews: true }),
    "/ai/chat?op=places&action=detail&id=ChIJ+x&provider=google&reviews=1",
  );
});
