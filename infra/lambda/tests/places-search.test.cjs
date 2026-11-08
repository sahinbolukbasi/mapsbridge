// Yer verisi proxy'si (Increment 1.5; bug 3/4/5, K2, K3). esbuild + vm harness (revenuecat
// kalıbı): DynamoDB, geo-places, Secrets Manager ve fetch stub'lanır. Gerçek sağlayıcı çağrısı yok.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

const root = path.resolve(__dirname, "../src");
const clone = (x) => JSON.parse(JSON.stringify(x));

function harness(options = {}) {
  const rows = new Map();
  const calls = { dynamo: [], geo: [], fetch: [] };
  const cmd = (n) =>
    class {
      constructor(input) {
        this.name = n;
        this.input = input;
      }
    };
  const dynamoNames = ["GetItemCommand", "PutItemCommand", "UpdateItemCommand"];
  const geoNames = [
    "SearchTextCommand",
    "GeocodeCommand",
    "ReverseGeocodeCommand",
    "GetPlaceCommand",
    "SearchNearbyCommand",
  ];
  const key = (k) => `${k.PK}|${k.SK}`;
  const external = {
    "@aws-sdk/client-dynamodb": {
      ...Object.fromEntries(dynamoNames.map((n) => [n, cmd(n)])),
      DynamoDBClient: class {
        async send(c) {
          calls.dynamo.push({ name: c.name, input: clone(c.input) });
          if (options.dynamoFail)
            throw Object.assign(new Error("db"), { name: "ServiceUnavailable" });
          if (c.name === "GetItemCommand") {
            const r = rows.get(key(c.input.Key));
            return { Item: r ? clone(r) : undefined };
          }
          if (c.name === "PutItemCommand") {
            rows.set(key(c.input.Item), clone(c.input.Item));
            return {};
          }
          const k = key(c.input.Key);
          const old = rows.get(k) || { ...c.input.Key };
          const v = c.input.ExpressionAttributeValues;
          if (old.count !== undefined && !(old.count < v[":limit"]))
            throw Object.assign(new Error("cond"), { name: "ConditionalCheckFailedException" });
          rows.set(k, {
            ...old,
            count: (old.count || 0) + v[":one"],
            ...(v[":exp"] ? { expiresAt: v[":exp"] } : {}),
          });
          return {};
        }
      },
    },
    "@aws-sdk/util-dynamodb": { marshall: (x) => x, unmarshall: (x) => x },
    "@aws-sdk/client-geo-places": {
      ...Object.fromEntries(geoNames.map((n) => [n, cmd(n)])),
      GeoPlacesClient: class {
        async send(c) {
          calls.geo.push({ name: c.name, input: clone(c.input) });
          if (options.geo) return options.geo(c);
          return { ResultItems: [] };
        }
      },
    },
    "@aws-sdk/client-secrets-manager": {
      GetSecretValueCommand: cmd("GetSecretValueCommand"),
      SecretsManagerClient: class {
        async send() {
          return { SecretString: "test-google-key" };
        }
      },
    },
  };
  const env = {
    AWS_REGION: "eu-central-1",
    DYNAMODB_TABLE: "data",
    ...options.env,
  };
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(root, file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = transformSync(readFileSync(filename, "utf8"), {
      loader: "ts",
      format: "cjs",
      target: "node22",
      supported: { "dynamic-import": false },
    }).code;
    vm.runInNewContext(
      code,
      {
        module,
        exports: module.exports,
        Buffer,
        URL,
        AbortSignal,
        console: { ...console, warn: () => {} },
        process: { env },
        fetch: async (url, init) => {
          calls.fetch.push({ url, init: clone(init) });
          return options.fetch
            ? options.fetch(url, init)
            : { ok: true, status: 200, json: async () => ({ places: [] }) };
        },
        require(spec) {
          if (spec.startsWith(".")) return load(path.resolve(path.dirname(filename), spec + ".ts"));
          if (external[spec]) return external[spec];
          if (spec.startsWith("node:")) return require(spec);
          throw new Error("Unexpected dependency: " + spec);
        },
      },
      { filename },
    );
    return module.exports;
  }
  return { load, rows, calls, env };
}

/** Saf servis testleri için bellek içi repo. */
function memoryRepo(over = {}) {
  const store = new Map();
  const counters = new Map();
  const log = [];
  return {
    log,
    store,
    counters,
    async getCache(k, now) {
      log.push(["getCache", k]);
      const row = store.get(k);
      return row && row.expiresAt > now ? row.places : null;
    },
    async putCache(k, places, expiresAt) {
      log.push(["putCache", k, expiresAt]);
      store.set(k, { places, expiresAt });
    },
    async consumeDaily(subject, day, limit) {
      const k = `${subject}|${day}`;
      const n = counters.get(k) || 0;
      if (n >= limit) return false;
      counters.set(k, n + 1);
      return true;
    },
    async consumeGoogleBudget(month, limit) {
      const k = `budget|${month}`;
      const n = counters.get(k) || 0;
      if (n >= limit) return false;
      counters.set(k, n + 1);
      return true;
    },
    async readControl() {
      return over.control || { googleEnabled: false, userDailyLimit: 300, monthlyGoogleCalls: 100 };
    },
    ...over.repo,
  };
}
function fakeProvider(id, places, opts = {}) {
  const calls = [];
  return {
    calls,
    id,
    async run(q) {
      calls.push(clone(q));
      if (opts.fail) throw opts.fail;
      return clone(places);
    },
  };
}
const PLACE = (over = {}) => ({
  id: "p1",
  provider: "amazon",
  name: "Ayasofya",
  lat: 41.0086,
  lng: 28.9802,
  address: "Sultanahmet, İstanbul",
  attribution: "Amazon Location Service",
  ...over,
});
const user = { key: "user#u1", guest: false };
const guest = { key: "ip#abc", guest: true };
const NOW = new Date("2026-11-06T10:00:00Z");

test("girdi reddi: geçersiz işlem, boş/uzun metin, konum, yarıçap, kategori → 400", async () => {
  const { load } = harness();
  const svc = load("places-search/places.service.ts");
  const deps = { repo: memoryRepo(), providers: {}, googleConfigured: false, now: () => NOW };
  for (const params of [
    {},
    { action: "drop" },
    { action: "search", q: "   " },
    { action: "search", q: "a".repeat(121) },
    { action: "search", q: "x", lat: "91", lng: "0" },
    { action: "reverse", lat: "abc", lng: "1" },
    { action: "nearby", lat: "41", lng: "29", radius: "25000" },
    { action: "nearby", lat: "41", lng: "29", category: "casino" },
    { action: "detail", id: "p1" },
    { action: "detail", id: "<script>", provider: "amazon" },
  ]) {
    const res = await svc.runPlaces(params, user, deps);
    assert.equal(res.status, 400, JSON.stringify(params));
    assert.equal(res.body.status, "invalid");
  }
});

test("misafir günlük limit aşımı → 429; sağlayıcı çağrılmaz", async () => {
  const { load } = harness();
  const svc = load("places-search/places.service.ts");
  const amazon = fakeProvider("amazon", [PLACE()]);
  const repo = memoryRepo({
    control: { googleEnabled: false, userDailyLimit: 300, monthlyGoogleCalls: 0 },
  });
  const deps = { repo, providers: { amazon }, googleConfigured: false, now: () => NOW };
  for (let i = 0; i < svc.LIMITS.guestDailyDefault; i++) {
    const r = await svc.runPlaces({ action: "search", q: `yer ${i}` }, guest, deps);
    assert.equal(r.status, 200);
  }
  const over = await svc.runPlaces({ action: "search", q: "son" }, guest, deps);
  assert.equal(over.status, 429);
  assert.equal(amazon.calls.length, svc.LIMITS.guestDailyDefault);
  // Girişli kullanıcı ayrı özne ve daha yüksek limit.
  assert.equal((await svc.runPlaces({ action: "search", q: "son" }, user, deps)).status, 200);
});

test("önbellek isabetinde sağlayıcı çağrılmaz ve kota tüketilmez", async () => {
  const { load } = harness();
  const svc = load("places-search/places.service.ts");
  const amazon = fakeProvider("amazon", [PLACE()]);
  const repo = memoryRepo();
  const deps = { repo, providers: { amazon }, googleConfigured: false, now: () => NOW };
  const first = await svc.runPlaces({ action: "search", q: "Ayasofya" }, user, deps);
  assert.equal(first.body.cached, false);
  const second = await svc.runPlaces({ action: "search", q: "Ayasofya" }, user, deps);
  assert.equal(second.status, 200);
  assert.equal(second.body.cached, true);
  assert.equal(amazon.calls.length, 1);
  assert.equal(repo.counters.get(`user#u1|20261106`), 1);
});

test("kill switch kapalı → Google çağrılmaz, Amazon'a düşer", async () => {
  const { load } = harness();
  const svc = load("places-search/places.service.ts");
  const google = fakeProvider("google", [PLACE({ provider: "google" })]);
  const amazon = fakeProvider("amazon", [PLACE()]);
  const repo = memoryRepo({
    control: { googleEnabled: false, userDailyLimit: 300, monthlyGoogleCalls: 1000 },
  });
  const res = await svc.runPlaces({ action: "search", q: "müze" }, user, {
    repo,
    providers: { google, amazon },
    googleConfigured: true,
    now: () => NOW,
  });
  assert.equal(res.body.provider, "amazon");
  assert.equal(google.calls.length, 0);
  // Google kimlikli detay da kapalıyken çağrılmaz → unavailable.
  const detail = await svc.runPlaces(
    { action: "detail", id: "ChIJ123", provider: "google" },
    user,
    { repo, providers: { google, amazon }, googleConfigured: true, now: () => NOW },
  );
  assert.equal(detail.status, 503);
  assert.equal(google.calls.length, 0);
});

test("kontrol okunamazsa Google kapalı sayılır", async () => {
  const { load } = harness({ dynamoFail: true });
  const repo = load("places-search/places.repo.ts");
  repo.resetPlacesControlCache();
  const control = await repo.placesRepo.readControl();
  assert.equal(control.googleEnabled, false);
});

test("aylık Google bütçesi aşılınca Google çağrılmaz, Amazon kullanılır", async () => {
  const { load } = harness();
  const svc = load("places-search/places.service.ts");
  const google = fakeProvider("google", [
    PLACE({ id: "g1", provider: "google", attribution: "Google" }),
  ]);
  const amazon = fakeProvider("amazon", [PLACE()]);
  const repo = memoryRepo({
    control: { googleEnabled: true, userDailyLimit: 300, monthlyGoogleCalls: 1 },
  });
  const deps = { repo, providers: { google, amazon }, googleConfigured: true, now: () => NOW };
  const a = await svc.runPlaces({ action: "search", q: "kahve" }, user, deps);
  assert.equal(a.body.provider, "google");
  const b = await svc.runPlaces({ action: "search", q: "çay" }, user, deps);
  assert.equal(b.body.provider, "amazon");
  assert.equal(google.calls.length, 1);
});

test("Google sağlayıcı: FieldMask dar küme; reviews yalnız reviews=1; anahtar istemciye dönmez", async () => {
  const seen = [];
  const { load } = harness({
    env: { GOOGLE_PLACES_SECRET_ID: "google-places-key" },
    fetch: async (url, init) => {
      seen.push({
        url,
        mask: init.headers["X-Goog-FieldMask"],
        key: init.headers["X-Goog-Api-Key"],
      });
      return {
        ok: true,
        status: 200,
        json: async () =>
          url.includes(":search")
            ? {
                places: [
                  {
                    id: "g1",
                    displayName: { text: "Kahve" },
                    location: { latitude: 41, longitude: 29 },
                  },
                ],
              }
            : {
                id: "g1",
                displayName: { text: "Kahve" },
                location: { latitude: 41, longitude: 29 },
              },
      };
    },
  });
  const { googlePlaces, SEARCH_FIELD_MASK, DETAIL_FIELD_MASK } = load(
    "places-search/providers/google-places.ts",
  );
  assert.equal(
    SEARCH_FIELD_MASK,
    "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType",
  );
  await googlePlaces.run({ op: "search", q: "kahve", lang: "tr" });
  await googlePlaces.run({
    op: "detail",
    id: "g1",
    provider: "google",
    lang: "tr",
    reviews: false,
  });
  await googlePlaces.run({ op: "detail", id: "g1", provider: "google", lang: "tr", reviews: true });
  assert.equal(seen[0].mask, SEARCH_FIELD_MASK);
  assert.ok(!/reviews|rating/.test(seen[0].mask), "arama maskesinde puan/yorum yok");
  assert.equal(seen[1].mask, DETAIL_FIELD_MASK);
  assert.ok(!seen[1].mask.includes("reviews"));
  assert.equal(seen[2].mask, `${DETAIL_FIELD_MASK},reviews`);
  assert.ok(
    seen.every((s) => s.key === "test-google-key"),
    "anahtar Secrets Manager'dan",
  );
});

test("Google ayrıntı: sınırlı fotoğraf (≤3) çözülür, atıf/boyut taşınır; arama/yakın maskesinde foto/puan yok", async () => {
  const seen = [];
  const { load } = harness({
    env: { GOOGLE_PLACES_SECRET_ID: "google-places-key" },
    fetch: async (url, init) => {
      seen.push({ url, mask: init.headers["X-Goog-FieldMask"] });
      if (url.includes("/media"))
        return {
          ok: true,
          status: 200,
          json: async () => ({ photoUri: `https://lh3.googleusercontent.com/${url.length}` }),
        };
      return {
        ok: true,
        status: 200,
        json: async () =>
          url.includes(":search") || url.includes(":searchNearby")
            ? {
                places: [
                  {
                    id: "g1",
                    displayName: { text: "Kahve" },
                    location: { latitude: 41, longitude: 29 },
                  },
                ],
              }
            : {
                id: "g1",
                displayName: { text: "Kahve" },
                location: { latitude: 41, longitude: 29 },
                rating: 4.5,
                userRatingCount: 1200,
                reviews: [{ rating: 5, text: { text: "Harika" } }],
                photos: [
                  { name: "places/g1/photos/a", widthPx: 800, heightPx: 600, authorAttributions: [{ displayName: "Ali" }] },
                  { name: "places/g1/photos/b" },
                  { name: "places/g1/photos/c" },
                  { name: "places/g1/photos/d" },
                  { name: "places/g1/photos/e" },
                ],
              },
      };
    },
  });
  const { googlePlaces, SEARCH_FIELD_MASK, DETAIL_FIELD_MASK, MAX_DETAIL_PHOTOS } = load(
    "places-search/providers/google-places.ts",
  );
  assert.equal(MAX_DETAIL_PHOTOS, 3);
  assert.ok(DETAIL_FIELD_MASK.includes("photos"), "ayrıntı maskesinde photos var");
  assert.ok(!/photos|rating|reviews/.test(SEARCH_FIELD_MASK), "arama maskesinde foto/puan/yorum yok");

  // Ayrıntı: puan + yorum + sınırlı foto döner.
  const detail = await googlePlaces.run({
    op: "detail",
    id: "g1",
    provider: "google",
    lang: "tr",
    reviews: true,
  });
  assert.equal(detail.length, 1);
  assert.equal(detail[0].rating, 4.5);
  assert.equal(detail[0].reviews.length, 1);
  assert.equal(detail[0].photos.length, MAX_DETAIL_PHOTOS, "≤3 foto çözülür");
  assert.match(detail[0].photos[0].url, /^https:\/\/lh3\.googleusercontent\.com\//);
  assert.equal(detail[0].photos[0].attribution, "Ali");
  assert.equal(detail[0].photos[0].width, 800);
  assert.equal(detail[0].photos[1].attribution, undefined, "atıf yoksa anahtar yok");
  const mediaCalls = seen.filter((s) => s.url.includes("/media"));
  assert.equal(mediaCalls.length, MAX_DETAIL_PHOTOS, "yalnız 3 foto medya isteği");

  // Arama/yakın arama: foto medya isteği YOK (SKU maliyeti).
  seen.length = 0;
  await googlePlaces.run({ op: "search", q: "kahve", lang: "tr" });
  await googlePlaces.run({ op: "nearby", lat: 41, lng: 29, radius: 800, lang: "tr" });
  assert.equal(seen.filter((s) => s.url.includes("/media")).length, 0, "arama/yakın foto çözmez");
  assert.ok(seen.every((s) => s.mask === SEARCH_FIELD_MASK), "arama/yakın dar maske");
});

test("Google ayrıntı: fotoğraf alanı yoksa photos anahtarı hiç yazılmaz (I1/I10)", async () => {
  const { load } = harness({
    env: { GOOGLE_PLACES_SECRET_ID: "google-places-key" },
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: "g1",
        displayName: { text: "Kahve" },
        location: { latitude: 41, longitude: 29 },
      }),
    }),
  });
  const { googlePlaces } = load("places-search/providers/google-places.ts");
  const [place] = await googlePlaces.run({
    op: "detail",
    id: "g1",
    provider: "google",
    lang: "tr",
    reviews: false,
  });
  assert.equal("photos" in place, false, "foto yoksa anahtar yok");
});

test("Google ayrıntısı akışı: puan+yorum+foto döner; Amazon (googleConfigured=false) hiçbirini döndürmez", async () => {
  // Google yapılandırılmış + kill switch açık: detay zenginleşir.
  const google = fakeProvider("google", [
    PLACE({
      id: "g1",
      provider: "google",
      attribution: "Google",
      rating: 4.7,
      userRatingCount: 500,
      reviews: [{ author: "Ece", rating: 5, text: "Güzel" }],
      photos: [{ url: "https://lh3.googleusercontent.com/x", attribution: "Ece", width: 800, height: 600 }],
    }),
  ]);
  const { load } = harness();
  const svc = load("places-search/places.service.ts");
  const repo = memoryRepo({
    control: { googleEnabled: true, userDailyLimit: 300, monthlyGoogleCalls: 10 },
  });
  const deps = { repo, providers: { google }, googleConfigured: true, now: () => NOW };
  const res = await svc.runPlaces(
    { action: "detail", id: "g1", provider: "google" },
    user,
    deps,
  );
  assert.equal(res.body.provider, "google");
  assert.equal(res.body.places[0].rating, 4.7);
  assert.equal(res.body.places[0].reviews.length, 1);
  assert.equal(res.body.places[0].photos.length, 1);

  // Cache isabetinde sağlayıcı tekrar çağrılmaz, zengin satır geri döner.
  const cached = await svc.runPlaces(
    { action: "detail", id: "g1", provider: "google" },
    user,
    deps,
  );
  assert.equal(cached.body.cached, true);
  assert.equal(cached.body.places[0].photos.length, 1);
  assert.equal(google.calls.length, 1, "önbellek isabetinde sağlayıcı yeniden çağrılmaz");

  // Amazon ayrıntısı (googleConfigured=false): puan/yorum/foto yok.
  const amazon = fakeProvider("amazon", [PLACE({ id: "a1", provider: "amazon" })]);
  const res2 = await svc.runPlaces(
    { action: "detail", id: "a1", provider: "amazon" },
    user,
    { repo: memoryRepo(), providers: { amazon }, googleConfigured: false, now: () => NOW },
  );
  assert.equal(res2.body.provider, "amazon");
  assert.equal(res2.body.places[0].rating, undefined);
  assert.equal(res2.body.places[0].reviews, undefined);
  assert.equal(res2.body.places[0].photos, undefined, "Amazon foto döndürmez");
});

test("K3: foto taşıyan Google satırı hâlâ Google kaynaklı sayılır (korpusa alınmaz)", async () => {
  const { load } = harness();
  const { isGoogleDerived } = load("places-search/google-content.ts");
  assert.equal(
    isGoogleDerived({
      provider: "google",
      name: "Kahve",
      photos: [{ url: "https://lh3.googleusercontent.com/x", attribution: "Ece" }],
    }),
    true,
  );
});

test("Google önbellek satırı ≤ 24 saat; Amazon ≤ 7 gün", async () => {
  const { load } = harness();
  const svc = load("places-search/places.service.ts");
  const now = Math.floor(NOW.getTime() / 1000);
  assert.ok(svc.cacheExpiresAt("google", now) <= now + 24 * 3600);
  assert.ok(svc.cacheExpiresAt("google", now) <= now + 30 * 86400, "lat/lng sınırı 30 gün");
  assert.ok(svc.cacheExpiresAt("amazon", now) <= now + 7 * 86400);
  const google = fakeProvider("google", [
    PLACE({ id: "g1", provider: "google", attribution: "Google" }),
  ]);
  const repo = memoryRepo({
    control: { googleEnabled: true, userDailyLimit: 300, monthlyGoogleCalls: 10 },
  });
  await svc.runPlaces({ action: "search", q: "kahve" }, user, {
    repo,
    providers: { google },
    googleConfigured: true,
    now: () => NOW,
  });
  const put = repo.log.find((l) => l[0] === "putCache");
  assert.match(put[1], /^PLACECACHE#google#[a-f0-9]{64}$/);
  assert.ok(put[2] <= now + 24 * 3600);
});

test("repo: önbellek satırı PLACECACHE#…/META + expiresAt; süresi geçen isabet sayılmaz; kota ADD koşullu", async () => {
  const { load, rows, calls } = harness();
  const { placesRepo } = load("places-search/places.repo.ts");
  await placesRepo.putCache("PLACECACHE#amazon#x", [PLACE()], 100);
  assert.deepEqual(Object.keys(rows.get("PLACECACHE#amazon#x|META")).sort(), [
    "PK",
    "SK",
    "expiresAt",
    "places",
  ]);
  assert.equal(await placesRepo.getCache("PLACECACHE#amazon#x", 200), null, "süresi geçmiş");
  assert.equal((await placesRepo.getCache("PLACECACHE#amazon#x", 50)).length, 1);
  assert.equal(await placesRepo.consumeDaily("ip#a", "20261106", 2), true);
  assert.equal(await placesRepo.consumeDaily("ip#a", "20261106", 2), true);
  assert.equal(await placesRepo.consumeDaily("ip#a", "20261106", 2), false);
  const upd = calls.dynamo.find((c) => c.name === "UpdateItemCommand");
  assert.equal(upd.input.Key.PK, "PLACES_QUOTA#ip#a");
  assert.match(upd.input.ConditionExpression, /#count < :limit/);
  assert.ok(rows.get("PLACES_QUOTA#ip#a|20261106").expiresAt > Date.now() / 1000);
});

test("kaynakta olmayan alan çıktıda anahtar olarak da yok (I1/I10)", async () => {
  const { load } = harness({
    geo: () => ({
      ResultItems: [
        { PlaceId: "a1", Title: "Galata Kulesi", Position: [28.9741, 41.0256] },
        { PlaceId: "a2", Title: "", Position: [28.9, 41.0] },
        { PlaceId: "a3", Title: "Konumsuz" },
      ],
    }),
  });
  const svc = load("places-search/places.service.ts");
  const { amazonLocation } = load("places-search/providers/amazon-location.ts");
  const res = await svc.runPlaces({ action: "search", q: "galata" }, user, {
    repo: memoryRepo(),
    providers: { amazon: amazonLocation },
    googleConfigured: false,
    now: () => NOW,
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.places.length, 1, "adsız / konumsuz sonuç atılır");
  assert.deepEqual(Object.keys(res.body.places[0]).sort(), [
    "attribution",
    "id",
    "lat",
    "lng",
    "name",
    "provider",
  ]);
  assert.equal(res.body.places[0].lat, 41.0256);
  assert.equal(res.body.places[0].lng, 28.9741);
});

test("Amazon AccessDenied → 503 unavailable; uydurma sonuç yok", async () => {
  const { load } = harness({
    geo: () => {
      throw Object.assign(new Error("denied"), { name: "AccessDeniedException" });
    },
  });
  const svc = load("places-search/places.service.ts");
  const { amazonLocation } = load("places-search/providers/amazon-location.ts");
  const res = await svc.runPlaces({ action: "reverse", lat: "41", lng: "29" }, user, {
    repo: memoryRepo(),
    providers: { amazon: amazonLocation },
    googleConfigured: false,
    now: () => NOW,
  });
  assert.equal(res.status, 503);
  assert.deepEqual(Object.keys(res.body).sort(), ["error", "status"]);
  assert.equal(res.body.status, "unavailable");
});

test("kategorili keşif bugünkü IAM'le SearchText kullanır (Filter.Circle); kategorisiz SearchNearby", async () => {
  const { load, calls } = harness();
  const { amazonLocation } = load("places-search/providers/amazon-location.ts");
  await amazonLocation.run({
    op: "nearby",
    lat: 41,
    lng: 29,
    radius: 1500,
    lang: "tr",
    category: "museum",
  });
  await amazonLocation.run({ op: "nearby", lat: 41, lng: 29, radius: 1500, lang: "tr" });
  assert.equal(calls.geo[0].name, "SearchTextCommand");
  assert.deepEqual(calls.geo[0].input.Filter.Circle, { Center: [29, 41], Radius: 1500 });
  assert.equal(calls.geo[0].input.QueryText, "museum");
  assert.equal(calls.geo[1].name, "SearchNearbyCommand");
});

test("handler: misafir öznesi hash'li IP (ham IP yazılmaz); ai/index dağıtımı 401'den önce", async () => {
  const { load } = harness();
  const { guestSubject, handlePlacesRequest } = load("places-search/handler.ts");
  const s = guestSubject("203.0.113.7");
  assert.match(s, /^ip#[a-f0-9]{32}$/);
  assert.ok(!s.includes("203.0.113.7"));
  const repo = memoryRepo();
  const res = await handlePlacesRequest(
    {
      queryStringParameters: { op: "places", action: "search", q: "Kadıköy" },
      requestContext: { http: { sourceIp: "203.0.113.7" } },
    },
    null,
    { repo, providers: { amazon: fakeProvider("amazon", [PLACE()]) }, googleConfigured: false },
  );
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).places[0].name, "Ayasofya");
  assert.ok([...repo.counters.keys()][0].startsWith(s));
  const src = readFileSync(path.join(root, "ai/index.ts"), "utf8");
  const dispatch = src.indexOf('op === "places"');
  const unauthorized = src.indexOf("if (!user) return reply(401");
  assert.ok(dispatch > 0 && dispatch < unauthorized, "places dağıtımı 401'den önce");
  assert.ok(!/reserveAI\([^)]*places/.test(src), "places yolu kredi rezervasyonu yapmaz");
});

test("K3: isGoogleDerived Google içeriğini ve yer önbelleği anahtarlarını yakalar", async () => {
  const { load } = harness();
  const { isGoogleDerived } = load("places-search/google-content.ts");
  assert.equal(isGoogleDerived({ places: [{ provider: "google", name: "X" }] }), true);
  assert.equal(isGoogleDerived({ PK: "PLACECACHE#amazon#abc" }), true);
  assert.equal(isGoogleDerived({ PK: "PLACEID#ChIJ" }), true);
  assert.equal(isGoogleDerived({ prompt: "Roma 3 gün", provider: "amazon" }), false);
  assert.equal(isGoogleDerived("Google Haritalar'da gördüğüm yer"), false, "salt kelime yetmez");
});

// ── Sağlayıcı dalları (en küçük birim): her işlem doğru geo-places komutuna, doğru girdiyle ──
const SEARCH = { op: "search", q: "Galata Kulesi", lang: "tr" };
test("search konumsuz: önce Geocode (konum istemez), SearchText Geocode konumuna yönlenir", async () => {
  const { load, calls } = harness({
    geo: (c) =>
      c.name === "GeocodeCommand"
        ? { ResultItems: [{ PlaceId: "g1", Title: "Galata", Position: [28.977, 41.0267] }] }
        : {
            ResultItems: [{ PlaceId: "s1", Title: "Galata Kulesi", Position: [28.9741, 41.0256] }],
          },
  });
  const { amazonLocation } = load("places-search/providers/amazon-location.ts");
  const out = await amazonLocation.run(SEARCH);
  assert.deepEqual(
    calls.geo.map((c) => c.name),
    ["GeocodeCommand", "SearchTextCommand"],
  );
  assert.equal(calls.geo[0].input.QueryText, "Galata Kulesi");
  assert.equal(calls.geo[0].input.BiasPosition, undefined, "Geocode konum almaz");
  assert.deepEqual(calls.geo[1].input.BiasPosition, [28.977, 41.0267], "[lng, lat]");
  assert.equal(calls.geo[1].input.Filter, undefined, "BiasPosition ile Filter birlikte yok");
  assert.equal(out[0].name, "Galata Kulesi");
});
test("search konumlu: yalnız SearchText + BiasPosition [lng, lat]; Geocode çağrılmaz", async () => {
  const { load, calls } = harness();
  const { amazonLocation } = load("places-search/providers/amazon-location.ts");
  await amazonLocation.run({ ...SEARCH, near: [41.0086, 28.9802] });
  assert.deepEqual(
    calls.geo.map((c) => c.name),
    ["SearchTextCommand"],
  );
  assert.deepEqual(calls.geo[0].input.BiasPosition, [28.9802, 41.0086]);
});
test("search konumsuz: Geocode boşsa SearchText çağrılmaz, boş liste (uydurma yok)", async () => {
  const { load, calls } = harness({ geo: () => ({ ResultItems: [] }) });
  const { amazonLocation } = load("places-search/providers/amazon-location.ts");
  assert.deepEqual(await amazonLocation.run(SEARCH), []);
  assert.deepEqual(
    calls.geo.map((c) => c.name),
    ["GeocodeCommand"],
  );
});
test("search konumsuz: SearchText boşsa Geocode sonucu döner", async () => {
  const { load } = harness({
    geo: (c) =>
      c.name === "GeocodeCommand"
        ? { ResultItems: [{ PlaceId: "g1", Title: "Galata", Position: [28.977, 41.0267] }] }
        : { ResultItems: [] },
  });
  const { amazonLocation } = load("places-search/providers/amazon-location.ts");
  const out = await amazonLocation.run(SEARCH);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "g1");
});
test("search kategorili: sorgu metni kategori terimiyle başlar, 150 karakterle kesilir", async () => {
  const { load, calls } = harness();
  const { amazonLocation } = load("places-search/providers/amazon-location.ts");
  await amazonLocation.run({
    op: "search",
    q: "x".repeat(300),
    lang: "en",
    category: "museum",
    near: [41, 29],
  });
  assert.equal(calls.geo[0].input.QueryText.length, 150);
  assert.ok(calls.geo[0].input.QueryText.startsWith("museum "));
  assert.equal(calls.geo[0].input.Language, "en");
});
test("reverse: ReverseGeocode QueryPosition [lng, lat], MaxResults 1", async () => {
  const { load, calls } = harness();
  const { amazonLocation } = load("places-search/providers/amazon-location.ts");
  await amazonLocation.run({ op: "reverse", lat: 41.0256, lng: 28.9742, lang: "tr" });
  assert.equal(calls.geo[0].name, "ReverseGeocodeCommand");
  assert.deepEqual(calls.geo[0].input.QueryPosition, [28.9742, 41.0256]);
  assert.equal(calls.geo[0].input.MaxResults, 1);
});
test("detail: GetPlace PlaceId + Contact; tek sonuç", async () => {
  const { load, calls } = harness({
    geo: () => ({ PlaceId: "d1", Title: "Galata Kulesi", Position: [28.9741, 41.0256] }),
  });
  const { amazonLocation } = load("places-search/providers/amazon-location.ts");
  const out = await amazonLocation.run({
    op: "detail",
    id: "d1",
    provider: "amazon",
    lang: "tr",
    reviews: false,
  });
  assert.equal(calls.geo[0].name, "GetPlaceCommand");
  assert.equal(calls.geo[0].input.PlaceId, "d1");
  assert.deepEqual(calls.geo[0].input.AdditionalFeatures, ["Contact"]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "Galata Kulesi");
});
test("nearby kategorisiz: SearchNearby QueryPosition [lng, lat] + QueryRadius", async () => {
  const { load, calls } = harness();
  const { amazonLocation } = load("places-search/providers/amazon-location.ts");
  await amazonLocation.run({ op: "nearby", lat: 41.0256, lng: 28.9742, radius: 500, lang: "tr" });
  assert.equal(calls.geo[0].name, "SearchNearbyCommand");
  assert.deepEqual(calls.geo[0].input.QueryPosition, [28.9742, 41.0256]);
  assert.equal(calls.geo[0].input.QueryRadius, 500);
});
test("fromAmazon: birincil kategori, saatler, telefon, web; olmayan alan undefined (I1)", async () => {
  const { load } = harness();
  const { fromAmazon } = load("places-search/providers/amazon-location.ts");
  const full = fromAmazon({
    PlaceId: "a",
    Title: "Müze",
    Position: [29, 41],
    Address: { Label: "Adres" },
    Categories: [
      { Name: "Other", LocalizedName: "Diğer" },
      { Name: "Museum", LocalizedName: "Müze", Primary: true },
    ],
    OpeningHours: [{ Display: ["Pzt-Cum 09:00-17:00"] }, { Display: [] }],
    Contacts: { Phones: [{ Value: "+90 212" }], Websites: [{ Value: "https://ornek.test" }] },
  });
  assert.equal(full.category, "Müze");
  assert.deepEqual(full.openingHours, ["Pzt-Cum 09:00-17:00"]);
  assert.equal(full.phone, "+90 212");
  assert.equal(full.website, "https://ornek.test");
  assert.equal(full.lat, 41);
  assert.equal(full.lng, 29);
  const bare = fromAmazon({ PlaceId: "b", Title: "Yer" });
  for (const k of ["lat", "lng", "address", "category", "openingHours", "phone", "website"])
    assert.equal(bare[k], undefined, k);
});
test("sağlayıcı hata eşlemesi: zaman aşımı / doğrulama → unavailable (503), sonuç uydurulmaz", async () => {
  for (const name of ["TimeoutError", "ValidationException"]) {
    const { load } = harness({
      geo: () => {
        throw Object.assign(new Error(name), { name });
      },
    });
    const svc = load("places-search/places.service.ts");
    const { amazonLocation } = load("places-search/providers/amazon-location.ts");
    const res = await svc.runPlaces({ action: "search", q: "Galata" }, user, {
      repo: memoryRepo(),
      providers: { amazon: amazonLocation },
      googleConfigured: false,
      now: () => NOW,
    });
    assert.equal(res.status, 503, name);
    assert.equal(res.body.status, "unavailable");
    assert.equal(res.body.places, undefined);
  }
});
test("handler: girişli kullanıcı kotası user#<sub> anahtarıyla sayılır", async () => {
  const { load } = harness();
  const { handlePlacesRequest } = load("places-search/handler.ts");
  const repo = memoryRepo();
  const res = await handlePlacesRequest(
    { queryStringParameters: { op: "places", action: "reverse", lat: "41", lng: "29" } },
    { sub: "u-42" },
    { repo, providers: { amazon: fakeProvider("amazon", [PLACE()]) }, googleConfigured: false },
  );
  assert.equal(res.statusCode, 200);
  assert.ok([...repo.counters.keys()][0].startsWith("user#u-42|"));
});
