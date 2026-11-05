// BottomSheet geometri regresyonu (FEAT-002 review #1/#3, WCAG 2.4.11): gerçek bileşen markup'ı
// (react-dom/server) + gerçek tokens.css/ui.css Chromium'da 375×800'de açılır. Her snap'te
// (peek/half/full) gövdenin kaydırma alanı ekranda biter, sona kaydırılan son öğe ve odaklanan
// son öğe görünür kalır. Playwright Chromium yoksa test skip olur.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const esbuild = require("esbuild");

const APP = path.join(__dirname, "..", "app");
const UI_DIR = path.join(APP, "components", "ui");
const VIEWPORT = { width: 375, height: 800 };
const SNAPS = ["peek", "half", "full"];

async function loadRender() {
  // locale-context next/navigation çeker; testte yalnızca fallback döndüren t yeterli.
  const localeStub = {
    name: "locale-stub",
    setup(build) {
      // react-dom (kök node_modules) içindeki require("react") da apps/web'in react'ine gitsin:
      // tek React kopyası, web uygulamasıyla aynı sürüm.
      build.onResolve({ filter: /^react(\/.*)?$/ }, (args) => ({
        path: require.resolve(args.path, { paths: [path.join(APP, "..")] }),
      }));
      build.onResolve({ filter: /lib\/locale-context$/ }, () => ({
        path: "locale-stub",
        namespace: "stub",
      }));
      build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents:
          "export const useLocale = () => ({ locale: 'tr', isEnglish: false, t: (k, f) => f ?? k });",
        loader: "js",
      }));
    },
  };
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { createElement } from "react";
        import { renderToStaticMarkup } from "react-dom/server";
        import { BottomSheet } from "./bottom-sheet";
        export function render(initial, rows) {
          const items = Array.from({ length: rows }, (_, k) =>
            createElement("button", { key: k, type: "button", className: "probe-row" }, "Durak " + (k + 1)),
          );
          return renderToStaticMarkup(
            createElement(BottomSheet, { snap: ["peek", "half", "full"], initial, label: "Duraklar", className: "probe-sheet" }, items),
          );
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
    plugins: [localeStub],
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
  return module.exports.render;
}

test("BottomSheet: her snap'te son öğe kaydırarak ve odakla ekrana gelir", async (t) => {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    t.skip("playwright kurulu değil");
    return;
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    t.skip(`Chromium başlatılamadı: ${String(err.message).split("\n")[0]}`);
    return;
  }
  try {
    const render = await loadRender();
    const tokens = fs.readFileSync(path.join(APP, "styles", "tokens.css"), "utf8");
    const ui = fs.readFileSync(path.join(UI_DIR, "ui.css"), "utf8");
    const probe =
      ".probe-sheet{position:fixed;inset-inline:0;inset-block-end:0}.probe-row{display:block;inline-size:100%;block-size:40px}";
    const context = await browser.newContext({ viewport: VIEWPORT, reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const snap of SNAPS) {
      const markup = render(snap, 40);
      await page.setContent(
        `<!doctype html><html><head><style>${tokens}</style><style>${ui}</style><style>${probe}</style></head><body>${markup}</body></html>`,
      );
      const m = await page.evaluate(() => {
        const sheet = document.querySelector(".ui-bottom-sheet");
        const body = document.querySelector(".ui-bottom-sheet__body");
        const rows = body.querySelectorAll(".probe-row");
        const last = rows[rows.length - 1];
        body.scrollTop = body.scrollHeight;
        const scrolledLast = last.getBoundingClientRect().bottom;
        body.scrollTop = 0;
        last.focus();
        return {
          snap: sheet.dataset.snap,
          sheetTop: sheet.getBoundingClientRect().top,
          bodyBottom: body.getBoundingClientRect().bottom,
          scrollable: body.scrollHeight > body.clientHeight,
          scrolledLast,
          focusedLast: last.getBoundingClientRect().bottom,
          focused: document.activeElement === last,
          vh: window.innerHeight,
        };
      });
      const where = `${snap}: ${JSON.stringify(m)}`;
      assert.equal(m.snap, snap, where);
      assert.ok(m.sheetTop > 0 && m.sheetTop < m.vh, `sheet ekranda başlamalı (${where})`);
      assert.ok(m.scrollable, `40 satır gövdeyi kaydırılabilir yapmalı (${where})`);
      assert.ok(m.bodyBottom <= m.vh + 0.5, `gövde kaydırma alanı ekranda bitmeli (${where})`);
      assert.ok(m.scrolledLast <= m.vh + 0.5, `sona kaydırınca son öğe görünmeli (${where})`);
      assert.ok(m.focused && m.focusedLast <= m.vh + 0.5, `odaklanan son öğe görünmeli (${where})`);
    }
    await context.close();
  } finally {
    await browser.close();
  }
});
