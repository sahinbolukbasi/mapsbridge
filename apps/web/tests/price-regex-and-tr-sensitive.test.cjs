// Faz sonrası iyileştirmeler (bu-projede-olan-ai-chat §8 adayları).
// (1) supervisor fiyat regex'i sembol-önce biçimde (€320) TÜM sayıyı yakalar;
//     eskiden yalnız ilk rakamı (€3) alıp doğrulanmış €320'yi reddedebiliyordu.
// (2) isSensitiveData Türkçe tek-l 'alerji/alerjik'i yakalar (eskiden yalnız 'allerg').
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

// ── (1) Fiyat regex — kaynaktaki güncel deseni birebir çıkar ve davranışını doğrula ──
const SUPERVISOR_SRC = fs.readFileSync(
  path.resolve(__dirname, "../app/lib/ai/supervisor.ts"),
  "utf8",
);

function priceRegexFromSource() {
  // Kaynaktaki priceMatch regex literal'ini çıkar (drift'e karşı: kaynaktan okur).
  const m = SUPERVISOR_SRC.match(/responseText\.match\(\s*(\/[^\n]+\/[a-z]*)\s*,?\s*\)/);
  assert.ok(m, "priceMatch regex kaynakta bulunamadı");
  // eslint-disable-next-line no-eval
  return eval(m[1]);
}

function priceGuard(responseText, flightHint) {
  const re = priceRegexFromSource();
  const pm = responseText.match(re);
  if (!pm) return { rejected: false };
  const verified = flightHint
    ? [String(flightHint.cheapestPrice), ...(flightHint.deals || []).map((d) => String(d.price))]
    : [];
  const rawNum = pm[0].replace(/[^0-9]/g, "");
  return { rejected: !verified.includes(rawNum), rawNum };
}

test("sembol-önce '€320' tüm sayıyı yakalar (rawNum=320), ilk rakam değil", () => {
  const out = JSON.stringify({ summary: "Mart'ta €320 civarı." });
  assert.equal(priceGuard(out, null).rawNum, "320");
});

test("doğrulanmış '€320' deal'i artık KABUL edilir (eski bug düzeldi)", () => {
  const out = JSON.stringify({ summary: "€320 civarı uçuş var." });
  const res = priceGuard(out, { cheapestPrice: 500, deals: [{ price: 320 }] });
  assert.equal(res.rejected, false);
});

test("doğrulanmamış sembol-önce fiyat yine reddedilir", () => {
  const out = JSON.stringify({ summary: "₺9999 gibi bir şey." });
  assert.equal(priceGuard(out, { cheapestPrice: 500, deals: [] }).rejected, true);
});

test("sayı-önce biçim ('4500 TL') hâlâ tüm sayıyı yakalar (regresyon yok)", () => {
  const out = JSON.stringify({ summary: "Uçuş 4500 TL." });
  const res = priceGuard(out, { cheapestPrice: 4500, deals: [] });
  assert.equal(res.rawNum, "4500");
  assert.equal(res.rejected, false);
});

test("fiyat içermeyen yanıt reddedilmez", () => {
  assert.equal(priceGuard(JSON.stringify({ summary: "Trastevere gez." }), null).rejected, false);
});

// ── (2) isSensitiveData Türkçe alerji ──────────────────────────────────────────
const mem = loadTs(path.resolve(__dirname, "../app/lib/ai/user-memory/types.ts"));

test("Türkçe tek-l 'alerji' artık hassas veri olarak yakalanır", () => {
  assert.equal(mem.isSensitiveData("notlar", "fıstık alerjim var"), true);
  assert.equal(mem.isSensitiveData("alerji", "x"), true);
  assert.equal(mem.isSensitiveData("notlar", "alerjik bünye"), true);
});

test("İngilizce 'allergy' hâlâ yakalanır (regresyon yok)", () => {
  assert.equal(mem.isSensitiveData("notes", "peanut allergy"), true);
});

test("sağlık/din anahtar/değerleri hâlâ yakalanır", () => {
  assert.equal(mem.isSensitiveData("health", "x"), true);
  assert.equal(mem.isSensitiveData("diet", "helal yiyorum"), true);
});

test("alakasız seyahat verisi hassas sayılmaz (yanlış pozitif yok)", () => {
  assert.equal(mem.isSensitiveData("cuisinePreferences", "ramen"), false);
  assert.equal(mem.isSensitiveData("destination", "Roma"), false);
});
