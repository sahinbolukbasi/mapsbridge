// Kredi gösterim tablosu ↔ contracts eşitliği (design §7.4, S1 kararı).
// UI product.md değerlerini gösterir; bilinen çelişkiler KNOWN_EXCEPTIONS'ta ADIYLA durur ve
// test çelişkinin hâlâ var olduğunu doğrular: hata düzeltilince istisna sessizce yaşamaz.
// ⚠ UI hoş geldin 5 / ai_chat 1 gösterir; sunucu değeri yayından önce kullanıcı tarafından
// teyit edilmeli.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

const ROOT = path.resolve(__dirname, "../../..");
const { CREDIT_COST_ROWS, WELCOME_CREDITS_DISPLAY, costOf } = loadTs(
  path.join(ROOT, "apps/web/app/lib/billing/credit-costs.ts"),
  { globals: { Error } },
);
const { ACTION_CREDIT_COSTS, BILLING_COST } = loadTs(
  path.join(ROOT, "packages/contracts/src/index.ts"),
);
// Yalnızca OKUNUR (backend kapsam dışı, değiştirilmez).
const LAMBDA_BILLING_STORE = path.join(ROOT, "infra/lambda/src/billing/store.ts");

const KNOWN_EXCEPTIONS = [
  {
    // Gerekçe: contracts ACTION_CREDIT_COSTS.ai_chat = 0.5 (Tier2 sohbet), product.md ve
    // BILLING_COST.CHAT ise 1 diyor. S1 kararı: UI 1 gösterir, contracts değişmez; sunucunun
    // gerçekte düştüğü değer yayından önce kullanıcı tarafından teyit edilecek.
    id: "contracts-ai_chat-0.5",
    action: "ai_chat",
    stillDiverges: () => ACTION_CREDIT_COSTS.ai_chat !== 1,
  },
  {
    // Gerekçe: lambda billing/store.ts (ve stripe/index.ts) hoş geldin hediyesini 100 kredi
    // yazıyor; product.md ve BILLING_COST.WELCOME_CREDITS 5. S1 kararı: UI 5 gösterir, backend
    // değişmez; gerçek sunucu değeri yayından önce kullanıcı tarafından teyit edilecek.
    id: "lambda-welcome-100",
    action: "welcome",
    stillDiverges: () => {
      const src = fs.readFileSync(LAMBDA_BILLING_STORE, "utf8");
      const m = src.match(/welcomeGift:\s*\{\s*credits:\s*(\d+)/);
      assert.ok(m, "billing/store.ts'te welcomeGift.credits bulunamadı (istisnayı gözden geçirin)");
      return Number(m[1]) !== WELCOME_CREDITS_DISPLAY;
    },
  },
];

test("tablo sırası ve değerleri product.md ile aynı (design §7.4)", () => {
  // vm realm dizileri düz JSON'a çevrilip karşılaştırılır.
  assert.deepEqual(JSON.parse(JSON.stringify(CREDIT_COST_ROWS.map((r) => [r.action, r.cost]))), [
    ["clarify", "free"],
    ["ai_chat", 1],
    ["route_optimize", 1],
    ["ai_stay_dining", 2],
    ["ai_deep_trip", 5],
  ]);
  for (const r of CREDIT_COST_ROWS) assert.match(r.labelKey, /^credits\.row\.[a-zA-Z]+$/);
  assert.equal(costOf("ai_deep_trip"), 5);
  assert.throws(() => costOf("nope"));
});

test("route_optimize / ai_stay_dining / ai_deep_trip = contracts ACTION_CREDIT_COSTS", () => {
  for (const action of ["route_optimize", "ai_stay_dining", "ai_deep_trip"])
    assert.equal(costOf(action), ACTION_CREDIT_COSTS[action], action);
});

test("ai_chat = BILLING_COST.CHAT; tercih netleştirme ücretsiz = BILLING_COST.CLARIFY 0", () => {
  assert.equal(costOf("ai_chat"), BILLING_COST.CHAT);
  assert.equal(BILLING_COST.CLARIFY, 0);
  assert.equal(costOf("clarify"), "free");
});

test("WELCOME_CREDITS_DISPLAY = BILLING_COST.WELCOME_CREDITS", () => {
  assert.equal(WELCOME_CREDITS_DISPLAY, BILLING_COST.WELCOME_CREDITS);
});

test("KNOWN_EXCEPTIONS adıyla listelenir ve çelişki hâlâ vardır (sessizce yaşamaz)", () => {
  assert.deepEqual(
    KNOWN_EXCEPTIONS.map((e) => e.id),
    ["contracts-ai_chat-0.5", "lambda-welcome-100"],
  );
  for (const e of KNOWN_EXCEPTIONS)
    assert.ok(
      e.stillDiverges(),
      `${e.id}: çelişki giderilmiş görünüyor; istisnayı KNOWN_EXCEPTIONS'tan kaldırın`,
    );
  // İstisna kapsamı: contracts ai_chat yalnız UI tablosundan farklı; diğer satırlar eşit.
  assert.notEqual(ACTION_CREDIT_COSTS.ai_chat, costOf("ai_chat"));
});

test("TR/EN etiketleri tanımlı (I11)", () => {
  const tr = require("../app/locales/tr.json");
  const en = require("../app/locales/en.json");
  for (const key of [
    ...CREDIT_COST_ROWS.map((r) => r.labelKey),
    "credits.free",
    "credits.one",
    "credits.other",
    "credits.table.caption",
  ]) {
    assert.ok(tr[key], `tr.json: ${key}`);
    assert.ok(en[key], `en.json: ${key}`);
  }
  assert.equal(tr["credits.row.aiChat"], "AI sohbet");
  assert.equal(en["credits.row.stayDining"], "Stay & dining analysis");
});
