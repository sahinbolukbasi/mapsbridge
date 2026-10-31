// SEO sözleşmesi build çıktısında (design §5.3, §5.5; AC-11 canonical kısmı, AC-14b).
// Canonical/hreflang alt testleri origin'li build ister (needsOrigin; NEXT_PUBLIC_SITE_URL).
// buildState() geçersizse REQUIRE_BUILD yokken gerekçeli skip, REQUIRE_BUILD=1 iken fail.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");
const { buildState } = require("./helpers/build-meta.cjs");

const APP = path.resolve(__dirname, "../app");
const { CANONICAL_ROUTES, LEGACY_REDIRECTS, expandPaths } = loadTs(
  path.join(APP, "lib/route-registry.ts"),
);

function requireBuild(t, needsOrigin = false) {
  const s = buildState({ needsOrigin });
  if (s.ok) return s;
  if (process.env.REQUIRE_BUILD === "1") assert.fail(`${s.reason}: ${s.message}`);
  t.skip(s.message);
  return null;
}
const htmlOf = (outDir, p) =>
  path.join(outDir, p === "/" ? "index.html" : `${p.slice(1)}index.html`);
const page = (s, p) => fs.readFileSync(htmlOf(s.outDir, p), "utf8");
const canonicalOf = (html) => html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null;
const hreflangs = (html) =>
  Object.fromEntries(
    [...html.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/g)].map((m) => [
      m[1],
      m[2],
    ]),
  );
const titleOf = (html) =>
  (html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"');
const localeOf = (p) => (p === "/en/" || p.startsWith("/en/") ? "en" : "tr");
const sitemapRoutes = () => CANONICAL_ROUTES.filter((r) => r.sitemap);

test("(1) sitemap'teki her URL self-canonical ve <title> registry başlığıyla başlar", (t) => {
  const s = requireBuild(t, true);
  if (!s) return;
  for (const r of sitemapRoutes()) {
    const html = page(s, r.path);
    assert.equal(canonicalOf(html), new URL(r.path, s.meta.siteOrigin).href, `${r.path} canonical`);
    const title = titleOf(html);
    assert.ok(title.startsWith(r.title[localeOf(r.path)]), `${r.path}: <title> "${title}"`);
  }
});

test("(2) LEGACY: hedefi sitemap:true olan 7 sayfada canonical = hedef; diğerlerinde canonical yok", (t) => {
  const s = requireBuild(t, true);
  if (!s) return;
  let withCanonical = 0;
  for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
    const html = page(s, from);
    const target = CANONICAL_ROUTES.find((r) => r.path === to);
    if (target.sitemap) {
      withCanonical++;
      assert.equal(canonicalOf(html), new URL(to, s.meta.siteOrigin).href, `${from} canonical`);
    } else {
      assert.equal(canonicalOf(html), null, `${from}: noindex hedefe canonical yazılmaz`);
      assert.ok(
        html.includes('<meta name="robots" content="noindex, follow"'),
        `${from}: noindex, follow`,
      );
    }
  }
  assert.equal(withCanonical, 7);
});

test("(3) / ve /en/ self-canonical (D15)", (t) => {
  const s = requireBuild(t, true);
  if (!s) return;
  assert.equal(canonicalOf(page(s, "/")), new URL("/", s.meta.siteOrigin).href);
  assert.equal(canonicalOf(page(s, "/en/")), new URL("/en/", s.meta.siteOrigin).href);
});

test("(4) tek dilli /about/: hreflang tr + x-default = sayfa, en yok", (t) => {
  const s = requireBuild(t, true);
  if (!s) return;
  const h = hreflangs(page(s, "/about/"));
  const self = new URL("/about/", s.meta.siteOrigin).href;
  assert.equal(h.tr, self);
  assert.equal(h["x-default"], self);
  assert.equal(h.en, undefined, "/about/ en hreflang taşımamalı");
});

test("(5) / ve /en/ karşılıklı tr/en hreflang", (t) => {
  const s = requireBuild(t, true);
  if (!s) return;
  const tr = new URL("/", s.meta.siteOrigin).href;
  const en = new URL("/en/", s.meta.siteOrigin).href;
  for (const p of ["/", "/en/"]) {
    const h = hreflangs(page(s, p));
    assert.equal(h.tr, tr, `${p} tr`);
    assert.equal(h.en, en, `${p} en`);
  }
});

test("(6) statik <html lang>: /en/ → en, diğer kanonik ve LEGACY sayfalar → tr", (t) => {
  const s = requireBuild(t);
  if (!s) return;
  const bad = [];
  for (const p of [...expandPaths(), ...Object.keys(LEGACY_REDIRECTS)]) {
    const lang = page(s, p).match(/<html lang="([^"]+)"/)?.[1];
    const expected = p === "/en/" ? "en" : "tr";
    if (lang !== expected) bad.push(`${p}: lang=${lang} (beklenen ${expected})`);
  }
  assert.deepEqual(bad, [], bad.join("\n"));
});
