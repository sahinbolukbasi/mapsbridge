// Pin paylaşım kodu codec'i (D3): encode→decode round-trip ve geçersiz girişin reddi.
// Kod kuralı `^[A-Za-z0-9-]{4,64}$` korunur; koordinat uydurulmaz, hatada null (I1).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

const APP = path.resolve(__dirname, "../app");
const { encodePinCode, decodePinCode, SHARE_CODE_PATTERN } = loadTs(
  path.join(APP, "lib/share/pin-link.ts"),
);

function roundtrip(pin) {
  const code = encodePinCode(pin);
  assert.match(code, SHARE_CODE_PATTERN, `kod biçimi: ${code}`);
  const out = decodePinCode(code);
  assert.ok(out, `çözülebildi: ${code}`);
  // Koordinat 6 ondalıkta korunur.
  assert.equal(out.lat.toFixed(6), Number(pin.lat).toFixed(6));
  assert.equal(out.lng.toFixed(6), Number(pin.lng).toFixed(6));
  return out;
}

test("encode→decode: pozitif/negatif koordinat ve sınır değerler korunur", () => {
  roundtrip({ lat: 41.008237, lng: 28.978359, label: "Ayasofya" });
  roundtrip({ lat: -33.868819, lng: 151.20929, label: "Opera" });
  roundtrip({ lat: 0, lng: 0, label: "Boş Ada" });
  roundtrip({ lat: 90, lng: 180, label: "Uç" });
  roundtrip({ lat: -90, lng: -180, label: "Diğer uç" });
});

test("etiket: boşluk/unicode korunur, 60 karaktere kırpılır", () => {
  const out = roundtrip({ lat: 41.0, lng: 29.0, label: "Kız Kulesi — İstanbul" });
  assert.equal(out.label, "Kız Kulesi — İstanbul");
  const long = "x".repeat(200);
  const trimmed = roundtrip({ lat: 41.0, lng: 29.0, label: long });
  assert.ok(trimmed.label.length <= 60, "etiket kırpıldı");
  // Etiket içindeki | ayıracı round-trip'i bozmaz.
  const pipe = roundtrip({ lat: 1, lng: 2, label: "A|B|C" });
  assert.equal(pipe.label, "A|B|C");
  // Etiketsiz pin de geçerli.
  const empty = roundtrip({ lat: 10, lng: 20, label: "" });
  assert.equal(empty.label, "");
});

test("decode: geçersiz girişler null döner (asla koordinat uydurmaz)", () => {
  assert.equal(decodePinCode(null), null);
  assert.equal(decodePinCode(undefined), null);
  assert.equal(decodePinCode(""), null);
  assert.equal(decodePinCode("ab"), null, "çok kısa (kurala uymaz)");
  assert.equal(decodePinCode("abc$def"), null, "geçersiz karakter");
  assert.equal(decodePinCode("a_bc"), null, "alt çizgi kuralda yok");
  assert.equal(decodePinCode("x".repeat(65)), null, "çok uzun");
  assert.equal(decodePinCode("ZZZZ"), null, "geçerli biçim ama anlamsız yük");
});

test("decode: aralık dışı koordinat reddedilir", () => {
  // lat/lng aralığını aşan gerçek bir kodu elle kuramayız; encode sınırı zaten koruyor.
  // Doğrudan sentetik bir yük ile aralık kontrolünü doğrula: lat=100 kodlanmış olsa bile red.
  const code = encodePinCode({ lat: 100, lng: 200, label: "x" });
  // encode aralık dayatmaz; decode etmeli ve aralık dışı olduğu için null dönmeli.
  assert.equal(decodePinCode(code), null, "lat>90/lng>180 reddedilir");
});
