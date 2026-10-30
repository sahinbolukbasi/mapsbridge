// Build çıktısında cascade layer sözleşmesi (AC-31a, design §2.6 "Doğrulama" 1).
// out/_next/static/**/*.css içinde @layer içeren her chunk'ın ilk kuralı minify edilmiş sıra
// ifadesidir ve layer adlarının ilk görünüş sırası tam olarak ORDER'dır (minifier @layer'ı korur).
// Layer dışı kurallar yalnızca G22 Leaflet kümesini (styles/vendor-overrides.css) hedefler.
// Build-bağımlıdır: buildState() geçersizse REQUIRE_BUILD yokken skip, REQUIRE_BUILD=1 iken fail.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildState } = require("./helpers/build-meta.cjs");

const ORDER = ["tokens", "base", "legacy", "chrome", "pages", "primitives"];
// G22: Leaflet'in ürettiği sınıflar (L.divIcon className'leri + .leaflet-*).
const G22 =
  /\.(custom-route-pin|custom-map-pin|stitch-leaflet-marker-wrap|leaflet-[\w-]+)(?![\w-])/;
// next/font'un ürettiği layer'sız çıktı (repo CSS'i değil): @font-face ve .<hash>_className/_variable.
const NEXT_FONT = /^\.[\w-]+_(className|variable)$/;

function requireBuild(t) {
  const s = buildState();
  if (s.ok) return s;
  if (process.env.REQUIRE_BUILD === "1") assert.fail(`${s.reason}: ${s.message}`);
  t.skip(s.message);
  return null;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".css")) out.push(p);
  }
  return out;
}

/** Üst düzey kurallar; string ve yorum farkındalıklı. */
function topLevel(css) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '"' || c === "'") {
      for (i++; i < css.length && css[i] !== c; i++) if (css[i] === "\\") i++;
      continue;
    }
    if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? css.length : end + 1;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        out.push(css.slice(start, i + 1).trim());
        start = i + 1;
      }
    } else if (c === ";" && depth === 0) {
      out.push(css.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  return out.filter((s) => s && !s.startsWith("/*"));
}

function layerNames(rule) {
  const m = /^@layer\s*([\w.,\s-]*?)\s*[;{]/.exec(rule);
  return m
    ? m[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
}

function layeredChunks(outDir) {
  return walk(path.join(outDir, "_next/static"))
    .map((file) => ({ file: path.relative(outDir, file), css: fs.readFileSync(file, "utf8") }))
    .filter((c) => c.css.includes("@layer"));
}

test("layer'lı her chunk sıra ifadesiyle başlar ve layer sırası korunur (AC-31a)", (t) => {
  const s = requireBuild(t);
  if (!s) return;
  const chunks = layeredChunks(s.outDir);
  assert.ok(chunks.length > 0, "out/_next/static altında @layer içeren CSS chunk'ı yok");
  const problems = [];
  for (const { file, css } of chunks) {
    const rules = topLevel(css);
    if (!rules[0] || !rules[0].startsWith("@layer")) {
      problems.push(`${file}: ilk kural @layer değil: ${String(rules[0]).slice(0, 60)}`);
      continue;
    }
    const seen = [];
    for (const rule of rules) {
      for (const name of layerNames(rule) ?? []) if (!seen.includes(name)) seen.push(name);
    }
    if (seen.join(",") !== ORDER.join(","))
      problems.push(`${file}: layer sırası ${seen.join(",")} (beklenen ${ORDER.join(",")})`);
  }
  assert.deepEqual(problems, []);
});

test("layer dışı kurallar yalnızca G22 Leaflet kümesini hedefler (vendor-overrides)", (t) => {
  const s = requireBuild(t);
  if (!s) return;
  const problems = [];
  let leaflet = 0;
  for (const { file, css } of layeredChunks(s.outDir)) {
    for (const rule of topLevel(css)) {
      if (rule.startsWith("@layer") || rule.startsWith("@font-face")) continue;
      const selector = rule.slice(0, rule.indexOf("{")).trim();
      if (NEXT_FONT.test(selector)) continue;
      const parts = selector.split(",");
      if (rule.startsWith("@") || !parts.every((p) => G22.test(p))) {
        problems.push(`${file}: layer dışı kural: ${rule.slice(0, 80)}`);
      } else leaflet++;
    }
  }
  assert.deepEqual(problems, []);
  assert.ok(leaflet > 0, "vendor-overrides.css kuralları build çıktısında bulunamadı");
});
