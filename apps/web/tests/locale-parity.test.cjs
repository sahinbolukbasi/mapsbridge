// i18n Parite Testi
// -----------------
// Amaç: en.json ve tr.json anahtar kümelerinin BİREBİR eşit kalmasını garanti etmek.
// Bir dile anahtar eklenip diğerine eklenmezse, o dildeki kullanıcı ham anahtar görür
// (I11 — dil eşleşmesi ihlali). Bu test sapmayı CI'da yakalar.
//
// Kaynak: PLAN.md FAZ 1 / adım 5. Konvansiyon: node:test + node:assert/strict, CommonJS.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const localesDir = path.resolve(__dirname, "../app/locales");
const en = require(path.join(localesDir, "en.json"));
const tr = require(path.join(localesDir, "tr.json"));

// Flat ya da nested olabilir — her iki durumu da düzleştirerek anahtar kümesini çıkar.
function flatKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flatKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys.sort();
}

test("i18n parite: en.json ve tr.json aynı anahtar kümesine sahip", () => {
  const enKeys = new Set(flatKeys(en));
  const trKeys = new Set(flatKeys(tr));

  const onlyInEn = [...enKeys].filter((k) => !trKeys.has(k));
  const onlyInTr = [...trKeys].filter((k) => !enKeys.has(k));

  assert.deepEqual(
    onlyInEn,
    [],
    `en.json'da olup tr.json'da OLMAYAN anahtarlar: [${onlyInEn}]. ` +
      `Türk kullanıcı bu anahtarlarda ham metin görür (I11 ihlali). tr.json'a ekle.`,
  );
  assert.deepEqual(
    onlyInTr,
    [],
    `tr.json'da olup en.json'da OLMAYAN anahtarlar: [${onlyInTr}]. ` +
      `İngilizce kullanıcı bu anahtarlarda ham metin görür (I11 ihlali). en.json'a ekle.`,
  );
});

test("i18n parite: hiçbir çeviri değeri boş değil", () => {
  function emptyValues(obj, prefix = "") {
    const empties = [];
    for (const [k, v] of Object.entries(obj)) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        empties.push(...emptyValues(v, full));
      } else if (typeof v === "string" && v.trim() === "") {
        empties.push(full);
      }
    }
    return empties;
  }
  assert.deepEqual(emptyValues(en), [], `en.json boş değerli anahtarlar içeriyor.`);
  assert.deepEqual(emptyValues(tr), [], `tr.json boş değerli anahtarlar içeriyor.`);
});
