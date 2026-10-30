// Kodmod `--mode tw` (design §2.7 madde 8b): Tailwind-benzeri sınıfları JSX'ten kaldırır.
//   - tw-utils.css'te TANIMSIZ arbitrary sınıflar (bg-[#0b101c] …) bugün stil üretmez → silinir.
//   - TANIMLI utility sınıfları, aynı deklarasyonları birebir taşıyan üretilmiş yerleşim sınıfına
//     (<prefix>-<n>) çevrilir. Aynı utility kümesi aynı sınıfı alır.
//   - `group` işaretçisi <prefix>-group olur (group-hover kuralları ona bağlanır).
//   - focus:outline-none üretilmez (G11; odak halkası base.css'ten gelir) → rapora not.
// Üretilen kurallar tw-utils.css'teki kaynak sırasıyla, `@layer legacy` içinde yazılır: utility'ler
// bugün legacy katmanında olduğu için sayfa CSS'iyle (pages) ve styles.css ile kaskad birebir aynı
// kalır. Hedef CSS dosyası tüketici TSX'lere import olarak eklenir.
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative } from "node:path";

export type TwRule = {
  index: number;
  media: string | null;
  parts: Array<{ pre: string; util: string; post: string }>;
  body: string;
};
export type TwTable = {
  rules: TwRule[];
  defined: Set<string>;
  keyframes: Map<string, string>;
  /** Rengi token'a güvenle çevrilemeyen utility'ler: JSX'te tw sınıfı olarak kalır (C18). */
  keep: Set<string>;
};
export type TwReport = {
  files: Array<{ file: string; replaced: number; deleted: number; generated: number }>;
  classes: Record<string, string>; // sınıf → "tanımsız → silindi" | "tanımlı → .x"
  notes: string[];
};

const ARBITRARY = /^[a-z-]*[a-z]+(?:-[a-z]+)*-\[[^\]]+\]$|^[a-z]+:[a-z-]+-\[[^\]]+\]$/;
const unescape = (s: string) => s.replace(/\\(.)/g, "$1");
const DROP = new Set(["focus:outline-none"]);

function stripComments(s: string) {
  return s.replace(/\/\*[\s\S]*?\*\//g, "");
}
/** {…} bloğunun kapanışını bulur. */
function blockEnd(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return i;
  }
  throw new Error("tw-utils.css: dengesiz blok");
}

export function parseTwUtils(css: string): TwTable {
  const src = stripComments(css);
  const layerStart = src.indexOf("@layer legacy {");
  if (layerStart < 0) throw new Error("tw-utils.css: @layer legacy bloğu yok");
  const open = src.indexOf("{", layerStart);
  const inner = src.slice(open + 1, blockEnd(src, open));
  const rules: TwRule[] = [];
  const defined = new Set<string>();
  const keyframes = new Map<string, string>();
  const walk = (text: string, media: string | null) => {
    let i = 0;
    while (i < text.length) {
      const brace = text.indexOf("{", i);
      if (brace < 0) break;
      const prelude = text.slice(i, brace).trim();
      const end = blockEnd(text, brace);
      const body = text.slice(brace + 1, end);
      if (prelude.startsWith("@media")) walk(body, prelude);
      else if (prelude.startsWith("@keyframes")) {
        keyframes.set(prelude.split(/\s+/)[1], `${prelude} {${body}}`);
      } else {
        const parts = prelude.split(",").map((p) => {
          const toks = [...p.matchAll(/\.((?:\\.|[\w-])+)/g)];
          const last = toks[toks.length - 1];
          if (!last) throw new Error(`tw-utils.css: sınıfsız seçici "${p.trim()}"`);
          const util = unescape(last[1]);
          defined.add(util);
          return {
            pre: p.slice(0, last.index).trim() ? p.slice(0, last.index).replace(/^\s+/, "") : "",
            util,
            post: p.slice(last.index! + last[0].length).replace(/\s+$/, ""),
          };
        });
        rules.push({ index: rules.length, media, parts, body: body.trim() });
      }
      i = end + 1;
    }
  };
  walk(inner, null);
  return { rules, defined, keyframes, keep: new Set() };
}

/** Bir className string parçasını dönüştürür. */
function convertTokens(
  text: string,
  table: TwTable,
  prefix: string,
  gen: Map<string, string>,
  report: TwReport,
  stats: { replaced: number; deleted: number },
): string {
  const lead = text.match(/^\s*/)![0];
  const trail = text.match(/\s*$/)![0];
  const toks = text.trim().split(/\s+/).filter(Boolean);
  if (!toks.length) return text;
  const utils: string[] = [];
  const out: Array<string | null> = [];
  let genSlot = -1;
  for (const t of toks) {
    if (t === "group") {
      out.push(`${prefix}-group`);
      report.classes[t] = `işaretçi → .${prefix}-group`;
    } else if (table.keep.has(t)) {
      out.push(t);
      report.classes[t] = "tanımlı → korundu (renk token'a güvenle çevrilemedi; C18)";
    } else if (table.defined.has(t)) {
      if (DROP.has(t)) {
        stats.deleted++;
        report.classes[t] = "tanımlı → üretilmedi (G11: odak halkası base.css'ten)";
        continue;
      }
      utils.push(t);
      if (genSlot < 0) {
        genSlot = out.length;
        out.push(null);
      }
    } else if (ARBITRARY.test(t)) {
      stats.deleted++;
      report.classes[t] = "tanımsız → silindi";
    } else out.push(t);
  }
  if (utils.length) {
    const key = [...new Set(utils)].sort().join(" ");
    let name = gen.get(key);
    if (!name) {
      name = `${prefix}-${gen.size + 1}`;
      gen.set(key, name);
    }
    out[genSlot] = name;
    stats.replaced += utils.length;
    for (const u of utils) report.classes[u] ??= `tanımlı → .${prefix}-*`;
  }
  const joined = out.filter((x): x is string => x !== null).join(" ");
  if (joined) return lead + joined + trail;
  return lead || trail ? " " : "";
}

/** className={…} / className="…" değerlerindeki string parçalarını dönüştürür. */
export function transformTwTsx(
  src: string,
  table: TwTable,
  prefix: string,
  gen: Map<string, string>,
  report: TwReport,
  file: string,
): string {
  const stats = { replaced: 0, deleted: 0 };
  const conv = (t: string) => convertTokens(t, table, prefix, gen, report, stats);
  let out = "";
  let i = 0;
  const re = /className=/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length;
    out += src.slice(i, start);
    if (src[start] === '"') {
      const end = src.indexOf('"', start + 1);
      out += '"' + conv(src.slice(start + 1, end)) + '"';
      i = end + 1;
    } else if (src[start] === "{") {
      let depth = 0;
      let end = start;
      for (; end < src.length; end++) {
        if (src[end] === "{") depth++;
        else if (src[end] === "}" && --depth === 0) break;
      }
      const expr = src.slice(start, end + 1);
      out += expr.replace(
        /"((?:\\.|[^"\\\n])*)"|'((?:\\.|[^'\\\n])*)'|`([^`]*)`/g,
        (lit, d, s, b) => {
          if (d !== undefined) return `"${conv(d)}"`;
          if (s !== undefined) return `'${conv(s)}'`;
          // şablon: yalnızca ${…} dışındaki statik parçalar
          return (
            "`" +
            b
              .split(/(\$\{[^}]*\})/)
              .map((p: string) => (p.startsWith("${") ? p : conv(p)))
              .join("") +
            "`"
          );
        },
      );
      i = end + 1;
    } else i = start;
    re.lastIndex = i;
  }
  out += src.slice(i);
  report.files.push({ file, replaced: stats.replaced, deleted: stats.deleted, generated: 0 });
  return out;
}

const LAYER_ORDER = "@layer tokens, base, legacy, chrome, pages, primitives;";

/** Üretilmiş sınıfların CSS'i (tw-utils.css kaynak sırası; legacy katmanı). */
export function emitTwCss(
  table: TwTable,
  prefix: string,
  gen: Map<string, string>,
  header: string,
): string {
  const byUtil = new Map<string, string[]>();
  for (const [key, name] of gen)
    for (const u of key.split(" ")) (byUtil.get(u) ?? byUtil.set(u, []).get(u)!).push(name);
  const lines: string[] = [LAYER_ORDER, "@layer legacy {", `  /* ${header} */`];
  const usedAnimations = new Set<string>();
  let media: string | null = null;
  for (const r of table.rules) {
    const sels: string[] = [];
    for (const p of r.parts) {
      for (const name of byUtil.get(p.util) ?? []) {
        const pre = p.pre.replace(/\.group(?![\w-])/g, `.${prefix}-group`);
        sels.push(`${pre}.${name}${p.post}`);
      }
    }
    if (!sels.length) continue;
    for (const k of table.keyframes.keys())
      if (new RegExp(`\\b${k}\\b`).test(r.body)) usedAnimations.add(k);
    if (r.media !== media) {
      if (media) lines.push("  }");
      if (r.media) lines.push(`  ${r.media} {`);
      media = r.media;
    }
    const ind = media ? "    " : "  ";
    const decls = r.body
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => `${ind}  ${d};`);
    lines.push(`${ind}${sels.join(`,\n${ind}`)} {`, ...decls, `${ind}}`);
  }
  if (media) lines.push("  }");
  for (const k of usedAnimations) {
    const kf = table.keyframes.get(k)!.replace(/\s+/g, " ");
    lines.push(`  ${kf.replace(/\{ /g, "{\n    ").replace(/; \}/g, ";\n  }")}`);
  }
  lines.push("}");
  return lines.join("\n") + "\n";
}

/** TSX'e CSS importu ekler (yoksa). */
export function ensureImport(src: string, tsxPath: string, cssPath: string): string {
  let spec = relative(dirname(tsxPath), cssPath).split("\\").join("/");
  if (!spec.startsWith(".")) spec = `./${spec}`;
  if (src.includes(`import "${spec}";`)) return src;
  const lines = src.split("\n");
  let last = -1;
  for (let k = 0; k < lines.length; k++)
    if (/^import\s/.test(lines[k]) || /^\} from /.test(lines[k])) last = k;
  lines.splice(last + 1, 0, `import "${spec}";`);
  return lines.join("\n");
}

export function loadTwTable(root: string): TwTable {
  const p = `${root}/apps/web/app/tw-utils.css`;
  if (!existsSync(p)) throw new Error("tw-utils.css yok: --mode tw yalnızca C18 öncesi çalışır");
  return parseTwUtils(readFileSync(p, "utf8"));
}
