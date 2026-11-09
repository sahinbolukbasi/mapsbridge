// Faz 6 / görev 22 — I6 promotion kuralı (oturum override profili mutasyona uğratmaz).
// shouldPromoteToProfile: bir davranış profile YALNIZCA tekrar (derived ≥3, stated ≥2)
// veya açık "hatırla" isteğiyle yazılır. Eşik altında → promote YOK (profil korunur).
// Ayrıca: açık-hatırla tespiti ve hassas-veri kapısı.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

const m = loadTs(path.resolve(__dirname, "../app/lib/ai/user-memory/types.ts"));

function entry(source) {
  return {
    id: "e1",
    userId: "u1",
    key: "cuisinePreferences",
    value: "ramen",
    source,
    confidence: 0.7,
    visible: true,
    createdAt: "2026-11-01",
    updatedAt: "2026-11-01",
  };
}

test("derived davranış profile YALNIZCA ≥3 tekrarında promote olur (I6 çekirdek)", () => {
  assert.equal(m.shouldPromoteToProfile(entry("derived"), 1, false), false);
  assert.equal(m.shouldPromoteToProfile(entry("derived"), 2, false), false, "2 yetmez");
  assert.equal(m.shouldPromoteToProfile(entry("derived"), 3, false), true, "3'te promote");
});

test("stated davranış ≥2 tekrarında promote olur", () => {
  assert.equal(m.shouldPromoteToProfile(entry("stated"), 1, false), false);
  assert.equal(m.shouldPromoteToProfile(entry("stated"), 2, false), true);
});

test("eşik altında promote YOK — oturum override'ı profili mutasyona uğratmaz (I6)", () => {
  // Tek bir oturumda söylenen/çıkarılan şey profile yazılmaz.
  assert.equal(m.shouldPromoteToProfile(entry("derived"), 1, false), false);
  assert.equal(m.shouldPromoteToProfile(entry("stated"), 1, false), false);
});

test("açık 'hatırla' isteği eşiği atlar (tek seferde promote)", () => {
  assert.equal(m.shouldPromoteToProfile(entry("derived"), 1, true), true);
  assert.equal(m.shouldPromoteToProfile(entry("stated"), 1, true), true);
});

test("confirmed kaynak tek başına (tekrarsız/açık istek yok) promote etmez", () => {
  // shouldPromoteToProfile confirmed'i özel ele almaz → explicit/eşik yoksa false.
  assert.equal(m.shouldPromoteToProfile(entry("confirmed"), 5, false), false);
  assert.equal(m.shouldPromoteToProfile(entry("confirmed"), 1, true), true, "açık istek yazar");
});

test("isExplicitRememberRequest TR + EN kalıplarını yakalar", () => {
  for (const t of ["bunu hatırla", "her zaman böyle olsun", "remember this", "always vegan"])
    assert.equal(m.isExplicitRememberRequest(t), true);
  assert.equal(m.isExplicitRememberRequest("Roma'da ne yesem"), false);
});

test("isSensitiveData sağlık/din/alerji anahtar veya değerini yakalar (açık onay gerekir)", () => {
  assert.equal(m.isSensitiveData("health", "x"), true);
  assert.equal(m.isSensitiveData("diet", "helal yiyorum"), true);
  // Regex 'allerg' (İng. yazım) yakalar; değerde 'allergy' geçerse tetiklenir.
  assert.equal(m.isSensitiveData("notes", "peanut allergy"), true);
  assert.equal(m.isSensitiveData("saglik", "x"), false, "aksansız 'saglik' regex'e uymaz");
  assert.equal(m.isSensitiveData("cuisinePreferences", "ramen"), false);
});

// Karakterizasyon bulgusu: isSensitiveData regex'i Türkçe 'alerji' (tek-l) yakalamaz,
// yalnız 'allerg' (İng.). Mevcut davranış — görev 22'de düzeltilmez (davranış dondurma);
// Faz sonrası iyileştirme adayı (TR eş-anlamlı genişletme).
test("karakterizasyon: Türkçe tek-l 'alerji' regex'e uymaz (bilinen sınır)", () => {
  assert.equal(m.isSensitiveData("alerji", "fıstık alerjim var"), false);
});
