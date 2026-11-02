// locale-utils (design §4.2, D13): dil alternatifi route registry'den türetilir; registry dışı ve
// tek dilli path'ler kendilerini döndürür (var olmayan /en/<path>/ üretilmez). load-ts.cjs ile
// yüklenir (locale-utils → route-registry import'u bundle'a girer).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");
const { getLocaleFromPath, getAlternatePath, localeRootPath } = loadTs(
  path.resolve(__dirname, "../app/lib/locale-utils.ts"),
);
// ─── getLocaleFromPath ────────────────────────────────────────────
test("/ returns tr", () => assert.equal(getLocaleFromPath("/"), "tr"));
test("/en returns en", () => assert.equal(getLocaleFromPath("/en"), "en"));
test("/en/ returns en", () => assert.equal(getLocaleFromPath("/en/"), "en"));
test("/en/maps/ returns en", () => assert.equal(getLocaleFromPath("/en/maps/"), "en"));
test("/maps/ returns tr", () => assert.equal(getLocaleFromPath("/maps/"), "tr"));
test("/haritalar/ returns tr", () => assert.equal(getLocaleFromPath("/haritalar/"), "tr"));
test("/travel-assistant/ returns tr", () =>
  assert.equal(getLocaleFromPath("/travel-assistant/"), "tr"));
test("empty string returns tr", () => assert.equal(getLocaleFromPath(""), "tr"));
// ─── getAlternatePath: gerçek dil varyantı ("/" ↔ "/en/") ──────────
test("/ alternates to /en/", () => assert.equal(getAlternatePath("/"), "/en/"));
test("/en/ alternates to /", () => assert.equal(getAlternatePath("/en/"), "/"));
test("en root /en alternates to /", () => assert.equal(getAlternatePath("/en"), "/"));
// ─── getAlternatePath: kanonik tek dilli sayfalar self ────────────
test("/maps/ stays /maps/", () => assert.equal(getAlternatePath("/maps/"), "/maps/"));
test("/travel-assistant/ stays /travel-assistant/", () =>
  assert.equal(getAlternatePath("/travel-assistant/"), "/travel-assistant/"));
test("/mobile-apps/ stays /mobile-apps/ (self)", () =>
  assert.equal(getAlternatePath("/mobile-apps/"), "/mobile-apps/"));
test("/reset-password/ stays /reset-password/ (self)", () =>
  assert.equal(getAlternatePath("/reset-password/"), "/reset-password/"));
test("/about/ stays /about/ (self; /en/about/ yok)", () =>
  assert.equal(getAlternatePath("/about/"), "/about/"));
// ─── getAlternatePath: LEGACY önce kanonik hedefe çözülür ──────────
test("/haritalar/ alternates to /maps/", () =>
  assert.equal(getAlternatePath("/haritalar/"), "/maps/"));
test("/desk/ alternates to /maps/", () => assert.equal(getAlternatePath("/desk/"), "/maps/"));
test("/gezi-asistani/ alternates to /travel-assistant/", () =>
  assert.equal(getAlternatePath("/gezi-asistani/"), "/travel-assistant/"));
test("/ai-asistan/ alternates to /travel-assistant/", () =>
  assert.equal(getAlternatePath("/ai-asistan/"), "/travel-assistant/"));
test("/ai/ alternates to /travel-assistant/", () =>
  assert.equal(getAlternatePath("/ai/"), "/travel-assistant/"));
test("/mobil-uygulamalar/ alternates to /mobile-apps/", () =>
  assert.equal(getAlternatePath("/mobil-uygulamalar/"), "/mobile-apps/"));
test("/sifre-sifirla/ alternates to /reset-password/", () =>
  assert.equal(getAlternatePath("/sifre-sifirla/"), "/reset-password/"));
test("/forgot-password/ alternates to /reset-password/", () =>
  assert.equal(getAlternatePath("/forgot-password/"), "/reset-password/"));
// ─── getAlternatePath: registry dışı path self (404 üretilmez) ────
test("deep tr path /profile/settings/ stays self", () => {
  assert.equal(getAlternatePath("/profile/settings/"), "/profile/settings/");
});
test("unknown en path /en/profile/settings/ stays self", () => {
  assert.equal(getAlternatePath("/en/profile/settings/"), "/en/profile/settings/");
});
// ─── localeRootPath: alternatifi olmayan sayfada dil anahtarı hedefi ─
test("localeRootPath en → /en/, tr → /", () => {
  assert.equal(localeRootPath("en"), "/en/");
  assert.equal(localeRootPath("tr"), "/");
});
