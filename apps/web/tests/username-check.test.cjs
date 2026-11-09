// F3 kullanıcı adı uygunluk saf yardımcılarının birim testi.
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

// TS modülünü küçük bir esbuild transpile ile yükle (projede ts-node yok; saf fonksiyonlar).
// Basit yol: mantığı burada birebir aynala DEĞİL — gerçek kaynaktan regex + eşlemeyi doğrula.
const SRC = path.join(__dirname, "../app/lib/auth/username-check.ts");
const fs = require("node:fs");
const src = fs.readFileSync(SRC, "utf8");

test("statusFromResponse eşlemesi: 404=available, 200=taken, diğer=unknown", () => {
  // Kaynaktaki eşleme sözleşmesini doğrula (regresyon koruması).
  assert.match(src, /httpStatus === 404\) return "available"/);
  assert.match(src, /httpStatus === 200\) return "taken"/);
  assert.match(src, /return "unknown"/);
});

test("validateUsername USERNAME_RE kullanır ve normalize eder", () => {
  assert.match(src, /USERNAME_RE\.test\(u\)/);
  assert.match(src, /normalizeUsername/);
});

test("checkUsernameAvailable mevcut public ucu kullanır, yeni route eklemez", () => {
  assert.match(src, /\/profiles\/\$\{encodeURIComponent\(u\)\}/);
  // Ağ hatasında bloklamaz (unknown döner).
  assert.match(src, /catch \{\s*return "unknown";/);
});

// USERNAME_RE davranışını profile-href kaynağından doğrula (tek kaynak).
test("USERNAME_RE: geçerli/geçersiz örnekler", () => {
  const hrefSrc = fs.readFileSync(
    path.join(__dirname, "../app/lib/navigation/profile-href.ts"),
    "utf8",
  );
  const m = hrefSrc.match(/USERNAME_RE = (\/.*\/)/);
  assert.ok(m, "USERNAME_RE bulunamadı");
  const re = eval(m[1]);
  assert.ok(re.test("deniz.yilmaz"));
  assert.ok(re.test("ali_k"));
  assert.ok(re.test("a-b-c"));
  assert.ok(!re.test("Deniz")); // büyük harf
  assert.ok(!re.test("ali k")); // boşluk
  assert.ok(!re.test("")); // boş
  assert.ok(!re.test("a".repeat(41))); // 40+
});
