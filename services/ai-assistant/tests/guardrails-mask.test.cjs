// Faz 4 / görev 15 — maskPII (I5 + gizlilik) sabitleme.
// Korpus büyütme hattının maskeleme güvencesi: kimlik/PII korpusa girmez; ve
// maskeleme İLGİ/DEMOGRAFİ türetmez (I5 — yalnız maskeler, sınıflandırmaz).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

function load() {
  const file = path.resolve(__dirname, "../src/domain/guardrails.ts");
  const code = transformSync(readFileSync(file, "utf8"), {
    loader: "ts",
    format: "cjs",
    target: "node22",
  }).code;
  const mod = { exports: {} };
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require, JSON });
  return mod.exports;
}

const { maskPII } = load();

test("e-posta maskelenir", () => {
  const r = maskPII("iletişim: gezgin@example.com teşekkürler");
  assert.equal(r.maskedText.includes("gezgin@example.com"), false);
  assert.ok(r.maskedText.includes("[E-POSTA_MASKEYLENDİ]"));
  assert.ok(r.detectedTypes.includes("EMAIL"));
  assert.equal(r.hasPII, true);
});

test("TC kimlik (11 hane) maskelenir", () => {
  const r = maskPII("TCKN 12345678901 ile kayıt");
  assert.equal(r.maskedText.includes("12345678901"), false);
  assert.ok(r.detectedTypes.includes("TC_KIMLIK"));
});

test("kredi kartı maskelenir", () => {
  const r = maskPII("kart 4111 1111 1111 1111 son kullanma");
  assert.ok(r.detectedTypes.includes("CREDIT_CARD"));
  assert.equal(/4111 1111 1111 1111/.test(r.maskedText), false);
});

test("telefon maskelenir", () => {
  const r = maskPII("ara: 0532 123 45 67");
  assert.ok(r.detectedTypes.includes("PHONE"));
});

test("US SSN maskelenir", () => {
  const r = maskPII("ssn 123-45-6789");
  assert.ok(r.detectedTypes.includes("SSN"));
  assert.equal(r.maskedText.includes("123-45-6789"), false);
});

test("PII içermeyen seyahat metni dokunulmadan kalır", () => {
  const text = "Roma'da Trastevere semtinde cacio e pepe dene.";
  const r = maskPII(text);
  assert.equal(r.maskedText, text);
  assert.equal(r.hasPII, false);
  assert.equal(r.detectedTypes.length, 0);
});

test("şehir/semt adları PII sanılıp maskelenmez (yanlış pozitif yok)", () => {
  const r = maskPII("İstanbul, Barcelona, Lima — 3 şehir 5 gün");
  assert.ok(r.maskedText.includes("İstanbul"));
  assert.ok(r.maskedText.includes("Barcelona"));
});

test("I5: maskeleme demografi (yaş/cinsiyet/milliyet) ETİKETİ türetmez", () => {
  // maskPII yalnız maskeler; çıktıya demografik sınıflandırma EKLEMEZ.
  const r = maskPII("35 yaşında, Türk, ailemle İstanbul'a gidiyorum");
  const blob = JSON.stringify(r);
  assert.equal(/age|gender|nationality|yaş_grubu|demograf/i.test(blob), false);
  // detectedTypes yalnız PII türleri içerir, demografi değil.
  for (const t of r.detectedTypes)
    assert.ok(["EMAIL", "TC_KIMLIK", "CREDIT_CARD", "PHONE", "SSN"].includes(t));
});

test("boş/garip girdi güvenli — boş maskeli metin döner", () => {
  for (const bad of ["", null, undefined, 123]) {
    const r = maskPII(bad);
    assert.equal(r.maskedText, "");
    assert.equal(r.hasPII, false);
    assert.equal(r.detectedTypes.length, 0);
  }
});
