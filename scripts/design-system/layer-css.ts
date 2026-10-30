// C2 kodmodu (design §2.6, §13 C2): sayfa başı :root bloklarını siler ve her web CSS dosyasını
// kendi cascade layer'ına sarar. İdempotenttir: zaten sarılmış dosyaya dokunmaz.
// Kullanım: node --experimental-strip-types scripts/design-system/layer-css.ts [--check]
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export const ORDER = "@layer tokens, base, legacy, chrome, pages, primitives;";
const root = resolve(import.meta.dirname, "../..");
const webApp = join(root, "apps/web/app");

// Root layout'un yüklediği global CSS'ler, bugünkü import sırasıyla (design §2.6 "Göreli sıranın korunması").
export const LEGACY = [
  "operations.css",
  "components/upgrade-modal.css",
  "styles.css",
  "auth.css",
  "extras.css",
  "tw-utils.css",
];
export const CHROME = ["components/header-nav.css", "components/site-footer.css"];
// Layer'sız kalan tek muaf dosyalar.
export const UNLAYERED = ["styles/tokens.css", "styles/vendor-overrides.css"];

export function layerFor(rel: string): "legacy" | "chrome" | "pages" | null {
  if (UNLAYERED.includes(rel)) return null;
  if (LEGACY.includes(rel)) return "legacy";
  if (CHROME.includes(rel)) return "chrome";
  return "pages";
}

/** Dengeli süslü parantezle bir bloğun bitişini bulur (yorum ve string'leri atlar). */
function blockEnd(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    const c = css[i];
    if (c === "/" && css[i + 1] === "*") {
      i = css.indexOf("*/", i + 2) + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      while (i < css.length && css[i] !== q) {
        if (css[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error("dengesiz süslü parantez");
}

/**
 * Seçicisi tam olarak `:root` olan blokları siler (üst düzeyde veya @media içinde).
 * `[data-theme="dark"]` içeren seçiciler ölü koyu temadır ve C4'te silinir; burada dokunulmaz.
 */
export function stripRootBlocks(css: string): { css: string; removed: number } {
  let removed = 0;
  let out = css;
  for (;;) {
    const re = /(^|[\n{};])(\s*(?:\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\/\s*)*):root\s*\{/g;
    const m = re.exec(out);
    if (!m) break;
    const start = m.index + m[1].length;
    const open = out.indexOf("{", m.index + m[0].length - 1);
    const end = blockEnd(out, open);
    let after = end + 1;
    if (out[after] === "\n") after++;
    out = out.slice(0, start) + out.slice(after);
    removed++;
  }
  // İçi boşalan @media bloklarını temizle.
  out = out.replace(/@media[^{]+\{\s*\}\n?/g, "");
  return { css: out, removed };
}

export function wrap(css: string, layer: string): string {
  const body = css.replace(/^\uFEFF/, "").trimEnd();
  return `${ORDER}\n@layer ${layer} {\n${body}\n}\n`;
}

export function isWrapped(css: string): boolean {
  return css.startsWith(ORDER) || css.split("\n")[1] === ORDER;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".css")) out.push(p);
  }
  return out;
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  let pending = 0;
  for (const file of walk(webApp).sort()) {
    const rel = relative(webApp, file);
    const layer = layerFor(rel);
    if (!layer) continue;
    const src = readFileSync(file, "utf8");
    if (isWrapped(src)) continue;
    pending++;
    if (check) {
      process.stderr.write(`layer-css: sarılmamış: ${rel}\n`);
      continue;
    }
    const { css, removed } = stripRootBlocks(src);
    writeFileSync(file, wrap(css, layer));
    process.stdout.write(
      `${rel}: @layer ${layer}${removed ? `, ${removed} :root bloğu silindi` : ""}\n`,
    );
  }
  if (check && pending) process.exit(1);
}
