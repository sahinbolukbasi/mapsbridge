// Yer verisi proxy istemcisi (lib/trip/places-api.ts; FEAT-003 U5). placesApi.{search,reverse,
// detail,nearby} canlı vekili `GET /ai/chat?op=places&action=…` çağırır; LLM yok, yer verisi
// yalnız vekilden gelir (I1). Burada: yol kurulumu (URL kodlama, boş/false düşürme), yanıt
// ayrıştırma (geçerli yer kalır, bozuk atılır, ok olmayan durum fırlatır) ve hata eşlemesi
// (429→limited, 400→invalid, 5xx→unavailable, diğer→network) ile "boş sonuç ≠ hata" ayrımı.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

const APP = path.resolve(__dirname, "../app");
const plain = (v) => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));
// device-owner currentDeviceOwner() window yokken guest döner (stub gerekmez); yalnız api-client
// stub'lanır (globalThis.__apiStub.respond yanıtı/hatayı belirler).
const stubs = {
  [path.join(APP, "lib/api-client.ts")]: path.join(__dirname, "stubs/api-client.stub.cjs"),
};

/** places-api'yi verilen respond ile yükler; __apiStub.calls çağrı yollarını tutar. */
function loadApi(respond) {
  const apiStub = { calls: [], respond };
  const api = loadTs(path.join(APP, "lib/trip/places-api.ts"), {
    stubs,
    globals: { __apiStub: apiStub, URLSearchParams },
  });
  return { api, apiStub };
}

const GALATA = {
  id: "a1",
  provider: "amazon",
  name: "Galata Kulesi",
  lat: 41.0256,
  lng: 28.9741,
  address: "Bereketzade, Beyoğlu, İstanbul",
  attribution: "Amazon Location Service",
};
const OK = (places, provider = "amazon") => ({ status: "ok", provider, places });

test("placesPath: op=places + action; değerler URL kodlanır, boş/false/undefined atılır", () => {
  const { api } = loadApi(() => OK([]));
  // search: q kodlanır, lat/lng geçer, undefined lang atılır.
  assert.equal(
    api.placesPath("search", { q: "Galata Kulesi", lat: 41.0256, lng: 28.9741, lang: undefined }),
    "/ai/chat?op=places&action=search&q=Galata+Kulesi&lat=41.0256&lng=28.9741",
  );
  // detail: reviews:true → "1", provider geçer, boş string düşer.
  assert.equal(
    api.placesPath("detail", { id: "ChIJ x", provider: "google", reviews: true, lang: "" }),
    "/ai/chat?op=places&action=detail&id=ChIJ+x&provider=google&reviews=1",
  );
  // reviews:false → tamamen atılır (false değer düşürülür).
  assert.equal(
    api.placesPath("detail", { id: "b", provider: "amazon", reviews: false }),
    "/ai/chat?op=places&action=detail&id=b&provider=amazon",
  );
  // nearby: category + radius geçer, undefined category atılır.
  assert.equal(
    api.placesPath("nearby", { lat: 41, lng: 29, radius: 500, category: undefined }),
    "/ai/chat?op=places&action=nearby&lat=41&lng=29&radius=500",
  );
  // reverse: özel karakterler kodlanır.
  assert.equal(
    api.placesPath("reverse", { lat: 41.1, lng: 29.2, lang: "tr" }),
    "/ai/chat?op=places&action=reverse&lat=41.1&lng=29.2&lang=tr",
  );
});

test("parsePlacesResponse: geçerli yer kalır, bozuk atılır (alan tamamlanmaz, I1)", () => {
  const { api } = loadApi(() => OK([]));
  const out = plain(
    api.parsePlacesResponse(
      OK([
        GALATA,
        { ...GALATA, id: "b", name: "" }, // boş ad → atılır
        { ...GALATA, id: "c", lat: "41" }, // lat sayı değil → atılır
        { ...GALATA, id: "d", provider: "osm" }, // bilinmeyen sağlayıcı → atılır
        { ...GALATA, id: "e", lng: Number.NaN }, // sonlu değil → atılır
        { ...GALATA, id: "f", attribution: undefined }, // atıf yok → atılır
        { ...GALATA, id: "g" }, // geçerli ikinci yer
      ]),
    ),
  );
  assert.deepEqual(
    out.places.map((p) => p.id),
    ["a1", "g"],
  );
  assert.equal(out.provider, "amazon");
  // provider google tanınır; bilinmeyen üst düzey provider amazon'a düşer.
  assert.equal(api.parsePlacesResponse(OK([], "google")).provider, "google");
  assert.equal(api.parsePlacesResponse(OK([], "osm")).provider, "amazon");
});

test("parsePlacesResponse: fotoğraf — geçerli http(s) korunur, bozuk atılır, hiç foto yoksa anahtar yok (B2/I1)", () => {
  const { api } = loadApi(() => OK([]));
  const out = plain(
    api.parsePlacesResponse(
      OK(
        [
          {
            ...GALATA,
            id: "g1",
            provider: "google",
            attribution: "Google",
            photos: [
              {
                url: "https://lh3.googleusercontent.com/a",
                attribution: "Ali",
                width: 800,
                height: 600,
              },
              { url: "http://ornek.test/b" }, // http da kabul
              { url: "ftp://x/c" }, // geçersiz şema → atılır
              { url: 42 }, // url string değil → atılır
              { attribution: "yok" }, // url yok → atılır
              null, // bozuk → atılır
            ],
          },
          { ...GALATA, id: "a1", photos: "nope" }, // dizi değil → photos anahtarı düşer
          { ...GALATA, id: "a2" }, // hiç foto yok → anahtar yok
        ],
        "google",
      ),
    ),
  );
  const g1 = out.places.find((p) => p.id === "g1");
  assert.equal(g1.photos.length, 2, "yalnız iki geçerli http(s) foto");
  assert.equal(g1.photos[0].url, "https://lh3.googleusercontent.com/a");
  assert.equal(g1.photos[0].attribution, "Ali");
  assert.equal(g1.photos[0].width, 800);
  assert.equal(g1.photos[1].url, "http://ornek.test/b");
  assert.equal("attribution" in g1.photos[1], false, "atıf yoksa anahtar yok");
  const a1 = out.places.find((p) => p.id === "a1");
  assert.equal("photos" in a1, false, "dizi olmayan photos düşer");
  const a2 = out.places.find((p) => p.id === "a2");
  assert.equal("photos" in a2, false, "foto yoksa anahtar yok (I1)");
});

test("parsePlacesResponse: ok olmayan/şema dışı yanıt PlacesApiError('unavailable') fırlatır", () => {
  const { api } = loadApi(() => OK([]));
  for (const bad of [
    { status: "unavailable" },
    { status: "ok" }, // places dizisi yok
    { status: "ok", places: "nope" },
    null,
    "metin",
  ]) {
    assert.throws(
      () => api.parsePlacesResponse(bad),
      (e) => e.name === "PlacesApiError" && e.kind === "unavailable",
      JSON.stringify(bad),
    );
  }
});

test("placesApi.search: gerçek boş sonuç → boş dizi (hata DEĞİL); doğru yolu çağırır", async () => {
  const { api, apiStub } = loadApi(() => OK([]));
  const res = await api.placesApi.search("  Galata  ", { near: { lat: 41, lng: 29 }, lang: "tr" });
  assert.deepEqual(plain(res), { provider: "amazon", places: [] });
  const url = new URL(apiStub.calls[0].path, "https://x");
  assert.equal(url.searchParams.get("op"), "places");
  assert.equal(url.searchParams.get("action"), "search");
  assert.equal(url.searchParams.get("q"), "Galata", "sorgu kırpılır");
  assert.equal(url.searchParams.get("lat"), "41");
  assert.equal(url.searchParams.get("lang"), "tr");
  assert.equal(apiStub.calls[0].init.timeoutMs, api.PLACES_TIMEOUT_MS);
  assert.equal(apiStub.calls[0].init.skipAuth, true, "misafirde oturumsuz (window yok → guest)");
});

test("placesApi.nearby/detail/reverse: her biri kendi action'ını çağırır", async () => {
  {
    const { api, apiStub } = loadApi(() => OK([GALATA]));
    await api.placesApi.nearby(41, 29, { radius: 800, category: "museum", lang: "en" });
    const u = new URL(apiStub.calls[0].path, "https://x");
    assert.equal(u.searchParams.get("action"), "nearby");
    assert.equal(u.searchParams.get("radius"), "800");
    assert.equal(u.searchParams.get("category"), "museum");
  }
  {
    const { api, apiStub } = loadApi(() => OK([GALATA]));
    await api.placesApi.detail("ChIJ", "google", { reviews: true });
    const u = new URL(apiStub.calls[0].path, "https://x");
    assert.equal(u.searchParams.get("action"), "detail");
    assert.equal(u.searchParams.get("reviews"), "1");
  }
  {
    const { api, apiStub } = loadApi(() => OK([GALATA]));
    await api.placesApi.reverse(41.1, 29.2, "tr");
    const u = new URL(apiStub.calls[0].path, "https://x");
    assert.equal(u.searchParams.get("action"), "reverse");
    assert.equal(u.searchParams.get("lat"), "41.1");
  }
});

test("hata eşlemesi: 429→limited, 400→invalid, 5xx→unavailable, diğer→network", async () => {
  const cases = [
    [{ status: 429, message: "çok fazla istek" }, "limited"],
    [{ status: 400, message: "geçersiz" }, "invalid"],
    [{ status: 500 }, "unavailable"],
    [{ status: 503 }, "unavailable"],
    [{ status: 401 }, "network"],
    [new TypeError("Failed to fetch"), "network"],
  ];
  for (const [thrown, kind] of cases) {
    const { api } = loadApi(() => {
      throw thrown;
    });
    await assert.rejects(
      () => api.placesApi.search("x"),
      (e) => e.name === "PlacesApiError" && e.kind === kind,
      JSON.stringify(thrown),
    );
  }
});

test("hata eşlemesi: zaten PlacesApiError ise olduğu gibi geçer (şema dışı yanıt → unavailable)", async () => {
  const { api } = loadApi(() => ({ status: "boom" }));
  await assert.rejects(
    () => api.placesApi.nearby(41, 29),
    (e) => e.name === "PlacesApiError" && e.kind === "unavailable",
  );
});
