// Route registry sözleşmesi (design §4.2, §5.1–5.4; AC-11, AC-12, AC-13, AC-14, AC-34).
// Kaynak düzeyi alt testler build gerektirmez. Build-bağımlı alt testler (out/) buildState()
// geçersizse REQUIRE_BUILD yokken gerekçeli skip, REQUIRE_BUILD=1 iken fail (design §10, R5-2).
// generate-seo.cjs require EDİLMEZ (yüklenirken public/sitemap.xml ve robots.txt yazar); sitemap.xml
// ve PAGES dizisi metin olarak okunur (AC-13).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");
const { buildState } = require("./helpers/build-meta.cjs");

const WEB = path.resolve(__dirname, "..");
const APP = path.join(WEB, "app");
const read = (rel) => fs.readFileSync(path.join(WEB, rel), "utf8");
const { CANONICAL_ROUTES, LEGACY_REDIRECTS, expandPaths, resolveAlternate, findRoute } = loadTs(
  path.join(APP, "lib/route-registry.ts"),
);
const registryExtras = loadTs(path.join(APP, "lib/route-registry.ts"));
// vm bağlamındaki diziler başka realm'dendir (deepStrictEqual prototipi karşılaştırır): kopyala.
const plain = (v) => JSON.parse(JSON.stringify(v));

// R5-1: C1'de (92628d1) donmuş 42 çekirdek path. Fixture yalnızca büyür; buradan silinemez.
const BASELINE_42 = [
  "/",
  "/about/",
  "/admin/",
  "/ai-asistan/",
  "/ai/",
  "/articles/",
  "/auth/callback/",
  "/checkout/",
  "/community/",
  "/contact/",
  "/cookies/",
  "/demo/",
  "/desk/",
  "/en/",
  "/forgot-password/",
  "/gezgin/",
  "/gezi-asistani/",
  "/harita/",
  "/haritalar/",
  "/how-it-works/",
  "/k/",
  "/kasif/",
  "/login/",
  "/maps/",
  "/messages/",
  "/mobil-uygulamalar/",
  "/mobile-apps/",
  "/privacy/",
  "/profile/",
  "/profile/edit/",
  "/profile/photo/",
  "/register/",
  "/reset-password/",
  "/sifre-sifirla/",
  "/support/",
  "/terms/",
  "/travel-assistant/",
  "/traveler/",
  "/u/",
  "/u/admin/",
  "/verify/",
  "/welcome/",
];
// Sitemap URL'leri (design §5.1; AC-13): başlangıçtaki 13 URL + /pricing/ (design §7.1, karar S4
// artım 5: yeni kanonik, indekslenen fiyat sayfası). /welcome/ karar S8 ile LEGACY → /register/
// oldu (design §5.2, F13) ve sitemap'ten çıktı.
const SITEMAP_URLS = [
  "/en/",
  "/maps/",
  "/travel-assistant/",
  "/mobile-apps/",
  "/pricing/",
  "/community/",
  "/how-it-works/",
  "/support/",
  "/about/",
  "/contact/",
  "/privacy/",
  "/terms/",
  "/cookies/",
];
// AC-34 bekleyen sayfalar (MobileStart'ın ikinci <main>/<h1>'i FEAT-004'te silindi; liste boş).
// Liste yalnızca küçülür: sayfa düzelince bu test listeden çıkarılmasını ister.
const AC34_PENDING = {};

function requireBuild(t) {
  const s = buildState();
  if (s.ok) return s;
  if (process.env.REQUIRE_BUILD === "1") assert.fail(`${s.reason}: ${s.message}`);
  t.skip(s.message);
  return null;
}
const htmlOf = (outDir, p) =>
  path.join(outDir, p === "/" ? "index.html" : `${p.slice(1)}index.html`);
const count = (html, re) => (html.match(re) ?? []).length;

test("AC-12: fixture 42 çekirdek path'i içerir ve yalnızca büyür", () => {
  const { routes } = JSON.parse(read("tests/fixtures/baseline-routes.json"));
  assert.ok(routes.length >= 42, `fixture ${routes.length} < 42`);
  const missing = BASELINE_42.filter((p) => !routes.includes(p));
  assert.deepEqual(missing, [], `fixture'dan silinen çekirdek path: ${missing.join(", ")}`);
});

test("AC-12 (a): her fixture path'i expandPaths() ∪ LEGACY_REDIRECTS kümesinde", () => {
  const { routes } = JSON.parse(read("tests/fixtures/baseline-routes.json"));
  const known = new Set([...expandPaths(), ...Object.keys(LEGACY_REDIRECTS)]);
  const missing = routes.filter((p) => !known.has(p));
  assert.deepEqual(
    missing,
    [],
    `registry'de olmayan path: ${missing.join(", ")} → route-registry.ts'e kanonik ya da LEGACY kaydı ekleyin`,
  );
});

test("AC-12 (b): her fixture path'i için out/<path>/index.html var (404 yok)", (t) => {
  const s = requireBuild(t);
  if (!s) return;
  const { routes } = JSON.parse(read("tests/fixtures/baseline-routes.json"));
  const missing = routes.filter((p) => !fs.existsSync(htmlOf(s.outDir, p)));
  assert.deepEqual(missing, [], `out/ içinde yok: ${missing.join(", ")}`);
});

test("registry tutarlılığı: path biçimi, tekillik, LEGACY zinciri yok, hedefler kanonik", () => {
  const paths = CANONICAL_ROUTES.map((r) => r.path);
  assert.equal(new Set(paths).size, paths.length, "yinelenen kanonik path");
  for (const r of CANONICAL_ROUTES) {
    assert.match(r.path, /^\/(.*\/)?$/, `${r.path} sonda / ile bitmeli`);
    assert.ok(fs.existsSync(path.join(WEB, r.file)), `${r.path}: ${r.file} yok`);
    assert.ok(r.title.tr && r.title.en, `${r.path}: title.tr/en zorunlu`);
    if (r.sitemap)
      assert.ok(r.description?.tr && r.description?.en, `${r.path}: sitemap:true → description`);
  }
  for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
    assert.ok(!paths.includes(from), `${from} hem kanonik hem LEGACY`);
    assert.ok(paths.includes(to), `${from} → ${to}: hedef kanonik değil`);
    assert.ok(!LEGACY_REDIRECTS[to], `${from} → ${to}: zincir`);
  }
});

test("chrome/footer/nav alanları (design §5.1–5.3, R5): enum, kanonik footer, tr+en etiket", () => {
  const { CHROME_VARIANTS, FOOTER_GROUPS, footerRoutes } = registryExtras;
  assert.deepEqual(plain(CHROME_VARIANTS), [
    "default",
    "wide",
    "wide-compact",
    "immersive",
    "focus",
  ]);
  assert.deepEqual(plain(FOOTER_GROUPS), ["product", "resources", "legal"]);
  for (const r of CANONICAL_ROUTES) {
    if (r.chrome !== undefined)
      assert.ok(CHROME_VARIANTS.includes(r.chrome), `${r.path}: chrome "${r.chrome}" enum dışı`);
    if (r.footer !== undefined) {
      assert.ok(FOOTER_GROUPS.includes(r.footer), `${r.path}: footer "${r.footer}" enum dışı`);
      assert.ok(!r.staticParams && !r.path.includes("["), `${r.path}: footer'da dinamik rota`);
      assert.ok(!LEGACY_REDIRECTS[r.path], `${r.path}: footer bağlantısı LEGACY`);
      // Sitemap'teki sayfa indexlenir; noindex sayfa sitemap'e girmez (tutarlılık).
      if (r.sitemap) assert.equal(r.robots, "index", `${r.path}: sitemap:true ama noindex`);
    }
    if (r.nav !== undefined) assert.ok(r.nav.tr && r.nav.en, `${r.path}: nav.tr/nav.en zorunlu`);
  }
  for (const r of CANONICAL_ROUTES) if (r.robots === "noindex") assert.equal(r.sitemap, false);
  const byGroup = Object.fromEntries(
    FOOTER_GROUPS.map((g) => [g, plain(footerRoutes(g).map((r) => r.path))]),
  );
  // design §5.3 sütunları; "Planlar ve kredi" = /pricing/ (design §7, FEAT-005).
  assert.deepEqual(byGroup, {
    product: ["/maps/", "/travel-assistant/", "/community/", "/mobile-apps/", "/pricing/"],
    resources: ["/how-it-works/", "/articles/", "/support/", "/contact/", "/about/"],
    legal: ["/privacy/", "/terms/", "/cookies/"],
  });
  const chromeOf = (p) => findRoute(p)?.chrome ?? "default";
  for (const p of ["/maps/", "/travel-assistant/", "/messages/"])
    assert.equal(chromeOf(p), "immersive", p);
  for (const p of ["/login/", "/register/", "/reset-password/", "/verify/", "/auth/callback/"])
    assert.equal(chromeOf(p), "focus", p);
});

test("adlandırma sözlüğü (design §5.1): başlıklar ve kısa menü etiketleri", () => {
  const title = (p) => plain(findRoute(p).title);
  const nav = (p) => plain(findRoute(p).nav);
  assert.deepEqual(title("/maps/"), { tr: "Rota planlayıcı", en: "Route planner" });
  assert.deepEqual(title("/travel-assistant/"), { tr: "Gezi asistanı", en: "Travel assistant" });
  assert.deepEqual(title("/profile/"), { tr: "Profilim", en: "My profile" });
  assert.deepEqual(nav("/maps/"), { tr: "Planla", en: "Plan" });
  assert.deepEqual(nav("/travel-assistant/"), { tr: "Asistan", en: "Assistant" });
  assert.deepEqual(nav("/community/"), { tr: "Topluluk", en: "Community" });
  assert.deepEqual(nav("/messages/"), { tr: "Mesajlar", en: "Messages" });
  assert.deepEqual(nav("/profile/"), { tr: "Profil", en: "Profile" });
  assert.deepEqual(nav("/pricing/"), { tr: "Planlar", en: "Plans" });
  assert.deepEqual(title("/pricing/"), { tr: "Planlar ve kredi", en: "Plans and credits" });
  assert.deepEqual(title("/checkout/"), { tr: "Bakiye ve ödeme", en: "Balance and payment" });
  const banned =
    /6 haneli|6-digit|topografik|topographic|saniyeler içinde|in seconds|senkronize|sync|çevrimdışı navigasyon|offline navigation|saha modu|field mode/i;
  for (const r of CANONICAL_ROUTES)
    for (const v of [r.title.tr, r.title.en, r.description?.tr ?? "", r.description?.en ?? ""])
      assert.doesNotMatch(v, banned, `${r.path}: doğrulanmamış iddia`);
});

test("isNavActive: LEGACY hedefe çözülür, ana sayfa yalnızca kökte etkin", () => {
  const { isNavActive } = registryExtras;
  assert.equal(isNavActive("/maps/", "/maps/"), true);
  assert.equal(isNavActive("/harita/", "/maps/"), true);
  assert.equal(isNavActive("/profile/edit/", "/profile/"), true);
  assert.equal(isNavActive("/en/", "/"), true);
  assert.equal(isNavActive("/maps/", "/"), false);
  assert.equal(isNavActive("/messages/", "/maps/"), false);
});

function sitemapPaths() {
  return [...read("public/sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => new URL(m[1]).pathname)
    .sort();
}
function seoPages() {
  return [...read("scripts/generate-seo.cjs").matchAll(/\{\s*path:\s*"([^"]+)"/g)]
    .map((m) => m[1])
    .sort();
}
test("AC-13: sitemap.xml = generate-seo.cjs PAGES = registry sitemap:true = SITEMAP_URLS (13 + /pricing/)", () => {
  const registry = plain(CANONICAL_ROUTES.filter((r) => r.sitemap).map((r) => r.path)).sort();
  assert.deepEqual(sitemapPaths(), [...SITEMAP_URLS].sort(), "public/sitemap.xml değişti");
  assert.deepEqual(seoPages(), [...SITEMAP_URLS].sort(), "generate-seo.cjs PAGES değişti");
  assert.deepEqual(
    registry,
    [...SITEMAP_URLS].sort(),
    "registry sitemap:true kümesi sitemap ile ayrıştı",
  );
});

test("AC-14: getAlternatePath/resolveAlternate registry dışı URL döndürmez", () => {
  const canonical = new Set(expandPaths());
  for (const p of [...expandPaths(), ...Object.keys(LEGACY_REDIRECTS)]) {
    const alt = resolveAlternate(p);
    assert.ok(canonical.has(alt), `${p} → ${alt} registry'de değil`);
  }
  assert.equal(resolveAlternate("/"), "/en/");
  assert.equal(resolveAlternate("/en/"), "/");
  assert.equal(resolveAlternate("/about/"), "/about/");
});

test("AC-14: [username] staticParams = generateStaticParams()", () => {
  const dir = path.join(APP, "[username]");
  const mod = loadTs(path.join(dir, "page.tsx"), {
    stubs: {
      [path.join(dir, "public-profile-client.tsx")]: path.join(
        __dirname,
        "stubs/empty-component.cjs",
      ),
      [path.join(APP, "lib/site-metadata.ts")]: path.join(__dirname, "stubs/site-metadata.cjs"),
    },
  });
  const generated = plain(mod.generateStaticParams()).map((p) => `/${p.username}/`);
  const entry = CANONICAL_ROUTES.find((r) => r.path === "/[username]/");
  assert.ok(entry, "/[username]/ kaydı yok");
  assert.deepEqual(plain(entry.staticParams), generated);
  for (const p of generated)
    assert.equal(findRoute(p)?.path, "/[username]/", `${p} → [username] kaydı`);
});

test("AC-11: her LEGACY sayfası anında meta refresh + noindex,follow taşır", (t) => {
  const s = requireBuild(t);
  if (!s) return;
  for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
    const file = htmlOf(s.outDir, from);
    assert.ok(fs.existsSync(file), `${from}: out/ içinde yok`);
    const html = fs.readFileSync(file, "utf8");
    const head = html.slice(0, html.indexOf("</head>"));
    assert.ok(
      head.includes(`<meta http-equiv="refresh" content="0;url=${to}"/>`),
      `${from}: <head> içinde 0 sn refresh → ${to} yok`,
    );
    assert.ok(
      head.includes('<meta name="robots" content="noindex, follow"/>'),
      `${from}: noindex, follow yok`,
    );
    assert.ok(
      html.includes(`location.replace(${JSON.stringify(to)}+location.search+location.hash)`),
      `${from}: query/hash koruyan script yok`,
    );
    assert.ok(
      html.includes(`href="${to}"`) && html.includes("Devam etmek için tıklayın"),
      `${from}: görünür bağlantı yok`,
    );
  }
});

test("AC-34: her kanonik rotanın statik HTML'i tek <main> ve tek <h1> içerir", (t) => {
  const s = requireBuild(t);
  if (!s) return;
  const problems = [];
  for (const p of expandPaths()) {
    const file = htmlOf(s.outDir, p);
    if (!fs.existsSync(file)) {
      problems.push(`${p}: out/ içinde yok`);
      continue;
    }
    const html = fs.readFileSync(file, "utf8");
    const ok = count(html, /<main[\s>]/g) === 1 && count(html, /<h1[\s>]/g) === 1;
    if (AC34_PENDING[p]) {
      if (ok) problems.push(`${p} artık geçiyor: AC34_PENDING'den çıkarın (${AC34_PENDING[p]})`);
    } else if (!ok)
      problems.push(`${p}: <main ${count(html, /<main[\s>]/g)}, <h1 ${count(html, /<h1[\s>]/g)}`);
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});
