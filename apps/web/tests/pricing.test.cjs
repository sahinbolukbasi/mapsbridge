// /pricing/ saf mantığı (design §7.2, §7.3, §12.2; FEAT-005). Katalog doğrulama, "≈" türetimi,
// yıllık indirim, kart durumu ve checkout URL parametreleri. lib/api-client.ts stub'lanır
// (window/localStorage/fetch yok). ⚠ UI hoş geldin 5 / ai_chat 1 gösterir; sunucu değeri
// yayından önce kullanıcı tarafından teyit edilmeli.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");
const WEB = path.resolve(__dirname, "../app");
const stubs = {
  [path.join(WEB, "lib/api-client.ts")]: path.join(__dirname, "stubs/api-client.stub.cjs"),
};
const globals = {
  process: { env: { NODE_ENV: "test" } },
  console: { ...console, warn: () => {} },
  setTimeout,
  clearTimeout,
  AbortController,
  URLSearchParams,
};
const catalog = loadTs(path.join(WEB, "lib/billing/catalog.ts"), { stubs, globals });
const params = loadTs(path.join(WEB, "lib/billing/checkout-params.ts"), { stubs, globals });
const plain = (v) => JSON.parse(JSON.stringify(v));

const product = (over = {}) => ({
  id: "pro",
  mode: "subscription",
  credits: 500,
  amount: 49900,
  available: true,
  ...over,
});

test("parseCatalog: şemaya uymayan ürün atılır, geçerliler kalır", () => {
  const raw = {
    enabled: true,
    products: [
      product(),
      product({ id: "" }),
      product({ id: "x", mode: "lifetime" }),
      product({ id: "y", credits: 1.5 }),
      product({ id: "z", credits: -1 }),
      product({ id: "w", amount: -10 }),
      product({ id: "v", amount: "499" }),
      product({ id: "u", available: "yes" }),
      null,
      "pro",
      product({ id: "pack-1", mode: "credit_pack", credits: 50, amount: 8900 }),
    ],
  };
  const out = plain(catalog.parseCatalog(raw));
  assert.equal(out.status, "ok");
  assert.equal(out.enabled, true);
  assert.deepEqual(
    out.products.map((p) => p.id),
    ["pro", "pack-1"],
  );
  // Ek alanlar (productId vb.) taşınmaz.
  const extra = plain(
    catalog.parseCatalog({ enabled: true, products: [product({ productId: "p" })] }),
  );
  assert.deepEqual(Object.keys(extra.products[0]).sort(), [
    "amount",
    "available",
    "credits",
    "id",
    "mode",
  ]);
});

test("parseCatalog: hepsi geçersiz ya da gövde bozuksa unavailable", () => {
  for (const raw of [
    { enabled: true, products: [product({ id: 1 }), product({ mode: "x" })] },
    null,
    undefined,
    "html",
    [],
    { enabled: "true", products: [] },
    { enabled: true },
    { enabled: true, products: {} },
  ])
    assert.deepEqual(plain(catalog.parseCatalog(raw)), { status: "unavailable" }, String(raw));
});

test("parseCatalog: enabled:false korunur; boş ürün listesi geçerlidir", () => {
  assert.deepEqual(plain(catalog.parseCatalog({ enabled: false, products: [product()] })), {
    status: "ok",
    enabled: false,
    products: [product()],
  });
  assert.deepEqual(plain(catalog.parseCatalog({ enabled: false, products: [] })), {
    status: "ok",
    enabled: false,
    products: [],
  });
});

test("derivePlanEquivalents: maliyet tablosundan aşağı yuvarlanır (5 derin rota, 1 sohbet)", () => {
  assert.deepEqual(plain(catalog.derivePlanEquivalents(5)), { deepTrips: 1, chats: 5 });
  assert.deepEqual(plain(catalog.derivePlanEquivalents(100)), { deepTrips: 20, chats: 100 });
  assert.deepEqual(plain(catalog.derivePlanEquivalents(500)), { deepTrips: 100, chats: 500 });
  assert.deepEqual(plain(catalog.derivePlanEquivalents(2500)), { deepTrips: 500, chats: 2500 });
  assert.deepEqual(plain(catalog.derivePlanEquivalents(7)), { deepTrips: 1, chats: 7 });
  assert.deepEqual(plain(catalog.derivePlanEquivalents(-3)), { deepTrips: 0, chats: 0 });
  assert.deepEqual(plain(catalog.derivePlanEquivalents(NaN)), { deepTrips: 0, chats: 0 });
});

test("planInfos: tier kredileri contracts + hoş geldin 5 (design §7.2 tablosu)", () => {
  assert.deepEqual(plain(catalog.planInfos()), [
    { tier: "free", credits: 5, kind: "welcome" },
    { tier: "explorer", credits: 100, kind: "monthly" },
    { tier: "pro", credits: 500, kind: "monthly" },
    { tier: "agency", credits: 2500, kind: "monthly" },
  ]);
});

test("yearlyDiscount: kredi başına, yalnızca iki dönem de varsa", () => {
  const monthly = product();
  const yearly = product({ id: "pro-yearly", amount: 499900, credits: 5500 });
  // Canlı katalog: 49900/500 = 99,8 kuruş/kredi, 499900/5500 ≈ 90,9 → %9 (yalnızca tutar: %17 YANLIŞ).
  assert.equal(catalog.yearlyDiscount(monthly, yearly), 9);
  // 12 × aylık kredi veren yıllık ürün: kredi başı indirim = tutar indirimi.
  assert.equal(
    catalog.yearlyDiscount(monthly, product({ id: "pro-yearly", amount: 499900, credits: 6000 })),
    17,
  );
  assert.equal(catalog.yearlyDiscount(monthly, product({ amount: 499900, credits: 0 })), undefined);
  assert.equal(catalog.yearlyDiscount(monthly, undefined), undefined);
  assert.equal(catalog.yearlyDiscount(undefined, yearly), undefined);
  assert.equal(catalog.yearlyDiscount(undefined, undefined), undefined);
  // 12 aydan pahalı/eşit yıllık indirim sayılmaz; sıfır tutar bölmez.
  assert.equal(
    catalog.yearlyDiscount(monthly, product({ amount: 49900 * 12, credits: 6000 })),
    undefined,
  );
  assert.equal(catalog.yearlyDiscount(product({ amount: 0 }), yearly), undefined);
});

test("findPlanProduct: aylık = <tier>, yıllık = <tier>-yearly, yalnızca abonelik", () => {
  const products = [
    product(),
    product({ id: "pro-yearly", amount: 499900 }),
    product({ id: "explorer", mode: "credit_pack" }),
  ];
  assert.equal(catalog.findPlanProduct(products, "pro", "monthly").id, "pro");
  assert.equal(catalog.findPlanProduct(products, "pro", "yearly").id, "pro-yearly");
  assert.equal(catalog.findPlanProduct(products, "explorer", "monthly"), undefined);
  assert.equal(catalog.findPlanProduct(products, "free", "monthly"), undefined);
});

test("planOffer: §7.3 durumları (yükleniyor, başarısız, kapalı, ürün yok, mevcut)", () => {
  const ok = (over = {}) => ({
    status: "ok",
    enabled: true,
    products: [product(), product({ id: "pro-yearly", amount: 499900, credits: 5500 })],
    ...over,
  });
  const offer = (...a) => plain(catalog.planOffer(...a));
  assert.deepEqual(offer("free", "monthly", "loading", null), { price: "free", purchase: "ok" });
  assert.deepEqual(offer("pro", "monthly", "loading", null), { price: "loading", purchase: "ok" });
  assert.deepEqual(offer("pro", "monthly", { status: "unavailable" }, null), {
    price: "unavailable",
    purchase: "ok",
  });
  assert.deepEqual(offer("pro", "monthly", ok(), null), {
    price: { amount: 49900, period: "monthly", credits: 500 },
    purchase: "ok",
  });
  // Yıllık: kredi satırı katalogdaki yıllık üründen (5.500 / yıl), indirim kredi başına (%9).
  assert.deepEqual(offer("pro", "yearly", ok(), null), {
    price: { amount: 499900, period: "yearly", credits: 5500 },
    discount: 9,
    purchase: "ok",
    credits: { n: 5500, kind: "yearly" },
  });
  // Aylık dönemde ve yıllık ürün yokken kredi satırı statik kalır (credits verilmez).
  assert.equal(offer("pro", "monthly", ok(), null).credits, undefined);
  assert.deepEqual(offer("pro", "yearly", ok({ products: [product()] }), null), {
    price: "none",
    purchase: "unavailable",
  });
  assert.equal(offer("pro", "monthly", ok({ enabled: false }), null).purchase, "closed");
  assert.deepEqual(offer("explorer", "monthly", ok(), null), {
    price: "none",
    purchase: "unavailable",
  });
  assert.equal(
    offer("pro", "monthly", ok({ products: [product({ available: false })] }), null).purchase,
    "unavailable",
  );
  assert.equal(offer("pro", "monthly", ok(), "pro").purchase, "current");
  assert.equal(offer("free", "monthly", ok(), "free").purchase, "current");
  // "Mevcut planın" dönemle birlikte eşleşir; free dönemsizdir.
  assert.equal(offer("pro", "yearly", ok(), "pro").purchase, "ok");
  assert.equal(offer("pro", "yearly", ok(), "pro", "monthly").purchase, "ok");
  assert.equal(offer("pro", "yearly", ok(), "pro", "yearly").purchase, "current");
  assert.equal(offer("pro", "monthly", ok(), "pro", "yearly").purchase, "ok");
  assert.equal(offer("free", "yearly", ok(), "free").purchase, "current");
});

test("fetchCatalog: skipAuth + 8 sn; hata/iptal unavailable döner, fırlatmaz", async () => {
  const calls = [];
  const run = (respond) => {
    const ctx = loadTs(path.join(WEB, "lib/billing/catalog.ts"), {
      stubs,
      globals: { ...globals, __apiStub: { calls, respond } },
    });
    return ctx;
  };
  const okMod = run(() => ({ enabled: true, products: [product()] }));
  assert.equal(plain(await okMod.fetchCatalog()).status, "ok");
  assert.equal(calls[0].path, "/revenuecat/plans");
  assert.equal(calls[0].init.skipAuth, true);
  assert.equal(calls[0].init.timeoutMs, 8000);
  assert.equal(okMod.CATALOG_TIMEOUT_MS, 8000);
  const failMod = run(() => {
    throw new Error("500");
  });
  assert.deepEqual(plain(await failMod.fetchCatalog()), { status: "unavailable" });
  const hangMod = run(() => new Promise(() => {}));
  const ctrl = new AbortController();
  const pending = hangMod.fetchCatalog(ctrl.signal);
  ctrl.abort();
  assert.deepEqual(plain(await pending), { status: "unavailable" });
});

test("parseCheckoutParams: plan/period/tab enum'a karşı, geçersizde geri düşer", () => {
  const p = (s) => plain(params.parseCheckoutParams(s));
  assert.deepEqual(p("?plan=pro&period=yearly&tab=credits"), {
    plan: "pro",
    period: "yearly",
    tab: "credits",
    canceled: false,
    success: false,
  });
  assert.deepEqual(p(""), {
    plan: null,
    period: "monthly",
    tab: null,
    canceled: false,
    success: false,
  });
  const bad = p("?plan=PRO&period=weekly&tab=x&canceled=1");
  assert.equal(bad.plan, null);
  assert.equal(bad.period, "monthly");
  assert.equal(bad.tab, null);
  assert.equal(bad.canceled, true);
  assert.equal(p("?plan=free").plan, "free");
  assert.equal(p("?plan=agency&success=1").success, true);
});

test("planCtaHref: free → /register/, oturumsuz → login next, oturumlu → checkout (J4)", () => {
  assert.equal(params.planCtaHref("free", "monthly", false), "/register/");
  assert.equal(params.planCtaHref("pro", "monthly", true), "/checkout/?plan=pro&period=monthly");
  assert.equal(
    params.planCtaHref("pro", "yearly", false),
    "/login/?next=%2Fcheckout%2F%3Fplan%3Dpro%26period%3Dyearly",
  );
});

test("yasak metinler: EN POPÜLER, deneme, kredi kartı ve contracts TRY fiyatları yok", () => {
  const files = [
    "pricing/pricing-client.tsx",
    "components/billing/plan-card.tsx",
    "checkout/checkout-client.tsx",
    "components/upgrade-modal.tsx",
  ].map((f) => fs.readFileSync(path.join(WEB, f), "utf8"));
  const locales = ["tr", "en"].map((l) =>
    Object.entries(JSON.parse(fs.readFileSync(path.join(WEB, `locales/${l}.json`), "utf8")))
      .filter(([k]) => /^(pricing|upgrade|checkout)\./.test(k))
      .map(([, v]) => v)
      .join("\n"),
  );
  const banned =
    /EN POPÜLER|most popular|ücretsiz deneme|free trial|deneme süresi|kredi kartı gerekmez|no credit card|yakında|uygulamayı indir|YEARLY_RATES|monthlyPriceTry|yearlyPriceTry|priceTry|₺\s?\d/i;
  for (const src of [...files, ...locales]) assert.doesNotMatch(src, banned);
});
