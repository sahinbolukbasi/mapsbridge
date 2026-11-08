// B3 (FEAT-002): /maps/ sol panel yeniden tasarımı — net etiketli bölümler.
// (a) TravelPlannerSidebar boş gezi ile react-dom/server ile render edilir: dört etiketli grup
//     (Yer ara / Keşfet / Günler / Kayıtlı yerler) her biri <h3> başlık + aria-labelledby ile
//     görünür; gün durağı boş durumu ve kayıtlı yerler boş metni çizilir; svg Icon var, emoji yok.
// (b) DiscoverPanel doğrudan render edilir: boş durum EmptyState primitive'iyle çizilir.
// (c) Arama/Keşfet yükleniyor/hata durumları yalnız async üretildiğinden (SSR'de efekt koşmaz),
//     durum makinesi (searchReducer) ve kaynak bağlanışı — doğru ARIA rolleriyle (role="alert"
//     hata, aria-hidden iskelet yükleniyor, role="status") — kalıcı sinyal olarak doğrulanır.
// (d) Eklenen i18n anahtarları tr.json ve en.json'da var; TR değeri yedeğe eşit.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const esbuild = require("esbuild");
const { loadTs } = require("./helpers/load-ts.cjs");

const APP = path.join(__dirname, "..", "app");
const TRIP = path.join(APP, "components", "trip");
const tr = require(path.join(APP, "locales/tr.json"));
const en = require(path.join(APP, "locales/en.json"));

const sidebarSrc = fs.readFileSync(path.join(TRIP, "travel-planner-sidebar.tsx"), "utf8");
const discoverSrc = fs.readFileSync(path.join(TRIP, "discover-panel.tsx"), "utf8");

// ── Ortak: locale'i stub'layan react-dom/server render köprüsü ──────────────────────────────
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
              return (v ?? f ?? k);
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
        import { TravelPlannerSidebar } from "./travel-planner-sidebar";
        import { DiscoverPanel } from "./discover-panel";
        const noop = () => {};
        export function renderSidebar(planner) {
          return renderToStaticMarkup(
            h(TravelPlannerSidebar, {
              planner,
              mode: "user",
              onRequireAuth: noop,
            }),
          );
        }
        export function renderDiscover() {
          return renderToStaticMarkup(
            h(DiscoverPanel, { dayPins: [], allPins: [], onAdd: noop }),
          );
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
    crypto: globalThis.crypto,
  };
  sandbox.globalThis = sandbox;
  // Tarayıcı API'leri yalnız efektlerde kullanılır; SSR render'ında dokunulmaz.
  sandbox.window = { addEventListener: noopFn, removeEventListener: noopFn };
  vm.runInContext(result.outputFiles[0].text, vm.createContext(sandbox));
  const run = (locale, produce) => {
    sandbox.__LOCALE__ = locale;
    sandbox.__DICT__ = locale === "en" ? en : tr;
    sandbox.__MISSES__ = [];
    const html = produce();
    return { html, misses: [...new Set(sandbox.__MISSES__)] };
  };
  return {
    sidebar: (locale, planner) => run(locale, () => module.exports.renderSidebar(planner)),
    discover: (locale) => run(locale, () => module.exports.renderDiscover()),
  };
}
function noopFn() {}

// Boş gezi: günler var, durak yok; kayıtlı yer yok. Render sırasında kullanılan tüm alanlar.
function emptyPlanner() {
  const noop = () => {};
  return {
    generalPins: [],
    selectedPin: null,
    activeTrip: { id: "t1", title: "Test", destination: "", days: [{ dayIndex: 1 }], pins: [] },
    activeTripId: "t1",
    activeDayIndex: 0,
    selectedPinId: null,
    pinsWithTime: [],
    activeRouteLegs: {},
    transportMode: "walking",
    trips: [],
    showVisitedOnMap: true,
    deviceSaved: false,
    setActiveDayIndex: noop,
    setSelectedPinId: noop,
    setShowVisitedOnMap: noop,
    addPinToGeneral: noop,
    addPinDirectlyToTrip: noop,
    assignPinToTrip: noop,
    movePinToDay: noop,
    movePinToGeneral: noop,
    updatePinAnywhere: noop,
    deletePinAnywhere: noop,
    togglePinVisitedAnywhere: noop,
    addDay: noop,
    reorderDay: noop,
    undo: noop,
  };
}

test("B3: sidebar dört etiketli grubu <h3> başlık + aria-labelledby ile render eder (boş durum)", async () => {
  const render = await loadRender();
  const { html, misses } = render.sidebar("tr", emptyPlanner());
  assert.deepEqual(misses, [], `TR'de eksik anahtar: ${misses.join(", ")}`);
  // Dört grup: her biri aria-labelledby ile kendi <h3> başlığına bağlı.
  for (const [id, title] of [
    ["planner-group-days", "Günler"],
    ["planner-group-search", "Yer ara"],
    ["planner-group-discover", "Keşfet"],
    ["planner-pool-title", "Kayıtlı yerler"],
  ]) {
    assert.match(html, new RegExp(`aria-labelledby="${id}"`), `${id} aria-labelledby yok`);
    assert.match(
      html,
      new RegExp(`<h3[^>]*id="${id}"`),
      `${id} için <h3> başlık yok`,
    );
    assert.ok(html.includes(title), `"${title}" başlık metni render edilmedi`);
  }
  // Gün sekmeleri erişilebilir grup; gün durağı boş durumu + kayıtlı yerler boş metni.
  assert.match(html, /role="group"/);
  assert.match(html, /class="ui-empty-state"/, "boş gün durumu EmptyState ile çizilmeli");
  assert.ok(html.includes("Gün seçmeden eklediğin yerler"), "kayıtlı yerler boş metni yok");
  // İkonlar svg; emoji ikon yok (R3/G28).
  assert.match(html, /<svg class="ui-icon/);
  assert.doesNotMatch(html, /\p{Extended_Pictographic}/u, "markup'ta emoji");
  // Yeni h1 eklenmez (tek h1 PageHeader'da; burada yalnız h3'ler).
  assert.doesNotMatch(html, /<h1[\s>]/, "sidebar <h1> eklememeli");
});

test("B3: EN render de eksik anahtar bırakmaz ve İngilizce başlıkları taşır", async () => {
  const render = await loadRender();
  const { html, misses } = render.sidebar("en", emptyPlanner());
  assert.deepEqual(misses, [], `EN'de eksik anahtar: ${misses.join(", ")}`);
  for (const title of ["Days", "Search places", "Explore", "Saved places"])
    assert.ok(html.includes(title), `EN başlık "${title}" yok`);
});

test("B3: DiscoverPanel doğrudan render edilir (idle/boş dalı mount olur, svg ikon taşır)", async () => {
  const render = await loadRender();
  const { html, misses } = render.discover("tr");
  assert.deepEqual(misses, [], `Keşfet TR'de eksik anahtar: ${misses.join(", ")}`);
  assert.match(html, /<svg class="ui-icon/, "Keşfet svg Icon taşımalı");
  assert.doesNotMatch(html, /\p{Extended_Pictographic}/u, "Keşfet markup'ında emoji");
  // Durak olmadığında yalnız haritada arama ipucu ve "Ne arıyorsun?" çipleri çizilir.
  assert.ok(html.includes("Ne arıyorsun?"), "ilgi çipleri grubu yok");
});

test("B3: arama/Keşfet yükleniyor/hata/boş durumları doğru ARIA primitive'lerine bağlı (kaynak)", () => {
  // Arama hata durumu: role="alert" (Alert live="assertive") + Tekrar dene.
  assert.match(sidebarSrc, /<Alert\s+tone="warning"\s+live="assertive"/, "arama hata Alert role=alert");
  // Arama yükleniyor iskeleti aria-hidden; durum satırı role="status".
  assert.match(sidebarSrc, /className="planner-search__results" aria-hidden="true"/);
  assert.match(sidebarSrc, /<div role="status" className="planner-search__status">/);
  assert.match(sidebarSrc, /<Skeleton variant="list-row" \/>/);
  // Keşfet: hata ErrorState (role="alert"), boş EmptyState, yükleniyor iskeleti aria-hidden.
  assert.match(discoverSrc, /<ErrorState/, "Keşfet hata ErrorState");
  assert.match(discoverSrc, /<EmptyState/, "Keşfet boş EmptyState");
  assert.match(discoverSrc, /className="planner-discover__list" aria-hidden="true"/);
  assert.match(discoverSrc, /<div role="status" className="planner-discover__status">/);
});

test("B3: arama durum makinesi yükleniyor/boş/hata/sonuç durumlarını üretir (searchReducer)", () => {
  const S = loadTs(path.join(APP, "lib/trip/place-search-logic.ts"));
  let state = S.initialSearchState();
  state = S.searchReducer(state, { type: "start", requestId: 1 });
  assert.equal(state.status, "loading");
  state = S.searchReducer(state, { type: "success", requestId: 1, results: [] });
  assert.equal(state.status, "empty");
  let s2 = S.searchReducer(S.initialSearchState(), { type: "start", requestId: 2 });
  s2 = S.searchReducer(s2, { type: "success", requestId: 2, results: [{ label: "x" }] });
  assert.equal(s2.status, "results");
  let s3 = S.searchReducer(S.initialSearchState(), { type: "start", requestId: 3 });
  s3 = S.searchReducer(s3, { type: "failure", requestId: 3 });
  assert.equal(s3.status, "error");
});

test("B3: eklenen grup i18n anahtarları tr/en'de var, TR değeri yedeğe eşit", () => {
  const pairs = [
    ["planner.group.days", "Günler"],
    ["planner.group.search", "Yer ara"],
    ["planner.group.discover", "Keşfet"],
  ];
  const problems = [];
  for (const [key, fallback] of pairs) {
    if (!(key in tr)) problems.push(`${key} tr.json'da yok`);
    else if (tr[key] !== fallback) problems.push(`${key} TR "${tr[key]}" ≠ "${fallback}"`);
    if (!(key in en)) problems.push(`${key} en.json'da yok`);
  }
  assert.deepEqual(problems, []);
});
