// Renk kodmodu (design §2.7, D14): CSS/TSX renk literal'lerini semantik token'lara çevirir.
// Bağımlılıksız; Node type-stripping ile koşar.
//
// Kullanım:
//   node --experimental-strip-types scripts/design-system/codemod-colors.ts [seçenekler] <dosya|dizin>...
//     --mode css|tsx|rn      (varsayılan: uzantıdan; rn = React Native, apps/mobile)
//     --dry-run              dosyaya yazmaz, yalnızca rapor
//     --report <json>        codemod-report.json yolu
//     --apply-manual <id,…>  manuel-kontrast listesinden onaylanan satırlar (tekrarlanabilir kayıt)
//
// Kurallar (özet):
//   1. Exact map: palette literal'i → role göre (color/background/border/shadow) semantik token.
//      Değer korunmuyorsa (rol token'ı yoksa) otomatik uygulanmaz.
//   2. Zemin farkındalığı: aynı dosyada göreli parlaklığı < 0.2 olan zemin çizen sınıfları
//      içeren seçicilerde metin rolü inverse ailesinden seçilir ve kural `inverseContainers`'a yazılır.
//   3. Değeri birebir korunmayan her color/fill/stroke değişikliği `manualContrast[]`'e düşer;
//      yalnızca --apply-manual ile uygulanır.
//   4. rgba(palette, a) → hazır alfa token'ı ya da color-mix(in srgb, var(--t) a%, transparent).
//      box-shadow içindeki siyah alfalar gölge token'ı ister → rapora (uygulanmaz).
//   5. ΔE fallback: exact yoksa fold(); ΔE ≤ 6 ya da karar tablosu satırı (§2.4b) → metin değilse
//      uygulanır; ΔE > 6 ve satır yok → `unmapped[]`, dokunulmaz, exit 1.
//   6. thirdParty / dataPalette literal'leri hiçbir zaman katlanmaz (rapora not).
//   7. Tamamı [data-theme="dark"] olan kural blokları silinir.
//   8. Layer sarma layer-css.ts'in işidir; sarılmamış CSS dosyası ölümcül hatadır.
// Ayrıştırılamayan dosya ölümcüldür (işlem durur, hiçbir dosya yazılmaz).
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deltaE, fold, normalizeHex } from "../../packages/design-tokens/src/color-math.ts";
import { dataPalette, palette, thirdParty } from "../../packages/design-tokens/src/palette.ts";
import { hexToRgb, resolveColor } from "../../packages/design-tokens/src/resolve.ts";
import { color, inverseOverrides } from "../../packages/design-tokens/src/tokens.ts";
import { legacyAliases } from "../../packages/design-tokens/src/legacy-aliases.ts";
import { luminance } from "../../packages/design-tokens/src/contrast.ts";
import {
  emitTwCss,
  ensureImport,
  loadTwTable,
  transformTwTsx,
  type TwReport,
} from "./codemod-tw.ts";

const root = resolve(import.meta.dirname, "../..");
const webApp = join(root, "apps/web/app");
const LAYER_ORDER = "@layer tokens, base, legacy, chrome, pages, primitives;";

// Kapsam dışı (G7 ile aynı + üretilmiş dosyalar).
const EXCLUDED = [
  /^lib\/ai\//,
  /^lib\/trip\/routing-service\.ts$/,
  /^lib\/destination\//,
  /^lib\/visa\//,
  /^lib\/affiliate\//,
  /^lib\/tracker\//,
  /^lib\/design-tokens\.ts$/,
  /^components\/ui\/google-logo\.tsx$/,
  /^styles\/tokens\.css$/,
];

export type Role = "text" | "background" | "border" | "shadow" | "ambiguous";
export type Change = {
  id: string;
  file: string;
  line: number;
  selector: string;
  property: string;
  before: string;
  after: string;
  kind: "exact" | "alpha" | "fold" | "decided";
  dE?: number;
  preserved: boolean;
  background: "light" | "dark" | "unknown";
  contrast?: number;
};
export type Note = {
  file: string;
  line: number;
  property: string;
  value: string;
  reason: string;
};
export type FileReport = { file: string; applied: number; manual: number; skipped: number };
export type Report = {
  mode: "css" | "tsx" | "rn";
  dryRun: boolean;
  files: FileReport[];
  applied: Change[];
  manualContrast: Change[];
  ambiguous: Note[];
  unmapped: Note[];
  notes: Note[];
  inverseContainers: Array<{ file: string; line: number; selector: string }>;
  darkBlocksRemoved: Array<{ file: string; line: number; selector: string }>;
};

// ---------------------------------------------------------------------------------------------
// Renk değerleri

type Parsed = { hex: string; alpha: number };
const PALETTE_BY_HEX = new Map<string, string>(
  Object.entries(palette).map(([n, h]) => [h.toLowerCase(), n]),
);
const THIRD_PARTY = new Map(Object.entries(thirdParty).map(([n, h]) => [h.toLowerCase(), n]));
const DATA = new Map(Object.entries(dataPalette).map(([n, h]) => [h.toLowerCase(), n]));
const NAMED: Record<string, string> = { white: "#ffffff", black: "#000000" };

/** Literal metni → {hex, alpha}; tanınmazsa null. */
export function parseColor(literal: string): Parsed | null {
  const s = literal.trim().toLowerCase();
  if (NAMED[s]) return { hex: NAMED[s], alpha: 1 };
  let m = s.match(/^#([0-9a-f]{8}|[0-9a-f]{4})$/);
  if (m) {
    const h = m[1].length === 4 ? [...m[1]].map((c) => c + c).join("") : m[1];
    return {
      hex: `#${h.slice(0, 6)}`,
      alpha: Math.round((parseInt(h.slice(6), 16) / 255) * 1000) / 1000,
    };
  }
  const hex = normalizeHex(s);
  if (hex) return { hex, alpha: 1 };
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map(Number);
    if ([r, g, b].some((v) => !Number.isInteger(v) || v > 255)) return null;
    const a =
      m[4] === undefined ? 1 : m[4].endsWith("%") ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
    const to2 = (v: number) => v.toString(16).padStart(2, "0");
    return { hex: `#${to2(r)}${to2(g)}${to2(b)}`, alpha: a };
  }
  return null;
}

const COLOR_LITERAL =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\brgba?\([^()]*\)|(?<![\w-])(?:white|black)(?![\w-])/g;

// ---------------------------------------------------------------------------------------------
// Rol → aday semantik token'lar (sıra önceliktir). Değer korunuyorsa ilk eşleşen seçilir.

const NEUTRAL = Object.keys(color).filter((n) => n.startsWith("color-neutral-"));
const TEXT_LIGHT = [
  "color-text",
  "color-text-muted",
  "color-text-subtle",
  "color-text-brand",
  "color-link",
  "color-on-surface-brand",
  "color-success",
  "color-success-strong",
  "color-warning",
  "color-warning-strong",
  "color-danger",
  "color-info",
  "color-accent-sky",
  "color-on-primary",
  "color-on-accent",
  "color-accent",
  "color-accent-strong",
  "color-warning-icon",
  "color-danger-icon",
  "color-info-icon",
  ...NEUTRAL.filter((n) => !/-(0|50|100|200|300|400)$/.test(n)), // açık zeminde 4.5 altı nötr metin yasak
];
const TEXT_DARK = [
  "color-text-inverse",
  "color-text-inverse-muted",
  "color-text-inverse-subtle",
  "color-text-inverse-brand",
  "color-link-inverse",
  "color-surface-brand-soft",
  "color-accent-strong",
  "color-accent",
  "color-on-primary",
  "color-accent-sky-soft",
  "color-warning-icon",
  "color-danger-icon",
  ...NEUTRAL,
];
const BACKGROUND = [
  "color-bg",
  "color-surface",
  "color-surface-sunken",
  "color-surface-tint",
  "color-surface-brand",
  "color-surface-brand-strong",
  "color-surface-brand-soft",
  "color-surface-inverse",
  "color-surface-inverse-strong",
  "color-primary",
  "color-brand",
  "color-brand-hover",
  "color-accent",
  "color-accent-strong",
  "color-accent-sky",
  "color-accent-sky-soft",
  "color-success-bg",
  "color-success",
  "color-success-strong",
  "color-warning-bg",
  "color-warning-bg-strong",
  "color-warning-icon",
  "color-danger-bg",
  "color-danger-solid",
  "color-danger-icon",
  "color-info-bg",
  "color-info-icon",
  "color-map-route",
  ...NEUTRAL,
];
const BORDER = [
  "color-border",
  "color-border-strong",
  "color-border-control",
  "color-success-border",
  "color-warning-border",
  "color-danger-border",
  "color-info-border",
  "color-primary",
  "color-brand",
  "color-accent",
  "color-accent-strong",
  "color-success",
  "color-danger",
  "color-info-icon",
  "color-warning-icon",
  ...NEUTRAL,
];
const ROLE_LIST: Record<Exclude<Role, "ambiguous">, string[]> = {
  text: TEXT_LIGHT,
  background: BACKGROUND,
  border: BORDER,
  shadow: [...BORDER, ...BACKGROUND],
};

const PROP_ROLE: Array<[RegExp, Role]> = [
  [
    /^(color|fill|stroke|caret-color|accent-color|-webkit-text-fill-color|text-decoration-color|stop-color)$/,
    "text",
  ],
  [/^background(-color|-image)?$/, "background"],
  [
    /^(border|outline|column-rule)(-(top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))?(-color)?$/,
    "border",
  ],
  [/^(box-shadow|text-shadow|filter|drop-shadow)$/, "shadow"],
];
export function roleOf(prop: string): Role {
  const p = prop.toLowerCase();
  if (p.startsWith("--")) return "ambiguous";
  for (const [re, role] of PROP_ROLE) if (re.test(p)) return role;
  return "ambiguous";
}
const camelToKebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const hexOfToken = (name: string): string => {
  const c = resolveColor(name);
  const to2 = (v: number) => v.toString(16).padStart(2, "0");
  return `#${to2(c.r)}${to2(c.g)}${to2(c.b)}`;
};
const alphaOfToken = (name: string): number => resolveColor(name).a;
/** inverse kapsamında değeri değişen token (sabit olmayan). */
const scoped = (name: string) => Boolean(inverseOverrides[name]);

/** primitive hex'i için role uygun ve (koyu bağlamda kapsamdan bağımsız) token. */
export function tokenFor(
  hex: string,
  role: Exclude<Role, "ambiguous">,
  dark: boolean,
  stable = false,
): string | null {
  const list = role === "text" && dark ? TEXT_DARK : ROLE_LIST[role];
  for (const name of list) {
    if (!(name in color)) continue;
    if (alphaOfToken(name) !== 1) continue;
    if ((dark || stable) && scoped(name)) continue;
    if (hexOfToken(name) === hex) return name;
  }
  return null;
}
/** Hazır alfa token'ı (color-accent-a20, white-a08, scrim …). */
function alphaToken(hex: string, alpha: number): string | null {
  for (const [name, v] of Object.entries(color)) {
    if (!("mix" in v)) continue;
    if (palette[v.mix].toLowerCase() === hex && Math.abs(v.percent / 100 - alpha) < 0.005)
      return name;
  }
  return null;
}
const pct = (a: number) => `${Math.round(a * 10000) / 100}%`;
/** Açık ve koyu zemin örnekleri (kontrast raporu için). */
const LIGHT_BG = hexToRgb(palette["slate-0"]);
const DARK_BG = hexToRgb(palette["forest-950"]);
function contrastOn(hex: string, dark: boolean): number {
  const fg = luminance(hexToRgb(hex));
  const bg = luminance(dark ? DARK_BG : LIGHT_BG);
  const [hi, lo] = fg > bg ? [fg, bg] : [bg, fg];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

type Decision =
  | {
      action: "replace";
      after: string;
      kind: Change["kind"];
      preserved: boolean;
      dE?: number;
      targetHex: string;
    }
  | { action: "note" | "ambiguous" | "unmapped"; reason: string };

/**
 * Tek literal için karar (design §2.7 adım 1–6). `stable`: kural koyu bir kabın içinde ama kendi
 * zemini açık (ör. koyu bant içindeki beyaz buton) → inverse kapsamında değeri değişen token seçilmez.
 */
export function decide(
  literal: string,
  prop: string,
  dark: boolean | null,
  stable = false,
): Decision {
  const parsed = parseColor(literal);
  if (!parsed) return { action: "ambiguous", reason: "çözümlenemeyen renk" };
  const role = roleOf(prop);
  if (role === "ambiguous") return { action: "ambiguous", reason: `rol belirsiz (${prop})` };
  const { hex, alpha } = parsed;
  if (role === "shadow" && hex === "#000000")
    return { action: "note", reason: "gölge: siyah alfa → --shadow-* token'ı (elle)" };
  if (role === "text" && dark === null) {
    // Karışık seçici listesi: yalnızca değeri her iki kapsamda birebir koruyan (inverse'te
    // değişmeyen) token kabul edilir; yoksa belirsiz.
    const exact = PALETTE_BY_HEX.get(hex);
    const stableToken = exact && alpha === 1 ? tokenFor(hex, "text", false, true) : null;
    if (!stableToken)
      return { action: "ambiguous", reason: "zemin belirsiz (karışık seçici listesi)" };
    return {
      action: "replace",
      after: `var(--${stableToken})`,
      kind: "exact",
      preserved: true,
      targetHex: hex,
    };
  }
  const isDark = dark === true;
  let target = PALETTE_BY_HEX.get(hex);
  let kind: Change["kind"] = alpha === 1 ? "exact" : "alpha";
  let dE: number | undefined;
  if (!target) {
    if (THIRD_PARTY.has(hex))
      return {
        action: "note",
        reason: `üçüncü taraf (${THIRD_PARTY.get(hex)})${hex.match(/^#(4285f4|34a853|fbbc05|ea4335)$/) ? " → google-logo.tsx'e taşı" : ""}`,
      };
    if (DATA.has(hex))
      return { action: "note", reason: `veri paleti (${DATA.get(hex)}) — katlanmaz` };
    const f = fold(hex);
    if (!f) return { action: "unmapped", reason: "ΔE > 6 ve §2.4b karar tablosunda satır yok" };
    if (f.group !== "ui")
      return { action: "ambiguous", reason: `karar hedefi UI dışı (${f.name})` };
    target = f.name;
    kind = f.decided ? "decided" : "fold";
    dE =
      Math.round((f.decided ? f.dE : deltaE(hex, palette[f.name as keyof typeof palette])) * 10) /
      10;
  }
  const targetHex = palette[target as keyof typeof palette].toLowerCase();
  let preserved = targetHex === hex;
  // Hazır alfa token'ı (scrim, accent-a20, white-a08 …) rol listesinden önce gelir.
  const ready = alpha < 1 && preserved ? alphaToken(targetHex, alpha) : null;
  if (ready && !((isDark || stable) && scoped(ready)))
    return { action: "replace", after: `var(--${ready})`, kind, preserved, dE, targetHex };
  let token = tokenFor(targetHex, role, isDark, stable);
  if (!token && role === "text" && !isDark && !stable) {
    // Açık zeminde 4.5 altı nötr metin: --color-text-subtle önerilir (değer korunmaz → manuel).
    if (
      ["slate-0", "slate-50", "slate-100", "slate-200", "slate-300", "slate-400"].includes(target)
    ) {
      token = "color-text-subtle";
      preserved = false;
    }
  }
  if (!token) return { action: "ambiguous", reason: `${target} için ${role} rolünde token yok` };
  const after =
    alpha === 1
      ? `var(--${token})`
      : `color-mix(in srgb, var(--${token}) ${pct(alpha)}, transparent)`;
  return { action: "replace", after, kind, preserved, dE, targetHex: hexOfToken(token) };
}

// ---------------------------------------------------------------------------------------------
// CSS ayrıştırma (yorum/string farkındalıklı; satır numaraları korunur)

type Decl = {
  prop: string;
  valueStart: number;
  valueEnd: number;
  line: number;
  selector: string;
  ruleIndex: number;
};
type CssRule = {
  selector: string;
  start: number;
  end: number;
  line: number;
  index: number;
  decls: Decl[];
};

export function parseCss(css: string, file = "<css>"): CssRule[] {
  const rules: CssRule[] = [];
  const stack: Array<{ prelude: string; start: number; line: number; rule?: CssRule }> = [];
  let segStart = 0;
  let line = 1;
  const lineAt = lineIndex(css);
  const flushDecl = (end: number) => {
    const top = stack[stack.length - 1];
    if (!top?.rule) return;
    const seg = css.slice(segStart, end);
    const colon = indexOutside(seg, ":");
    if (colon < 0) return;
    const prop = seg.slice(0, colon).trim();
    if (!/^-{0,2}[a-zA-Z][\w-]*$/.test(prop)) return;
    let vs = segStart + colon + 1;
    while (vs < end && /\s/.test(css[vs])) vs++;
    let ve = end;
    while (ve > vs && /\s/.test(css[ve - 1])) ve--;
    top.rule.decls.push({
      prop,
      valueStart: vs,
      valueEnd: ve,
      line: lineAt(vs),
      selector: top.rule.selector,
      ruleIndex: top.rule.index,
    });
  };
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "\n") line++;
    else if (c === "/" && css[i + 1] === "*") {
      const close = css.indexOf("*/", i + 2);
      if (close < 0) throw new Error(`${file}:${line}: kapanmamış yorum`);
      for (let k = i; k < close + 2; k++) if (css[k] === "\n") line++;
      i = close + 1;
    } else if (c === '"' || c === "'") {
      for (i++; i < css.length && css[i] !== c; i++) {
        if (css[i] === "\\") i++;
        else if (css[i] === "\n") throw new Error(`${file}:${line}: kapanmamış string`);
      }
    } else if (c === "(") {
      // url(...) ve diğer fonksiyonlar: ; { } içeremez varsayımı yerine eşleşen parantezi atla.
      let depth = 1;
      for (i++; i < css.length && depth > 0; i++) {
        if (css[i] === "(") depth++;
        else if (css[i] === ")") depth--;
        else if (css[i] === '"' || css[i] === "'") {
          const q = css[i];
          for (i++; i < css.length && css[i] !== q; i++) if (css[i] === "\\") i++;
        } else if (css[i] === "\n") line++;
      }
      i--;
    } else if (c === "{") {
      const prelude = stripComments(css.slice(segStart, i)).trim().replace(/\s+/g, " ");
      const isAt = prelude.startsWith("@");
      const rule: CssRule | undefined = isAt
        ? undefined
        : {
            selector: prelude,
            start: segStart,
            end: -1,
            line: lineAt(segStart + leadingWs(css, segStart, i)),
            index: rules.length,
            decls: [],
          };
      if (rule) {
        rule.start = segStart + leadingWs(css, segStart, i);
        rules.push(rule);
      }
      stack.push({ prelude, start: segStart, line, rule });
      segStart = i + 1;
    } else if (c === "}") {
      flushDecl(i);
      const top = stack.pop();
      if (!top) throw new Error(`${file}:${line}: dengesiz '}'`);
      if (top.rule) top.rule.end = i + 1;
      segStart = i + 1;
    } else if (c === ";") {
      flushDecl(i);
      segStart = i + 1;
    }
  }
  if (stack.length) throw new Error(`${file}: kapanmamış blok (${stack.length})`);
  return rules;
}
/** pos → 1 tabanlı satır (ikili arama). */
function lineIndex(text: string): (pos: number) => number {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return (pos) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}
function leadingWs(css: string, from: number, to: number): number {
  let k = from;
  while (k < to) {
    if (/\s/.test(css[k])) k++;
    else if (css[k] === "/" && css[k + 1] === "*") {
      const close = css.indexOf("*/", k + 2);
      k = close < 0 ? to : close + 2;
    } else break;
  }
  return k - from;
}
function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ");
}
function indexOutside(s: string, ch: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    else if (s[i] === ch && depth === 0) return i;
  }
  return -1;
}

/** Değer içindeki string/url() aralıklarını maskeler (renk aranmaz). */
function maskStrings(value: string): string {
  return value
    .replace(/url\([^)]*\)/gi, (m) => " ".repeat(m.length))
    .replace(/"[^"]*"|'[^']*'/g, (m) => " ".repeat(m.length));
}

/** Bir zemin değerinin göreli parlaklığı (bilinen literal ya da token). */
function backgroundLuminance(value: string): number | null {
  const masked = maskStrings(value);
  const lit = masked.match(COLOR_LITERAL)?.[0];
  if (lit) {
    const p = parseColor(lit);
    if (p && p.alpha >= 0.5) return luminance(hexToRgb(p.hex));
  }
  const v = masked.match(/var\(--([\w-]+)/);
  if (v) {
    let name = v[1];
    const alias = legacyAliases[name]?.match(/^var\(--([\w-]+)\)$/);
    if (alias) name = alias[1];
    if (name in color) {
      const c = resolveColor(name);
      if (c.a >= 0.5) return luminance(c);
    }
  }
  return null;
}
const classesOf = (selector: string) => [...selector.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
const lastCompound = (part: string) =>
  part
    .trim()
    .split(/\s*[\s>+~]\s*/)
    .pop() ?? part;

/** Dosyadaki koyu zemin sınıfları (design §2.7 adım 2). */
function darkClasses(css: string, rules: CssRule[]): Set<string> {
  const out = new Set<string>();
  for (const r of rules)
    for (const d of r.decls) {
      if (!/^background(-color)?$/.test(d.prop)) continue;
      const L = backgroundLuminance(css.slice(d.valueStart, d.valueEnd));
      if (L === null || L >= 0.2) continue;
      for (const part of r.selector.split(","))
        for (const cls of classesOf(lastCompound(part.replace(/:[\w-]+(\([^)]*\))?/g, ""))))
          out.add(cls);
    }
  return out;
}
/** Kuralın zemin bağlamı: true koyu, false açık, null karışık. */
function contextOf(css: string, rule: CssRule, dark: Set<string>): boolean | null {
  const own = rule.decls.find((d) => /^background(-color)?$/.test(d.prop));
  if (own) {
    const L = backgroundLuminance(css.slice(own.valueStart, own.valueEnd));
    if (L !== null) return L < 0.2;
  }
  const parts = rule.selector.split(",").map((p) => classesOf(p).some((c) => dark.has(c)));
  if (parts.every(Boolean)) return true;
  if (parts.every((p) => !p)) return false;
  return null;
}

// ---------------------------------------------------------------------------------------------
// Dönüşüm

type Edit = { start: number; end: number; text: string };
function applyEdits(src: string, edits: Edit[]): string {
  let out = src;
  for (const e of [...edits].sort((a, b) => b.start - a.start))
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}
function idFor(file: string, line: number, before: string, n: number) {
  return `${file}:${line}:${before.replace(/\s+/g, "")}${n ? `#${n}` : ""}`;
}

export function transformCss(
  src: string,
  file: string,
  approved: Set<string>,
  report: Report,
): string {
  // styles/vendor-overrides.css tek layer'sız muaf dosyadır (design §2.6, G22).
  if (!file.endsWith("styles/vendor-overrides.css") && !src.startsWith(LAYER_ORDER))
    throw new Error(
      `${file}: ilk satır layer sıra ifadesi değil (önce scripts/design-system/layer-css.ts ile sarın)`,
    );
  const rules = parseCss(src, file);
  const dark = darkClasses(src, rules);
  const edits: Edit[] = [];
  // 7. Tamamı [data-theme="dark"] olan bloklar silinir.
  const DARK_THEME = /\[data-theme=["']?dark["']?\]/;
  const removed = new Set<number>();
  for (const r of rules)
    if (r.selector.split(",").every((p) => DARK_THEME.test(p))) {
      let end = r.end;
      if (src[end] === "\n") end++;
      let start = r.start;
      while (start > 0 && src[start - 1] !== "\n" && /\s/.test(src[start - 1])) start--;
      edits.push({ start, end, text: "" });
      removed.add(r.index);
      report.darkBlocksRemoved.push({ file, line: r.line, selector: r.selector });
    }
  const fr: FileReport = { file, applied: 0, manual: 0, skipped: 0 };
  const inverseMarked = new Set<number>();
  for (const r of rules) {
    if (removed.has(r.index)) continue;
    const ctx = contextOf(src, r, dark);
    // Koyu kap içinde kendi açık zemini olan kural: kapsamdan bağımsız token.
    const nested =
      ctx === false && r.selector.split(",").some((p) => classesOf(p).some((c) => dark.has(c)));
    for (const d of r.decls) {
      const value = src.slice(d.valueStart, d.valueEnd);
      const masked = maskStrings(value);
      const seen = new Map<string, number>();
      for (const m of masked.matchAll(COLOR_LITERAL)) {
        const literal = value.slice(m.index!, m.index! + m[0].length);
        const n = seen.get(literal) ?? 0;
        seen.set(literal, n + 1);
        const res = decide(literal, d.prop, ctx, nested);
        const base = { file, line: d.line, property: d.prop, value: literal };
        if (res.action === "note") {
          report.notes.push({ ...base, reason: res.reason });
          fr.skipped++;
          continue;
        }
        if (res.action === "ambiguous") {
          report.ambiguous.push({ ...base, reason: res.reason });
          fr.skipped++;
          continue;
        }
        if (res.action !== "replace") {
          report.unmapped.push({ ...base, reason: res.reason });
          fr.skipped++;
          continue;
        }
        const role = roleOf(d.prop);
        const change: Change = {
          id: idFor(file, d.line, literal, n),
          file,
          line: d.line,
          selector: r.selector,
          property: d.prop,
          before: literal,
          after: res.after,
          kind: res.kind,
          dE: res.dE,
          preserved: res.preserved,
          background: ctx === true ? "dark" : ctx === false ? "light" : "unknown",
          contrast: role === "text" ? contrastOn(res.targetHex, ctx === true) : undefined,
        };
        const needsManual = role === "text" && !res.preserved;
        if (needsManual && !approved.has(change.id)) {
          report.manualContrast.push(change);
          fr.manual++;
          continue;
        }
        edits.push({
          start: d.valueStart + m.index!,
          end: d.valueStart + m.index! + m[0].length,
          text: res.after,
        });
        report.applied.push(change);
        fr.applied++;
        if (role === "text" && ctx === true && !inverseMarked.has(r.index)) {
          inverseMarked.add(r.index);
          report.inverseContainers.push({ file, line: r.line, selector: r.selector });
        }
      }
    }
  }
  report.files.push(fr);
  return applyEdits(src, edits);
}

/** TSX modu: yalnızca JSX style={{…}} nesnelerindeki renk string'leri çevrilir. */
export function transformTsx(
  src: string,
  file: string,
  approved: Set<string>,
  report: Report,
): string {
  const edits: Edit[] = [];
  const fr: FileReport = { file, applied: 0, manual: 0, skipped: 0 };
  const lineAt = lineIndex(src);
  const STRING = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
  for (const m of src.matchAll(STRING)) {
    const quote = m[1];
    const body = m[2];
    if (quote === "`" && body.includes("${")) continue;
    const bodyStart = m.index! + 1;
    const literals = [...body.matchAll(COLOR_LITERAL)];
    if (!literals.length) continue;
    const before = src.slice(Math.max(0, m.index! - 200), m.index!);
    const line = lineAt(m.index!);
    const attr = before.match(/(?:^|[\s{(,])(fill|stroke|color|stopColor|stop-color)=$/);
    const key = before.match(/([A-Za-z]+)\s*:\s*$/)?.[1];
    for (const lit of literals) {
      const literal = lit[0];
      const base = { file, line, property: attr?.[1] ?? key ?? "?", value: literal };
      if (attr) {
        report.notes.push({
          ...base,
          reason: "SVG özniteliği → currentColor (elle; değer kapsayıcıdan gelir)",
        });
        fr.skipped++;
        continue;
      }
      if (!key || !inStyleProp(src, m.index!)) {
        report.notes.push({ ...base, reason: "JS tüketicisi → lib/design-tokens.ts (elle)" });
        fr.skipped++;
        continue;
      }
      const prop = camelToKebab(key);
      const res = decide(literal, prop, false);
      if (res.action !== "replace") {
        (res.action === "unmapped"
          ? report.unmapped
          : res.action === "ambiguous"
            ? report.ambiguous
            : report.notes
        ).push({ ...base, property: prop, reason: res.reason });
        fr.skipped++;
        continue;
      }
      const change: Change = {
        id: idFor(file, line, literal, 0),
        file,
        line,
        selector: "style",
        property: prop,
        before: literal,
        after: res.after,
        kind: res.kind,
        dE: res.dE,
        preserved: res.preserved,
        background: "unknown",
        contrast: roleOf(prop) === "text" ? contrastOn(res.targetHex, false) : undefined,
      };
      if (roleOf(prop) === "text" && !res.preserved && !approved.has(change.id)) {
        report.manualContrast.push(change);
        fr.manual++;
        continue;
      }
      edits.push({
        start: bodyStart + lit.index!,
        end: bodyStart + lit.index! + literal.length,
        text: res.after,
      });
      report.applied.push(change);
      fr.applied++;
    }
  }
  report.files.push(fr);
  return applyEdits(src, edits);
}
/** pos, açık bir `style={{` nesnesinin içinde mi? */
function inStyleProp(src: string, pos: number): boolean {
  const start = src.lastIndexOf("style={{", pos);
  if (start < 0) return false;
  let depth = 0;
  for (let i = start + 6; i < pos; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
    if (depth <= 0) return false;
  }
  return depth >= 2;
}

// ---------------------------------------------------------------------------------------------
// RN modu (design §7.1): apps/mobile kaynağındaki TÜM hex/rgb(a) literal'leri `tokens.*`
// ifadesine çevrilir (StyleSheet, JSX öznitelikleri, JS sabitleri, WebView HTML şablonları).
// Hedef: exact palette → rol token'ı (değer korunur); değilse fold() (ΔE ≤ 6 ya da §2.4b karar
// satırı); hiçbiri yoksa `unmapped` → exit 1. Alfa: hazır alfa token'ı (değer birebir) ya da
// `withAlpha(token, a)` (RN'de color-mix karşılığı). thirdParty/dataPalette katlanmaz, kendi
// gruplarından okunur. Siyah (gölge/örtü tabanı) → tokens.color.black (yalnız mobil).
type NativeColors = Record<string, string>;
const RN_LITERAL =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\brgba?\([^()]*\)/g;
type Segment = {
  start: number;
  end: number;
  kind: "str" | "tpl";
  quoteStart: number;
  quoteEnd: number;
};
/** TS/TSX kaynağını yorum/string/şablon farkındalıklı tarar; metin bölümlerini döner. */
export function scanSegments(src: string): {
  segments: Segment[];
  comments: Array<[number, number]>;
} {
  const segments: Segment[] = [];
  const comments: Array<[number, number]> = [];
  const stack: number[] = []; // şablon içindeki ${ derinlikleri
  let i = 0;
  let depth = 0;
  const readTemplate = (from: number) => {
    // from: ` sonrası ya da } sonrası (şablona dönüş)
    let j = from;
    const begin = from;
    while (j < src.length) {
      const ch = src[j];
      if (ch === "\\") {
        j += 2;
        continue;
      }
      if (ch === "`") {
        segments.push({
          start: begin,
          end: j,
          kind: "tpl",
          quoteStart: begin - 1,
          quoteEnd: j + 1,
        });
        return { next: j + 1, open: false };
      }
      if (ch === "$" && src[j + 1] === "{") {
        segments.push({ start: begin, end: j, kind: "tpl", quoteStart: begin - 1, quoteEnd: j });
        return { next: j + 2, open: true };
      }
      j++;
    }
    throw new Error("kapanmamış şablon literal'i");
  };
  // Regex literal'lerini kaba tespit: önceki anlamlı karakter operatörse '/' regex başlatır.
  const regexAllowed = (pos: number) => {
    let k = pos - 1;
    while (k >= 0 && /\s/.test(src[k])) k--;
    if (k < 0) return true;
    return (
      /[(,=:[!&|?{};+\-*%<>~^]/.test(src[k]) ||
      /\b(return|typeof|case|in|of)$/.test(src.slice(Math.max(0, k - 6), k + 1))
    );
  };
  while (i < src.length) {
    const ch = src[i];
    if (ch === "/" && src[i + 1] === "/") {
      const e = src.indexOf("\n", i);
      const end = e < 0 ? src.length : e;
      comments.push([i, end]);
      i = end;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      const e = src.indexOf("*/", i + 2);
      if (e < 0) throw new Error("kapanmamış yorum");
      comments.push([i, e + 2]);
      i = e + 2;
      continue;
    }
    if (ch === "/" && regexAllowed(i)) {
      // regex literal'i atla
      let j = i + 1;
      let cls = false;
      while (j < src.length && src[j] !== "\n") {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === "[") cls = true;
        else if (src[j] === "]") cls = false;
        else if (src[j] === "/" && !cls) break;
        j++;
      }
      if (src[j] === "/") {
        i = j + 1;
        continue;
      }
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== ch) {
        if (src[j] === "\\") j++;
        else if (src[j] === "\n") break;
        j++;
      }
      segments.push({ start: i + 1, end: j, kind: "str", quoteStart: i, quoteEnd: j + 1 });
      i = j + 1;
      continue;
    }
    if (ch === "`") {
      const r = readTemplate(i + 1);
      i = r.next;
      if (r.open) {
        stack.push(depth);
        depth = 0;
      }
      continue;
    }
    if (ch === "{") {
      depth++;
      i++;
      continue;
    }
    if (ch === "}") {
      if (depth === 0 && stack.length) {
        depth = stack.pop()!;
        const r = readTemplate(i + 1);
        i = r.next;
        if (r.open) {
          stack.push(depth);
          depth = 0;
        }
        continue;
      }
      depth--;
      i++;
      continue;
    }
    i++;
  }
  return { segments, comments };
}
function rnRole(key: string): Exclude<Role, "ambiguous"> {
  const k = key.toLowerCase();
  if (/shadow/.test(k)) return "shadow";
  if (/^(background|bg)|backgroundcolor|fillcolor|^colors$|bgcolors$|^fill$/.test(k))
    return k === "fill" ? "text" : "background";
  if (/border|outline/.test(k)) return "border";
  return "text";
}
/** RN için token ifadesi; bulunamazsa null + sebep. */
export function decideRn(
  literal: string,
  key: string,
  native: NativeColors,
):
  | { expr: string; kind: Change["kind"]; dE?: number; preserved: boolean }
  | { reason: string; unmapped: boolean } {
  const parsed = parseColor(literal);
  if (!parsed) return { reason: "çözümlenemeyen renk", unmapped: true };
  const { hex, alpha } = parsed;
  const withA = (expr: string) =>
    alpha === 1 ? expr : `withAlpha(${expr}, ${Math.round(alpha * 1000) / 1000})`;
  if (!PALETTE_BY_HEX.has(hex) && THIRD_PARTY.has(hex))
    return {
      expr: withA(`tokens.thirdParty[${JSON.stringify(THIRD_PARTY.get(hex))}]`),
      kind: "exact",
      preserved: true,
    };
  if (!PALETTE_BY_HEX.has(hex) && DATA.has(hex)) {
    const n = DATA.get(hex)!;
    const acc = /^[a-z]+$/.test(n) ? `.${n}` : `[${JSON.stringify(n)}]`;
    return { expr: withA(`tokens.dataPalette${acc}`), kind: "exact", preserved: true };
  }
  if (hex === "#000000")
    return {
      expr: withA("tokens.color.black"),
      kind: alpha === 1 ? "exact" : "alpha",
      preserved: true,
    };
  let target = PALETTE_BY_HEX.get(hex);
  let kind: Change["kind"] = alpha === 1 ? "exact" : "alpha";
  let dE: number | undefined;
  if (!target) {
    const f = fold(hex);
    if (!f) return { reason: "ΔE > 6 ve §2.4b karar tablosunda satır yok", unmapped: true };
    kind = f.decided ? "decided" : "fold";
    dE =
      Math.round(
        (f.decided ? f.dE : deltaE(hex, (palette as Record<string, string>)[f.name] ?? hex)) * 10,
      ) / 10;
    if (f.group === "data") {
      const n = f.name.slice("data-".length);
      const acc = /^[a-z]+$/.test(n) ? `.${n}` : `[${JSON.stringify(n)}]`;
      return { expr: withA(`tokens.dataPalette${acc}`), kind, dE, preserved: false };
    }
    if (f.group !== "ui") return { reason: `karar hedefi UI dışı (${f.name})`, unmapped: true };
    target = f.name;
  }
  const targetHex = palette[target as keyof typeof palette].toLowerCase();
  const preserved = targetHex === hex;
  if (targetHex === "#000000") return { expr: withA("tokens.color.black"), kind, dE, preserved };
  const role = rnRole(key);
  if (alpha < 1 && preserved) {
    const rgb = hexToRgb(targetHex);
    const want = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    const ready = Object.entries(native).find(([, v]) => v === want)?.[0];
    if (ready) return { expr: `tokens.color.${ready}`, kind, dE, preserved };
  }
  const web =
    tokenFor(targetHex, role, false) ??
    tokenFor(targetHex, role === "text" ? "background" : "text", false);
  let name = web
    ? web.replace(/^color-/, "").replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
    : null;
  if (!name || native[name]?.toLowerCase() !== targetHex)
    name = Object.entries(native).find(([, v]) => v.toLowerCase() === targetHex)?.[0] ?? null;
  if (!name) return { reason: `${target} (${targetHex}) için mobil token yok`, unmapped: true };
  return { expr: withA(`tokens.color.${name}`), kind, dE, preserved };
}
/** RN modu dönüşümü: string literal'i ifadeye, şablon metnindeki literal'i ${ifade}'ye çevirir. */
export function transformRn(
  src: string,
  file: string,
  native: NativeColors,
  themeImport: string,
  report: Report,
): string {
  const edits: Edit[] = [];
  const fr: FileReport = { file, applied: 0, manual: 0, skipped: 0 };
  const lineAt = lineIndex(src);
  const { segments, comments } = scanSegments(src);
  let usesTokens = false;
  let usesAlpha = false;
  for (const [a, b] of comments)
    for (const m of src.slice(a, b).matchAll(RN_LITERAL))
      report.notes.push({
        file,
        line: lineAt(a + m.index!),
        property: "yorum",
        value: m[0],
        reason: "yorumdaki renk literal'i (elle)",
      });
  for (const seg of segments) {
    const body = src.slice(seg.start, seg.end);
    const lits = [...body.matchAll(RN_LITERAL)];
    if (!lits.length) continue;
    const whole = seg.kind === "str" && lits.length === 1 && lits[0][0] === body;
    for (const lit of lits) {
      const pos = seg.start + lit.index!;
      const line = lineAt(pos);
      let key: string;
      if (whole) {
        const before = src.slice(Math.max(0, seg.quoteStart - 80), seg.quoteStart);
        key =
          before.match(/([A-Za-z]+)\s*[:=]\s*\{?\s*\[?\s*(?:["'][^"']*["']\s*,\s*)*$/)?.[1] ?? "?";
      } else {
        const before = src.slice(Math.max(0, pos - 120), pos);
        key = before.match(/([A-Za-z-]+)\s*:[^;:{}]*$/)?.[1] ?? "?";
        key = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      }
      const d = decideRn(lit[0], key, native);
      if ("reason" in d) {
        (d.unmapped ? report.unmapped : report.ambiguous).push({
          file,
          line,
          property: key,
          value: lit[0],
          reason: d.reason,
        });
        fr.skipped++;
        continue;
      }
      if (seg.kind === "str" && !whole) {
        report.unmapped.push({
          file,
          line,
          property: key,
          value: lit[0],
          reason: "string içinde gömülü renk (şablona çevir, elle)",
        });
        fr.skipped++;
        continue;
      }
      usesTokens = true;
      if (d.expr.startsWith("withAlpha(")) usesAlpha = true;
      if (whole) edits.push({ start: seg.quoteStart, end: seg.quoteEnd, text: d.expr });
      else edits.push({ start: pos, end: pos + lit[0].length, text: `\${${d.expr}}` });
      report.applied.push({
        id: idFor(file, line, lit[0], 0),
        file,
        line,
        selector: seg.kind,
        property: key,
        before: lit[0],
        after: d.expr,
        kind: d.kind,
        dE: d.dE,
        preserved: d.preserved,
        background: "unknown",
      });
      fr.applied++;
    }
  }
  report.files.push(fr);
  // JSX özniteliği: color="#fff" → color={tokens.x}
  let out = applyEdits(src, edits);
  out = out.replace(
    /([A-Za-z]+)=(tokens\.[A-Za-z0-9_.[\]"-]+|withAlpha\([^()]*\))(?=[\s/>])/g,
    "$1={$2}",
  );
  if (usesTokens) out = ensureThemeImport(out, themeImport, usesAlpha);
  return out;
}
function ensureThemeImport(src: string, from: string, alpha: boolean): string {
  const names = alpha ? ["tokens", "withAlpha"] : ["tokens"];
  const re = new RegExp(
    `import \\{([^}]*)\\} from "${from.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}";`,
  );
  const m = src.match(re);
  if (m) {
    const have = m[1]
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const all = [...new Set([...have, ...names])];
    return src.replace(re, `import { ${all.join(", ")} } from "${from}";`);
  }
  // son import bildiriminden sonra
  const importRe = /^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm;
  let last = -1;
  for (const im of src.matchAll(importRe)) last = im.index! + im[0].length;
  const line = `import { ${names.join(", ")} } from "${from}";`;
  if (last < 0) return `${line}\n${src}`;
  return src.slice(0, last) + `\n${line}` + src.slice(last);
}
async function mainRn(argv: string[]): Promise<number> {
  const dryRun = argv.includes("--dry-run");
  const ri = argv.indexOf("--report");
  const reportPath = ri >= 0 ? argv[ri + 1] : undefined;
  const targets = argv
    .filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--mode" && argv[i - 1] !== "--report")
    .map((a) => resolve(a));
  if (!targets.length) throw new Error("Dosya ya da dizin verin");
  const mobile = join(root, "apps/mobile");
  const nativePath = join(mobile, "src/theme/tokens.ts");
  const { tokens } = (await import(nativePath)) as { tokens: { color: NativeColors } };
  const files: string[] = [];
  for (const t of targets) collect(t, "tsx", files);
  const report = emptyReport("rn", dryRun);
  const outputs: Array<[string, string, string]> = [];
  for (const abs of files) {
    const rel = relative(root, abs).split("\\").join("/");
    if (rel.startsWith("apps/mobile/src/theme/")) continue;
    let themeImport = relative(dirname(abs), join(mobile, "src/theme")).split("\\").join("/");
    if (!themeImport.startsWith(".")) themeImport = `./${themeImport}`;
    const src = readFileSync(abs, "utf8");
    outputs.push([abs, src, transformRn(src, rel, tokens.color, themeImport, report)]);
  }
  if (!dryRun) for (const [abs, src, next] of outputs) if (next !== src) writeFileSync(abs, next);
  if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  const t = (k: keyof Report) => (report[k] as unknown[]).length;
  console.log(
    `codemod-colors (rn${dryRun ? ", dry-run" : ""}): ${files.length} dosya · uygulanan ${t("applied")} · belirsiz ${t("ambiguous")} · not ${t("notes")} · eşlenmemiş ${t("unmapped")}`,
  );
  for (const f of report.files)
    if (f.applied || f.skipped)
      console.log(`  ${f.file}: ${f.applied} uygulandı, ${f.skipped} atlandı`);
  for (const u of [...report.unmapped, ...report.ambiguous])
    console.error(`  eşlenmemiş: ${u.file}:${u.line} ${u.property}: ${u.value} — ${u.reason}`);
  return report.unmapped.length || report.ambiguous.length ? 1 : 0;
}
// ---------------------------------------------------------------------------------------------
// CLI

export function emptyReport(mode: "css" | "tsx" | "rn", dryRun: boolean): Report {
  return {
    mode,
    dryRun,
    files: [],
    applied: [],
    manualContrast: [],
    ambiguous: [],
    unmapped: [],
    notes: [],
    inverseContainers: [],
    darkBlocksRemoved: [],
  };
}
function collect(target: string, mode: "css" | "tsx" | undefined, out: string[]) {
  const st = statSync(target);
  if (st.isDirectory()) {
    for (const n of readdirSync(target).sort())
      if (!["node_modules", "out", ".next"].includes(n)) collect(join(target, n), mode, out);
    return;
  }
  const ext = target.endsWith(".css") ? "css" : /\.tsx?$/.test(target) ? "tsx" : null;
  if (!ext || (mode && ext !== mode)) return;
  const appRel = relative(webApp, target).split("\\").join("/");
  if (!appRel.startsWith("..") && EXCLUDED.some((re) => re.test(appRel))) return;
  out.push(target);
}
/** --mode tw: tw sınıfları → üretilmiş yerleşim sınıfları (+ renkler kodmoddan geçer). */
function mainTw(argv: string[]) {
  let out: string | undefined;
  let prefix: string | undefined;
  let dryRun = false;
  let reportPath: string | undefined;
  const files: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mode") i++;
    else if (a === "--css") out = resolve(argv[++i]);
    else if (a === "--prefix") prefix = argv[++i];
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--report") reportPath = argv[++i];
    else if (a.startsWith("--")) throw new Error(`Bilinmeyen seçenek: ${a}`);
    else files.push(resolve(a));
  }
  if (!out || !prefix || !files.length)
    throw new Error("--mode tw: --css <çıktı.css> --prefix <ön-ek> <tsx…> gerekli");
  if (!/^[a-z][a-z0-9-]*$/.test(prefix)) throw new Error(`Geçersiz ön ek: ${prefix}`);
  const table = loadTwTable(root);
  // Rengi manuel-kontrast / belirsiz / gölge notu düşen utility'ler çevrilmez (G1 yeni dosyada artmasın).
  for (const r of table.rules) {
    const probe = emptyReport("css", true);
    transformCss(
      `${LAYER_ORDER}\n@layer legacy {\n  .probe {\n    ${r.body}\n  }\n}\n`,
      "probe.css",
      new Set(),
      probe,
    );
    if (
      probe.manualContrast.length ||
      probe.ambiguous.length ||
      probe.notes.length ||
      probe.unmapped.length
    )
      for (const p of r.parts) table.keep.add(p.util);
  }
  const gen = new Map<string, string>();
  const tw: TwReport = { files: [], classes: {}, notes: [] };
  const writes: Array<[string, string]> = [];
  for (const abs of files) {
    const rel = relative(root, abs).split("\\").join("/");
    const src = readFileSync(abs, "utf8");
    let next = transformTwTsx(src, table, prefix, gen, tw, rel);
    if (next !== src) next = ensureImport(next, abs, out);
    if (next !== src) writes.push([abs, next]);
  }
  const relOut = relative(root, out).split("\\").join("/");
  let css = emitTwCss(
    table,
    prefix,
    gen,
    `Üretildi: scripts/design-system/codemod-colors.ts --mode tw (design §2.7 8b). Elle düzenlemeyin; değerler tw-utils.css'ten birebir.`,
  );
  const colors = emptyReport("css", dryRun);
  css = transformCss(css, relOut, new Set(), colors);
  if (!dryRun) {
    for (const [abs, next] of writes) writeFileSync(abs, next);
    if (gen.size) writeFileSync(out, css);
  }
  if (reportPath)
    writeFileSync(
      reportPath,
      JSON.stringify(
        { tw, colors, generated: Object.fromEntries([...gen].map(([k, v]) => [v, k])) },
        null,
        2,
      ) + "\n",
    );
  console.log(
    `codemod-colors (tw${dryRun ? ", dry-run" : ""}): ${files.length} dosya · ${gen.size} üretilmiş sınıf · ${tw.files.reduce((s, f) => s + f.replaced, 0)} utility çevrildi · ${tw.files.reduce((s, f) => s + f.deleted, 0)} silindi · renk ${colors.applied.length} uygulandı / ${colors.manualContrast.length} manuel`,
  );
  return colors.unmapped.length ? 1 : 0;
}

function main(argv: string[]): number | Promise<number> {
  if (argv[argv.indexOf("--mode") + 1] === "tw" && argv.includes("--mode")) return mainTw(argv);
  if (argv[argv.indexOf("--mode") + 1] === "rn" && argv.includes("--mode")) return mainRn(argv);
  let mode: "css" | "tsx" | undefined;
  let dryRun = false;
  let reportPath: string | undefined;
  const approved = new Set<string>();
  const targets: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mode") mode = argv[++i] as "css" | "tsx";
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--report") reportPath = argv[++i];
    else if (a === "--apply-manual") for (const id of argv[++i].split(",")) approved.add(id.trim());
    else if (a.startsWith("--")) throw new Error(`Bilinmeyen seçenek: ${a}`);
    else targets.push(resolve(a));
  }
  if (!targets.length) throw new Error("Dosya ya da dizin verin");
  const files: string[] = [];
  for (const t of targets) collect(t, mode, files);
  const report = emptyReport(mode ?? "css", dryRun);
  const outputs: Array<[string, string, string]> = [];
  for (const abs of files) {
    const rel = relative(root, abs).split("\\").join("/");
    const src = readFileSync(abs, "utf8");
    const next = abs.endsWith(".css")
      ? transformCss(src, rel, approved, report)
      : transformTsx(src, rel, approved, report);
    outputs.push([abs, src, next]);
  }
  // Ayrıştırma hatası yukarıda throw eder: hiçbir dosya yazılmadan işlem durur.
  if (!dryRun) for (const [abs, src, next] of outputs) if (next !== src) writeFileSync(abs, next);
  if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  const t = (k: keyof Report) => (report[k] as unknown[]).length;
  console.log(
    `codemod-colors (${report.mode}${dryRun ? ", dry-run" : ""}): ${files.length} dosya · uygulanan ${t("applied")} · manuel-kontrast ${t("manualContrast")} · belirsiz ${t("ambiguous")} · not ${t("notes")} · eşlenmemiş ${t("unmapped")} · dark blok ${t("darkBlocksRemoved")}`,
  );
  for (const f of report.files)
    if (f.applied || f.manual || f.skipped)
      console.log(`  ${f.file}: ${f.applied} uygulandı, ${f.manual} manuel, ${f.skipped} atlandı`);
  for (const u of report.unmapped)
    console.error(`  eşlenmemiş: ${u.file}:${u.line} ${u.property}: ${u.value} — ${u.reason}`);
  return report.unmapped.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve()
    .then(() => main(process.argv.slice(2)))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(`codemod-colors: ${(err as Error).message}`);
      process.exitCode = 2;
    });
}
