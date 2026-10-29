/**
 * Statik tasarım metrikleri (tarayıcı gerektirmez):
 *  - apps/web CSS satır sayıları, sabit kodlanmış renkler (hex / rgb() / hsl()), :root blokları
 *  - page.tsx listesi + her sayfanın ortak header/footer kullanımı (layout zinciri + import grafiği)
 *  - TSX içinde tw-utils.css (Tailwind-benzeri) utility class kullanımı
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { discoverPages, findFiles, type PageEntry } from "./routes.ts";

export const SHARED_HEADER = "app/components/header-nav.tsx";
export const SHARED_FOOTER = "app/components/site-footer.tsx";

interface Counted {
  value: string;
  count: number;
}

function topN<T>(items: T[], n: number, key: (t: T) => number): T[] {
  return [...items].sort((a, b) => key(b) - key(a)).slice(0, n);
}

function countMap(values: string[]): Counted[] {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** En içteki `{ ... }` blokları = bildirim (declaration) blokları. Selector'lar dışarıda kalır. */
function declarationBlocks(css: string): string[] {
  return [...css.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
}

const HEX_RE = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g;

function normalizeHex(hex: string): string {
  const h = hex.slice(1).toLowerCase();
  if (h.length === 3 || h.length === 4) return "#" + [...h].map((c) => c + c).join("");
  return "#" + h;
}

/** rgb()/rgba()/hsl()/hsla() çağrılarını parantez dengesiyle çıkarır. */
function colorFunctions(text: string): string[] {
  const out: string[] = [];
  const re = /\b(rgba?|hsla?)\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < text.length && depth > 0) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")") depth--;
      i++;
    }
    out.push(text.slice(m.index, i).toLowerCase().replace(/\s+/g, ""));
    re.lastIndex = i;
  }
  return out;
}

export interface CssFileMetrics {
  file: string;
  lines: number;
  hexOccurrences: number;
  distinctHex: number;
  colorFnOccurrences: number;
  rootBlocks: number;
  importantCount: number;
}

function cssMetrics(webRoot: string) {
  const files = findFiles(webRoot, (n) => n.endsWith(".css"));
  const perFile: CssFileMetrics[] = [];
  const allHex: string[] = [];
  const allColorFns: string[] = [];
  const rootBlocks: { file: string; selector: string }[] = [];
  const customProps: string[] = [];
  let totalLines = 0;
  let important = 0;

  for (const abs of files) {
    const file = relative(webRoot, abs);
    const raw = readFileSync(abs, "utf8");
    const lines = raw.split("\n").length - (raw.endsWith("\n") ? 1 : 0);
    totalLines += lines;
    const css = stripComments(raw);
    const blocks = declarationBlocks(css);
    const values = blocks.join("\n");

    const hex = [...values.matchAll(HEX_RE)].map((m) => m[0].toLowerCase());
    const fns = colorFunctions(values);
    allHex.push(...hex);
    allColorFns.push(...fns);
    customProps.push(...[...values.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const imp = (values.match(/!important/g) ?? []).length;
    important += imp;

    let fileRoots = 0;
    for (const m of css.matchAll(/([^{};]+)\{/g)) {
      const selector = m[1].trim().replace(/\s+/g, " ");
      if (/:root(?![\w-])/.test(selector)) {
        fileRoots++;
        rootBlocks.push({ file, selector });
      }
    }

    perFile.push({
      file,
      lines,
      hexOccurrences: hex.length,
      distinctHex: new Set(hex).size,
      colorFnOccurrences: fns.length,
      rootBlocks: fileRoots,
      importantCount: imp,
    });
  }

  const literalFns = allColorFns.filter((f) => !f.includes("var("));
  const distinctHexNormalized = new Set(allHex.map(normalizeHex));
  const distinctLiteralFns = new Set(literalFns);

  return {
    fileCount: files.length,
    totalLines,
    topFilesByLines: topN(perFile, 20, (f) => f.lines).map(({ file, lines }) => ({ file, lines })),
    colors: {
      hexOccurrences: allHex.length,
      distinctHex: new Set(allHex).size,
      distinctHexNormalized: distinctHexNormalized.size,
      colorFnOccurrences: allColorFns.length,
      colorFnLiteralOccurrences: literalFns.length,
      colorFnWithVarOccurrences: allColorFns.length - literalFns.length,
      distinctColorFnLiterals: distinctLiteralFns.size,
      /** hex (normalize) + rgb()/hsl() literal toplam farklı renk değeri */
      distinctColorLiterals: distinctHexNormalized.size + distinctLiteralFns.size,
      topHex: countMap(allHex).slice(0, 30),
      topColorFnLiterals: countMap(literalFns).slice(0, 30),
    },
    topFilesByHex: topN(perFile, 20, (f) => f.hexOccurrences).map(
      ({ file, hexOccurrences, distinctHex }) => ({ file, hexOccurrences, distinctHex }),
    ),
    root: {
      blocks: rootBlocks.length,
      /** Selector'ı tam olarak ":root" olan (token tanım) blokları */
      pureBlocks: rootBlocks.filter((r) => r.selector === ":root").length,
      files: [...new Set(rootBlocks.map((r) => r.file))],
      selectors: rootBlocks,
    },
    customProperties: {
      definitions: customProps.length,
      distinct: new Set(customProps).size,
    },
    importantCount: important,
    files: perFile,
  };
}

// ── Header/footer statik analizi ──────────────────────────────────────────────

const IMPORT_RE =
  /(?:import|export)\s[^;]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;

function resolveLocal(fromFile: string, spec: string, webRoot: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = join(dirname(join(webRoot, fromFile)), spec);
  for (const c of [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
  ]) {
    if (/\.(tsx?|jsx?)$/.test(c) && existsSync(c)) return relative(webRoot, c);
  }
  return null;
}

function readSafe(webRoot: string, file: string): string {
  try {
    return readFileSync(join(webRoot, file), "utf8");
  } catch {
    return "";
  }
}

/** BFS: girişlerden ulaşılabilen yerel modüller + her birine ilk ulaşılan zincir. */
function reachable(entries: string[], webRoot: string): Map<string, string[]> {
  const chains = new Map<string, string[]>();
  const queue: string[] = [];
  for (const e of entries) {
    if (!chains.has(e)) {
      chains.set(e, [e]);
      queue.push(e);
    }
  }
  while (queue.length) {
    const file = queue.shift() as string;
    const src = readSafe(webRoot, file);
    for (const m of src.matchAll(IMPORT_RE)) {
      const target = resolveLocal(file, m[1] ?? m[2] ?? m[3], webRoot);
      if (target && !chains.has(target)) {
        chains.set(target, [...(chains.get(file) as string[]), target]);
        queue.push(target);
      }
    }
  }
  return chains;
}

export type ChromeUsage = "shared" | "own" | "shared+own" | "none";

export interface PageChrome {
  file: string;
  pattern: string;
  routes: string[];
  layouts: string[];
  header: ChromeUsage;
  footer: ChromeUsage;
  /** Ortak header'a ulaşan import zinciri (varsa) */
  headerVia: string[] | null;
  footerVia: string[] | null;
  /** Kendi <header>/<footer> JSX'ini render eden (ortak olmayan) dosyalar */
  ownHeaderFiles: string[];
  ownFooterFiles: string[];
  /** Sezgisel: page.tsx içinde redirect()/router.replace() çağrısı varsa ilk hedef (koşullu olabilir; kesin sonuç için çalışma anı finalUrl) */
  redirectsTo: string | null;
}

function classify(shared: boolean, own: boolean): ChromeUsage {
  if (shared && own) return "shared+own";
  if (shared) return "shared";
  if (own) return "own";
  return "none";
}

export function pageChrome(pages: PageEntry[], webRoot: string): PageChrome[] {
  return pages.map((p) => {
    const chains = reachable([...p.layouts, p.file], webRoot);
    const own = (tag: string, sharedFile: string) =>
      [...chains.keys()].filter(
        (f) =>
          f !== SHARED_HEADER &&
          f !== SHARED_FOOTER &&
          f !== sharedFile &&
          new RegExp(`<${tag}[\\s>]`).test(readSafe(webRoot, f)),
      );
    const ownHeaderFiles = own("header", SHARED_HEADER);
    const ownFooterFiles = own("footer", SHARED_FOOTER);
    const headerVia = chains.get(SHARED_HEADER) ?? null;
    const footerVia = chains.get(SHARED_FOOTER) ?? null;
    const redirect = readSafe(webRoot, p.file).match(
      /(?:\bredirect|router\.replace)\(\s*[^"'`)]*["'`](\/[^"'`?$]*)/,
    );
    return {
      file: p.file,
      pattern: p.pattern,
      routes: p.routes,
      layouts: p.layouts,
      header: classify(!!headerVia, ownHeaderFiles.length > 0),
      footer: classify(!!footerVia, ownFooterFiles.length > 0),
      headerVia,
      footerVia,
      ownHeaderFiles,
      ownFooterFiles,
      redirectsTo: redirect ? redirect[1] : null,
    };
  });
}

// ── TSX utility class kullanımı ───────────────────────────────────────────────

function twUtilityClasses(webRoot: string): Set<string> {
  const file = join(webRoot, "app/tw-utils.css");
  if (!existsSync(file)) return new Set();
  const css = stripComments(readFileSync(file, "utf8"));
  const names = new Set<string>();
  for (const m of css.matchAll(/([^{}]+)\{/g)) {
    if (m[1].trim().startsWith("@")) continue;
    for (const c of m[1].matchAll(/\.((?:\\.|[A-Za-z0-9_-])+)/g))
      names.add(c[1].replace(/\\(.)/g, "$1"));
  }
  return names;
}

/** className="..." / className={...} içindeki string literal token'ları. */
function classNameTokens(src: string): string[] {
  const tokens: string[] = [];
  const re = /className\s*=\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    const ch = src[i];
    let expr = "";
    if (ch === '"' || ch === "'") {
      const end = src.indexOf(ch, i + 1);
      expr = src.slice(i, end + 1);
      i = end + 1;
    } else if (ch === "{") {
      let depth = 0;
      const start = i;
      for (; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}" && --depth === 0) break;
      }
      expr = src.slice(start, i + 1);
    }
    re.lastIndex = i;
    for (const s of expr.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)) {
      const text = (s[1] ?? s[2] ?? s[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
      tokens.push(...text.split(/\s+/).filter(Boolean));
    }
  }
  return tokens;
}

function utilityUsage(webRoot: string) {
  const defined = twUtilityClasses(webRoot);
  const tsx = findFiles(webRoot, (n) => n.endsWith(".tsx"));
  const used: string[] = [];
  const arbitrary: string[] = [];
  const perFile: { file: string; occurrences: number }[] = [];
  const tsxHex: string[] = [];
  for (const abs of tsx) {
    const src = readFileSync(abs, "utf8");
    const tokens = classNameTokens(src);
    const hits = tokens.filter((t) => defined.has(t));
    used.push(...hits);
    arbitrary.push(...tokens.filter((t) => /^[a-z0-9:-]+-\[[^\]]+\]$/.test(t)));
    if (hits.length) perFile.push({ file: relative(webRoot, abs), occurrences: hits.length });
    tsxHex.push(
      ...[
        ...src.matchAll(
          /["'`\s(:]#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g,
        ),
      ].map((x) => `#${x[1].toLowerCase()}`),
    );
  }
  const arbitraryDefined = arbitrary.filter((t) => defined.has(t));
  return {
    utilityClasses: {
      definedInTwUtils: defined.size,
      occurrences: used.length,
      distinctUsed: new Set(used).size,
      filesUsing: perFile.length,
      topFiles: topN(perFile, 20, (f) => f.occurrences),
      topClasses: countMap(used).slice(0, 30),
      arbitraryValueOccurrences: arbitrary.length,
      arbitraryValueDistinct: new Set(arbitrary).size,
      arbitraryValueUndefined: [...new Set(arbitrary.filter((t) => !defined.has(t)))].sort(),
      arbitraryValueDefinedOccurrences: arbitraryDefined.length,
    },
    tsxHexLiterals: {
      occurrences: tsxHex.length,
      distinct: new Set(tsxHex).size,
    },
  };
}

export function collectMetrics(webRoot: string) {
  const pages = discoverPages(webRoot);
  const chrome = pageChrome(pages, webRoot);
  const tally = (key: "header" | "footer") =>
    chrome.reduce<Record<string, number>>(
      (acc, c) => ((acc[c[key]] = (acc[c[key]] ?? 0) + 1), acc),
      {},
    );
  return {
    generatedAt: new Date().toISOString(),
    webRoot: relative(process.cwd(), webRoot) || ".",
    css: cssMetrics(webRoot),
    pages: {
      count: pages.length,
      routeCount: new Set(pages.flatMap((p) => p.routes)).size,
      headerUsage: tally("header"),
      footerUsage: tally("footer"),
      list: chrome,
    },
    ...utilityUsage(webRoot),
  };
}

export type Metrics = ReturnType<typeof collectMetrics>;
