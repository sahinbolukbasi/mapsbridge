// Faz 7 / görev 26 — affiliate ayrımı (I8).
// Para kazanma yüzeyleri AYRI: affiliate kartları route.stops'a GİRMEZ; yalnız ilgili
// olanlar gösterilir; sıralama komisyona göre değil deterministik. supervisor
// affiliateCards'ı route'tan ayrı bir alanda tutar + koşullu (I10) seçer.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.resolve(__dirname, "../app/lib/ai/supervisor.ts"), "utf8");

// ── Ayrı yüzey (drift guard): affiliate kartları route'a karışmaz ─────────────

test("I8: affiliateCards ayrı bir değişken + ayrı yanıt alanı (route değil)", () => {
  assert.ok(/let affiliateCards: AffiliateCard\[\] \| undefined/.test(SRC));
  // Yanıta ayrı alan olarak eklenir.
  assert.ok(/\.\.\.\(affiliateCards\?\.length \? \{ affiliateCards \} : \{\}\)/.test(SRC));
});

test("I8: affiliate kartı route.stops'a / research.places'e push EDİLMEZ", () => {
  // Affiliate seçim bloğu stops/places listesine yazmamalı.
  const block = SRC.slice(
    SRC.indexOf("let affiliateCards"),
    SRC.indexOf("// Affiliate card generation is non-critical"),
  );
  assert.equal(/\.stops\.push\(/.test(block), false, "affiliate route.stops'a girmez");
  assert.equal(/research\.places\.push\(/.test(block), false, "affiliate research'e girmez");
  assert.equal(/route\.stops\s*=/.test(block), false);
});

// ── Koşullu seçim (I10 + I8): yalnız ilgili kartlar ──────────────────────────
// Kaynak gate mantığının birebir kopyası (chat modu).

function selectCards({ reqText = "", needs = {}, flow = {}, mode = "chat" }) {
  const flowIsPricing = (flow.stage ?? "none") === "pricing";
  const flowTopic = flow.activeTopic ?? "none";
  const wantsHotel =
    /otel|konaklama|kal(?:acağım|mak|acak)|hotel|hostel|apart|butik|resort/u.test(reqText) ||
    (flowIsPricing && flowTopic === "hotel");
  const wantsFlight =
    /uçuş|uçak|bilet|flight|nasıl\s*gid/u.test(reqText) ||
    !!needs.flights ||
    (flowIsPricing && flowTopic === "flight");
  const wantsCar =
    /araba\s*kiral|araç\s*kiral|kiralık\s*araç|rent.*car/u.test(reqText) ||
    !!needs.car_rental ||
    (flowIsPricing && flowTopic === "car_rental");
  if (mode === "route") return ["flight", "hotel", "carRental", "insurance"]; // tam plan sabit demet
  const out = [];
  if (wantsFlight) out.push("flight");
  if (wantsHotel) out.push("hotel");
  if (wantsCar) out.push("car");
  if ((wantsFlight || wantsHotel) && out.length) out.push("insurance");
  return out;
}

test("drift guard: supervisor wantsHotel/wantsFlight/wantsCar koşullu gate içerir", () => {
  assert.ok(SRC.includes("const wantsHotel ="));
  assert.ok(SRC.includes("const wantsFlight ="));
  assert.ok(SRC.includes("const wantsCar ="));
});

test("chat: sadece otel sorulursa yalnız hotel (+ sigorta) kartı seçilir", () => {
  assert.deepEqual(selectCards({ reqText: "hangi otelde kalsam" }), ["hotel", "insurance"]);
});

test("chat: alakasız sohbet → hiç affiliate kartı yok (I10 koşullu UI)", () => {
  assert.deepEqual(selectCards({ reqText: "roma tarihini anlat" }), []);
});

test("chat: uçuş sorulursa flight + sigorta; araç sorulursa yalnız car", () => {
  assert.deepEqual(selectCards({ reqText: "uçuş var mı" }), ["flight", "insurance"]);
  assert.deepEqual(selectCards({ reqText: "araç kiralama" }), ["car"]);
});

test("route modu tam demeti sabit SIRAYLA verir (komisyona göre değil)", () => {
  // Sıra deterministik: flight, hotel, carRental, insurance — komisyon sıralaması yok (I8).
  assert.deepEqual(selectCards({ mode: "route" }), ["flight", "hotel", "carRental", "insurance"]);
});

test("pricing flow topic'i ilgili kartı açar (davranıştan çıkarım)", () => {
  assert.deepEqual(
    selectCards({ reqText: "evet", flow: { stage: "pricing", activeTopic: "flight" } }),
    ["flight", "insurance"],
  );
});
