// Yönlendirme sözleşmesi (design §5.4, §12.2; R8): safe-next ve paylaşım kodu normalizasyonu.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

const APP = path.resolve(__dirname, "../app");
const { safeNext, readNext, NEXT_MAX_LENGTH, DEFAULT_NEXT } = loadTs(
  path.join(APP, "lib/navigation/safe-next.ts"),
);
const { normalizeShareCode, isValidShareCode } = loadTs(path.join(APP, "lib/share/share-code.ts"));
const ORIGIN = "https://mapsbridge.com";

test("safeNext: kanonik, staticParams ve LEGACY yolları kabul edilir, search korunur", () => {
  assert.equal(safeNext("/maps/?trip=1", ORIGIN), "/maps/?trip=1");
  assert.equal(safeNext("/k/?code=AB12", ORIGIN), "/k/?code=AB12");
  assert.equal(safeNext("/gezgin/", ORIGIN), "/gezgin/");
  assert.equal(safeNext("/harita/", ORIGIN), "/harita/");
  assert.equal(safeNext("/travel-assistant/?q=Roma", ORIGIN), "/travel-assistant/?q=Roma");
  assert.equal(safeNext("/checkout", ORIGIN), "/checkout/", "sondaki / tamamlanır");
});

test("safeNext: dış origin, protokol-göreli, ters bölü ve bilinmeyen yol reddedilir", () => {
  for (const bad of [
    "https://evil.example/",
    "//evil",
    "//evil.example/maps/",
    "/\\evil",
    "/\\/evil.example/",
    "/not-a-route/",
    "maps/",
    "javascript:alert(1)",
    "",
    null,
    undefined,
  ])
    assert.equal(safeNext(bad, ORIGIN), DEFAULT_NEXT, `kabul edilmemeli: ${String(bad)}`);
  assert.equal(safeNext("//evil", ORIGIN, "/"), "/", "fallback parametresi");
});

test("safeNext: hash atılır; 512 karakter sınırı", () => {
  assert.equal(safeNext("/maps/?trip=1#durak-3", ORIGIN), "/maps/?trip=1");
  const long = "/maps/?q=" + "a".repeat(600);
  assert.ok(long.length > NEXT_MAX_LENGTH);
  assert.equal(safeNext(long, ORIGIN), DEFAULT_NEXT);
  const edge = "/maps/?q=" + "a".repeat(NEXT_MAX_LENGTH - 9);
  assert.equal(edge.length, NEXT_MAX_LENGTH);
  assert.equal(safeNext(edge, ORIGIN), edge);
});

test("readNext: next, redirect'ten önce gelir; redirect geriye uyumlu okunur", () => {
  assert.equal(readNext("?next=%2Fcommunity%2F&redirect=%2Fprofile%2F", ORIGIN), "/community/");
  assert.equal(readNext("?redirect=%2Fcheckout%2F", ORIGIN), "/checkout/");
  assert.equal(readNext("?next=https%3A%2F%2Fevil.example%2F", ORIGIN), DEFAULT_NEXT);
  assert.equal(readNext("", ORIGIN), DEFAULT_NEXT);
  assert.equal(
    readNext(`?next=${encodeURIComponent("/travel-assistant/?q=Roma'da 3 gün")}`, ORIGIN),
    "/travel-assistant/?q=Roma%27da%203%20g%C3%BCn",
  );
});

test("share-code: boşluklar silinir, büyük harfe çevrilir; biçim ve uzunluk sınırları", () => {
  assert.equal(normalizeShareCode("  ab 12-cd \n"), "AB12-CD");
  assert.equal(normalizeShareCode(null), "");
  assert.equal(isValidShareCode("AB12"), true);
  assert.equal(isValidShareCode("A".repeat(32)), true);
  assert.equal(isValidShareCode("ABC"), false, "en az 4");
  assert.equal(isValidShareCode("A".repeat(33)), false, "en çok 32");
  assert.equal(isValidShareCode("ab12"), false, "normalize edilmemiş küçük harf");
  assert.equal(isValidShareCode("AB_12"), false);
  assert.equal(isValidShareCode(normalizeShareCode("mb-8492")), true);
});

test("footer bağlantıları registry'den (F29): sabit href yok, kırık çapalar hiçbir yerde yok", () => {
  const fs = require("node:fs");
  const footer = fs.readFileSync(path.join(APP, "components/site-footer.tsx"), "utf8");
  assert.doesNotMatch(footer, /href=["'{`]+\//, "site-footer.tsx sabit href içeriyor");
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(p);
      return /\.(tsx?|json)$/.test(e.name) ? [p] : [];
    });
  const hits = walk(APP).filter((f) =>
    /\/#(faq|kullanici-yorumlari)\b/.test(fs.readFileSync(f, "utf8")),
  );
  assert.deepEqual(
    hits.map((f) => path.relative(APP, f)),
    [],
  );
});

test("dönüş parametresi üreticileri yalnızca next yazar; paylaşım üreticileri ?code= (R8, §5.4)", () => {
  const fs = require("node:fs");
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === "node_modules" || e.name === "ai" ? [] : walk(p);
      return /\.tsx?$/.test(e.name) ? [p] : [];
    });
  const bad = [];
  for (const f of walk(APP)) {
    const src = fs.readFileSync(f, "utf8");
    if (/[?&]redirect=/.test(src)) bad.push(`${path.relative(APP, f)}: ?redirect=`);
    if (/[?&]kod=/.test(src)) bad.push(`${path.relative(APP, f)}: ?kod=`);
  }
  assert.deepEqual(bad, []);
});
