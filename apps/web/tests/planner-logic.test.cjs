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
  // Karar S19: optimize ücretsiz istemci 2-opt'tur; kredi rozeti ve misafir kapısı yok.
  assert.doesNotMatch(src, /cost=\{/);
  const optimize = src.slice(src.indexOf("const optimize = () =>"));
  assert.doesNotMatch(optimize.slice(0, optimize.indexOf("\n  };\n")), /setGate/);
});
// ── Hesap yalıtımı (FEAT-007 review #1; KVKK): cihaz kaydı başka hesaba/misafire geçmez ──
const S = loadTs(path.join(APP, "lib/trip/planner-store.ts"));
test("planner-store: sahip e-posta ya da guest; başka hesabın kaydı kullanılamaz", () => {
  assert.equal(S.plannerOwner(null), "guest");
  assert.equal(S.plannerOwner({ token: "t", email: " A@Example.com " }), "a@example.com");
  assert.equal(S.plannerOwner({ token: "", email: "a@example.com" }), "guest");
  assert.equal(S.plannerOwner({ token: "t", email: "" }), "guest");
  // aynı sahip
  assert.equal(S.canUsePlannerStore("a@example.com", "a@example.com"), true);
  assert.equal(S.canUsePlannerStore("guest", "guest"), true);
  // misafir taslağı girişte hesaba geçebilir (§6.3)
  assert.equal(S.canUsePlannerStore("guest", "b@example.com"), true);
  // başka hesap: ne misafir ne başka hesap görür
  assert.equal(S.canUsePlannerStore("a@example.com", "guest"), false);
  assert.equal(S.canUsePlannerStore("a@example.com", "b@example.com"), false);
  // işaretsiz eski kayıt (FEAT-007 öncesi yalnız oturumlu yazardı): misafire gösterilmez
  assert.equal(S.canUsePlannerStore(null, "guest"), false);
  assert.equal(S.canUsePlannerStore(null, "a@example.com"), true);
});
test("planner-store: girişte yalnız misafirken oluşturulmuş, duraklı, sunucuda olmayan taslaklar aktarılır", () => {
  const trips = [
    { id: "trip-1", origin: "guest", pins: [{}] },
    { id: "trip-2", origin: "guest", pins: [] },
    { id: "trip-3", origin: "user", pins: [{}] },
    { id: "trip-4", pins: [{}] },
    { id: "route-9", origin: "guest", pins: [{}] },
  ];
  const out = plain(S.guestDraftsForTransfer(trips));
  assert.deepEqual(
    out.map((t) => [t.id, t.origin]),
    [["trip-1", "user"]],
  );
});
test("planner-store: çıkış kaydı siler; planlayıcı anahtarlarına yalnız planner-store dokunur", () => {
  const cognito = fs.readFileSync(path.join(APP, "lib/cognito.ts"), "utf8");
  const signOut = cognito.slice(cognito.indexOf("export function signOut"));
  assert.match(signOut.slice(0, signOut.indexOf("\n}\n")), /clearPlannerStore\(\)/);
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name) && !p.endsWith(path.join("trip", "planner-store.ts"))) {
        if (/travelPlanner\.v5|generalPins\.v5/.test(fs.readFileSync(p, "utf8"))) offenders.push(p);
      }
    }
  };
  walk(APP);
  assert.deepEqual(offenders, []);
});
test("planner-store: A'nın kaydı misafire okunmaz, misafir yazımı önce A'nın kaydını siler", () => {
  const data = new Map();
  const localStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
  const M = loadTs(path.join(APP, "lib/trip/planner-store.ts"), {
    globals: { window: {}, localStorage },
  });
  // A oturumlu yazar
  localStorage.setItem("mapsbridge.accessToken", "t");
  localStorage.setItem("mapsbridge.userEmail", "a@example.com");
  assert.equal(M.writePlannerStore(M.PLANNER_TRIPS_KEY, "[A]"), true);
  assert.equal(M.writePlannerStore(M.PLANNER_GENERAL_PINS_KEY, "[pool-A]"), true);
  assert.equal(M.readPlannerStore(M.PLANNER_TRIPS_KEY), "[A]");
  // oturum düşer (çıkış çağrılmadan): misafir A'yı göremez
  localStorage.removeItem("mapsbridge.accessToken");
  assert.equal(M.readPlannerStore(M.PLANNER_TRIPS_KEY), null);
  // misafir yazınca A'nın tüm kaydı silinir, sahip guest olur
  assert.equal(M.writePlannerStore(M.PLANNER_TRIPS_KEY, "[G]"), true);
  assert.equal(data.get(M.PLANNER_GENERAL_PINS_KEY), undefined);
  assert.equal(data.get(M.PLANNER_OWNER_KEY), "guest");
  // B girişi: misafir taslağını görür (aktarım için)
  localStorage.setItem("mapsbridge.accessToken", "t2");
  localStorage.setItem("mapsbridge.userEmail", "b@example.com");
  assert.equal(M.readPlannerStore(M.PLANNER_TRIPS_KEY), "[G]");
  M.clearPlannerStore();
  assert.equal(data.get(M.PLANNER_TRIPS_KEY), undefined);
  assert.equal(data.get(M.PLANNER_OWNER_KEY), undefined);
  // depolama hatası → false ("Cihazda kayıtlı" rozeti gizlenir)
  localStorage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  assert.equal(M.writePlannerStore(M.PLANNER_TRIPS_KEY, "[x]"), false);
});
// ── Hesap değişimi regresyonu (çıkış yapmadan A → B; kullanıcı kararı, FEAT-007 BLOCKING) ──
function memStorage() {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}
function signIn(ls, email) {
  ls.setItem("mapsbridge.accessToken", `t-${email}`);
  ls.setItem("mapsbridge.userEmail", email);
}
test("hesap değişimi: A'nın gezileri/taslakları B'ye görünmez ve B'ye aktarılmaz", () => {
  const ls = memStorage();
  const M = loadTs(path.join(APP, "lib/trip/planner-store.ts"), {
    globals: { window: {}, localStorage: ls },
  });
  signIn(ls, "a@example.com");
  const aTrips = [{ id: "trip-a1", origin: "user", pins: [{ label: "A'nın evi" }] }];
  assert.equal(M.writePlannerStore(M.PLANNER_TRIPS_KEY, JSON.stringify(aTrips)), true);
  // çıkış yapmadan B girer
  signIn(ls, "b@example.com");
  assert.equal(M.readPlannerStore(M.PLANNER_TRIPS_KEY), null);
  assert.equal(M.readPlannerStore(M.PLANNER_GENERAL_PINS_KEY), null);
  // B'nin ilk yazımı A'nın kaydını tamamen siler
  assert.equal(M.writePlannerStore(M.PLANNER_TRIPS_KEY, "[]"), true);
  assert.equal(ls.getItem(M.PLANNER_TRIPS_KEY), "[]");
  assert.equal(ls.getItem(M.PLANNER_OWNER_KEY), "b@example.com");
  // A geri dönünce B'nin kaydını görmez
  signIn(ls, "a@example.com");
  assert.equal(M.readPlannerStore(M.PLANNER_TRIPS_KEY), null);
  // A hesabındayken oluşturulan "trip-…" taslağı (origin user) hiçbir girişte aktarılmaz
  assert.deepEqual(plain(M.guestDraftsForTransfer(aTrips)), []);
});
test("misafir → kendi hesabı: taslak tek hesaba geçer; sahiplenen hesaptan sonra başka hesap göremez", () => {
  const ls = memStorage();
  const M = loadTs(path.join(APP, "lib/trip/planner-store.ts"), {
    globals: { window: {}, localStorage: ls },
  });
  const guestTrips = [{ id: "trip-g1", origin: "guest", pins: [{}] }];
  assert.equal(M.writePlannerStore(M.PLANNER_TRIPS_KEY, JSON.stringify(guestTrips)), true);
  assert.equal(ls.getItem(M.PLANNER_OWNER_KEY), "guest");
  signIn(ls, "new@example.com");
  assert.equal(M.readPlannerStore(M.PLANNER_TRIPS_KEY), JSON.stringify(guestTrips));
  // use-travel-planner kalıcılık effect'i okuduktan hemen sonra yazar → sahip yeni hesap
  const moved = M.guestDraftsForTransfer(guestTrips);
  assert.equal(M.writePlannerStore(M.PLANNER_TRIPS_KEY, JSON.stringify(moved)), true);
  assert.equal(ls.getItem(M.PLANNER_OWNER_KEY), "new@example.com");
  signIn(ls, "other@example.com");
  assert.equal(M.readPlannerStore(M.PLANNER_TRIPS_KEY), null);
});
test("asistan misafir taslağı (?resume=1): ilk açan hesap sahiplenir; başka hesap ve misafir göremez", () => {
  const ls = memStorage();
  const globals = { window: {}, localStorage: ls };
  const D = loadTs(path.join(APP, "lib/guest/guest-draft-owner.ts"), { globals });
  const store = D.ownedDraftStorage(ls);
  const KEY = "mapsbridge.guestDraft.v1";
  // misafir yazar
  store.setItem(KEY, '{"q":"Roma"}');
  assert.equal(ls.getItem(D.GUEST_DRAFT_OWNER_KEY), "guest");
  // A girer, ?resume=1 okur → sahiplenir
  signIn(ls, "a@example.com");
  assert.equal(store.getItem(KEY), '{"q":"Roma"}');
  assert.equal(ls.getItem(D.GUEST_DRAFT_OWNER_KEY), "a@example.com");
  // çıkış yapmadan B girer → göremez
  signIn(ls, "b@example.com");
  assert.equal(store.getItem(KEY), null);
  // oturum düşer → misafir de göremez
  ls.removeItem("mapsbridge.accessToken");
  assert.equal(store.getItem(KEY), null);
  // misafir yeni taslak yazınca sahiplik bırakılır
  store.setItem(KEY, '{"q":"Lizbon"}');
  assert.equal(ls.getItem(D.GUEST_DRAFT_OWNER_KEY), "guest");
  store.removeItem(KEY);
  assert.equal(ls.getItem(KEY), null);
  assert.equal(ls.getItem(D.GUEST_DRAFT_OWNER_KEY), null);
  // çıkış misafir taslağını da siler
  const cognito = fs.readFileSync(path.join(APP, "lib/cognito.ts"), "utf8");
  assert.match(cognito, /clearGuestDraftStore\(\)/);
  const guest = fs.readFileSync(path.join(APP, "travel-assistant/guest-assistant.tsx"), "utf8");
  assert.match(guest, /ownedDraftStorage\(window\.localStorage\)/);
});
test("başka sekmede kimlik değişirse bellekteki geziler yazılmaz (expectedOwner)", () => {
  const ls = memStorage();
  const M = loadTs(path.join(APP, "lib/trip/planner-store.ts"), {
    globals: { window: {}, localStorage: ls },
  });
  signIn(ls, "a@example.com");
  assert.equal(M.writePlannerStore(M.PLANNER_TRIPS_KEY, "[A]", "a@example.com"), true);
  signIn(ls, "b@example.com");
  assert.equal(M.writePlannerStore(M.PLANNER_TRIPS_KEY, "[A-bellek]", "a@example.com"), false);
  assert.equal(ls.getItem(M.PLANNER_TRIPS_KEY), "[A]");
  const hook = fs.readFileSync(path.join(APP, "lib/trip/use-travel-planner.ts"), "utf8");
  assert.match(hook, /!session\?\.token \|\| !sameOwner\(\)/);
});
