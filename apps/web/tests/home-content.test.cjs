// Ana sayfa içerik sözleşmesi (design §10, §5.1; kararlar S1, S6, S11; FEAT-004).
// (a) yasak terimler ana sayfa kaynaklarında ve home.* değerlerinde yok; (b) hoş geldin kredisi
// sayısı contracts BILLING_COST.WELCOME_CREDITS ile aynı; (c) S6/S11 kapıları: home.faq.q4 ve
// home.mobile.* render edilmez; (d) kaynakta kullanılan her home.*/trip.* anahtarı iki dilde var.
// Build-bağımlı alt test (§10 bölüm sırası) REQUIRE_BUILD yokken skip, REQUIRE_BUILD=1 iken fail.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");
const { buildState } = require("./helpers/build-meta.cjs");

const WEB = path.resolve(__dirname, "..");
const APP = path.join(WEB, "app");
const ROOT = path.resolve(WEB, "../..");
const tr = require(path.join(APP, "locales/tr.json"));
const en = require(path.join(APP, "locales/en.json"));

// Ana sayfanın render ettiği kaynaklar (home-client + alt bileşenleri).
const HOME_SOURCES = [
  "home-client.tsx",
  "home-prompt.tsx",
  "en/page.tsx",
  "page.tsx",
  "components/trip/sample-route-preview.tsx",
  "components/trip/stop-row.tsx",
  "components/trip/connector.tsx",
  "components/trip/day-header.tsx",
  "components/trip/trip-format.ts",
];
const source = (rel) => fs.readFileSync(path.join(APP, rel), "utf8");
const homeValues = (dict) => Object.entries(dict).filter(([k]) => k.startsWith("home."));

// design §5.1 yasak terimleri + S1/S6 iddiaları. Büyük/küçük harf duyarsız; yalnızca kelime
// BAŞI sınırıyla aranır ki Türkçe ekli biçimler de yakalansın ("Harita Masası", "Masada").
const FORBIDDEN = [
  "Masa",
  "Desk",
  "ROUTE OS",
  "Eco-Path",
  "CANLI KÖPRÜ",
  "Portföy",
  "v2.4",
  "SİSTEM AKTİF",
  "256-Bit",
  "kredi kartı gerekmez",
  "EN POPÜLER",
  "yakında",
  "App Store",
  "Google Play",
  "uygulamayı indir",
];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const forbiddenRe = (term) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(term)}`, "iu");

test("(a) yasak terimler ana sayfa kaynaklarında ve home.* değerlerinde yok", () => {
  const hits = [];
  for (const rel of HOME_SOURCES)
    for (const term of FORBIDDEN)
      if (forbiddenRe(term).test(source(rel))) hits.push(`${rel}: ${term}`);
  for (const [lang, dict] of [
    ["tr", tr],
    ["en", en],
  ])
    for (const [key, value] of homeValues(dict))
      for (const term of FORBIDDEN)
        if (forbiddenRe(term).test(value)) hits.push(`${lang}.${key}: ${term}`);
  assert.deepEqual(hits, [], `yasak terim: ${hits.join("; ")}`);
});

test("(a) silinen sahte veri ve MobileStart'a referans kalmadı", () => {
  for (const rel of ["components/mobile-start.tsx", "features/landing/landing-data.ts"])
    assert.equal(fs.existsSync(path.join(APP, rel)), false, `${rel} hâlâ var`);
  for (const rel of HOME_SOURCES)
    assert.doesNotMatch(source(rel), /mobile-start|features\/landing|MobileStart/, rel);
});

test("(b) hero güven satırı hoş geldin kredisini contracts değeriyle gösterir (S1)", () => {
  const { BILLING_COST } = loadTs(path.join(ROOT, "packages/contracts/src/index.ts"));
  const { WELCOME_CREDITS_DISPLAY } = loadTs(path.join(APP, "lib/billing/credit-costs.ts"));
  const n = String(BILLING_COST.WELCOME_CREDITS);
  assert.equal(String(WELCOME_CREDITS_DISPLAY), n);
  for (const [lang, dict] of [
    ["tr", tr],
    ["en", en],
  ]) {
    const trust = Object.entries(dict)
      .filter(([k]) => k.startsWith("home.hero.trust."))
      .map(([, v]) => v);
    assert.ok(trust.length === 3, `${lang}: home.hero.trust.* 3 madde olmalı`);
    assert.ok(
      trust.some((v) => new RegExp(`(^|\\D)${n}(\\D|$)`).test(v)),
      `${lang}: home.hero.trust.* hoş geldin kredisi ${n} içermiyor`,
    );
  }
});

test("(c) S6/S11 kapıları: SSS q4 ve mobil bölüm ana sayfada render edilmez", () => {
  for (const rel of HOME_SOURCES) {
    const src = source(rel);
    assert.doesNotMatch(src, /home\.faq\.[qa]4\b/, `${rel} home.faq.q4/a4 kullanıyor (S11)`);
    assert.doesNotMatch(src, /home\.mobile\./, `${rel} home.mobile.* kullanıyor (S6)`);
  }
  // Anahtarlar tanımlıdır (kullanıcı teyidiyle açılır), yalnızca render edilmez.
  for (const key of ["home.faq.q4", "home.faq.a4", "home.mobile.title", "home.mobile.sub"])
    assert.ok(tr[key] && en[key], `${key} tanımlı olmalı`);
});

test("(d) kaynakta kullanılan her home.*/trip.* anahtarı iki dilde de var", () => {
  const missing = [];
  for (const rel of HOME_SOURCES)
    for (const m of source(rel).matchAll(/["'`]((?:home|trip)\.[A-Za-z0-9_.]+)["'`]/g)) {
      const key = m[1];
      if (!(key in tr)) missing.push(`tr ${key} (${rel})`);
      if (!(key in en)) missing.push(`en ${key} (${rel})`);
    }
  assert.deepEqual(missing, [], `eksik anahtar: ${missing.join(", ")}`);
});

test("(d) home-client şablon anahtar kullanmaz (statik kontrol edilebilir kalır)", () => {
  for (const rel of HOME_SOURCES)
    assert.doesNotMatch(source(rel), /t\(`home\./, `${rel} şablon home.* anahtarı kullanıyor`);
});

function requireBuild(t) {
  const s = buildState();
  if (s.ok) return s;
  if (process.env.REQUIRE_BUILD === "1") assert.fail(`${s.reason}: ${s.message}`);
  t.skip(s.message);
  return null;
}

test("§10 bölüm sırası: / ve /en/ (mobil bölüm ve q4 yok)", (t) => {
  const s = requireBuild(t);
  if (!s) return;
  const ORDER = [
    "basla",
    "nasil-calisir",
    "ozellikler",
    "bagimsizlik",
    "krediler",
    "paylasim",
    "sss",
    "son",
  ];
  for (const file of ["index.html", "en/index.html"]) {
    const html = fs.readFileSync(path.join(s.outDir, file), "utf8");
    const positions = ORDER.map((id) => html.indexOf(`id="${id}"`));
    assert.ok(
      positions.every((p) => p >= 0),
      `${file}: eksik bölüm ${ORDER.filter((_, i) => positions[i] < 0)}`,
    );
    assert.deepEqual(
      [...positions].sort((a, b) => a - b),
      positions,
      `${file}: bölüm sırası bozuk`,
    );
    assert.equal(html.includes('id="mobil"'), false, `${file}: mobil bölüm render edilmemeli (S6)`);
    assert.equal(html.includes('id="sss-4"'), false, `${file}: SSS q4 render edilmemeli (S11)`);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${file}: tek h1`);
  }
  const en = fs.readFileSync(path.join(s.outDir, "en/index.html"), "utf8");
  assert.ok(en.includes("Describe your trip. Watch it land on the map."), "/en/ hero İngilizce");
  assert.equal(en.includes("English version is in beta"), false, "/en/ beta notu kaldırıldı");
});
