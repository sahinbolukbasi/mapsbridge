const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

function loadModule() {
  const file = path.resolve(__dirname, "../app/lib/locale-utils.ts");
  const code = readFileSync(file, "utf8");
  const transformed = transformSync(code, { loader: "ts", format: "cjs", target: "node22" }).code;
  const mod = { exports: {} };
  vm.runInNewContext(transformed, {
    module: mod, exports: mod.exports,
    require, console,
  });
  return mod.exports;
}

const { getLocaleFromPath, getAlternatePath } = loadModule();

// ─── getLocaleFromPath ────────────────────────────────────────────

test("/ returns tr", () => assert.equal(getLocaleFromPath("/"), "tr"));
test("/en returns en", () => assert.equal(getLocaleFromPath("/en"), "en"));
test("/en/ returns en", () => assert.equal(getLocaleFromPath("/en/"), "en"));
test("/en/maps/ returns en", () => assert.equal(getLocaleFromPath("/en/maps/"), "en"));
test("/maps/ returns tr", () => assert.equal(getLocaleFromPath("/maps/"), "tr"));
test("/haritalar/ returns tr", () => assert.equal(getLocaleFromPath("/haritalar/"), "tr"));
test("/travel-assistant/ returns tr", () => assert.equal(getLocaleFromPath("/travel-assistant/"), "tr"));
test("empty string returns tr", () => assert.equal(getLocaleFromPath(""), "tr"));

// ─── getAlternatePath (ROUTE_MAP exact matches) ──────────────────

test("/ alternates to /en/", () => assert.equal(getAlternatePath("/"), "/en/"));
test("/en/ alternates to /", () => assert.equal(getAlternatePath("/en/"), "/"));
test("/maps/ stays /maps/", () => assert.equal(getAlternatePath("/maps/"), "/maps/"));
test("/haritalar/ alternates to /maps/", () => assert.equal(getAlternatePath("/haritalar/"), "/maps/"));
test("/desk/ alternates to /maps/", () => assert.equal(getAlternatePath("/desk/"), "/maps/"));
test("/travel-assistant/ stays /travel-assistant/", () => assert.equal(getAlternatePath("/travel-assistant/"), "/travel-assistant/"));
test("/gezi-asistani/ alternates to /travel-assistant/", () => assert.equal(getAlternatePath("/gezi-asistani/"), "/travel-assistant/"));
test("/ai-asistan/ alternates to /travel-assistant/", () => assert.equal(getAlternatePath("/ai-asistan/"), "/travel-assistant/"));
test("/ai/ alternates to /travel-assistant/", () => assert.equal(getAlternatePath("/ai/"), "/travel-assistant/"));
test("/mobil-uygulamalar/ alternates to /mobile-apps/", () => assert.equal(getAlternatePath("/mobil-uygulamalar/"), "/mobile-apps/"));
test("/mobile-apps/ alternates to /mobil-uygulamalar/", () => assert.equal(getAlternatePath("/mobile-apps/"), "/mobil-uygulamalar/"));
test("/sifre-sifirla/ alternates to /reset-password/", () => assert.equal(getAlternatePath("/sifre-sifirla/"), "/reset-password/"));
test("/reset-password/ alternates to /sifre-sifirla/", () => assert.equal(getAlternatePath("/reset-password/"), "/sifre-sifirla/"));
test("/forgot-password/ alternates to /reset-password/", () => assert.equal(getAlternatePath("/forgot-password/"), "/reset-password/"));

// ─── getAlternatePath (dynamic locale flip) ───────────────────────

test("tr path /about/ flips to /en/about/", () => assert.equal(getAlternatePath("/about/"), "/en/about/"));
test("en path /en/about/ flips to /about/", () => assert.equal(getAlternatePath("/en/about/"), "/about/"));
test("en root /en flips to /", () => assert.equal(getAlternatePath("/en"), "/"));
test("deep tr path /profile/settings/ flips to /en/profile/settings/", () => {
  assert.equal(getAlternatePath("/profile/settings/"), "/en/profile/settings/");
});
test("deep en path /en/profile/settings/ flips to /profile/settings/", () => {
  assert.equal(getAlternatePath("/en/profile/settings/"), "/profile/settings/");
});
