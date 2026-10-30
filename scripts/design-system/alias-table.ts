// Eski custom property'leri (sayfa başı :root blokları) semantik token'lara bağlar (design §2.5).
// Çıktılar: packages/design-tokens/src/legacy-aliases.ts ve (verilirse) --report <json>.
// Kullanım: node --experimental-strip-types scripts/design-system/alias-table.ts [--report f.json] [--check]
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fold, normalizeHex } from "../../packages/design-tokens/src/color-math.ts";
import { palette } from "../../packages/design-tokens/src/palette.ts";
import { color, type ColorValue } from "../../packages/design-tokens/src/tokens.ts";

const root = resolve(import.meta.dirname, "../..");
const webApp = join(root, "apps/web/app");
const outFile = join(root, "packages/design-tokens/src/legacy-aliases.ts");

// tokens.css'te aynı adla zaten tanımlı ölçek token'ları: alias üretilmez, token değeri geçerlidir.
const NATIVE = new Set([
  "space-1",
  "space-2",
  "space-3",
  "space-4",
  "space-5",
  "space-6",
  "space-8",
  "space-12",
  "space-16",
  "shadow-sm",
  "shadow-lg",
  "content-form",
  "content-reading",
  "page-gutter",
  "control-height",
  "mobile-nav-height",
  "app-header-height",
  "radius-sm",
  "radius-lg",
]);

// Renk dışı eski adlar → eşdeğer ölçek token'ı. Font adı literal'leri değer koruyarak aynen kalır (C2 görsel fark 0).
const NON_COLOR: Record<string, string> = {
  radius: "var(--radius-md)",
  "nav-height": "var(--header-height)",
  "font-sans": "var(--font-family-sans)",
  "font-sm": "var(--font-size-md)",
  "font-body": "var(--font-size-base)",
  "font-section": "var(--font-size-display)",
  "line-body": "var(--line-height-body)",
  "line-heading": "var(--line-height-heading)",
  "content-width": "var(--container-full)",
};

// Aynı ada farklı değer veren çakışmalar için bağlayıcı hedefler (design §2.5 tablo 2).
const CONFLICT_TARGET: Record<string, string> = {
  "mb-forest": "color-primary",
  "sb-primary": "color-primary",
  "sb-canvas-base": "color-bg",
  "sb-canvas-subtle": "color-surface-sunken",
  "sb-text-main": "color-text",
  "sb-text-muted": "color-text-muted",
  "sb-bg-page": "color-bg",
  "sb-border-subtle": "color-border-subtle",
  "sb-surface-card": "color-surface",
};

// calm ailesi (styles.css) için bağlayıcı satırlar (design §2.5 tablo 1).
const FIXED: Record<string, string> = {
  brand: "color-brand",
  "brand-hover": "color-brand-hover",
  "brand-soft": "color-surface-brand",
  text: "color-text",
  "text-muted": "color-text-muted",
  surface: "color-surface",
  "surface-alt": "color-surface-sunken",
  bg: "color-bg",
  border: "color-border",
  "border-focus": "color-border-control",
  "on-brand": "color-on-primary",
  "focus-ring": "focus-ring-color",
  danger: "color-danger",
  success: "color-success",
  "error-bg": "color-danger-bg",
  "error-border": "color-danger-border",
};

type Def = { file: string; value: string };

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".css") && !p.endsWith("styles/tokens.css")) out.push(p);
  }
  return out;
}

export function collectRootDefs(): Map<string, Def[]> {
  const defs = new Map<string, Def[]>();
  for (const file of walk(webApp)) {
    const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/(^|[\n}])([^{}\n]*):root([^{]*)\{([^}]*)\}/g)) {
      const selector = `${m[2]}:root${m[3]}`;
      if (selector.includes("dark")) continue;
      for (const d of m[4].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
        const list = defs.get(d[1]) ?? [];
        list.push({ file: relative(webApp, file), value: d[2].replace(/\s+/g, " ").trim() });
        defs.set(d[1], list);
      }
    }
  }
  return defs;
}

const CALM_VALUES: Record<string, string> = {};

/** var(--x, fallback) zincirini düz değere indirir. */
function flatten(value: string, defs: Map<string, Def[]>, depth = 0): string {
  const m = value.match(/^var\(--([\w-]+)\s*(?:,\s*(.+))?\)$/);
  if (!m || depth > 5) return value;
  const ref = defs.get(m[1])?.[0]?.value ?? CALM_VALUES[m[1]];
  if (ref) return flatten(ref, defs, depth + 1);
  return m[2] ? flatten(m[2].trim(), defs, depth + 1) : value;
}

function sameValue(a: ColorValue, b: ColorValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function semanticFor(primitive: string, legacyName: string): string | undefined {
  const candidates = Object.entries(color)
    .filter(([, v]) => "ref" in v && v.ref === primitive)
    .map(([k]) => k);
  if (candidates.length === 0) return undefined;
  const n = legacyName;
  const hints: Array<[RegExp, RegExp]> = [
    [/deep-forest|forest-dark/, /surface-inverse/],
    [/border|outline/, /border/],
    [/on-primary$|on-brand/, /on-primary/],
    [/text|on-surface|on-background|muted|on-secondary|on-primary-container/, /text|on-/],
    [/canvas|bg|background|surface|card|container|subtle|page|glow|mint/, /surface|bg|neutral/],
    [/error|danger/, /danger/],
    [/primary|secondary|brand|forest|emerald|accent|tertiary/, /primary|brand|accent|success|link/],
  ];
  for (const [nameRe, tokenRe] of hints) {
    if (!nameRe.test(n)) continue;
    const hit = candidates.find((c) => tokenRe.test(c));
    if (hit) return hit;
  }
  return candidates[0];
}

export type Row = {
  name: string;
  values: string[];
  files: string[];
  target: string;
  dE?: number;
  decided?: boolean;
  kind: "native" | "fixed" | "conflict" | "color" | "non-color" | "literal";
};

export function buildTable(defs: Map<string, Def[]>): { rows: Row[]; errors: string[] } {
  const rows: Row[] = [];
  const errors: string[] = [];
  for (const [name, list] of [...defs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (name.startsWith("color-")) continue; // yeni adlar
    const values = [...new Set(list.map((d) => d.value))];
    const files = [...new Set(list.map((d) => d.file))];
    const base = { name, values, files };
    if (NATIVE.has(name)) {
      rows.push({ ...base, target: `(tokens.css --${name})`, kind: "native" });
      continue;
    }
    if (NON_COLOR[name]) {
      rows.push({ ...base, target: NON_COLOR[name], kind: "non-color" });
      continue;
    }
    if (FIXED[name]) {
      rows.push({ ...base, target: `var(--${FIXED[name]})`, kind: "fixed" });
      continue;
    }
    if (CONFLICT_TARGET[name]) {
      rows.push({ ...base, target: `var(--${CONFLICT_TARGET[name]})`, kind: "conflict" });
      continue;
    }
    if (values.length > 1) {
      errors.push(`--${name}: birden fazla değer (${values.join(" | ")}) ve çakışma kararı yok`);
      continue;
    }
    const flat = flatten(values[0], defs);
    const rgba = flat.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/);
    if (rgba) {
      const hex =
        "#" +
        [rgba[1], rgba[2], rgba[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("");
      const f = fold(hex);
      const pct = Math.round(Number(rgba[4]) * 100);
      const hit =
        f &&
        Object.entries(color).find(([, v]) =>
          sameValue(v, { mix: f.name as keyof typeof palette, percent: pct }),
        );
      if (hit) {
        rows.push({ ...base, target: `var(--${hit[0]})`, dE: f!.dE, kind: "color" });
        continue;
      }
      if (f) {
        rows.push({
          ...base,
          target: `color-mix(in srgb, var(--${semanticFor(f.name, name) ?? f.name}) ${pct}%, transparent)`,
          dE: f.dE,
          kind: "color",
        });
        continue;
      }
      errors.push(`--${name}: ${flat} için katlama yok`);
      continue;
    }
    const hex = normalizeHex(flat);
    if (hex) {
      const f = fold(hex);
      if (!f) {
        errors.push(`--${name}: ${hex} ΔE>6 ve karar tablosunda yok`);
        continue;
      }
      if (f.group !== "ui") {
        errors.push(`--${name}: ${hex} → ${f.name} (UI dışı grup)`);
        continue;
      }
      const sem = semanticFor(f.name, name);
      if (!sem) {
        errors.push(`--${name}: ${hex} → ${f.name} için semantik token yok`);
        continue;
      }
      rows.push({
        ...base,
        target: `var(--${sem})`,
        dE: Number(f.dE.toFixed(1)),
        decided: f.decided,
        kind: "color",
      });
      continue;
    }
    // Font yığını gibi literal değerler: değer koruyarak aynen.
    if (!/#[0-9a-f]{3,8}\b/i.test(flat)) {
      rows.push({ ...base, target: flat, kind: "literal" });
      continue;
    }
    errors.push(`--${name}: çözümlenemeyen değer ${flat}`);
  }
  return { rows, errors };
}

function render(rows: Row[]): string {
  const body = rows
    .filter((r) => r.kind !== "native")
    .map((r) => `  ${JSON.stringify(r.name)}: ${JSON.stringify(r.target)},`)
    .join("\n");
  return [
    "// C2'de scripts/design-system/alias-table.ts ile bir kez üretildi (kaynak: silinen sayfa :root blokları).",
    "// Eski sayfa token adları → semantik token (design §2.5). Geçicidir: her sayfa grubu taşındığında",
    "// o dosyanın eski adları semantik adlarla değiştirilir ve satırı buradan elle silinir. Son hali {}.",
    "// Yeni satır EKLENMEZ (guard).",
    "",
    "export const legacyAliases: Record<string, string> = {",
    body,
    "};",
    "",
  ].join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const reportIdx = args.indexOf("--report");
  const defs = collectRootDefs();
  // styles.css :root silindikten sonra var(--brand, …) çözümlemesi için calm değerleri sabitlenir.
  for (const [k, v] of Object.entries(FIXED)) {
    const resolved = color[v];
    if (resolved && "ref" in resolved) CALM_VALUES[k] = palette[resolved.ref];
  }
  const { rows, errors } = buildTable(defs);
  if (errors.length) {
    for (const e of errors) process.stderr.write(`alias-table: ${e}\n`);
    process.exit(1);
  }
  if (reportIdx >= 0)
    writeFileSync(resolve(args[reportIdx + 1]), JSON.stringify(rows, null, 2) + "\n");
  writeFileSync(outFile, render(rows));
  process.stdout.write(
    `alias-table: ${rows.length} satır, ${rows.filter((r) => r.kind !== "native").length} alias\n`,
  );
}
