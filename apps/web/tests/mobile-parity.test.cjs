// Web ↔ mobil parite (design §9, plan D3, FEAT-011). Mobil @mapsbridge/contracts'a ve web'e
// bağımlı değildir (workspace'ler arası relative import yasak); gösterim verisi ve saf mantık
// kopyadır. Bu test kopyaların web kaynağıyla aynı kaldığını doğrular: kredi tablosu, plan
// kredileri, misafir soru seti, I3 kırpma kuralları, seçim/snap mantığı, TR metinler (web
// tr.json değerleri) ve sekme öğeleri. Ayrıca sekme yığını reducer'ının geri sırası (design §12.1).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

const ROOT = path.resolve(__dirname, "../../..");
const WEB = path.join(ROOT, "apps/web/app");
const MOBILE = path.join(ROOT, "apps/mobile/src");
const TR = JSON.parse(fs.readFileSync(path.join(WEB, "locales/tr.json"), "utf8"));
const quiet = { ...console, warn: () => {} };
const stubs = {
  [path.join(WEB, "lib/api-client.ts")]: path.join(__dirname, "stubs/api-client.stub.cjs"),
};
const webGlobals = {
  process: { env: { NODE_ENV: "test" } },
  console: quiet,
  AbortController,
  URLSearchParams,
};

const webCosts = loadTs(path.join(WEB, "lib/billing/credit-costs.ts"));
const webCatalog = loadTs(path.join(WEB, "lib/billing/catalog.ts"), { stubs, globals: webGlobals });
const webGuest = loadTs(path.join(WEB, "lib/guest/guest-script.ts"));
const webLimits = loadTs(path.join(WEB, "components/assistant/logic/question-limits.ts"), {
  globals: webGlobals,
});
const webChoice = loadTs(path.join(WEB, "components/ui/logic/choice.ts"));
const webSheet = loadTs(path.join(WEB, "components/ui/logic/sheet-snap.ts"));

const mobileCosts = loadTs(path.join(MOBILE, "billing/credit-costs.ts"));
const mobilePlans = loadTs(path.join(MOBILE, "billing/plans.ts"));
const mobileGuest = loadTs(path.join(MOBILE, "guest/guest-script.ts"));
const mobileLimits = loadTs(path.join(MOBILE, "ui/logic/question-limits.ts"), {
  globals: { console: quiet, __DEV__: true },
});
const mobileChoice = loadTs(path.join(MOBILE, "ui/logic/choice.ts"));
const mobileSheet = loadTs(path.join(MOBILE, "ui/logic/sheet-snap.ts"));
const mobileFormat = loadTs(path.join(MOBILE, "ui/logic/trip-format.ts"));
const mobileUi = loadTs(path.join(MOBILE, "i18n/ui.ts"));
const mobileTabs = loadTs(path.join(MOBILE, "navigation/tab-items.ts"));
const nav = loadTs(path.join(MOBILE, "navigation/tab-stack.ts"));

const plain = (v) => JSON.parse(JSON.stringify(v));

test("kredi tablosu: aynı satırlar, maliyetler ve hoş geldin kredisi; etiketler web tr.json", () => {
  const strip = (rows) => rows.map(({ action, labelKey, cost }) => ({ action, labelKey, cost }));
  assert.deepEqual(
    plain(strip(mobileCosts.CREDIT_COST_ROWS)),
    plain(strip(webCosts.CREDIT_COST_ROWS)),
  );
  assert.equal(mobileCosts.WELCOME_CREDITS_DISPLAY, webCosts.WELCOME_CREDITS_DISPLAY);
  for (const row of mobileCosts.CREDIT_COST_ROWS)
    assert.equal(row.label, TR[row.labelKey], `${row.action} etiketi tr.json'dan farklı`);
  // Web CostBadge formatı (credits.free / credits.one / credits.other).
  const t = (k) => TR[k];
  for (const cost of ["free", 1, 2, 5]) {
    const web =
      cost === "free"
        ? t("credits.free")
        : t(cost === 1 ? "credits.one" : "credits.other").replace("{n}", String(cost));
    assert.equal(mobileCosts.formatCreditCost(cost), web);
  }
});

test("plan kartı: tier'ler, krediler, '≈' türetmesi ve fiyat biçimi web ile aynı", () => {
  const web = webCatalog.planInfos().map(({ tier, credits, kind }) => ({ tier, credits, kind }));
  const mobile = mobilePlans.PLAN_TIERS.map((tier) => ({
    tier,
    ...mobilePlans.PLAN_CREDITS[tier],
  }));
  assert.deepEqual(plain(mobile), plain(web));
  for (const n of [0, 1, 5, 100, 500, 2500, 5500, -3, Number.NaN])
    assert.deepEqual(
      plain(mobilePlans.derivePlanEquivalents(n)),
      plain(webCatalog.derivePlanEquivalents(n)),
      `≈ ${n}`,
    );
  for (const amount of [0, 50, 9999, 10000, 129900, 123450, 100000000])
    assert.equal(
      mobilePlans.formatPrice(amount),
      webCatalog.formatPrice(amount, "tr"),
      `fiyat ${amount}`,
    );
  assert.equal(mobilePlans.groupThousands(2500), (2500).toLocaleString("tr-TR"));
});

test("misafir soru seti: aynı turlar, kimlikler, modlar, sınırlar; metinler web tr.json", () => {
  const shape = (turns) =>
    turns.map((t) => ({
      turn: t.turn,
      questions: t.questions.map((q) => ({
        id: q.id,
        textKey: q.textKey,
        mode: q.mode,
        max: q.max,
        options: q.options.map((o) => ({ id: o.id, labelKey: o.labelKey })),
      })),
    }));
  assert.deepEqual(plain(shape(mobileGuest.GUEST_TURNS)), plain(shape(webGuest.GUEST_TURNS)));
  assert.equal(mobileGuest.INTERESTS_MAX, webGuest.INTERESTS_MAX);
  assert.equal(mobileGuest.DATE_RANGE_MAX_DAYS, webGuest.DATE_RANGE_MAX_DAYS);
  for (const turn of mobileGuest.GUEST_TURNS)
    for (const q of turn.questions) {
      assert.equal(q.text, TR[q.textKey], `${q.id} soru metni`);
      for (const o of q.options) assert.equal(o.label, TR[o.labelKey], `${q.id}/${o.id} etiketi`);
    }
  const inputs = [
    {},
    {
      duration: "3d",
      character: "food-drink",
      pace: "calm",
      interests: ["museums", "x", "museums"],
    },
    { duration: "pick-dates", character: "nope" },
    {
      duration: { from: "2030-01-01", to: "2030-01-05" },
      interests: ["markets", "viewpoints", "local-food", "museums"],
    },
    { duration: { from: "2030-01-10", to: "2030-01-01" } },
    null,
    [],
  ];
  for (const input of inputs) {
    assert.deepEqual(
      plain(mobileGuest.sanitizeAnswers(input)),
      plain(webGuest.sanitizeAnswers(input)),
    );
    const clean = webGuest.sanitizeAnswers(input);
    assert.equal(mobileGuest.nextTurn(clean), webGuest.nextTurn(clean));
  }
  for (const [a, b, today] of [
    ["2030-01-01", "2030-01-30", "2029-12-31"],
    ["2030-01-01", "2030-01-31", undefined],
    ["2030-01-05", "2030-01-01", undefined],
    ["2020-01-01", "2020-01-02", "2025-01-01"],
    ["bad", "2030-01-01", undefined],
  ])
    assert.equal(
      mobileGuest.validateDateRange(a, b, today),
      webGuest.validateDateRange(a, b, today),
    );
});

test("QuestionCard I3 kırpması (≤2 soru, 2–4 seçenek) web question-limits ile aynı", () => {
  const o = (n) => Array.from({ length: n }, (_, i) => ({ id: `o${i}`, label: `S${i}` }));
  const fixtures = [
    [],
    null,
    [{ id: "a", text: "A", mode: "single", options: o(1) }],
    [{ id: "a", text: "A", mode: "single", options: o(6) }],
    [
      { id: "a", text: "A", mode: "single", options: o(2) },
      { id: "b", text: "B", mode: "multi", max: 9, options: o(4) },
      { id: "c", text: "C", mode: "single", options: o(3) },
    ],
  ];
  for (const f of fixtures) {
    const web = webLimits.clampQuestions(f);
    const mobile = mobileLimits.clampQuestions(f);
    assert.deepEqual(plain(mobile), plain(web));
    assert.ok(mobile.questions.length <= 2);
    for (const q of mobile.questions) assert.ok(q.options.length >= 2 && q.options.length <= 4);
  }
  const qs = [{ id: "a", text: "A", mode: "single", options: o(2) }];
  assert.deepEqual(
    plain(mobileLimits.answerLabels(qs, { a: ["o1"] })),
    plain(webLimits.answerLabels(qs, { a: ["o1"] })),
  );
  assert.equal(mobileLimits.allAnswered(qs, {}), webLimits.allAnswered(qs, {}));
});

test("seçim ve BottomSheet snap mantığı web ile aynı", () => {
  for (const [sel, v, mode, max] of [
    [[], "a", "single", undefined],
    [["a"], "b", "single", undefined],
    [["a", "b"], "c", "multi", 2],
    [["a"], "a", "multi", 2],
  ])
    assert.deepEqual(
      plain(mobileChoice.toggleChoice(sel, v, mode, max)),
      plain(webChoice.toggleChoice(sel, v, mode, max)),
    );
  for (const args of [
    [true, 4, "multi", 4],
    [false, 4, "multi", 4],
    [false, 1, "single", 1],
  ])
    assert.equal(mobileChoice.chipLocked(...args), webChoice.chipLocked(...args));
  for (const args of [
    [5, 1, 1, 5],
    [1, -1, 1, 5],
    [Number.NaN, 1, 1, 5],
  ])
    assert.equal(mobileChoice.clampStep(...args), webChoice.clampStep(...args));
  const snaps = ["peek", "half", "full"];
  for (const cur of snaps)
    for (const input of ["Enter", " ", "ArrowUp", "ArrowDown", "up", "down", "x"])
      assert.equal(mobileSheet.nextSnap(cur, input, snaps), webSheet.nextSnap(cur, input, snaps));
  for (const dy of [-200, -10, 0, 30, 49, 200, Number.NaN])
    assert.equal(
      mobileSheet.snapFromDrag(dy, "half", snaps),
      webSheet.snapFromDrag(dy, "half", snaps),
    );
  assert.equal(mobileSheet.SHEET_DRAG_THRESHOLD, webSheet.SHEET_DRAG_THRESHOLD);
});

test("mobil arayüz metinleri (i18n/ui.ts) web tr.json değerlerine birebir eşit", () => {
  const entries = Object.entries(mobileUi.UI_TR);
  assert.ok(entries.length >= 60, "beklenen metin kümesi");
  for (const [key, value] of entries) {
    assert.ok(key in TR, `${key} tr.json'da yok`);
    assert.equal(value, TR[key], `${key}`);
  }
  assert.equal(mobileUi.tr("gate.welcome", { n: 5 }), TR["gate.welcome"].replace("{n}", "5"));
  // trip-format: web formatMinutes/formatMeters ile aynı TR çıktı (web: Intl tr-TR).
  const t = (k) => TR[k];
  const km = (m) =>
    `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(m / 1000)} km`;
  for (const m of [0, 45, 60, 90, 125]) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    const web =
      h === 0
        ? `${r} ${t("trip.unit.minute")}`
        : r === 0
          ? `${h} ${t("trip.unit.hour")}`
          : `${h} ${t("trip.unit.hour")} ${r} ${t("trip.unit.minute")}`;
    assert.equal(mobileFormat.formatMinutes(m), web);
  }
  for (const m of [0, 600, 999, 1000, 1500, 12345])
    assert.equal(mobileFormat.formatMeters(m), m < 1000 ? `${Math.round(m)} m` : km(m));
});

test("sekme öğeleri: web MobileNav ile aynı etiket (tr.json) ve ikon", () => {
  const header = fs.readFileSync(path.join(WEB, "components/header-nav.tsx"), "utf8");
  const webIcon = {};
  for (const m of header.matchAll(/labelKey: "(nav\.[a-zA-Z]+)", icon: "([a-z-]+)"/g))
    webIcon[m[1]] = m[2];
  for (const [tab, item] of Object.entries(mobileTabs.TAB_ITEMS)) {
    assert.equal(item.label, TR[item.labelKey], `${tab} etiketi`);
    assert.equal(item.icon, webIcon[item.labelKey], `${tab} ikonu web ile aynı olmalı`);
  }
});

test("sekme yığını: push/pop/reset ve sekmeye yeniden dokunma köke indirir", () => {
  let s = nav.initialNav("plan");
  s = nav.navReducer(s, { type: "push", screen: "map" });
  assert.equal(nav.topScreen(s), "map");
  s = nav.navReducer(s, { type: "push", screen: "map" });
  assert.deepEqual(plain(s.stacks.plan), ["map"], "aynı ekran üst üste itilmez");
  s = nav.navReducer(s, { type: "select", tab: "ai" });
  assert.equal(s.tab, "ai");
  assert.equal(nav.topScreen(s, "plan"), "map", "diğer sekmenin yığını korunur");
  s = nav.navReducer(s, { type: "select", tab: "plan" });
  s = nav.navReducer(s, { type: "select", tab: "plan" });
  assert.equal(nav.topScreen(s), null, "etkin sekmeye dokunma yığını köke indirir");
  s = nav.navReducer(s, { type: "push", tab: "community", screen: "map" });
  assert.equal(s.tab, "community");
  assert.equal(nav.topScreen(s), "map");
  s = nav.navReducer(s, { type: "pop" });
  assert.equal(nav.topScreen(s), null);
  assert.deepEqual(plain(nav.navReducer(s, { type: "pop" })), plain(s), "boş yığında pop etkisiz");
  assert.deepEqual(
    plain(nav.navReducer(s, { type: "reset", tab: "explore" })),
    plain(nav.initialNav("explore")),
  );
});

test("Android geri sırası (design §12.1): yığın → önceki sekme → Planla → çıkış", () => {
  const HOME = "plan";
  let s = nav.initialNav("explore");
  s = nav.navReducer(s, { type: "select", tab: "plan" });
  s = nav.navReducer(s, { type: "push", screen: "map" });
  s = nav.navReducer(s, { type: "select", tab: "community" });
  s = nav.navReducer(s, { type: "select", tab: "ai" });
  s = nav.navReducer(s, { type: "select", tab: "community" });
  assert.deepEqual(plain(s.history), ["explore", "plan", "ai"], "geçmiş tekil, en eski başta");

  const steps = [];
  for (let i = 0; i < 10; i++) {
    const r = nav.onBack(s, HOME);
    steps.push(
      r.handled
        ? `${r.state.tab}${nav.topScreen(r.state) ? "/" + nav.topScreen(r.state) : ""}`
        : "exit",
    );
    if (!r.handled) break;
    s = r.state;
  }
  // community → ai → plan/map (yığın korunmuştu) → plan (pop) → explore → plan (Planla) → çıkış
  assert.deepEqual(steps, ["ai", "plan/map", "plan", "explore", "plan", "exit"]);

  // Yığın boş, geçmiş yok, kök sekme Planla değil → Planla.
  const r1 = nav.onBack(nav.initialNav("profile"), HOME);
  assert.equal(r1.handled, true);
  assert.equal(r1.state.tab, "plan");
  // Kök sekme Planla ve yığın boş → sistem varsayılanı (çıkış).
  assert.equal(nav.onBack(nav.initialNav("plan"), HOME).handled, false);
  // Artık var olmayan sekmeler (oturum değişimi) geçmişte atlanır.
  let g = nav.initialNav("explore");
  g = nav.navReducer(g, { type: "select", tab: "login" });
  const r2 = nav.onBack(g, HOME, ["plan", "ai", "community", "messages", "profile"]);
  assert.equal(r2.state.tab, "plan");
});
test("misafir Keşfet'te geri: design §12.1 birebir (Planla, sonra çıkış)", () => {
  // FEAT-011 review #5: tablo "kök sekme Planla değil → Planla" der; misafir setinde de Planla
  // vardır. Bu davranış onaylı tasarımın gereğidir; değişirse önce design.md §12.1 güncellenir.
  const guestTabs = ["explore", "plan", "ai", "community", "login"];
  const r = nav.onBack(nav.initialNav("explore"), "plan", guestTabs);
  assert.equal(r.handled, true);
  assert.equal(r.state.tab, "plan");
  assert.equal(nav.onBack(r.state, "plan", guestTabs).handled, false);
});

// ── Native gezi kaydı hesap yalıtımı (design §6.3/§6.4, KVKK; FEAT-011 review #1) ──
const webPlanner = loadTs(path.join(WEB, "lib/trip/planner-store.ts"));
const tripOwner = loadTs(path.join(MOBILE, "services/trip-owner.ts"));
const tripStubs = {
  [path.join(MOBILE, "services/storage.ts")]: path.join(__dirname, "stubs/mobile-storage.stub.cjs"),
  [path.join(MOBILE, "services/api.ts")]: path.join(__dirname, "stubs/mobile-route-api.stub.cjs"),
};
const STOP = {
  id: "s1",
  name: "Kolezyum",
  category: "MEKAN",
  time: "10:00",
  duration: "60 dk",
  address: "",
  lat: 41.89,
  lng: 12.49,
};
/** Her senaryo kendi tripStore tekilini alır (yeni bundle + yeni bağlam). */
function freshTripStore(initialStorage = {}, server = {}) {
  const mem = { ...initialStorage };
  const remote = [];
  const api = {
    calls: [],
    async listRoutes() {
      return remote.map((r) => ({ ...r }));
    },
    async createRoute(name, stops) {
      if (server.createFails) throw new Error("çevrimdışı");
      const routeId = `srv-${remote.length + 1}`;
      remote.push({ routeId, name, stops });
      return { routeId, name, stops };
    },
    async updateRoute() {
      return { status: "ok" };
    },
    async deleteRoute() {
      return { status: "ok" };
    },
  };
  for (const r of server.routes ?? []) remote.push(r);
  const mod = loadTs(path.join(MOBILE, "services/tripStore.ts"), {
    stubs: tripStubs,
    globals: { __mbStorage: mem, __mbRouteApi: api, console: quiet },
  });
  return { store: mod.tripStore, mem, api, remote };
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const memberRoute = { id: "srv-a1", name: "A'nın gezisi", day: 1, stops: [STOP] };

test("gezi sahibi kuralı web planner-store ile aynı (canUse / aktarım filtresi)", () => {
  assert.equal(tripOwner.GUEST_OWNER, webPlanner.GUEST_OWNER);
  const owners = [null, "guest", "a@x.com", "b@x.com"];
  for (const stored of owners)
    for (const current of ["guest", "a@x.com"])
      assert.equal(
        tripOwner.canUseTripStore(stored, current),
        webPlanner.canUsePlannerStore(stored, current),
        `${stored} → ${current}`,
      );
  assert.equal(tripOwner.ownerFromEmail("  A@X.com "), "a@x.com");
  assert.equal(tripOwner.ownerFromEmail(undefined), "guest");
  const out = tripOwner.guestRoutesForTransfer([
    { id: "route-1", origin: "guest", stops: [STOP] },
    { id: "route-2", origin: "guest", stops: [] },
    { id: "srv-3", origin: "guest", stops: [STOP] },
    { id: "route-4", stops: [STOP] },
  ]);
  assert.deepEqual(plain(out), [
    { id: "route-1", origin: "user", stops: plain([STOP]), pendingUpload: true },
  ]);
});

test("misafir önceki hesabın (ya da işaretsiz eski kaydın) gezilerini görmez", async () => {
  for (const owner of ["a@x.com", undefined]) {
    const initial = {
      mb_all_routes: JSON.stringify([memberRoute]),
      mb_active_route_id: memberRoute.id,
      mb_saved_pool: JSON.stringify([STOP]),
      cached_routes: JSON.stringify([{ routeId: "srv-a1", name: "A", stops: [] }]),
    };
    if (owner) initial.mb_routes_owner = owner;
    const { store, mem, api } = freshTripStore(initial);
    assert.deepEqual(plain(store.getAllRoutes()), [], "sahip bildirilmeden gezi yok");
    await store.setOwner("guest");
    await flush();
    assert.deepEqual(plain(store.getAllRoutes()), [], `sahip=${owner}`);
    assert.deepEqual(plain(store.getSavedPool()), []);
    assert.equal(mem.mb_routes_owner, "guest");
    assert.equal(mem.mb_all_routes, "[]");
    assert.equal(mem.cached_routes, undefined, "hesabın sunucu önbelleği silinir");
    assert.deepEqual(api.calls, [], "misafirde sunucu isteği yok");
  }
});

test("üye çıkışında geziler, havuz ve önbellek silinir; başka hesap öncekini görmez", async () => {
  const { store, mem } = freshTripStore(
    {
      mb_all_routes: JSON.stringify([memberRoute]),
      mb_routes_owner: "a@x.com",
      mb_saved_pool: JSON.stringify([STOP]),
    },
    { routes: [{ routeId: "srv-a1", name: "A'nın gezisi", stops: [] }] },
  );
  await store.setOwner("a@x.com");
  assert.deepEqual(
    plain(store.getAllRoutes().map((r) => r.id)),
    ["srv-a1"],
    "aynı hesap kendi kaydını görür",
  );
  await store.clearForSignOut();
  await flush();
  assert.deepEqual(plain(store.getAllRoutes()), []);
  assert.deepEqual(plain(store.getSavedPool()), []);
  assert.equal(mem.mb_routes_owner, "guest");
  assert.equal(mem.mb_saved_pool, "[]");

  const other = freshTripStore({
    mb_all_routes: JSON.stringify([memberRoute]),
    mb_routes_owner: "a@x.com",
  });
  await other.store.setOwner("b@x.com");
  await flush();
  assert.ok(
    !other.store.getAllRoutes().some((r) => r.id === memberRoute.id),
    "A'nın gezisi B'ye gösterilmez",
  );
  assert.equal(other.mem.mb_routes_owner, "b@x.com");
});

test("misafir taslağı yalnız cihazda kalır, girişte hesaba aktarılır (silinmez)", async () => {
  const { store, mem, api, remote } = freshTripStore(
    {},
    { routes: [{ routeId: "srv-9", name: "Sunucudaki", stops: [] }] },
  );
  await store.setOwner("guest");
  store.createRoute("Roma", [STOP]);
  store.createRoute("Boş taslak");
  await flush();
  assert.deepEqual(api.calls, [], "misafir sunucuya yazmaz");
  assert.equal(mem.mb_routes_owner, "guest");
  assert.deepEqual(
    plain(store.getAllRoutes().map((r) => r.origin)),
    ["guest", "guest"],
    "misafir gezisi origin: guest",
  );

  await store.setOwner("b@x.com");
  await flush();
  assert.deepEqual(
    plain(api.calls.map((c) => c.name)),
    ["createRoute", "listRoutes"],
    "yalnız duraklı taslak yüklenir, sonra eşitlenir",
  );
  assert.equal(remote.length, 2);
  const names = store.getAllRoutes().map((r) => r.name);
  assert.deepEqual(plain(names.sort()), ["Roma", "Sunucudaki"], "taslak korunur, kopya yok");
  assert.ok(store.getAllRoutes().every((r) => !r.pendingUpload && r.origin === "user"));
  assert.equal(mem.mb_routes_owner, "b@x.com");
});

test("aktarım yüklemesi başarısızsa taslak beklemede kalır, eşitleme onu silmez", async () => {
  const { store, api } = freshTripStore({}, { createFails: true });
  await store.setOwner("guest");
  store.createRoute("Roma", [STOP]);
  await store.setOwner("b@x.com");
  await flush();
  const routes = plain(store.getAllRoutes());
  assert.equal(routes.length, 1);
  assert.equal(routes[0].name, "Roma");
  assert.equal(routes[0].pendingUpload, true);
  assert.ok(api.calls.some((c) => c.name === "listRoutes"));
});

// ── FEAT-012: Keşfet metni, paylaşım kodu, misafir taslağı, katalog ve optimize paritesi ──
const EN = JSON.parse(fs.readFileSync(path.join(WEB, "locales/en.json"), "utf8"));
const mobileHome = loadTs(path.join(MOBILE, "i18n/home.ts"));

test("Keşfet metni (i18n/home.ts) web home.* değerleriyle birebir; home.mobile.* yok (S6)", () => {
  const trEntries = Object.entries(mobileHome.HOME_TR);
  assert.ok(trEntries.length >= 50, "beklenen Keşfet metin kümesi");
  for (const [key, value] of trEntries) {
    assert.ok(key.startsWith("home."), key);
    assert.ok(!key.startsWith("home.mobile."), `${key}: mobil/mağaza bölümü render edilmez (S6)`);
    assert.equal(value, TR[key], `TR ${key}`);
  }
  assert.deepEqual(Object.keys(mobileHome.HOME_EN), Object.keys(mobileHome.HOME_TR));
  for (const [key, value] of Object.entries(mobileHome.HOME_EN))
    assert.equal(value, EN[key], `EN ${key}`);
  // Keşfet'te kullanılan her home.* anahtarı home.ts'te ve web ana sayfasının render ettiği kümede.
  const explore = fs.readFileSync(path.join(MOBILE, "screens/ExploreScreen.tsx"), "utf8");
  const webHome =
    fs.readFileSync(path.join(WEB, "home-client.tsx"), "utf8") +
    fs.readFileSync(path.join(WEB, "home-prompt.tsx"), "utf8");
  for (const m of explore.matchAll(/"(home\.[A-Za-z0-9_.]+)"/g)) {
    assert.ok(m[1] in mobileHome.HOME_TR, `${m[1]} home.ts'te yok`);
    assert.ok(webHome.includes(`"${m[1]}"`), `${m[1]} web ana sayfasında render edilmiyor`);
  }
});

test("paylaşım kodu kuralı web share-code ile aynı (S16)", () => {
  const web = loadTs(path.join(WEB, "lib/share/share-code.ts"));
  const mob = loadTs(path.join(MOBILE, "share/share-code.ts"));
  for (const raw of [
    "",
    " ab ",
    "abcd",
    "AbC-12",
    " a b c d ",
    "x".repeat(64),
    "x".repeat(65),
    "ab_c",
    null,
  ])
    assert.equal(mob.readShareCode(raw), web.readShareCode(raw), String(raw));
  assert.equal(mob.SHARE_CODE_PATTERN.source, web.SHARE_CODE_PATTERN.source);
  assert.equal(mob.shareCodeUrl("Ab-12"), "https://mapsbridge.com/k/?code=Ab-12");
});

test("misafir taslağı: aynı anahtar/şema/TTL, aynı özet mesajı, hesap yalıtımı", async () => {
  const webDraft = loadTs(path.join(WEB, "lib/guest/guest-draft.ts"), { globals: webGlobals });
  const webOwner = loadTs(path.join(WEB, "lib/guest/guest-draft-owner.ts"), {
    stubs,
    globals: webGlobals,
  });
  const mob = loadTs(path.join(MOBILE, "guest/guest-draft.ts"));
  assert.equal(mob.GUEST_DRAFT_KEY, webDraft.GUEST_DRAFT_KEY);
  assert.equal(mob.GUEST_DRAFT_OWNER_KEY, webOwner.GUEST_DRAFT_OWNER_KEY);
  assert.equal(mob.GUEST_DRAFT_TTL_MS, webDraft.GUEST_DRAFT_TTL_MS);
  assert.equal(mob.GUEST_PROMPT_MAX, webDraft.GUEST_PROMPT_MAX);
  for (const text of ["  Roma'da\n3 gün ", "a\u0007b", "x".repeat(600), 42, ""])
    assert.equal(mob.sanitizePrompt(text), webDraft.sanitizePrompt(text));
  const now = Date.parse("2030-01-01T00:00:00Z");
  assert.deepEqual(plain(mob.createDraft("Roma", now)), plain(webDraft.createDraft("Roma", now)));
  const t = (k, f) => TR[k] ?? f;
  const draft = {
    ...webDraft.createDraft("Roma'da 3 gün", now),
    answers: {
      duration: "3d",
      character: "history-culture",
      pace: "balanced",
      interests: ["local-food", "viewpoints"],
    },
    turn: 3,
  };
  assert.equal(mob.buildGuestSummaryMessage(draft), webDraft.buildGuestSummaryMessage(draft, t));
  const ranged = {
    ...draft,
    answers: { ...draft.answers, duration: { from: "2030-02-01", to: "2030-02-03" } },
  };
  assert.equal(mob.buildGuestSummaryMessage(ranged), webDraft.buildGuestSummaryMessage(ranged, t));
  for (const owner of ["guest", "a@x.com"])
    for (const stored of [null, "guest", "a@x.com", "b@x.com"])
      assert.equal(mob.canUseGuestDraft(stored, owner), webOwner.canUseGuestDraft(stored, owner));

  // AsyncStorage benzeri bellek deposu.
  const mem = {};
  const store = {
    async getItem(k) {
      return k in mem ? mem[k] : null;
    },
    async setItem(k, v) {
      mem[k] = v;
    },
    async removeItem(k) {
      delete mem[k];
    },
  };
  assert.equal(await mob.saveDraft(store, draft, "guest"), true);
  assert.equal(mem[mob.GUEST_DRAFT_OWNER_KEY], "guest");
  // Web localStorage okuması (eşzamanlı depo) aynı taslağı döndürür.
  const snapshot = { ...mem };
  const webStore = {
    getItem: (k) => (k in snapshot ? snapshot[k] : null),
    setItem: (k, v) => (snapshot[k] = v),
    removeItem: (k) => delete snapshot[k],
  };
  const expected = webDraft.loadDraft(webStore, now);
  assert.ok(expected, "web taslağı okur");
  assert.deepEqual(plain(await mob.loadDraft(store, "a@x.com", now)), plain(expected));
  assert.equal(mem[mob.GUEST_DRAFT_OWNER_KEY], "a@x.com", "ilk açan hesap sahiplenir");
  assert.equal(await mob.loadDraft(store, "b@x.com", now), null, "başka hesap göremez");
  assert.equal(await mob.loadDraft(store, "guest", now), null, "sonraki misafir göremez");
  assert.equal(
    await mob.loadDraft(store, "a@x.com", now + mob.GUEST_DRAFT_TTL_MS + 1),
    null,
    "TTL",
  );
  assert.equal(mem[mob.GUEST_DRAFT_KEY], undefined, "süresi dolan taslak silinir");
  mem[mob.GUEST_DRAFT_KEY] = "{bozuk";
  assert.equal(await mob.loadDraft(store, "guest", now), null);
  assert.equal(mem[mob.GUEST_DRAFT_KEY], undefined, "bozuk taslak silinir");
});

test("katalog doğrulaması web parseCatalog ile aynı; native yalnız aylık ürün (S18)", () => {
  const mob = loadTs(path.join(MOBILE, "billing/catalog.ts"));
  const products = [
    { id: "explorer", mode: "subscription", credits: 100, amount: 19900, available: true },
    { id: "pro", mode: "subscription", credits: 500, amount: 49900, available: false },
    { id: "pro-yearly", mode: "subscription", credits: 5500, amount: 499900, available: true },
    { id: "pack-50", mode: "credit_pack", credits: 50, amount: 9900, available: true },
    { id: "", mode: "subscription", credits: 1, amount: 1, available: true },
    { id: "x", mode: "gift", credits: 1, amount: 1, available: true },
  ];
  for (const raw of [
    { enabled: true, products },
    { enabled: false, products: products.slice(0, 2) },
    { enabled: true, products: [{ id: "bad" }] },
    { enabled: true, products: [] },
    null,
    { products },
  ])
    assert.deepEqual(plain(mob.parseCatalog(raw)), plain(webCatalog.parseCatalog(raw)));
  const parsed = webCatalog.parseCatalog({ enabled: true, products }).products;
  for (const tier of ["free", "explorer", "pro", "agency"])
    assert.deepEqual(
      plain(mob.findMonthlyProduct(parsed, tier) ?? null),
      plain(webCatalog.findPlanProduct(parsed, tier, "monthly") ?? null),
      tier,
    );
});

test("rota optimizasyonu web optimizeRouteOrder ile aynı sıra ve kazanç (S19, I2)", () => {
  const web = loadTs(path.join(WEB, "lib/trip/routing-service.ts"), { globals: webGlobals });
  const mob = loadTs(path.join(MOBILE, "trip/optimize.ts"));
  const sets = [
    [
      [41.8902, 12.4922],
      [41.9009, 12.4833],
      [41.8925, 12.4853],
      [41.8986, 12.4769],
      [41.9029, 12.4534],
    ],
    [
      [41.0086, 28.9802],
      [41.0256, 28.9741],
      [41.0054, 28.9768],
      [41.0108, 28.968],
    ],
    [
      [1, 1],
      [1.0001, 1],
    ],
  ];
  for (const coords of sets) {
    const stops = coords.map(([lat, lng], i) => ({ id: `s${i}`, lat, lng }));
    const pins = stops.map((s) => ({ ...s, dayIndex: 0, name: s.id }));
    const w = web.optimizeRouteOrder(pins, "walking");
    const m = mob.optimizeStopOrder(stops, "walking");
    if (!w) {
      assert.equal(m, null);
      continue;
    }
    assert.deepEqual(plain(m.optimizedStopIds), plain(w.optimizedPinIds));
    assert.equal(m.savedDistanceKm, w.savedDistanceKm);
    assert.equal(m.savedDurationMinutes, w.savedDurationMinutes);
  }
});

// ─── FEAT-012 review düzeltmeleri ──────────────────────────────────────────────

test("native Paywall mağaza paketini katalogun packageId/productId alanıyla eşler (review #1)", () => {
  const mob = loadTs(path.join(MOBILE, "billing/catalog.ts"));
  // GET /revenuecat/plans yanıtı: lambda billing/catalog.ts ürünleri + available (salt okunur).
  const lambda = loadTs(path.join(ROOT, "infra/lambda/src/billing/catalog.ts"), {
    globals: { process: { env: {} } },
  });
  const raw = {
    enabled: true,
    products: lambda.revenuecatCatalog().map((p) => ({ ...p, available: !!p.productId })),
    welcomeCredits: 100,
  };
  const parsed = mob.parseCatalog(raw);
  assert.deepEqual(plain(parsed), plain(webCatalog.parseCatalog(raw)), "web paritesi korunur");
  const ids = mob.parseStoreIds(raw);
  const pro = mob.findMonthlyProduct(parsed.products, "pro");
  assert.ok(pro && pro.available, "pro aylık katalogda");
  const pkg = (identifier, product) => ({ identifier, product: { identifier: product } });
  assert.ok(mob.matchesStoreIds(pkg("$rc_monthly", "store.pro.monthly"), ids[pro.id]), "paket id");
  assert.ok(mob.matchesStoreIds(pkg("custom", ids[pro.id].productId), ids[pro.id]), "ürün id");
  assert.ok(!mob.matchesStoreIds(pkg("$rc_annual", "x"), ids[pro.id]), "yıllık paket eşleşmez");
  assert.ok(!mob.matchesStoreIds(pkg("pro", "pro"), ids[pro.id]), "katalog id mağaza id değildir");
  assert.ok(!mob.matchesStoreIds(pkg("$rc_monthly", "x"), undefined), "kimliksiz ürün satılmaz");
  assert.deepEqual(plain(mob.parseStoreIds(null)), {});
  assert.deepEqual(plain(mob.parseStoreIds({ products: [{ id: "a", packageId: 3 }] })), {});
  const paywall = fs.readFileSync(path.join(MOBILE, "components/PaywallModal.tsx"), "utf8");
  assert.match(paywall, /matchesStoreIds\(p, ids\)/);
  assert.match(paywall, /native\.paywall\.storePrice/, "mağaza fiyatı notu (karar C2)");
});

test("native yalnız metinleri web anahtarı ya da değeriyle çakışmaz (review #10)", () => {
  const mobileHome = loadTs(path.join(MOBILE, "i18n/home.ts"));
  const webValues = new Set(Object.values(TR));
  for (const [key, value] of Object.entries(mobileUi.NATIVE_TR)) {
    assert.ok(key.startsWith("native."), key);
    assert.ok(!(key in TR), `${key} web tr.json'da var; UI_TR'ye web anahtarıyla taşınmalı`);
    assert.ok(!webValues.has(value), `${key}: değer web tr.json'da var, web anahtarını kullan`);
  }
  for (const key of Object.keys(mobileUi.UI_TR))
    assert.ok(!(key in mobileUi.NATIVE_TR), `${key} iki kümede`);
  assert.deepEqual(Object.keys(mobileHome.HOME_NATIVE_EN), Object.keys(mobileHome.HOME_NATIVE_TR));
  for (const key of Object.keys(mobileHome.HOME_NATIVE_TR)) {
    assert.ok(key.startsWith("native.home."), key);
    assert.ok(!(key in TR) && !(key in EN), key);
  }
});

test("Keşfet native'in yapamadığını iddia etmez (karar S23)", () => {
  const mobileHome = loadTs(path.join(MOBILE, "i18n/home.ts"));
  const explore = fs.readFileSync(path.join(MOBILE, "screens/ExploreScreen.tsx"), "utf8");
  for (const key of [
    "home.features.planner.body",
    "home.features.share.title",
    "home.features.share.body",
  ])
    assert.ok(!explore.includes(`"${key}"`), `${key} native'de çizilmez`);
  const rendered = Object.values({ ...mobileHome.HOME_TR, ...mobileHome.HOME_NATIVE_TR }).join(" ");
  for (const claim of [/sürükle/i, /yol ağı/i, /süreli ve onaya/i])
    assert.doesNotMatch(rendered, claim);
  // Web ana sayfası da optimize için yol ağı iddia etmez (S19/S23).
  assert.doesNotMatch(TR["home.features.optimize.body"], /yol ağı/i);
  assert.doesNotMatch(EN["home.features.optimize.body"], /road network/i);
});

test("eski uydurma profil varsayılanları yalnız birebir eşleşirse temizlenir (karar B1)", () => {
  const mob = loadTs(path.join(MOBILE, "profile/legacy-defaults.ts"));
  const L = mob.LEGACY_PROFILE_DEFAULTS;
  const legacy = {
    fullName: "Ada",
    travelTitle: L.travelTitle,
    bio: L.bio,
    location: L.location,
    avatarUrl: L.avatarUrl,
  };
  const cleaned = mob.stripLegacyProfileDefaults(legacy);
  assert.notEqual(cleaned, legacy);
  assert.deepEqual(plain(cleaned), { fullName: "Ada", travelTitle: "", bio: "", location: "" });
  const own = {
    fullName: "Ada",
    travelTitle: `${L.travelTitle} `,
    bio: "Kendi yazdığım",
    location: "İstanbul",
    avatarUrl: "file:///me.jpg",
  };
  assert.equal(mob.stripLegacyProfileDefaults(own), own, "kullanıcı değeri olduğu gibi kalır");
  const mixed = mob.stripLegacyProfileDefaults({ ...own, location: L.location });
  assert.equal(mixed.location, "");
  assert.equal(mixed.bio, "Kendi yazdığım");
  assert.equal(mixed.avatarUrl, "file:///me.jpg");
  const svc = fs.readFileSync(path.join(MOBILE, "services/socialSync.ts"), "utf8");
  assert.match(svc, /stripLegacyProfileDefaults\(parsed\)/);
});

test("çok günlü rota: gün durak öneki ile; harita yükleme hatası RN'e iletilir (review #3, #9)", () => {
  const days = loadTs(path.join(MOBILE, "trip/days.ts"));
  assert.equal(days.dayFromTime("2. gün · Sabah"), 2);
  assert.equal(days.dayFromTime("Sabah"), undefined);
  assert.equal(days.dayFromTime(""), undefined);
  assert.equal(days.stopDay({ time: "" }, 3), 3);
  assert.equal(days.spansSeveralDays([{ time: "1. gün" }, { time: "2. gün · Öğle" }], 1), true);
  assert.equal(days.spansSeveralDays([{ time: "1. gün" }, { time: "" }], 1), false);
  const map = fs.readFileSync(path.join(MOBILE, "screens/MapScreen.tsx"), "utf8");
  assert.match(map, /eyebrow=\{multiDay \? undefined/);
  assert.match(map, /time=\{stop\.time \|\| undefined\}/);
  assert.match(map, /"MAP_LOAD_FAILED"/);
  // WebView onError satır içi html'de tetiklenmez: belge yükleme hatasını kendisi bildirir.
  const html = fs.readFileSync(path.join(MOBILE, "map/leaflet-html.ts"), "utf8");
  assert.match(html, /type: "MAP_LOAD_FAILED"/);
  assert.match(html, /MAP_LOAD_TIMEOUT_MS/);
  assert.match(html, /tileerror/);
});
// ── Increment 4.3: modal sunumu, toast süresi/bekletme ve ilerleme mantığı web ile birebir ──
const LOGIC_COPIES = ["modal-presentation", "toast-timing", "toast-hold", "progress"];
/** Kopyanın ilk iki satırı kaynak notudur; geri kalanı web dosyasıyla birebir aynıdır. */
function copyBody(rel) {
  return fs.readFileSync(path.join(MOBILE, rel), "utf8").split("\n").slice(2).join("\n");
}
test("4.3: ui/logic kopyaları (modal-presentation, toast-timing, toast-hold, progress) web ile birebir", () => {
  for (const name of LOGIC_COPIES) {
    const web = fs.readFileSync(path.join(WEB, `components/ui/logic/${name}.ts`), "utf8");
    assert.equal(copyBody(`ui/logic/${name}.ts`), web, `${name}.ts web kaynağından farklı`);
  }
  const webModal = loadTs(path.join(WEB, "components/ui/logic/modal-presentation.ts"));
  const mobModal = loadTs(path.join(MOBILE, "ui/logic/modal-presentation.ts"));
  for (const size of ["sheet", "md", "sm", "lg"])
    for (const mobile of [true, false])
      assert.equal(
        mobModal.modalPresentation(size, mobile),
        webModal.modalPresentation(size, mobile),
      );
  const webToast = loadTs(path.join(WEB, "components/ui/logic/toast-timing.ts"));
  const mobToast = loadTs(path.join(MOBILE, "ui/logic/toast-timing.ts"));
  for (const tone of ["info", "success", "warning", "danger"])
    for (const hasAction of [true, false])
      for (const durationMs of [undefined, 0, 3000, Number.NaN])
        assert.equal(
          mobToast.toastDuration({ tone, hasAction, durationMs }),
          webToast.toastDuration({ tone, hasAction, durationMs }),
        );
  const t0 = mobToast.startTimer(6000, 1000);
  const paused = mobToast.pauseTimer(t0, 3000);
  assert.deepEqual(
    plain(paused),
    plain(webToast.pauseTimer(webToast.startTimer(6000, 1000), 3000)),
  );
  assert.equal(mobToast.timerProgress(paused, 6000, 9999), 4000 / 6000);
  const webHold = loadTs(path.join(WEB, "components/ui/logic/toast-hold.ts"));
  const mobHold = loadTs(path.join(MOBILE, "ui/logic/toast-hold.ts"));
  for (const open of [true, false]) {
    assert.equal(mobHold.admitToast(open), webHold.admitToast(open));
    assert.deepEqual(
      plain(mobHold.releaseHeld([1, 2], open)),
      plain(webHold.releaseHeld([1, 2], open)),
    );
  }
  const webProg = loadTs(path.join(WEB, "components/ui/logic/progress.ts"));
  const mobProg = loadTs(path.join(MOBILE, "ui/logic/progress.ts"));
  for (const [v, m] of [
    [50, 100],
    [3, 4],
    [-1, 10],
    [200, 100],
    [Number.NaN, 100],
    [1, 0],
  ])
    assert.equal(mobProg.clampProgress(v, m), webProg.clampProgress(v, m));
  for (const i of [0, 1, 2])
    for (const c of [0, 1, 3]) assert.equal(mobProg.stepState(i, c), webProg.stepState(i, c));
  assert.equal(
    mobProg.stepAnnouncement(mobileUi.UI_TR["ui.progress.step"], 1, ["A", "B", "C"]),
    webProg.stepAnnouncement(TR["ui.progress.step"], 1, ["A", "B", "C"]),
  );
});
test("4.3: ModalFrame ≥768 dp her sunumu ortalı dialog yapar, <768 sheet alttan; RN primitive'leri web adlarıyla", () => {
  const src = fs.readFileSync(path.join(MOBILE, "ui/ModalFrame.tsx"), "utf8");
  assert.match(src, /TABLET_MIN_WIDTH = 768/);
  assert.match(src, /modalPresentation\("sheet", width < TABLET_MIN_WIDTH\)/);
  assert.match(src, /reduced\s*\?\s*"none"/, "hareket azaltmada animationType none");
  assert.match(src, /outputRange: \[0\.96, 1\]/, "ölçek .96 → 1");
  const index = fs.readFileSync(path.join(MOBILE, "ui/index.ts"), "utf8");
  for (const name of [
    "Toaster",
    "useToast",
    "Progress",
    "Celebrate",
    "Skeleton",
    "EmptyState",
    "haptic",
  ])
    assert.match(index, new RegExp(`\\b${name}\\b`), `ui/index.ts ${name}`);
  const toast = fs.readFileSync(path.join(MOBILE, "ui/Toast.tsx"), "utf8");
  assert.match(toast, /admitToast\(openModalCount\(\) > 0\)/, "açık modalda toast bekletilir");
  const button = fs.readFileSync(path.join(MOBILE, "ui/Button.tsx"), "utf8");
  assert.match(button, /disabledReason/);
  assert.match(button, /loadingLabel/);
  assert.match(button, /android_ripple=/);
  const press = fs.readFileSync(path.join(MOBILE, "ui/usePressScale.ts"), "utf8");
  assert.match(press, /PRESSED_SCALE = 0\.97/);
});
