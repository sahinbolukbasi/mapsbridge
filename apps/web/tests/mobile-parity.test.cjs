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
