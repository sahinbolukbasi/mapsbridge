// FEAT-002 (U1/U2): NearbyList bileşeni. react-dom/server ile EN sözlükle render edilir.
// renderToStaticMarkup effect'leri koşmaz; ilk render yükleme (loading) durumudur → başlık,
// görünmez durum metni ve iskelet satırları çizilir. Ayrıca her t() anahtarı EN sözlükte var (I11).
// Sıralama/alan/affiliate davranışı saf eşleyicide (nearby.test.cjs) kapsanır.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const vm = require("node:vm");
const esbuild = require("esbuild");

const APP = path.join(__dirname, "..", "app");
const TRIP = path.join(APP, "components/trip");
const en = require(path.join(APP, "locales/en.json"));

// locale-context EN sözlükle; placesApi ağ çağrısı yapmasın diye stub'lanır (effect zaten koşmaz).
const stubPlugin = {
  name: "nearby-stubs",
  setup(build) {
    build.onResolve({ filter: /^react(\/.*)?$/ }, (args) => ({
      path: require.resolve(args.path, { paths: [path.join(APP, "..")] }),
    }));
    build.onResolve({ filter: /lib\/locale-context$/ }, () => ({
      path: "locale-stub",
      namespace: "stub",
    }));
    build.onResolve({ filter: /lib\/trip\/places-api$/ }, () => ({
      path: "places-stub",
      namespace: "stub",
    }));
    build.onLoad({ filter: /^locale-stub$/, namespace: "stub" }, () => ({
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
    build.onLoad({ filter: /^places-stub$/, namespace: "stub" }, () => ({
      contents: `
        export const PLACE_CATEGORY_IDS = [];
        export class PlacesApiError extends Error {
          constructor(kind, message) { super(message); this.kind = kind; }
        }
        export const placesApi = { nearby: () => new Promise(() => {}) };`,
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
        import { NearbyList } from "./nearby-list";
        export function render(props) {
          return renderToStaticMarkup(h(NearbyList, props));
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
    plugins: [stubPlugin],
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
  return (props) => {
    sandbox.__DICT__ = en;
    sandbox.__MISSES__ = [];
    const html = module.exports.render(props);
    return { html, misses: [...new Set(sandbox.__MISSES__)] };
  };
}

const PROPS = {
  lat: 41.0082,
  lng: 28.9784,
  days: [1, 2],
  activeDayIndex: 1,
  onAdd: () => {},
  onFocus: () => {},
};

test("ilk render: başlık + görünmez yükleniyor metni + iskelet satırları", async () => {
  const render = await loadRender();
  const { html, misses } = render(PROPS);
  assert.match(html, /What&#x27;s nearby/);
  assert.match(html, /Searching nearby places…/);
  // Yükleme iskeleti listesi (aria-hidden) çizilir.
  assert.match(html, /planner-discover__list[^>]*aria-hidden="true"/);
  // I11: EN sözlükte eksik anahtar yok (en azından ilk renderdaki anahtarlar).
  assert.deepEqual(misses, []);
});

test("render olmazsa olmaz anahtarlar EN sözlükte tanımlı (I11)", async () => {
  // Bileşenin kullandığı tüm nearby.* anahtarları sözlükte olmalı (durumlar effect sonrası da).
  for (const k of [
    "nearby.title",
    "nearby.loading",
    "nearby.results",
    "nearby.empty",
    "nearby.limited",
    "nearby.error.title",
    "nearby.error.body",
  ]) {
    assert.ok(k in en, `EN sözlükte eksik anahtar: ${k}`);
  }
});
