// Tasarım token'ları: tek kaynak, üretim güncel, kontrast eşikleri, RN uyumu (design §2, AC-4).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../../..");
const pkg = path.join(root, "packages/design-tokens");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const runTs = (args, input) =>
  spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", ...args],
    { cwd: pkg, encoding: "utf8", input },
  );

test("token çıktıları kaynakla güncel ve tüm kontrast çiftleri eşiği geçer", () => {
  const r = runTs(["scripts/generate.ts", "--check"]);
  assert.equal(r.status, 0, `tokens:check başarısız:\n${r.stderr}`);
});

test("kontrast çiftleri: metin ≥4.5, UI/focus ≥3.0 (hesaplanan oranlar)", () => {
  const script = `
    import { REQUIRED_PAIRS, checkPairs, checkInverseScope } from "./src/contrast.ts";
    console.log(JSON.stringify({ count: REQUIRED_PAIRS.length, failures: [...checkPairs(), ...checkInverseScope()] }));
  `;
  const r = runTs(["--input-type=module", "-e", script]);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.ok(out.count >= 40, `beklenen ≥40 çift, bulunan ${out.count}`);
  assert.deepEqual(out.failures, []);
});

test("palette.ts dışında token paketinde renk literali yok", () => {
  const dir = path.join(pkg, "src");
  for (const file of fs.readdirSync(dir)) {
    if (file === "palette.ts") continue;
    const src = fs.readFileSync(path.join(dir, file), "utf8");
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b/, `${file} içinde hex literal var`);
  }
});

test("tokens.css: katman sırası ilk satırlarda, tek :root bloğu", () => {
  const css = read("apps/web/app/styles/tokens.css");
  const lines = css.split("\n");
  assert.match(lines[0], /OTOMATİK ÜRETİLDİ/);
  assert.equal(lines[1], "@layer tokens, base, legacy, chrome, pages, primitives;");
  assert.equal((css.match(/:root\s*\{/g) || []).length, 1);
  // Breakpoint'e bağlı token :root'ta tanımlanmaz (html özgüllüğü, design §2.3)
  const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("\n  }", css.indexOf(":root {")));
  assert.doesNotMatch(rootBlock, /--app-header-height:/);
});

test("RN teması çözülmüş renk kullanır (color-mix / var() yok)", () => {
  const native = read("apps/mobile/src/theme/tokens.ts");
  assert.doesNotMatch(native, /color-mix|var\(/);
  assert.match(native, /export const tokens = /);
});

test("root layout tokens.css'i ilk CSS olarak yükler", () => {
  const layout = read("apps/web/app/layout.tsx");
  const firstCss = layout.match(/import\s+"([^"]+\.css)"/);
  assert.ok(firstCss, "layout'ta CSS import'u yok");
  assert.equal(firstCss[1], "./styles/tokens.css");
});

test("donmuş rota baseline'ı 42 path içerir ve sıralıdır (AC-12, R5-1)", () => {
  const { routes } = JSON.parse(read("apps/web/tests/fixtures/baseline-routes.json"));
  assert.equal(routes.length, 42);
  assert.deepEqual([...routes].sort(), routes);
  for (const r of routes) assert.match(r, /^\/(.*\/)?$/, `${r} sonda / ile bitmeli`);
});
