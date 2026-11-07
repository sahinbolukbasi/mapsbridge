// Reveal öznitelik aktarımı (review-pages P1): `Section reveal` kökü Reveal üzerinden çizilir;
// id, aria-labelledby ve data-surface kaybolursa bölüm adsız <section> olur (landmark adı, #çapa ve
// G18 kontrast sözleşmesi düşer). Gerçek bileşen react-dom/server ile çizilip markup denetlenir.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const vm = require("node:vm");
const esbuild = require("esbuild");

const APP = path.join(__dirname, "..", "app");
const UI_DIR = path.join(APP, "components", "ui");

async function loadRender() {
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { createElement } from "react";
        import { renderToStaticMarkup } from "react-dom/server";
        import { Section } from "./section";
        import { Reveal } from "./reveal";
        export function renderSection(props) {
          return renderToStaticMarkup(createElement(Section, props, createElement("p", null, "içerik")));
        }
        export function renderReveal(props) {
          return renderToStaticMarkup(createElement(Reveal, props, "içerik"));
        }`,
      resolveDir: UI_DIR,
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
    plugins: [
      {
        name: "react-single-copy",
        setup(build) {
          build.onResolve({ filter: /^react(\/.*)?$/ }, (args) => ({
            path: require.resolve(args.path, { paths: [path.join(APP, "..")] }),
          }));
        },
      },
    ],
  });
  const module = { exports: {} };
  vm.runInContext(
    result.outputFiles[0].text,
    vm.createContext({
      module,
      exports: module.exports,
      require,
      console,
      process,
      TextEncoder,
      TextDecoder,
      setTimeout,
      clearTimeout,
      queueMicrotask,
      MessageChannel,
    }),
  );
  return module.exports;
}

test("Section reveal: id, aria-labelledby ve data-surface korunur (P1)", async () => {
  const { renderSection } = await loadRender();
  const html = renderSection({ reveal: true, id: "parite", title: "Parite", surface: "inverse" });
  assert.match(html, /^<section /);
  assert.match(html, /\bid="parite"/);
  assert.match(html, /aria-labelledby="parite-title"/);
  assert.match(html, /<h2 id="parite-title"/);
  assert.match(html, /data-surface="inverse"/);
  assert.match(html, /class="ui-reveal ui-section ui-section--inverse"/);
});

test("Section reveal ile düz Section aynı öznitelikleri taşır", async () => {
  const { renderSection } = await loadRender();
  // Öznitelik sırası önemsiz: kümeler karşılaştırılır.
  const attrs = (html) =>
    (html.slice(0, html.indexOf(">")).replace(/ui-reveal /, "").match(/[\w-]+="[^"]*"/g) ?? [])
      .sort()
      .join(" ");
  const plain = renderSection({ id: "a", title: "Başlık" });
  const revealed = renderSection({ reveal: true, id: "a", title: "Başlık" });
  assert.equal(attrs(revealed), attrs(plain));
});

test("Reveal ek HTML özniteliklerini kök etikete aktarır", async () => {
  const { renderReveal } = await loadRender();
  const html = renderReveal({ as: "ul", id: "liste", "aria-label": "Liste", stagger: true });
  assert.match(html, /^<ul /);
  assert.match(html, /\bid="liste"/);
  assert.match(html, /aria-label="Liste"/);
  assert.match(html, /class="ui-reveal ui-reveal--stagger"/);
});
