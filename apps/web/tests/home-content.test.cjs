// Ana sayfa içerik sözleşmesi (design §10, §5.1; kararlar S1, S6, S11; FEAT-004).
// (a) yasak terimler ana sayfa kaynaklarında ve home.* değerlerinde yok; (b) hoş geldin kredisi
// sayısı contracts BILLING_COST.WELCOME_CREDITS ile aynı; (c) S6/S11 kapıları: home.mobile.*
// render edilmez, home.faq.q4 FEAT-007'de I12 kapsamı doğrulanınca render edilir; (d) kaynakta kullanılan her home.*/trip.* anahtarı iki dilde var.
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

test("(c) S6 kapısı: mobil bölüm render edilmez; S11: SSS q4 doğrulanmış kapsamla render edilir", () => {
  for (const rel of HOME_SOURCES)
    assert.doesNotMatch(source(rel), /home\.mobile\./, `${rel} home.mobile.* kullanıyor (S6)`);
  // Anahtarlar tanımlıdır (kullanıcı teyidiyle açılır), yalnızca render edilmez.
  for (const key of ["home.mobile.title", "home.mobile.sub"])
    assert.ok(tr[key] && en[key], `${key} tanımlı olmalı`);
  // FEAT-007 I12 denetimi: use-travel-planner yalnızca durakları, koordinatları, gün ve sırayı
  // cihazda saklar; yol geometrisi/yön tarifi saklanmaz. q4/a4 render edilir ve yön bilgisi
  // saklandığını iddia etmez (S11).
  assert.match(source("home-client.tsx"), /"home\.faq\.q4"/, "home-client q4'ü render etmeli");
  assert.match(source("home-client.tsx"), /"home\.faq\.a4"/, "home-client a4'ü render etmeli");
  assert.doesNotMatch(tr["home.faq.a4"], /temel yön bilgisi/i, "tr a4 yön bilgisi iddia etmemeli");
  assert.doesNotMatch(en["home.faq.a4"], /basic directions are stored/i, "en a4 yön iddiası");
  for (const dict of [tr, en]) assert.ok(dict["home.faq.q4"] && dict["home.faq.a4"]);
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

// FEAT-010 (F6, F7, S6): mobil uygulamalar, nasıl çalışır ve footer da aynı sözleşmeye tabi.
const CONTENT_SOURCES = [
  "mobile-apps/mobile-apps-client.tsx",
  "mobile-apps/page.tsx",
  "how-it-works/how-it-works-client.tsx",
  "how-it-works/page.tsx",
  "components/site-footer.tsx",
];
const CONTENT_PREFIXES = ["how.", "mobileApps.", "footer."];
// Mağaza varlığı iddiaları (S6): rozet, indirme, sürüm, "yakında". Kelime SONU sınırıyla da
// aranır ki "Yakındaki" gibi sözcükler yakalanmasın.
const STORE_CLAIMS = [
  /app\s*store/i,
  /google\s*play/i,
  /play\.google\.com/i,
  /apps\.apple\.com/i,
  /uygulamay[ıi]\s+indir/iu,
  /download\s+the\s+app/i,
  /(^|[^\p{L}])(pek\s+|çok\s+)?yakında(?![\p{L}])/iu,
  /coming\s+soon/i,
  /\bv\d+\.\d+\b/i,
];
test("(e) mobil uygulamalar / nasıl çalışır / footer: yasak terim ve mağaza iddiası yok", () => {
  const hits = [];
  for (const rel of CONTENT_SOURCES) {
    const src = source(rel);
    for (const term of FORBIDDEN) if (forbiddenRe(term).test(src)) hits.push(`${rel}: ${term}`);
    for (const re of STORE_CLAIMS) if (re.test(src)) hits.push(`${rel}: ${re}`);
  }
  for (const [lang, dict] of [
    ["tr", tr],
    ["en", en],
  ])
    for (const [key, value] of Object.entries(dict)) {
      if (!CONTENT_PREFIXES.some((p) => key.startsWith(p))) continue;
      for (const term of FORBIDDEN)
        if (forbiddenRe(term).test(value)) hits.push(`${lang}.${key}: ${term}`);
      for (const re of STORE_CLAIMS) if (re.test(value)) hits.push(`${lang}.${key}: ${re}`);
    }
  assert.deepEqual(hits, [], `yasak terim / mağaza iddiası: ${hits.join("; ")}`);
});
test("(e) S6: mağaza durumu tek değerden okunur ve 'unknown'", () => {
  const { MOBILE_APP_STATUS, showStoreClaims } = loadTs(path.join(APP, "lib/mobile-app-status.ts"));
  assert.equal(MOBILE_APP_STATUS, "unknown");
  assert.equal(showStoreClaims(), false);
  assert.equal(showStoreClaims("available"), true);
  assert.match(source("mobile-apps/mobile-apps-client.tsx"), /lib\/mobile-app-status/);
  // Kaynakta kullanılan how.* / mobileApps.* anahtarları iki dilde var.
  const missing = [];
  for (const rel of CONTENT_SOURCES)
    for (const m of source(rel).matchAll(/["'`]((?:how|mobileApps)\.[A-Za-z0-9_.]+)["'`]/g))
      for (const [lang, dict] of [
        ["tr", tr],
        ["en", en],
      ])
        if (!(m[1] in dict)) missing.push(`${lang} ${m[1]} (${rel})`);
  assert.deepEqual(missing, [], `eksik anahtar: ${missing.join(", ")}`);
});
test("(e) F6: nasıl çalışır SSS soruları ana sayfa SSS'inden farklı", () => {
  const src = source("how-it-works/how-it-works-client.tsx");
  const keys = [...src.matchAll(/"(how\.faq\.q\d+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 3, "how-it-works en az 3 SSS sorusu render etmeli");
  for (const [lang, dict] of [
    ["tr", tr],
    ["en", en],
  ]) {
    const home = new Set(
      Object.entries(dict)
        .filter(([k]) => /^home\.faq\.q\d+$/.test(k))
        .map(([, v]) => v.trim().toLowerCase()),
    );
    for (const k of keys)
      assert.equal(
        home.has(dict[k].trim().toLowerCase()),
        false,
        `${lang} ${k} ana sayfada da var`,
      );
  }
});
function requireBuild(t) {
  const s = buildState();
  if (s.ok) return s;
  if (process.env.REQUIRE_BUILD === "1") assert.fail(`${s.reason}: ${s.message}`);
  t.skip(s.message);
  return null;
}

test("§10 bölüm sırası: / ve /en/ (mobil bölüm yok, SSS q4 var)", (t) => {
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
    assert.equal(
      html.includes('id="sss-4"'),
      true,
      `${file}: SSS q4 render edilmeli (FEAT-007, S11)`,
    );
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${file}: tek h1`);
  }
  const en = fs.readFileSync(path.join(s.outDir, "en/index.html"), "utf8");
  // Başlık vurgu sözcüğü (PageHeader titleInk) metni span'e böler; etiketler atılarak aranır.
  const enText = en.replace(/<[^>]+>/g, "");
  assert.ok(enText.includes("Describe your trip. Watch it land on the map."), "/en/ hero İngilizce");
  assert.equal(en.includes("English version is in beta"), false, "/en/ beta notu kaldırıldı");
});
test("(e) S6: hiçbir web rotasının HTML'inde mağaza rozeti, indirme, sürüm ya da 'yakında' yok", (t) => {
  const s = requireBuild(t);
  if (!s) return;
  const files = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) {
        if (name !== "_next") walk(abs);
      } else if (name.endsWith(".html")) files.push(abs);
      // public/ altından kopyalanan statik dosyalar (ör. geliştirici sayfası expo-qr.html, Expo Go
      // talimatı) web rotası değildir; yalnız Next'in ürettiği sayfalar taranır.
    }
  };
  walk(s.outDir);
  const PUBLIC = path.join(WEB, "public");
  const routeFiles = files.filter(
    (abs) => !fs.existsSync(path.join(PUBLIC, path.relative(s.outDir, abs))),
  );
  files.length = 0;
  files.push(...routeFiles);
  assert.ok(files.length > 10, "out/ içinde HTML bulunamadı");
  const hits = [];
  for (const abs of files) {
    // Yalnız görünür metin: script/style ve etiketler atılır.
    const text = fs
      .readFileSync(abs, "utf8")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    for (const re of STORE_CLAIMS)
      if (re.test(text)) hits.push(`${path.relative(s.outDir, abs)}: ${re}`);
  }
  assert.deepEqual(hits, [], `mağaza iddiası: ${hits.join("; ")}`);
});
test("summarizeLastTrip: en son güncellenen gezi seçilir, zaman damgası yoksa ilk geçerli gezi (final review #9)", () => {
  const { summarizeLastTrip } = loadTs(path.join(APP, "lib/trip/last-trip.ts"));
  const pin = { id: "p" };
  const raw = JSON.stringify([
    { title: "Eski", pins: [pin, pin], updatedAt: "2026-01-01T00:00:00.000Z" },
    { title: "Yeni", pins: [pin], updatedAt: "2026-03-01T00:00:00.000Z" },
    { title: "Boş", pins: [], updatedAt: "2026-09-01T00:00:00.000Z" },
    { title: "Orta", pins: [pin], createdAt: "2026-02-01T00:00:00.000Z" },
  ]);
  assert.deepEqual({ ...summarizeLastTrip(raw) }, { title: "Yeni", stops: 1 });
  const noStamps = JSON.stringify([
    { title: "A", pins: [pin] },
    { title: "B", pins: [pin, pin] },
  ]);
  assert.deepEqual({ ...summarizeLastTrip(noStamps) }, { title: "A", stops: 1 });
  assert.equal(summarizeLastTrip("[]"), null);
  assert.equal(summarizeLastTrip("{"), null);
});
test("EN tekil durak: home.lastTrip.stops.one / trip.day.stops.one (final review #9)", () => {
  assert.equal(en["home.lastTrip.stops.one"], "{n} stop");
  assert.equal(en["trip.day.stops.one"], "{n} stop");
  assert.equal(tr["home.lastTrip.stops.one"], "{n} durak");
  assert.equal(tr["trip.day.stops.one"], "{n} durak");
});
