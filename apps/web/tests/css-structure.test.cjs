// CSS yapısı: her dosya layer'lı ve doğru layer'da, legacy alias tablosu boş (design §2.5, §2.6).
// C19: tek :root (G2) ve Leaflet muafiyeti (G22) kontrolleri design-system-guard.test.cjs'e devredildi.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const appDir = path.join(root, "apps/web/app");
const ORDER = "@layer tokens, base, legacy, chrome, pages, primitives;";
const UNLAYERED = new Set(["styles/tokens.css", "styles/vendor-overrides.css"]);
const LEGACY = [
  "operations.css",
  "components/upgrade-modal.css",
  "styles.css",
  "auth.css",
  // tw-utils.css'ten üretilmiş yerleşim sınıfları (codemod --mode tw, design §2.7 8b): legacy
  // katmanında kalır, böylece utility'lerin sayfa CSS'ine karşı kaskadı birebir korunur.
  // tw-utils.css C18'de silindi.
  "features/community/community-layout.css",
  "profile/profile-layout.css",
  "profile/edit/edit-layout.css",
  "maps/maps-layout.css",
  "reset-password/reset-password-layout.css",
  "components/soft-icon-layout.css",
];
const CHROME = ["components/header-nav.css", "components/site-footer.css"];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".css")) out.push(p);
  }
  return out;
}
const cssFiles = walk(appDir).map((p) => path.relative(appDir, p).split(path.sep).join("/"));
const read = (rel) => fs.readFileSync(path.join(appDir, rel), "utf8");
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Üst düzey ifadeleri döndürür (yorumlar atılmış). */
function topLevel(css) {
  const src = strip(css);
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        out.push(src.slice(start, i + 1).trim());
        start = i + 1;
      }
    } else if (c === ";" && depth === 0) {
      out.push(src.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  return out.filter(Boolean);
}

test("her web CSS dosyası sıra ifadesiyle başlar ve tüm kuralları layer bloğundadır", () => {
  const problems = [];
  for (const rel of cssFiles) {
    if (UNLAYERED.has(rel)) continue;
    const css = read(rel);
    if (!css.startsWith(ORDER)) problems.push(`${rel}: ilk satır sıra ifadesi değil`);
    for (const stmt of topLevel(css)) {
      if (stmt === ORDER) continue;
      if (!/^@layer [a-z]+\s*\{/.test(stmt))
        problems.push(`${rel}: layer dışı ifade: ${stmt.slice(0, 60)}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("dosyalar doğru layer'dadır (legacy / chrome / pages)", () => {
  const problems = [];
  for (const rel of cssFiles) {
    if (UNLAYERED.has(rel)) continue;
    const first = strip(read(rel)).split("\n")[1] ?? "";
    const expected =
      rel === "styles/base.css" || rel === "styles/motion.css"
        ? "base"
        : rel === "components/ui/ui.css"
          ? "primitives"
          : LEGACY.includes(rel)
            ? "legacy"
            : CHROME.includes(rel)
              ? "chrome"
              : "pages";
    if (!first.startsWith(`@layer ${expected} {`))
      problems.push(`${rel}: beklenen @layer ${expected}, bulunan "${first}"`);
  }
  assert.deepEqual(problems, []);
});

test("legacy dosyalardaki ek pages bloğu yalnızca body-kapsamlı override içerir", () => {
  for (const rel of LEGACY) {
    const stmts = topLevel(read(rel)).filter((s) => s.startsWith("@layer pages"));
    for (const s of stmts) {
      const inner = s.slice(s.indexOf("{") + 1, s.lastIndexOf("}"));
      for (const m of inner.matchAll(/([^{};]+)\{/g)) {
        const sel = m[1].trim();
        if (sel.startsWith("@")) continue;
        assert.match(
          sel,
          /^body(\s|:has\()/,
          `${rel}: pages bloğunda body-kapsamlı olmayan seçici: ${sel}`,
        );
      }
    }
  }
});

test("legacy alias hedefleri tokens.css'te tanımlıdır ve yeni ad içermez", () => {
  const tokens = read("styles/tokens.css");
  const defined = new Set([...tokens.matchAll(/--([\w-]+)\s*:/g)].map((m) => m[1]));
  const src = fs.readFileSync(
    path.join(root, "packages/design-tokens/src/legacy-aliases.ts"),
    "utf8",
  );
  const entries = [...src.matchAll(/^\s+"([\w-]+)": "([^"]*)",$/gm)];
  // C18: tüm alias kullanımları semantik token'lara yazıldı; tablo boş obje (AC-6).
  assert.match(src, /legacyAliases: Record<string, string> = \{\};/);
  assert.equal(entries.length, 0);
  for (const [, name, value] of entries) {
    assert.doesNotMatch(name, /^color-/, `${name}: alias adı semantik ad alanında olamaz`);
    for (const ref of value.matchAll(/var\(--([\w-]+)\)/g)) {
      assert.ok(defined.has(ref[1]), `${name} → --${ref[1]} tanımsız`);
    }
    assert.doesNotMatch(value, /#[0-9a-f]{3,8}\b/i, `${name}: alias değeri renk literal içeremez`);
  }
});
