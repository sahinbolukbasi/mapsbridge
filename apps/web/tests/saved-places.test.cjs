// FEAT-001 (U3/U4): Kaydedilen yerler varsayılan kapalı disclosure + ekleme anı gün seçimi.
// (a) TravelPlannerSidebar react-dom/server ile EN sözlükle render edilir: "Kayıtlı yerler"
//     <details> KAPALI (open yok) başlar, başlıkta sayı; (b) ekleme kartı (haritadan seçilen
//     nokta) gün <Select>'i + Kaydedilenler seçeneği taşır; (c) eksik EN anahtarı yok (I11).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const vm = require("node:vm");
const esbuild = require("esbuild");

const APP = path.join(__dirname, "..", "app");
const TRIP = path.join(APP, "components/trip");
const en = require(path.join(APP, "locales/en.json"));

// locale-context'i EN sözlükle stub'la (assistant-studio.test.cjs deseni): eksik anahtar toplanır.
const localeStub = {
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
          locale: "en",
          isEnglish: true,
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

async function loadRender() {
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { createElement as h } from "react";
        import { renderToStaticMarkup } from "react-dom/server";
        import { TravelPlannerSidebar } from "./travel-planner-sidebar";
        export function render(planner, props) {
          return renderToStaticMarkup(
            h(TravelPlannerSidebar, {
              planner,
              mode: "user",
              onRequireAuth: () => {},
              ...props,
            }),
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
    plugins: [localeStub],
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
  vm.runInContext(result.outputFiles[0].text, vm.createContext(sandbox));
  return (planner, props) => {
    sandbox.__DICT__ = en;
    sandbox.__MISSES__ = [];
    const html = module.exports.render(planner, props || {});
    return { html, misses: [...new Set(sandbox.__MISSES__)] };
  };
}

function makePlanner(generalPins) {
  const noop = () => {};
  const trip = {
    id: "trip-1",
    title: "Trip",
    destination: "Roma",
    days: [
      { dayIndex: 1, startTime: "09:00" },
      { dayIndex: 2, startTime: "09:00" },
    ],
    pins: [],
    isPublic: false,
  };
  return {
    generalPins,
    selectedPin: null,
    activeTrip: trip,
    activeTripId: trip.id,
    activeDayIndex: 1,
    selectedPinId: null,
    pinsWithTime: [],
    activeRouteLegs: {},
    transportMode: "walking",
    showVisitedOnMap: true,
    deviceSaved: false,
    trips: [trip],
    setActiveDayIndex: noop,
    setSelectedPinId: noop,
    setShowVisitedOnMap: noop,
    addPinToGeneral: noop,
    addPinDirectlyToTrip: noop,
    assignPinToTrip: noop,
    updatePinAnywhere: noop,
    deletePinAnywhere: noop,
    togglePinVisitedAnywhere: noop,
    movePinToGeneral: noop,
    reorderDay: noop,
    undo: noop,
    addDay: noop,
  };
}

test("U4: 'Kayıtlı yerler' disclosure varsayılan KAPALI, başlıkta sayı", async () => {
  const render = await loadRender();
  const pins = [
    { id: "g1", label: "Pantheon", address: "Roma", category: "genel", dayIndex: 0, lat: 41.9, lng: 12.4 },
    { id: "g2", label: "Trevi", address: "Roma", category: "genel", dayIndex: 0, lat: 41.9, lng: 12.5 },
  ];
  const { html, misses } = render(makePlanner(pins));
  // <details class="planner-pool"> KAPALI başlar: markup'ta open özniteliği YOK.
  const m = html.match(/<details[^>]*class="planner-pool"[^>]*>/);
  assert.ok(m, "planner-pool <details> render edilmeli");
  assert.doesNotMatch(m[0], /\bopen\b/, "disclosure varsayılan kapalı olmalı (open yok)");
  // Başlıkta sayı (Add to saved places başlığı değil; 'Saved places (2)').
  assert.match(html, /Saved places \(2\)/);
  // Satırların adı render edilmez (kapalı) ama react-dom/server içeriği yine de yazar; sayı yeter.
  assert.deepEqual(misses, []);
});

test("U3: ekleme kartı gün <select>'i + Kaydedilenler seçeneği taşır", async () => {
  const render = await loadRender();
  const { html, misses } = render(makePlanner([]), {
    selectedMapPoint: { lat: 41.9, lng: 12.5, address: "Roma, İtalya" },
  });
  // Nereye eklensin etiketli select; 1. ve 2. gün + Kaydedilenler seçenekleri.
  assert.match(html, /aria-label="Where to add"/);
  assert.match(html, /<option[^>]*value="1"[^>]*>Day 1<\/option>/);
  assert.match(html, /<option[^>]*value="2"[^>]*>Day 2<\/option>/);
  assert.match(html, /<option[^>]*value="general"[^>]*>Saved places<\/option>/);
  // Tek + eylemi "Add".
  assert.match(html, />\s*Add\s*<\/button>|>Add<\/button>|Add<\/span>/);
  assert.deepEqual(misses, []);
});
