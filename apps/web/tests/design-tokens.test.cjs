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

test("donmuş rota baseline'ı ≥42 path içerir ve sıralıdır (AC-12, R5-1; 42 çekirdek path route-registry.test.cjs BASELINE_42)", () => {
  const { routes } = JSON.parse(read("apps/web/tests/fixtures/baseline-routes.json"));
  assert.ok(routes.length >= 42, `fixture yalnızca büyür: ${routes.length} < 42`);
  assert.deepEqual([...routes].sort(), routes);
  for (const r of routes) assert.match(r, /^\/(.*\/)?$/, `${r} sonda / ile bitmeli`);
});

test("AC-4f: primitive varyantları × açık/inverse kap × üç zemin (metin ≥4.5, kenarlık/gösterge ≥3, odak ≥3)", () => {
  const script = `
    import { checkPrimitiveSurfaces } from "./src/contrast.ts";
    import { PRIMITIVE_SURFACES } from "./src/components.ts";
    console.log(JSON.stringify({ rows: PRIMITIVE_SURFACES, failures: checkPrimitiveSurfaces() }));
  `;
  const r = runTs(["--input-type=module", "-e", script]);
  assert.equal(r.status, 0, r.stderr);
  const { rows, failures } = JSON.parse(r.stdout);
  assert.ok(rows.length >= 30, `beklenen ≥30 satır, bulunan ${rows.length}`);
  assert.deepEqual(failures, []);
  // Kendi zeminini çizen primitive kökünde data-surface="default" taşır (ownSurface).
  const uiDir = path.join(root, "apps/web/app/components/ui");
  for (const file of new Set(
    rows.filter((row) => row.ownSurface !== false).map((row) => row.file),
  )) {
    const src = fs.readFileSync(path.join(uiDir, file), "utf8");
    assert.match(
      src,
      /data-surface"?\s*[=:]\s*[^\n]*"default"/,
      `${file}: ownSurface primitive kökünde data-surface="default" yok`,
    );
  }
  // Tablodaki her bileşen token'ı tokens.css'te tanımlı.
  const css = read("apps/web/app/styles/tokens.css");
  for (const row of rows)
    for (const name of [row.bg, row.bgHover, ...row.text, ...(row.ui ?? [])].filter(
      (n) => n && n !== "container",
    ))
      assert.match(
        css,
        new RegExp(`--${name}:`),
        `${row.primitive}/${row.variant}: --${name} tanımsız`,
      );
});

// NFR-7 bütçesi 40 960 → 53 248 B (52 KB): Yön B token seti (design §3) ve genel primitive'ler
// (design §4.2) için plan D1 kararı. Özelliğe özgü bileşimler ui.css dışında, yalnız kendi
// rotalarında yüklenir. redesign-v2 Increment 2 (approval.json ruleChanges a/R10–R15): auth
// layout'u, modal ölçek/solma, Toast tonları, Progress, Celebrate ve Skeleton varyantları genel
// primitive'lerdir (+ hover/basma/ripple, 2.7) → 53 248 → 73 728 B (72 KB). Sayfaya özgü koreografi
// yine sayfa CSS'inde. Increment 3: sayfalar arası ortak koreografi primitive'leri ([data-enter],
// Reveal kademesi, nabız noktası, vurgu çizgisi, sallanma, başta ikonlu Input, PageHeader card,
// Section display) → 73 728 → 81 920 B (80 KB). Sayfaya özgü hareket sayfa CSS'inde kalır.
const CSS_BUDGET = 81920;
test("NFR-7: tokens.css + base.css + ui.css ≤ 80 KB (geçici legacy alias bölümü hariç)", () => {
  const tokens = read("apps/web/app/styles/tokens.css");
  // Legacy alias bölümü geçicidir (design §13.1 tokens.css satırı "alias bölümü hariç"); C18'de boşalır.
  const alias = tokens.match(/ {4}\/\* Geçici legacy alias[^\n]*\n(?: {4}--[^\n]*\n)*/);
  const tokensBytes = Buffer.byteLength(tokens) - (alias ? Buffer.byteLength(alias[0]) : 0);
  const total =
    tokensBytes +
    Buffer.byteLength(read("apps/web/app/styles/base.css")) +
    Buffer.byteLength(read("apps/web/app/components/ui/ui.css"));
  assert.ok(total <= CSS_BUDGET, `üç CSS toplamı ${total} bayt (> ${CSS_BUDGET})`);
});

test("Yön B anahtarları web CSS, RN teması ve iki ikon çıktısında var (design §3.3, plan D4)", () => {
  const css = read("apps/web/app/styles/tokens.css");
  const cssKeys = [
    "duration-deliberate",
    "duration-route",
    "easing-enter",
    "easing-exit",
    "motion-distance-md",
    "letter-spacing-tight",
    "font-size-6xl",
    ...[1, 2, 3, 4, 5, 6, 7].map((d) => `color-day-${d}`),
    "color-highlight-text",
    "chip-selected-bg",
    "cost-fg",
  ];
  for (const key of cssKeys) assert.match(css, new RegExp(`--${key}:`), `tokens.css: --${key} yok`);

  const native = read("apps/mobile/src/theme/tokens.ts");
  const motionBlock = native.slice(native.indexOf("  motion: {"));
  assert.match(motionBlock, /^\s{4}easing: \{/m, "RN tokens.ts: motion.easing yok");
  assert.match(motionBlock, /spring: \{\s*sheet: \{/, "RN tokens.ts: motion.spring.sheet yok");
  assert.match(native, /^\s{2}letterSpacing: \{/m, "RN tokens.ts: letterSpacing yok");
  assert.match(native, /^\s{4}family: \{/m, "RN tokens.ts: font.family yok");

  const script = `
    import { icons } from "./src/icons.ts";
    import { iconPaths as web } from "../../apps/web/app/lib/icon-paths.ts";
    import { iconPaths as native } from "../../apps/mobile/src/theme/icon-paths.ts";
    console.log(JSON.stringify({ src: Object.keys(icons), web: Object.keys(web), native: Object.keys(native) }));
  `;
  const r = runTs(["--input-type=module", "-e", script]);
  assert.equal(r.status, 0, r.stderr);
  const keys = JSON.parse(r.stdout);
  assert.ok(keys.src.length >= 56, `beklenen ≥56 ikon, bulunan ${keys.src.length}`);
  assert.deepEqual(keys.web, keys.src, "web icon-paths.ts anahtarları icons.ts ile aynı değil");
  assert.deepEqual(keys.native, keys.src, "RN icon-paths.ts anahtarları icons.ts ile aynı değil");
});
