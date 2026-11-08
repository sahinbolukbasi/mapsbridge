// B2 yer zenginleştirme (FEAT-003): puan rozeti, fotoğraf şeridi ve Google atfı YALNIZ kaynakta
// varsa çizilir (I1/I10); Amazon yerde hiçbiri render edilmez (boş düğüm yok). Gerçek bileşenler
// react-dom/server ile EN sözlükle render edilir (assistant-studio kalıbı): RatingBadge, Media
// fotoğraf, GoogleLogo ve StopRow. Yeni i18n anahtarları tr/en'de var ve TR değeri yedeğe eşit.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const esbuild = require("esbuild");

const APP = path.join(__dirname, "..", "app");
const TRIP = path.join(APP, "components/trip");
const tr = require(path.join(APP, "locales/tr.json"));
const en = require(path.join(APP, "locales/en.json"));

async function loadRender() {
  const stub = {
    name: "locale-stub",
    setup(build) {
      build.onResolve({ filter: /^react(\/.*)?$/ }, (args) => ({
        path: require.resolve(args.path, { paths: [path.join(APP, "..")] }),
      }));
      build.onResolve({ filter: /lib\/locale-context$/ }, () => ({
        path: "locale-stub",
        namespace: "stub",
      }));
      build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents: `
          export const useLocale = () => ({
            locale: globalThis.__LOCALE__,
            isEnglish: globalThis.__LOCALE__ === "en",
            t: (k, f) => {
              const v = globalThis.__DICT__[k];
              if (v === undefined) globalThis.__MISSES__.push(k);
              return v ?? f ?? k;
            },
          });`,
        loader: "js",
      }));
    },
  };
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { createElement as h } from "react";
        import { renderToStaticMarkup } from "react-dom/server";
        import { RatingBadge } from "./rating-badge";
        import { StopRow } from "./stop-row";
        import { Media, GoogleLogo } from "../ui";
        const num = (n) => n.toLocaleString(globalThis.__LOCALE__ === "en" ? "en-GB" : "tr-TR");
        // Google yer: puan + foto + GoogleLogo atfı (place-facts/discover kompozisyonu).
        function GooglePlace() {
          return h("section", null,
            h("ul", { className: "planner-facts__photos" },
              h("li", { className: "planner-facts__photo", key: "p" },
                h(Media, { src: "https://lh3.googleusercontent.com/x", ratio: "4/3", alt: "Kahve fotoğrafı: Ali" }),
                h("span", { className: "planner-facts__photo-credit" }, "Ali"))),
            h(RatingBadge, { rating: 4.6, count: 1200, format: num }),
            h("p", { className: "planner-facts__attribution" }, h(GoogleLogo, { size: 16 }), "Kaynak: Google"));
        }
        // Amazon yer: puan yok, foto yok, GoogleLogo yok → boş düğüm bile yok.
        function AmazonPlace() {
          return h("section", null,
            h(RatingBadge, { rating: undefined, count: undefined, format: num }));
        }
        export function render() {
          const noop = () => {};
          return renderToStaticMarkup(h("div", null,
            h("div", { id: "google" }, h(GooglePlace)),
            h("div", { id: "amazon" }, h(AmazonPlace)),
            h("div", { id: "stop-google" },
              h(StopRow, { index: 1, day: 1, name: "Kahve", category: "food",
                categoryLabel: "Yeme-içme", rating: 4.6, ratingCount: 1200 })),
            h("div", { id: "stop-amazon" },
              h(StopRow, { index: 2, day: 1, name: "Park", category: "compass",
                categoryLabel: "Gezi" })),
          ));
        }`,
      resolveDir: TRIP,
      loader: "tsx",
    },
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    target: "node22",
    jsx: "automatic",
    loader: { ".css": "empty" },
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
    plugins: [stub],
  });
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require,
    console,
    process,
    TextEncoder,
    TextDecoder,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    MessageChannel,
    URL,
    URLSearchParams,
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(result.outputFiles[0].text, vm.createContext(sandbox));
  return (locale) => {
    sandbox.__LOCALE__ = locale;
    sandbox.__DICT__ = locale === "en" ? en : tr;
    sandbox.__MISSES__ = [];
    return { html: module.exports.render(), misses: [...new Set(sandbox.__MISSES__)] };
  };
}

test("B2: Google yerde puan + foto (<img alt>) + GoogleLogo render edilir; eksik EN anahtarı yok", async () => {
  const render = await loadRender();
  const { html, misses } = render("en");
  assert.deepEqual(misses, [], `eksik EN anahtarı: ${misses.join(", ")}`);
  const google = html.slice(html.indexOf('id="google"'), html.indexOf('id="amazon"'));
  // Fotoğraf: <img> alt taşır (G12).
  assert.match(google, /<img[^>]+alt="[^"]+"/, "foto <img> alt taşır");
  assert.match(google, /lh3\.googleusercontent\.com/);
  assert.match(google, /planner-facts__photo-credit">Ali</);
  // Puan rozeti (erişilebilir etiket + görünür metin).
  assert.match(google, /planner-rating-badge/);
  assert.match(google, /4\.6 \(1,200\)/);
  assert.match(google, /aria-label="4\.6 \/ 5 rating \(1,200 reviews\)"/);
  // GoogleLogo (svg) atıf içinde.
  assert.match(google, /<svg/);
});

test("B2: Amazon yerde puan/foto/GoogleLogo yok — boş düğüm bile yok (I1/I10)", async () => {
  const render = await loadRender();
  const { html } = render("en");
  const amazon = html.slice(html.indexOf('id="amazon"'), html.indexOf('id="stop-google"'));
  assert.doesNotMatch(amazon, /planner-rating-badge/, "puan rozeti yok");
  assert.doesNotMatch(amazon, /<img/, "foto yok");
  assert.doesNotMatch(amazon, /<svg/, "GoogleLogo yok");
});

test("B2: durak satırı yer puanı varsa rozet gösterir, yoksa göstermez (foto satırda çekilmez)", async () => {
  const render = await loadRender();
  const { html } = render("tr");
  const gStop = html.slice(html.indexOf('id="stop-google"'), html.indexOf('id="stop-amazon"'));
  const aStop = html.slice(html.indexOf('id="stop-amazon"'));
  assert.match(gStop, /planner-rating-badge/);
  assert.match(gStop, /4,6 \(1\.200\)/, "TR sayı biçimi");
  assert.doesNotMatch(gStop, /<img/, "durak satırında foto çekilmez");
  assert.doesNotMatch(aStop, /planner-rating-badge/, "puansız durakta rozet yok");
});

test("B2: yeni i18n anahtarları tr/en'de var; TR değeri yedeğe eşit (I11)", () => {
  const pairs = [
    ["planner.facts.photos", "Fotoğraflar"],
    ["planner.facts.photoAlt", "{name} fotoğrafı {n}"],
    ["planner.facts.photoAltBy", "{name} fotoğrafı: {author}"],
    ["planner.facts.ratingLabel", "{r} / 5 puan"],
    ["planner.facts.ratingLabelCount", "{r} / 5 puan ({n} değerlendirme)"],
  ];
  for (const [key, fallback] of pairs) {
    assert.ok(key in tr, `${key} tr.json'da yok`);
    assert.equal(tr[key], fallback, `${key} TR değeri yedeğe eşit`);
    assert.ok(key in en, `${key} en.json'da yok`);
  }
});

test("B2: place-facts kaynağı foto şeridini yalnız m.photos varsa çizer ve Media/<img alt> kullanır", () => {
  const src = fs.readFileSync(path.join(TRIP, "place-facts.tsx"), "utf8");
  assert.match(src, /m\.photos && m\.photos\.length > 0/, "foto şeridi varlığa bağlı (I10)");
  assert.match(src, /<Media\b/, "foto Media primitive'iyle (alt zorunlu)");
  assert.match(src, /planner\.facts\.photoAlt/, "alt metni i18n'den");
});
