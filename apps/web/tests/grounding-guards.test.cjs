// Faz 1 / görev 6 — supervisor grounding guard'ları (I1).
// supervisor.ts'in iki belirleyici grounding kuralı runMultiAgentSupervisor
// closure'ının içinde (model pipeline'a bağlı), bu yüzden doğrudan import edilemez.
// Strateji (house pattern, bkz ai-route-persist.test.cjs): (1) kaynak metninde
// kuralın HÂLÂ var olduğunu doğrula (drift guard), (2) kuralın belirleyici
// mantığını birebir kopyalayıp davranışını test et. Kaynak değişirse (1) kırılır.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");

const SUPERVISOR_SRC = fs.readFileSync(
  path.resolve(__dirname, "../app/lib/ai/supervisor.ts"),
  "utf8",
);

// ── Kural 1: Doğrulanmamış fiyat reddi ────────────────────────────────────────
// Kaynaktaki regex ve allowlist mantığının birebir kopyası.
const PRICE_RE = /(?:\d[\d.,– -]*\s*(?:TL|USD|EUR|JPY|₺|€|¥)|[$₺€¥£]\s*\d)/iu;
function priceGuard(responseText, flightHint) {
  const priceMatch = responseText.match(PRICE_RE);
  if (!priceMatch) return { rejected: false };
  const verifiedPrices = flightHint
    ? [String(flightHint.cheapestPrice), ...(flightHint.deals || []).map((d) => String(d.price))]
    : [];
  const rawNum = priceMatch[0].replace(/[^0-9]/g, "");
  return { rejected: !verifiedPrices.includes(rawNum), rawNum };
}

test("drift guard: supervisor hâlâ fiyat regex + verifiedPrices reddini içeriyor", () => {
  assert.ok(
    SUPERVISOR_SRC.includes("Doğrulanmamış fiyat içeren yanıt reddedildi."),
    "fiyat reddi mesajı kaynakta kalmalı",
  );
  assert.ok(SUPERVISOR_SRC.includes("verifiedPrices.includes(rawNum)"));
  assert.ok(
    SUPERVISOR_SRC.includes("TL|USD|EUR|JPY|₺|€|¥"),
    "fiyat tespit regex'i kaynakta kalmalı",
  );
});

test("doğrulanmamış fiyat (flightData yok) reddedilir (I1)", () => {
  const out = JSON.stringify({ orchestratorSummary: "Uçuş yaklaşık 4500 TL tutar." });
  assert.equal(priceGuard(out, null).rejected, true);
});

test("flightData ile doğrulanmış fiyat kabul edilir", () => {
  const out = JSON.stringify({ orchestratorSummary: "En ucuz uçuş 4500 TL." });
  const res = priceGuard(out, { cheapestPrice: 4500, deals: [] });
  assert.equal(res.rejected, false);
  assert.equal(res.rawNum, "4500");
});

test("flightData'daki deal fiyatı da kabul edilir (sayı önce biçimi: '320 EUR')", () => {
  // Not: regex'in '[$₺€¥£]\\s*\\d' kolu sembol + İLK rakamı yakalar ('€320'→'3').
  // Para birimi SONRA gelen biçimde ('320 EUR') tam sayı yakalanır — bu karakterize
  // edilen gerçek davranıştır. Sayı-önce biçim doğrulanmış deal ile eşleşir.
  const out = JSON.stringify({ summary: "Mart ayında 320 EUR civarı." });
  const res = priceGuard(out, { cheapestPrice: 500, deals: [{ price: 320 }] });
  assert.equal(res.rawNum, "320");
  assert.equal(res.rejected, false);
});

test("karakterizasyon: '€320' biçimi sembol+ilk rakamı ('3') yakalar", () => {
  // Kaynak regex'in bilinen sınırı — belgelenmiş gerçek davranış, görev 6'da
  // düzeltilmez (davranış dondurma). Faz sonrası iyileştirme adayı.
  const out = JSON.stringify({ summary: "€320 civarı." });
  assert.equal(priceGuard(out, { cheapestPrice: 500, deals: [{ price: 320 }] }).rawNum, "3");
});

test("fiyat içermeyen yanıt reddedilmez", () => {
  const out = JSON.stringify({ orchestratorSummary: "Trastevere semtini gez, cacio e pepe dene." });
  assert.equal(priceGuard(out, null).rejected, false);
});

test("doğrulanmış fiyattan FARKLI bir fiyat yine reddedilir", () => {
  const out = JSON.stringify({ summary: "Uçuş 9999 EUR." });
  // flightData 4500 diyor ama model 9999 uydurdu → reddedilmeli.
  assert.equal(priceGuard(out, { cheapestPrice: 4500, deals: [] }).rejected, true);
});

// ── Kural 2: Yetersiz gerçek durak → clarify (uydurma rota yok) ────────────────
// Kaynak: if (mode === "route" && (!research || research.places.length < (context.days || 1)))
function insufficientStops(mode, research, days) {
  return mode === "route" && (!research || research.places.length < (days || 1));
}

test("drift guard: supervisor hâlâ yetersiz-durak → clarify koşulunu içeriyor", () => {
  assert.ok(
    SUPERVISOR_SRC.includes("research.places.length < (context.days || 1)"),
    "yetersiz durak koşulu kaynakta kalmalı",
  );
  assert.ok(
    SUPERVISOR_SRC.includes("Uydurma bir rota vermek istemiyorum."),
    "uydurma rota reddi mesajı kaynakta kalmalı",
  );
});

test("gerçek durak yoksa rota üretilmez (clarify) (I1)", () => {
  assert.equal(insufficientStops("route", null, 3), true);
  assert.equal(insufficientStops("route", { places: [] }, 3), true);
});

test("gün sayısından az durak varsa clarify", () => {
  assert.equal(insufficientStops("route", { places: [{}, {}] }, 3), true);
});

test("yeterli durak varsa rota üretimine izin verilir", () => {
  assert.equal(insufficientStops("route", { places: [{}, {}, {}] }, 3), false);
});

test("chat modunda durak koşulu uygulanmaz", () => {
  assert.equal(insufficientStops("chat", null, 3), false);
});
