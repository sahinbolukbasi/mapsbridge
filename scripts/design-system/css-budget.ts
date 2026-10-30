// CSS satır bütçesi ölçümü (design §13.1, AC-5). Bağımsızdır (ui-audit'e bağlı değil).
// apps/web altındaki her CSS dosyası için yorumları atarak blok bazlı tarar ve şunları yazar:
//   lines        — dosya satırı (ui-audit metrics.ts `css.totalLines` ile aynı sayım)
//   darkLines    — seçici listesinin tamamı [data-theme="dark"] olan blokların satırları
//   rootLines    — :root seçicili (dark olmayan) blokların satırları
//   poolLines    — primitive havuzu: seçicisinde POOL deseni geçen, dark olmayan kuralların satırları
// Kullanım: node --experimental-strip-types scripts/design-system/css-budget.ts [--out <json>]
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "../..");
const webRoot = join(root, "apps/web");
const SKIP = new Set(["node_modules", "out", ".next"]);
export const POOL =
  /btn|button|input|field|modal|dialog|badge|chip|toast|spinner|skeleton|shimmer|avatar|empty-state|pagination|tab|tabs|footer|alert|toggle|switch|checkbox|select/;
const DARK = /\[data-theme=["']?dark["']?\]/;

export type FileBudget = {
  file: string;
  lines: number;
  darkLines: number;
  rootLines: number;
  poolLines: number;
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir).sort()) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".css")) out.push(p);
  }
  return out;
}

/** Yorumları aynı satır sayısını koruyarak boşlukla değiştirir. */
function blankComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

type Rule = { selector: string; startLine: number; endLine: number };

/** En içteki (bildirim içeren) kuralları satır aralıklarıyla döndürür. */
function rules(css: string): Rule[] {
  const out: Rule[] = [];
  const stack: Array<{ prelude: string; start: number }> = [];
  let preludeStart = 0;
  let line = 1;
  const lineAt: number[] = [];
  for (let i = 0; i < css.length; i++) {
    lineAt[i] = line;
    const c = css[i];
    if (c === "\n") line++;
    else if (c === '"' || c === "'") {
      for (i++; i < css.length && css[i] !== c; i++) {
        lineAt[i] = line;
        if (css[i] === "\\") i++;
      }
      lineAt[i] = line;
    } else if (c === "{") {
      const raw = css.slice(preludeStart, i);
      const lead = raw.length - raw.trimStart().length;
      stack.push({ prelude: raw.trim(), start: preludeStart + lead });
      preludeStart = i + 1;
    } else if (c === "}") {
      const top = stack.pop();
      if (top && !top.prelude.startsWith("@")) {
        out.push({
          selector: top.prelude.replace(/\s+/g, " "),
          startLine: lineAt[top.start] ?? line,
          endLine: line,
        });
      }
      preludeStart = i + 1;
    } else if (c === ";") preludeStart = i + 1;
  }
  return out;
}

export function measureFile(abs: string): FileBudget {
  const raw = readFileSync(abs, "utf8");
  const lines = raw.split("\n").length - (raw.endsWith("\n") ? 1 : 0);
  const budget: FileBudget = {
    file: relative(webRoot, abs).split("\\").join("/"),
    lines,
    darkLines: 0,
    rootLines: 0,
    poolLines: 0,
  };
  for (const r of rules(blankComments(raw))) {
    const span = r.endLine - r.startLine + 1;
    const parts = r.selector.split(",").map((s) => s.trim());
    if (parts.every((p) => DARK.test(p))) budget.darkLines += span;
    else if (/:root(?![\w-])/.test(r.selector)) budget.rootLines += span;
    else if (POOL.test(r.selector)) budget.poolLines += span;
  }
  return budget;
}

export function measure() {
  const files = walk(webRoot).map(measureFile);
  const sum = (k: keyof Omit<FileBudget, "file">) => files.reduce((s, f) => s + f[k], 0);
  return {
    generatedAt: new Date().toISOString(),
    method: "design §13.1 (blok bazlı, yorumlar atılmış)",
    totals: {
      files: files.length,
      totalLines: sum("lines"),
      darkLines: sum("darkLines"),
      rootLines: sum("rootLines"),
      poolLines: sum("poolLines"),
    },
    files,
  };
}

// import.meta.main Node 22'de yok; doğrudan çalıştırma argv[1] ile anlaşılır.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = measure();
  const i = process.argv.indexOf("--out");
  if (i !== -1 && process.argv[i + 1]) {
    const out = resolve(process.argv[i + 1]);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  }
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
