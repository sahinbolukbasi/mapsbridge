// Tasarım sistemi guard'ı G1–G23 (design §10 tablosu, AC-36; mesaj → steering eşlemesi §11).
// Ratchet: apps/web/tests/design-system-baseline.json `{ rule: { file: count } }`. Test şu durumlarda
// kırmızıdır: sayı baseline'ı aşarsa, baseline'da olmayan dosyada ihlal varsa, baseline gerçekten
// büyükse ("baseline'ı düşürün"). Baseline yalnızca aşağı yönde yeniden yazılır:
//   node apps/web/tests/design-system-guard.test.cjs --write-baseline        (artışı reddeder)
//   node apps/web/tests/design-system-guard.test.cjs --write-baseline --init (yalnızca dosya yokken)
//   node apps/web/tests/design-system-guard.test.cjs --write-baseline --seed G24,G25 (baseline'da
//     anahtarı olmayan yeni kuralı bir kez ekler; G24–G29 ui-ux-redesign FEAT-002'de seed edildi)
// Her kural baseline'da anahtar olarak durur (temizlenen kural `{}`); böylece sıfıra inmiş kural
// --seed ile yeniden açılamaz.
// Baseline dosyası yoksa (C19 sonrası) tüm kurallar 0 bekler. G13 baseline yerine
// packages/design-tokens/src/breakpoints.ts `legacyBreakpoints` listesini kullanır (D18).
// CSS'te yorumlar atılır ve renk kuralları yalnızca declaration değerlerine bakar; TS/TSX
// TypeScript AST'iyle taranır (string/template literal içerikleri, JSX öğeleri, import'lar).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { loadTs } = require("./helpers/load-ts.cjs");

const ROOT = path.resolve(__dirname, "../../..");
const WEB = path.join(ROOT, "apps/web");
const APP = path.join(WEB, "app");
const BASELINE_PATH = path.join(__dirname, "design-system-baseline.json");
const STEERING_PATH = path.join(ROOT, ".kiro/steering/design-system.md");
const REGISTRY_PATH = path.join(APP, "lib/route-registry.ts");
let registryCache = null;
const registry = () => (registryCache ??= loadTs(REGISTRY_PATH));
// Kimlik kapıları da kendi PageShell'ini çizer (design §4.3, §4.5).
const SHELL_RENDERING_GATES = [
  "components/auth-guard.tsx",
  "components/auth-gate.tsx",
];
const PKG_SRC = path.join(ROOT, "packages/design-tokens/src");
const ORDER = "@layer tokens, base, legacy, chrome, pages, primitives;";

// §11 "Guard mesajı → bölüm eşlemesi (sabit)".
const STEERING_SECTION = {
  G1: "Renk",
  G2: "Kaskad",
  G3: "Kaskad",
  G4: "Sayfa şablonu",
  G5: "Chrome",
  G6: "Primitive'ler",
  G7: "Renk",
  G8: "Primitive'ler",
  G9: "URL ve SEO",
  G10: "Sayfa şablonu",
  G11: "Erişilebilirlik",
  G12: "Erişilebilirlik",
  G13: "Boşluk ve tipografi",
  G14: "Renk",
  G15: "Kaskad",
  G16: "Kaskad",
  G17: "Renk",
  G18: "Renk",
  G19: "Chrome",
  G20: "Kaskad",
  G21: "URL ve SEO",
  G22: "Kaskad",
  G23: "Renk",
  G24: "Boşluk ve tipografi",
  G25: "Boşluk ve tipografi",
  G26: "Boşluk ve tipografi",
  G27: "Kaskad",
  G28: "Primitive'ler",
  G29: "Erişilebilirlik",
};
const ref = (rule) =>
  `(bkz. .kiro/steering/design-system.md §${STEERING_SECTION[rule.replace(/[a-z]$/, "")]})`;

// Kural başına düzeltme yolu (Türkçe).
const HINT = {
  G1: "token kullanın",
  G2: ":root yalnızca styles/tokens.css'te tanımlanır",
  G3: "koyu tema yok; [data-theme] / dataset.theme kullanmayın",
  G4: "her kanonik sayfa (ya da tek *-client.tsx kökü) PageShell render eder; LEGACY sayfası yalnızca LegacyRedirect; her page.tsx registry'de",
  G4m: "<main> yalnızca PageShell'de (components/ui/page-shell.tsx); sayfa PageShell render eder",
  G5: "header/footer yalnızca SiteChrome'dan (components/ui/site-chrome.tsx) render edilir",
  G6: "Tailwind-benzeri sınıf yerine yerleşim sınıfı ya da primitive kullanın",
  G7: "TS/TSX'te renk literal'i yerine token (CSS değişkeni / lib/design-tokens.ts) kullanın",
  G9: "eş-anlamlı (LEGACY) URL yerine kanonik URL'e bağlantı verin (lib/route-registry.ts LEGACY_REDIRECTS)",
  G8: ".ui-* seçicisi yalnızca components/ui/ui.css'te yazılır",
  G10: "<h1> yalnızca PageHeader'da (components/ui/page-header.tsx)",
  G11: "outline: none yazmayın; odak halkası base.css'teki :focus-visible kuralından gelir",
  G12: '<img> alt taşımalı (dekoratifse alt="")',
  G13: "yalnızca 640/768/1024/1280 (ve .98 eşlenikleri) kullanın",
  G14: "eski adı semantik token'la değiştirip legacy-aliases.ts satırını silin",
  G15: "!important kaldırın (layer'lı !important primitive'leri ezer)",
  G16: "ilk satır sıra ifadesi olmalı ve tüm kurallar layer bloğunda olmalı",
  G16c: "öğe seçicisini sınıfa bağlayın (.x__action) ya da base.css'e taşıyın",
  G16d: "img/h1-h6/p tip seçicisi artırılamaz; sınıfa bağlayın",
  G17: "üçüncü taraf renkleri yalnızca GoogleLogo ve ui.css'te kullanılır",
  G18: 'koyu zeminli kap JSX\'te data-surface="inverse" taşımalı',
  G19: "chrome sınıflarını sayfa CSS'inde override etmeyin (varyant registry'den gelir)",
  G20: "<style> yerine sayfa CSS dosyası kullanın",
  G21: "useSearchParams yalnızca *-listener.tsx içinde, tüketicide <Suspense fallback={null}> ile",
  G22: "Leaflet'e ait seçiciler yalnızca styles/vendor-overrides.css'te yazılır",
  G23: "veri/gün/kategori renkleri yalnızca harita ve rota dosyalarında kullanılır",
  G24: "süre ve easing yalnızca var(--duration-*) / var(--easing-*) ile yazılır",
  G25: "font-family yalnızca var(--font-family-*) ile yazılır",
  G26: "font-size / border-radius / box-shadow / z-index için ölçek token'ı (var(--font-size-*), --radius-*, --shadow-*/--elevation-*, --z-*) kullanın",
  G27: "@view-transition, ::view-transition-*, scroll-behavior ve scroll-padding yalnızca styles/motion.css'te",
  G28: "emoji yerine Icon primitive'ini kullanın (components/ui/svg-icon.tsx)",
  G29: "animation / animation-name yalnızca @media (prefers-reduced-motion: no-preference) içinde",
};

// ---------------------------------------------------------------------------------------------
// Dosya kümeleri

function walk(dir, match, out = []) {
  for (const name of fs.readdirSync(dir).sort()) {
    if (name === "node_modules") continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, match, out);
    else if (match(name)) out.push(p);
  }
  return out;
}
const rel = (abs) => path.relative(WEB, abs).split(path.sep).join("/"); // "app/..."
const appRel = (abs) => path.relative(APP, abs).split(path.sep).join("/");

const CSS_FILES = walk(APP, (n) => n.endsWith(".css"));
const TSX_FILES = walk(APP, (n) => n.endsWith(".tsx"));
const TS_FILES = walk(APP, (n) => /\.tsx?$/.test(n) && !n.endsWith(".d.ts"));

// design §2.6 dosya → layer eşlemesi.
const LEGACY = [
  "operations.css",
  "styles.css",
  "auth.css",
  // tw-utils.css'ten üretilmiş yerleşim sınıfları (codemod --mode tw, design §2.7 8b): legacy
  // katmanında kalır, böylece utility'lerin sayfa CSS'ine karşı kaskadı birebir korunur.
  // tw-utils.css C18'de silindi.
  "features/community/community-layout.css",
  "profile/profile-layout.css",
  "profile/edit/edit-layout.css",
  "reset-password/reset-password-layout.css",
  "components/soft-icon-layout.css",
];
const CHROME = ["components/header-nav.css", "components/site-footer.css"];
function layerOf(abs) {
  const r = appRel(abs);
  if (r === "styles/tokens.css") return "tokens";
  if (r === "styles/base.css" || r === "styles/motion.css") return "base";
  if (r === "components/ui/ui.css") return "primitives";
  if (r === "styles/vendor-overrides.css") return null;
  if (LEGACY.includes(r)) return "legacy";
  if (CHROME.includes(r)) return "chrome";
  return "pages";
}

// G7 kapsamı dışı: lambda bundle'ına giren web dosyaları (NFR-6) ve üretilmiş TS.
const LAMBDA_BUNDLED = [/^lib\/ai\//, /^lib\/trip\/routing-service\.ts$/, /^lib\/destination\//];
LAMBDA_BUNDLED.push(/^lib\/visa\//, /^lib\/affiliate\//, /^lib\/tracker\//);
const GENERATED_TS = "lib/design-tokens.ts";

// G23: veri renklerinin serbest olduğu dosyalar (desk/ C7'de maps/'e taşındı).
const DATA_COLOR_ALLOWED = [
  /^components\/trip\//,
  /^features\/trip-planner\//,
  /^lib\/trip\//,
  /^maps\//,
  /^k\//,
  /^\[username\]\//,
  /^components\/travel-globe\.tsx$/,
];

// G6: tw-utils.css'ten DONDURULMUŞ 145 sınıf (dosya silindikten sonra da geçerli).
const TW_CLASSES = new Set(
  (
    "absolute animate-fade-in bg-black/60 bg-emerald-100 bg-emerald-50 bg-emerald-50/70 bg-emerald-600 " +
    "bg-slate-50 bg-slate-50/70 bg-slate-900/70 bg-transparent bg-white border border-emerald-200 " +
    "border-slate-100 border-slate-200 border-t bottom-0 cursor-pointer disabled:cursor-not-allowed " +
    "disabled:opacity-50 duration-300 fixed flex flex-1 flex-col flex-shrink-0 flex-wrap " +
    "focus:border-emerald-500 focus:outline-none font-bold font-medium font-semibold gap-1 gap-1.5 gap-2 " +
    "gap-2.5 gap-3 grid grid-cols-2 group group-hover:ring-2 group-hover:ring-emerald-500 " +
    "group-hover:scale-105 h-11 h-6 h-7 h-9 h-full hidden hover:bg-emerald-100 hover:bg-emerald-700 " +
    "hover:bg-red-50 hover:bg-slate-100 hover:bg-slate-50 hover:bg-slate-900 hover:scale-[1.01] " +
    "hover:text-emerald-700 hover:text-slate-700 hover:text-slate-800 inline-flex inset-0 inset-x-0 " +
    "items-center items-start justify-between justify-center leading-relaxed max-h-48 max-h-96 mb-3 " +
    "min-w-0 ml-1 mt-0.5 mt-1 mt-3 object-cover overflow-hidden p-1.5 p-2 p-2.5 p-3 pt-1 pt-2 pt-3 " +
    "px-1.5 px-2 px-3 px-3.5 px-5 py-0.5 py-1 py-1.5 py-2 relative right-0 right-2 rounded-full " +
    "rounded-lg rounded-md rounded-xl shadow-sm shadow-xl sm:flex-row sm:gap-2 sm:grid-cols-4 sm:inline " +
    "sm:items-center sm:p-4 sm:px-2.5 space-y-2 space-y-3 space-y-4 text-[10px] text-[11px] " +
    "text-emerald-600 text-emerald-700 text-emerald-800 text-left text-red-600 text-slate-300 " +
    "text-slate-400 text-slate-500 text-slate-600 text-slate-700 text-slate-800 text-slate-900 text-sm " +
    "text-white text-xs top-2 top-full transition-all transition-colors transition-transform truncate " +
    "w-11 w-48 w-6 w-7 w-9 w-full whitespace-pre-line z-30 z-40"
  ).split(" "),
);
const TW_ARBITRARY = /\b[a-z]+(?:-[a-z]+)*-\[[^\]]+\]/;

// CSS adlı renkler (CSS Color 4) ve sistem renkleri.
const NAMED_COLORS = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet " +
    "brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue " +
    "darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange " +
    "darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise " +
    "darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia " +
    "gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo " +
    "ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue " +
    "lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon " +
    "mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue " +
    "mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin " +
    "navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen " +
    "paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red " +
    "rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue " +
    "slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white " +
    "whitesmoke yellow yellowgreen"
  ).split(" "),
);
const SYSTEM_COLORS = new Set(
  "canvas canvastext highlight highlighttext graytext buttontext buttonface buttonborder linktext field fieldtext mark marktext".split(
    " ",
  ),
);
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;

// ---------------------------------------------------------------------------------------------
// CSS ayrıştırıcı: yorumlar satır korunarak boşlanır; kurallar, at-rule'lar ve declaration'lar.

function blankComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function parseCss(raw) {
  const src = blankComments(raw);
  const nl = [];
  for (let k = 0; k < src.length; k++) if (src[k] === "\n") nl.push(k);
  const lineOf = (idx) => {
    let lo = 0;
    let hi = nl.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (nl[mid] < idx) lo = mid + 1;
      else hi = mid;
    }
    return lo + 1;
  };
  let i = 0;
  const skipString = () => {
    const q = src[i];
    for (i++; i < src.length && src[i] !== q; i++) if (src[i] === "\\") i++;
    i++;
  };
  const startOf = (from) => {
    let s = from;
    while (s < src.length && /\s/.test(src[s])) s++;
    return s;
  };
  function block(ancestors) {
    const nodes = [];
    const decls = [];
    let start = i;
    const flush = (end) => {
      const text = src.slice(start, end).trim();
      if (!text) return;
      const line = lineOf(startOf(start));
      if (text.startsWith("@")) nodes.push({ type: "stmt", text, line, ancestors });
      else {
        const c = text.indexOf(":");
        if (c > 0)
          decls.push({
            prop: text.slice(0, c).trim().toLowerCase(),
            value: text.slice(c + 1).trim(),
            line,
          });
        else nodes.push({ type: "stray", text, line, ancestors });
      }
    };
    while (i < src.length) {
      const c = src[i];
      if (c === '"' || c === "'") skipString();
      else if (c === "(") {
        let depth = 0;
        while (i < src.length) {
          if (src[i] === '"' || src[i] === "'") {
            skipString();
            continue;
          }
          if (src[i] === "(") depth++;
          else if (src[i] === ")" && --depth === 0) break;
          i++;
        }
        i++;
      } else if (c === "{") {
        const prelude = src.slice(start, i).trim();
        const line = lineOf(startOf(start));
        i++;
        const node = prelude.startsWith("@")
          ? { type: "at", name: (prelude.match(/^@([\w-]+)/) || [])[1], prelude, line, ancestors }
          : { type: "rule", selector: prelude.replace(/\s+/g, " "), line, ancestors };
        const inner = block([...ancestors, node]);
        node.children = inner.nodes;
        node.decls = inner.decls;
        nodes.push(node);
        start = i;
      } else if (c === "}") {
        flush(i);
        i++;
        return { nodes, decls };
      } else if (c === ";") {
        flush(i);
        i++;
        start = i;
      } else i++;
    }
    flush(i);
    return { nodes, decls };
  }
  return { src, top: block([]).nodes };
}

function* allNodes(nodes) {
  for (const n of nodes) {
    yield n;
    if (n.children) yield* allNodes(n.children);
  }
}
const inKeyframes = (n) => n.ancestors.some((a) => a.type === "at" && /keyframes$/.test(a.name));
const inForcedColors = (n) =>
  n.ancestors.some(
    (a) => a.type === "at" && a.name === "media" && /forced-colors\s*:\s*active/.test(a.prelude),
  );

/** Üst düzey virgüllerle seçici listesini böler (parantez içini korur). */
function splitSelectors(sel) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let k = 0; k < sel.length; k++) {
    if (sel[k] === "(" || sel[k] === "[") depth++;
    else if (sel[k] === ")" || sel[k] === "]") depth--;
    else if (sel[k] === "," && depth === 0) {
      out.push(sel.slice(start, k).trim());
      start = k + 1;
    }
  }
  out.push(sel.slice(start).trim());
  return out.filter(Boolean);
}
const withoutAttrs = (sel) => sel.replace(/\[[^\]]*\]/g, "[]");
function typeSelectorCount(sel, tags) {
  const re = new RegExp(`(^|[\\s>+~(,])(${tags})(?=$|[\\s>+~.#:\\[),])`, "g");
  return [...withoutAttrs(sel).matchAll(re)].length;
}

const cssCache = new Map();
function css(abs) {
  if (!cssCache.has(abs)) cssCache.set(abs, parseCss(fs.readFileSync(abs, "utf8")));
  return cssCache.get(abs);
}
function* cssRules(abs) {
  for (const n of allNodes(css(abs).top)) if (n.type === "rule" && !inKeyframes(n)) yield n;
}
function* cssDecls(abs) {
  for (const n of allNodes(css(abs).top))
    if (n.decls) for (const d of n.decls) yield { ...d, node: n };
}

// ---------------------------------------------------------------------------------------------
// TS/TSX ayrıştırıcı

const tsCache = new Map();
function source(abs) {
  if (!tsCache.has(abs)) {
    const kind = abs.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    tsCache.set(
      abs,
      ts.createSourceFile(abs, fs.readFileSync(abs, "utf8"), ts.ScriptTarget.Latest, true, kind),
    );
  }
  return tsCache.get(abs);
}
function* tsNodes(sf) {
  const stack = [sf];
  while (stack.length) {
    const n = stack.pop();
    yield n;
    const kids = [];
    // forEachChild truthy dönüşte durur; push'un dönüşü yutulmalı.
    ts.forEachChild(n, (c) => {
      kids.push(c);
    });
    for (let k = kids.length - 1; k >= 0; k--) stack.push(kids[k]);
  }
}
const lineOfTs = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
const isStringish = (n) =>
  ts.isStringLiteral(n) ||
  ts.isNoSubstitutionTemplateLiteral(n) ||
  n.kind === ts.SyntaxKind.TemplateHead ||
  n.kind === ts.SyntaxKind.TemplateMiddle ||
  n.kind === ts.SyntaxKind.TemplateTail;
function* tsStrings(abs) {
  const sf = source(abs);
  for (const n of tsNodes(sf)) if (isStringish(n)) yield { text: n.text, line: lineOfTs(sf, n) };
}
function* jsxElements(abs) {
  const sf = source(abs);
  for (const n of tsNodes(sf)) {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n))
      yield {
        tag: n.tagName.getText(sf),
        attrs: n.attributes.properties,
        line: lineOfTs(sf, n),
        node: n,
        sf,
      };
  }
}
const attrName = (a) => (ts.isJsxAttribute(a) ? a.name.getText() : null);
function attrStrings(attr) {
  // className="a b" | className={"a"} | className={`a ${x}`} → statik parçalar.
  if (!attr.initializer) return [];
  if (ts.isStringLiteral(attr.initializer)) return [attr.initializer.text];
  const out = [];
  const visit = (n) => {
    if (isStringish(n)) out.push(n.text);
    ts.forEachChild(n, visit);
  };
  visit(attr.initializer);
  return out;
}
function* imports(abs) {
  const sf = source(abs);
  for (const st of sf.statements)
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier))
      yield { spec: st.moduleSpecifier.text, node: st, line: lineOfTs(sf, st) };
}

// ---------------------------------------------------------------------------------------------
// Kurallar: her biri { file: [{ line, text }] } döndürür.

function collector() {
  const v = {};
  return {
    add(file, line, text) {
      (v[file] ??= []).push({ line, text });
    },
    result: v,
  };
}

const palette = loadTs(path.join(PKG_SRC, "palette.ts"));
const THIRD_PARTY_HEX = new Set(Object.values(palette.thirdParty).map((h) => h.toLowerCase()));

function stripValue(value) {
  return value.replace(/url\([^)]*\)/gi, "url()").replace(/"[^"]*"|'[^']*'/g, '""');
}

// G24–G29 yardımcıları. tokens.css (token tanımları) altı kuraldan da muaftır.
const MOTION_PROPS = new Set([
  "transition",
  "transition-duration",
  "transition-delay",
  "transition-timing-function",
  "animation",
  "animation-duration",
  "animation-delay",
  "animation-timing-function",
]);
const SCALE_PROPS = new Set(["font-size", "border-radius", "box-shadow", "z-index"]);
const TIME_LITERAL = /(?<![\w.-])[-+]?(?:\d+\.?\d*|\.\d+)m?s(?![\w-])/;
const EASING_LITERAL =
  /(?<![\w-])(?:cubic-bezier|steps)\(|(?<![\w-])(?:ease(?:-in-out|-in|-out)?|linear|step-start|step-end)(?![\w-])/;
const LENGTH_LITERAL = /(?<![\w.-])(\d+\.?\d*|\.\d+)(?:px|rem|em)(?![\w-])/g;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
/** var(...) çağrılarını (iç içe parantezleriyle) değerden çıkarır: fallback literal'i sayılmaz. */
function withoutVars(value) {
  let out = "";
  for (let k = 0; k < value.length;) {
    if (value.startsWith("var(", k) && !/[\w-]/.test(value[k - 1] ?? "")) {
      let depth = 0;
      let j = k + 3;
      for (; j < value.length; j++) {
        if (value[j] === "(") depth++;
        else if (value[j] === ")" && --depth === 0) break;
      }
      out += " ";
      k = j + 1;
    } else out += value[k++];
  }
  return out;
}
function* motionScopedDecls() {
  for (const abs of CSS_FILES) {
    if (appRel(abs) === "styles/tokens.css") continue;
    for (const d of cssDecls(abs)) yield { abs, d };
  }
}

const RULES = {
  G1() {
    const c = collector();
    for (const abs of CSS_FILES) {
      if (appRel(abs) === "styles/tokens.css") continue;
      for (const d of cssDecls(abs)) {
        const v = stripValue(d.value);
        for (const m of v.matchAll(HEX)) c.add(rel(abs), d.line, m[0]);
        for (const m of v.matchAll(/\b(rgba?|hsla?)\(\s*[-+.\d]/gi)) c.add(rel(abs), d.line, m[0]);
        for (const m of v.matchAll(/(^|[^\w-])([a-zA-Z][\w-]*)/g)) {
          const word = m[2].toLowerCase();
          if (NAMED_COLORS.has(word) || (SYSTEM_COLORS.has(word) && !inForcedColors(d.node)))
            c.add(rel(abs), d.line, m[2]);
        }
      }
    }
    return c.result;
  },
  G2() {
    const c = collector();
    for (const abs of CSS_FILES) {
      let n = 0;
      for (const r of cssRules(abs))
        for (const m of r.selector.matchAll(/:root(?![\w-])/g)) {
          n++;
          if (appRel(abs) !== "styles/tokens.css") c.add(rel(abs), r.line, m.input);
        }
      if (appRel(abs) === "styles/tokens.css" && n !== 1)
        for (let k = 0; k < Math.abs(n - 1); k++)
          c.add(rel(abs), 1, `${n} adet :root (tam 1 olmalı)`);
    }
    return c.result;
  },
  G3() {
    const c = collector();
    for (const abs of CSS_FILES)
      for (const r of cssRules(abs))
        for (const _ of r.selector.matchAll(/\[data-theme/g)) c.add(rel(abs), r.line, r.selector);
    for (const abs of TS_FILES) {
      for (const s of tsStrings(abs))
        if (s.text.includes("[data-theme")) c.add(rel(abs), s.line, s.text);
      const sf = source(abs);
      for (const n of tsNodes(sf))
        if (
          ts.isBinaryExpression(n) &&
          n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          /\.dataset\.theme$/.test(n.left.getText(sf))
        )
          c.add(rel(abs), lineOfTs(sf, n), n.getText(sf).slice(0, 60));
    }
    return c.result;
  },
  // G4 (design §10, §4.3, §5.3): registry'ye bağlı shell kuralları. C7'de etkinleşti.
  G4() {
    const c = collector();
    const { CANONICAL_ROUTES, LEGACY_REDIRECTS } = registry();
    const abs = (r) => path.join(WEB, r);
    const hasJsx = (file, tag) => [...jsxElements(file)].some((el) => el.tag === tag);
    // Relative import + `export ... from` zinciri (yalnızca relative yollar).
    const resolveRel = (from, spec) => {
      if (!spec.startsWith(".")) return null;
      const base = path.resolve(path.dirname(from), spec);
      return [base, `${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx")].find(
        (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
      );
    };
    const relTargets = (file) => {
      const sf = source(file);
      const out = [];
      for (const st of sf.statements) {
        const spec =
          (ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) &&
          st.moduleSpecifier &&
          ts.isStringLiteral(st.moduleSpecifier)
            ? st.moduleSpecifier.text
            : null;
        const target = spec && resolveRel(file, spec);
        if (target) out.push(target);
      }
      return out;
    };
    const canonicalFiles = new Set();
    for (const route of CANONICAL_ROUTES) {
      const page = abs(route.file);
      canonicalFiles.add(page);
      if (!fs.existsSync(page)) {
        c.add(route.file, 0, `${route.path}: dosya yok`);
        continue;
      }
      if (hasJsx(page, "PageShell")) continue;
      const clients = relTargets(page).filter((p) => p.endsWith("-client.tsx"));
      if (clients.length > 1) {
        c.add(
          route.file,
          0,
          `${route.path}: tek istemci kökü olmalı (${clients.length} *-client.tsx)`,
        );
        continue;
      }
      // re-export zincirinin sonundaki *-client.tsx
      let target = clients[0];
      for (let hop = 0; !target && hop < 3; hop++) {
        const next = relTargets(page);
        if (next.length !== 1) break;
        target = next[0].endsWith("-client.tsx") ? next[0] : undefined;
      }
      const owner = target ?? page;
      if (!hasJsx(owner, "PageShell")) c.add(rel(owner), 0, `${route.path}: <PageShell yok`);
    }
    // Kapılar da PageShell çizer; chrome/main çizmez (design §4.3 SHELL_RENDERING_GATES).
    for (const gate of SHELL_RENDERING_GATES) {
      const file = path.join(APP, gate);
      if (!hasJsx(file, "PageShell")) c.add(rel(file), 0, "kapı <PageShell çizmeli");
      for (const tag of ["main", "HeaderNav", "SiteFooter"])
        if (hasJsx(file, tag)) c.add(rel(file), 0, `kapı <${tag} çizmez`);
    }
    // LEGACY sayfaları yalnızca LegacyRedirect; tablo ↔ sayfa tutarlılığı; zincir yok.
    const legacyFiles = new Set();
    for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
      const page = path.join(APP, from.replace(/^\/|\/$/g, ""), "page.tsx");
      legacyFiles.add(page);
      if (LEGACY_REDIRECTS[to]) c.add("app/lib/route-registry.ts", 0, `${from} → ${to} zincir`);
      if (!fs.existsSync(page)) {
        c.add(rel(page), 0, `${from}: LegacyRedirect sayfası yok`);
        continue;
      }
      const tags = new Set([...jsxElements(page)].map((el) => el.tag));
      if ([...tags].some((t) => t !== "LegacyRedirect") || !tags.has("LegacyRedirect"))
        c.add(rel(page), 0, `${from}: yalnızca <LegacyRedirect> içermeli`);
    }
    for (const file of TSX_FILES)
      for (const el of jsxElements(file)) {
        if (el.tag !== "LegacyRedirect") continue;
        const fromAttr = el.attrs.find((a) => attrName(a) === "from");
        const value = fromAttr ? attrStrings(fromAttr)[0] : undefined;
        const expected = `/${path.relative(APP, path.dirname(file)).split(path.sep).join("/")}/`;
        if (!value || !LEGACY_REDIRECTS[value] || value !== expected)
          c.add(rel(file), el.line, `LegacyRedirect from="${value}" tabloda/konumda değil`);
      }
    // Her app/**/page.tsx registry'de (kanonik dosya ya da LEGACY sayfası).
    for (const page of TSX_FILES.filter((f) => path.basename(f) === "page.tsx"))
      if (!canonicalFiles.has(page) && !legacyFiles.has(page))
        c.add(rel(page), 0, "page.tsx route-registry.ts'te kayıtlı değil");
    return c.result;
  },
  // G9 (design §5.4): sabit path'i LEGACY anahtarına TAM eşit bağlantı (önek eşleme yok).
  G9() {
    const c = collector();
    const { LEGACY_REDIRECTS } = registry();
    const legacyPages = new Set(
      Object.keys(LEGACY_REDIRECTS).map((k) =>
        path.join(APP, k.replace(/^\/|\/$/g, ""), "page.tsx"),
      ),
    );
    const pathOf = (text) => {
      const bare = text.split(/[?#]/)[0];
      if (!bare.startsWith("/")) return null;
      return bare.endsWith("/") ? bare : `${bare}/`;
    };
    const literals = (node) => {
      const out = [];
      const visit = (n) => {
        if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
        else if (ts.isTemplateExpression(n)) out.push(n.head.text);
        else ts.forEachChild(n, visit);
      };
      visit(node);
      return out;
    };
    for (const file of TSX_FILES) {
      if (appRel(file) === "lib/route-registry.ts" || legacyPages.has(file)) continue;
      const sf = source(file);
      const check = (node, at) => {
        for (const text of literals(node)) {
          const p = pathOf(text);
          if (p && LEGACY_REDIRECTS[p])
            c.add(rel(file), lineOfTs(sf, at), `${text} → ${LEGACY_REDIRECTS[p]}`);
        }
      };
      for (const n of tsNodes(sf)) {
        if (
          ts.isJsxAttribute(n) &&
          ["href", "action"].includes(n.name.getText(sf)) &&
          n.initializer
        )
          check(n.initializer, n);
        else if (ts.isCallExpression(n) && n.arguments.length) {
          const callee = n.expression.getText(sf);
          if (
            /(^|\.)(push|replace|assign)$/.test(callee) &&
            !/(^|\.)(apiFetch|fetch|adminRequest)$/.test(callee)
          )
            check(n.arguments[0], n);
        } else if (
          ts.isBinaryExpression(n) &&
          n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          /(^|\.)location\.href$/.test(n.left.getText(sf))
        )
          check(n.right, n);
      }
    }
    return c.result;
  },
  // G4'ün registry'den bağımsız alt kuralı (design §10): C6'dan itibaren koşar (ratchet → 0).
  G4m() {
    const c = collector();
    for (const abs of TSX_FILES) {
      if (appRel(abs) === "components/ui/page-shell.tsx") continue;
      for (const el of jsxElements(abs)) if (el.tag === "main") c.add(rel(abs), el.line, "<main");
    }
    return c.result;
  },
  G5() {
    const c = collector();
    for (const abs of TSX_FILES) {
      const r = appRel(abs);
      const base = path.basename(abs, ".tsx");
      if (r !== "components/ui/site-chrome.tsx")
        for (const im of imports(abs)) {
          const m = im.spec.match(/(?:^|\/)(header-nav|site-footer)(\.tsx?|\.css)?$/);
          if (m && m[1] !== base) c.add(rel(abs), im.line, `import "${im.spec}"`);
        }
      for (const el of jsxElements(abs)) {
        if (el.tag === "footer" && r !== "components/site-footer.tsx")
          c.add(rel(abs), el.line, "<footer");
        if (el.tag === "header" && r !== "components/header-nav.tsx")
          c.add(rel(abs), el.line, "<header");
      }
    }
    return c.result;
  },
  G6() {
    const c = collector();
    for (const abs of TSX_FILES)
      for (const el of jsxElements(abs))
        for (const a of el.attrs) {
          if (attrName(a) !== "className") continue;
          for (const s of attrStrings(a))
            for (const cls of s.split(/\s+/).filter(Boolean))
              if (TW_CLASSES.has(cls) || TW_ARBITRARY.test(cls)) c.add(rel(abs), el.line, cls);
        }
    return c.result;
  },
  G7() {
    const c = collector();
    for (const abs of TS_FILES) {
      const r = appRel(abs);
      if (r === GENERATED_TS || LAMBDA_BUNDLED.some((re) => re.test(r))) continue;
      for (const s of tsStrings(abs)) {
        for (const m of s.text.matchAll(HEX)) c.add(rel(abs), s.line, m[0]);
        for (const m of s.text.matchAll(/\brgba?\(/g)) c.add(rel(abs), s.line, m[0]);
      }
    }
    return c.result;
  },
  G8() {
    const c = collector();
    // base.css yalnızca konumlu/global yardımcıları taşır (design §2.6 base satırı, §3 SkipLink).
    const BASE_UI = new Set([
      "ui-visually-hidden",
      "ui-visually-hidden--focusable",
      "ui-skip-link",
    ]);
    for (const abs of CSS_FILES) {
      if (appRel(abs) === "components/ui/ui.css") continue;
      const isBase = appRel(abs) === "styles/base.css";
      for (const r of cssRules(abs))
        for (const m of r.selector.matchAll(/\.(ui-[\w-]+)/g))
          if (!(isBase && BASE_UI.has(m[1]))) c.add(rel(abs), r.line, r.selector);
    }
    return c.result;
  },
  G10() {
    const c = collector();
    for (const abs of TSX_FILES) {
      if (appRel(abs) === "components/ui/page-header.tsx") continue;
      for (const el of jsxElements(abs)) if (el.tag === "h1") c.add(rel(abs), el.line, "<h1");
    }
    return c.result;
  },
  G11() {
    const c = collector();
    for (const abs of CSS_FILES)
      for (const d of cssDecls(abs)) {
        if (d.prop !== "outline" || !/^(none|0)(\s|!|$)/i.test(d.value)) continue;
        const allowed =
          appRel(abs) === "styles/base.css" &&
          d.node.type === "rule" &&
          d.node.selector === ":focus:not(:focus-visible)";
        if (!allowed) c.add(rel(abs), d.line, `outline: ${d.value}`);
      }
    return c.result;
  },
  G12() {
    const c = collector();
    for (const abs of TSX_FILES)
      for (const el of jsxElements(abs)) {
        if (el.tag !== "img") continue;
        const names = el.attrs.map(attrName);
        if (!names.includes("alt") && !el.attrs.some((a) => ts.isJsxSpreadAttribute(a)))
          c.add(rel(abs), el.line, "<img alt yok");
      }
    return c.result;
  },
  G14() {
    const c = collector();
    const { legacyAliases } = loadTs(path.join(PKG_SRC, "legacy-aliases.ts"));
    for (const name of Object.keys(legacyAliases))
      c.add("packages/design-tokens/src/legacy-aliases.ts", 0, `--${name}`);
    return c.result;
  },
  G15() {
    const c = collector();
    for (const abs of CSS_FILES) {
      const r = appRel(abs);
      if (r === "styles/base.css" || r === "styles/vendor-overrides.css") continue;
      for (const d of cssDecls(abs))
        if (/!\s*important/i.test(d.value)) c.add(rel(abs), d.line, `${d.prop}: ${d.value}`);
    }
    return c.result;
  },
  G16() {
    const c = collector();
    for (const abs of CSS_FILES) {
      if (layerOf(abs) === null) continue;
      const { src, top } = css(abs);
      const first = src.split("\n").find((l) => l.trim()) ?? "";
      if (first.trim() !== ORDER) c.add(rel(abs), 1, `ilk satır: ${first.trim().slice(0, 60)}`);
      for (const n of top) {
        if (n.type === "stmt" && n.text + ";" === ORDER) continue;
        if (n.type === "at" && n.name === "layer" && /^@layer\s+[\w.-]+$/.test(n.prelude)) continue;
        c.add(rel(abs), n.line, `layer dışı: ${(n.selector ?? n.prelude ?? n.text).slice(0, 60)}`);
      }
    }
    return c.result;
  },
  G16c() {
    const c = collector();
    for (const abs of CSS_FILES) {
      if (!["pages", "legacy", "chrome"].includes(layerOf(abs))) continue;
      for (const r of cssRules(abs))
        for (const s of splitSelectors(r.selector))
          for (let k = typeSelectorCount(s, "button|input|select|textarea|a|dialog"); k > 0; k--)
            c.add(rel(abs), r.line, s);
    }
    return c.result;
  },
  G16d() {
    const c = collector();
    for (const abs of CSS_FILES) {
      if (!["pages", "legacy", "chrome"].includes(layerOf(abs))) continue;
      for (const r of cssRules(abs))
        for (const s of splitSelectors(r.selector))
          for (let k = typeSelectorCount(s, "img|h[1-6]|p"); k > 0; k--) c.add(rel(abs), r.line, s);
    }
    return c.result;
  },
  G17() {
    const c = collector();
    const ownerFiles = [
      "components/ui/google-logo.tsx",
      "components/ui/ui.css",
      "styles/tokens.css",
      GENERATED_TS,
    ];
    for (const abs of CSS_FILES) {
      const r = appRel(abs);
      for (const d of cssDecls(abs)) {
        if (!ownerFiles.includes(r) && d.value.includes("--color-brand-google-"))
          c.add(rel(abs), d.line, d.value.slice(0, 60));
        if (r !== "styles/tokens.css")
          for (const m of d.value.matchAll(HEX))
            if (THIRD_PARTY_HEX.has(m[0].toLowerCase())) c.add(rel(abs), d.line, m[0]);
      }
    }
    for (const abs of TS_FILES) {
      const r = appRel(abs);
      if (r === GENERATED_TS) continue;
      for (const s of tsStrings(abs)) {
        if (!ownerFiles.includes(r) && s.text.includes("--color-brand-google-"))
          c.add(rel(abs), s.line, s.text.slice(0, 60));
        for (const m of s.text.matchAll(HEX))
          if (THIRD_PARTY_HEX.has(m[0].toLowerCase())) c.add(rel(abs), s.line, m[0]);
      }
    }
    return c.result;
  },
  G18() {
    const c = collector();
    const inverseClasses = new Set();
    for (const abs of TSX_FILES)
      for (const el of jsxElements(abs)) {
        const surface = el.attrs.find((a) => attrName(a) === "data-surface");
        if (!surface || !attrStrings(surface).includes("inverse")) continue;
        const cls = el.attrs.find((a) => attrName(a) === "className");
        if (cls)
          for (const s of attrStrings(cls))
            for (const k of s.split(/\s+/)) if (k) inverseClasses.add(k);
      }
    for (const abs of CSS_FILES) {
      if (layerOf(abs) !== "pages") continue;
      for (const r of cssRules(abs)) {
        const dark = r.decls.some(
          (d) =>
            /^background(-color)?$/.test(d.prop) &&
            /var\(--color-(surface-inverse[\w-]*|primary)\)/.test(d.value),
        );
        if (!dark) continue;
        for (const s of splitSelectors(r.selector)) {
          const last = s.split(/[\s>+~]+/).pop() ?? "";
          const classes = [...last.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
          if (classes.length && !classes.some((k) => inverseClasses.has(k)))
            c.add(rel(abs), r.line, s);
        }
      }
    }
    return c.result;
  },
  G19() {
    const c = collector();
    for (const abs of CSS_FILES) {
      if (!["pages", "legacy"].includes(layerOf(abs))) continue;
      for (const r of cssRules(abs))
        for (const m of r.selector.matchAll(
          /\.(global-site-header|global-site-footer|mobile-primary-nav)[\w-]*/g,
        ))
          c.add(rel(abs), r.line, m[0]);
    }
    return c.result;
  },
  G20() {
    const c = collector();
    for (const abs of TSX_FILES)
      for (const el of jsxElements(abs)) if (el.tag === "style") c.add(rel(abs), el.line, "<style");
    return c.result;
  },
  G21() {
    const c = collector();
    const listeners = TSX_FILES.filter((f) => f.endsWith("-listener.tsx"));
    for (const abs of TSX_FILES) {
      const isListener = abs.endsWith("-listener.tsx");
      for (const im of imports(abs)) {
        const named = im.node.importClause?.namedBindings;
        const usesSearchParams =
          named &&
          ts.isNamedImports(named) &&
          named.elements.some((e) => (e.propertyName ?? e.name).text === "useSearchParams");
        if (usesSearchParams && !isListener) c.add(rel(abs), im.line, "useSearchParams");
        const target = listeners.find((l) => im.spec.endsWith(path.basename(l, ".tsx")));
        if (target) {
          const wrapped = [...jsxElements(abs)].some(
            (el) =>
              el.tag === "Suspense" &&
              el.attrs.some(
                (a) =>
                  attrName(a) === "fallback" &&
                  a.initializer &&
                  /\{\s*null\s*\}/.test(a.initializer.getText(el.sf)),
              ),
          );
          if (!wrapped) c.add(rel(abs), im.line, `${im.spec} <Suspense fallback={null}> olmadan`);
        }
      }
    }
    return c.result;
  },
  G22() {
    const c = collector();
    const set = new Set();
    for (const abs of TS_FILES) {
      const sf = source(abs);
      for (const n of tsNodes(sf)) {
        if (
          !ts.isCallExpression(n) ||
          !/(divIcon|bindPopup|popup|tooltip)$/.test(n.expression.getText(sf))
        )
          continue;
        for (const arg of n.arguments) {
          if (!ts.isObjectLiteralExpression(arg)) continue;
          for (const p of arg.properties) {
            if (!ts.isPropertyAssignment(p) || p.name.getText(sf) !== "className") continue;
            const init = p.initializer;
            const text =
              ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)
                ? init.text
                : ts.isTemplateExpression(init)
                  ? init.head.text
                  : "";
            for (const k of text.split(/\s+/)) if (k) set.add(k);
          }
        }
      }
    }
    const owns = (selector) =>
      /\.leaflet-[\w-]/.test(selector) ||
      [...selector.matchAll(/\.([\w-]+)/g)].some((m) => set.has(m[1]));
    for (const abs of CSS_FILES) {
      const vendor = appRel(abs) === "styles/vendor-overrides.css";
      for (const r of cssRules(abs))
        for (const s of splitSelectors(r.selector)) {
          if (vendor ? !owns(s) : owns(s)) c.add(rel(abs), r.line, s);
        }
    }
    return c.result;
  },
  G23() {
    const c = collector();
    const allowed = (abs) => DATA_COLOR_ALLOWED.some((re) => re.test(appRel(abs)));
    const DATA_VAR = /--color-(data|day|category)-[\w-]+/g;
    for (const abs of CSS_FILES) {
      if (allowed(abs) || appRel(abs) === "styles/tokens.css") continue;
      for (const d of cssDecls(abs))
        for (const m of d.value.matchAll(DATA_VAR)) c.add(rel(abs), d.line, m[0]);
    }
    for (const abs of TS_FILES) {
      if (allowed(abs) || appRel(abs) === GENERATED_TS) continue;
      for (const s of tsStrings(abs))
        for (const m of s.text.matchAll(DATA_VAR)) c.add(rel(abs), s.line, m[0]);
      const sf = source(abs);
      for (const n of tsNodes(sf))
        if (
          ts.isIdentifier(n) &&
          /^(dataPalette|dayPalette\w*|categoryPalette|pinPalette|illustration)$/.test(n.text)
        )
          c.add(rel(abs), lineOfTs(sf, n), n.text);
    }
    return c.result;
  },
  // G24–G26 (R1, design §15): hareket ve ölçek literal'leri. Declaration başına bir ihlal.
  G24() {
    const c = collector();
    for (const { abs, d } of motionScopedDecls()) {
      if (!MOTION_PROPS.has(d.prop)) continue;
      const v = withoutVars(stripValue(d.value));
      if (TIME_LITERAL.test(v) || EASING_LITERAL.test(v))
        c.add(rel(abs), d.line, `${d.prop}: ${d.value}`);
    }
    return c.result;
  },
  G25() {
    const c = collector();
    for (const { abs, d } of motionScopedDecls()) {
      if (d.prop !== "font-family") continue;
      if (d.node.type === "at" && d.node.name === "font-face") continue;
      if (/^(var\(--font-family-|inherit\b)/i.test(d.value.trim())) continue;
      c.add(rel(abs), d.line, `font-family: ${d.value}`);
    }
    return c.result;
  },
  G26() {
    const c = collector();
    for (const { abs, d } of motionScopedDecls()) {
      if (!SCALE_PROPS.has(d.prop)) continue;
      const v = withoutVars(stripValue(d.value)).replace(/!\s*important/i, "");
      const bad =
        d.prop === "z-index"
          ? [...v.matchAll(/(?<![\w.-])-?\d+(?![\w.%-])/g)].some((m) => Number(m[0]) !== 0)
          : [...v.matchAll(LENGTH_LITERAL)].some((m) => Number(m[1]) !== 0);
      if (bad) c.add(rel(abs), d.line, `${d.prop}: ${d.value}`);
    }
    return c.result;
  },
  // G27 (R2): view transition ve global kaydırma davranışı yalnızca styles/motion.css'te.
  G27() {
    const c = collector();
    for (const abs of CSS_FILES) {
      const r = appRel(abs);
      if (r === "styles/tokens.css" || r === "styles/motion.css") continue;
      for (const n of allNodes(css(abs).top)) {
        if (n.type === "at" && n.name === "view-transition")
          c.add(rel(abs), n.line, "@view-transition");
        if (n.type === "rule" && /::view-transition/.test(n.selector))
          c.add(rel(abs), n.line, n.selector);
        for (const d of n.decls ?? [])
          if (d.prop === "scroll-behavior" || d.prop.startsWith("scroll-padding"))
            c.add(rel(abs), d.line, `${d.prop}: ${d.value}`);
      }
    }
    return c.result;
  },
  // G28 (R3): TSX string/template literal'lerinde ve JSX metninde emoji kod noktası (eşleşme başına).
  G28() {
    const c = collector();
    for (const abs of TSX_FILES) {
      const sf = source(abs);
      const scan = (text, line) => {
        for (const m of text.matchAll(EMOJI)) c.add(rel(abs), line, m[0]);
      };
      for (const s of tsStrings(abs)) scan(s.text, s.line);
      for (const n of tsNodes(sf)) if (ts.isJsxText(n)) scan(n.text, lineOfTs(sf, n));
    }
    return c.result;
  },
  // G29 (R9): animasyon yalnızca no-preference bloğunda (statik varsayılan; `none` serbest).
  G29() {
    const c = collector();
    for (const { abs, d } of motionScopedDecls()) {
      if (d.prop !== "animation" && d.prop !== "animation-name") continue;
      if (/^none\b/i.test(d.value.trim()) || inKeyframes(d.node)) continue;
      const chain = [...d.node.ancestors, d.node];
      const allowed = chain.some(
        (a) =>
          a.type === "at" &&
          a.name === "media" &&
          /prefers-reduced-motion\s*:\s*no-preference/.test(a.prelude),
      );
      if (!allowed) c.add(rel(abs), d.line, `${d.prop}: ${d.value}`);
    }
    return c.result;
  },
};

// ---------------------------------------------------------------------------------------------
// G13: breakpoint kümesi + donmuş legacyBreakpoints (baseline yerine).

const { BREAKPOINT_VALUES, legacyBreakpoints } = loadTs(path.join(PKG_SRC, "breakpoints.ts"));
function mediaWidthUsage() {
  const out = {};
  for (const abs of CSS_FILES)
    for (const n of allNodes(css(abs).top)) {
      if (n.type !== "at" || n.name !== "media") continue;
      const query = n.prelude
        .replace(/^@media\s*/i, "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
      const values = [...query.matchAll(/\(\s*(?:min|max)-width\s*:\s*([\d.]+)(?:px)?\s*\)/g)].map(
        (m) => Number(m[1]),
      );
      if (!values.some((v) => !BREAKPOINT_VALUES.includes(v))) continue;
      const list = ((out[appRel(abs)] ??= {})[query] ??= []);
      list.push(n.line);
    }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Ratchet

function countsOf(violations) {
  const out = {};
  for (const [file, list] of Object.entries(violations)) out[file] = list.length;
  return out;
}
// Sıfıra inen kural da baseline'da `{}` olarak kalır: anahtarın varlığı "bu kural bir kez
// yazıldı" demektir ve --seed ile yeniden açılamaz (ratchet yalnızca aşağı).
function actualCounts() {
  const all = {};
  for (const [rule, fn] of Object.entries(RULES))
    all[rule] = Object.fromEntries(Object.entries(countsOf(fn())).sort());
  return all;
}
const readBaseline = () =>
  fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) : null;

function writeBaseline() {
  const init = process.argv.includes("--init");
  const existing = readBaseline();
  if (!existing && !init) {
    console.error("Baseline yok. İlk oluşturma için --init verin (yalnızca dosya yokken).");
    process.exit(1);
  }
  if (existing && init) {
    console.error("--init yalnızca baseline dosyası yokken kullanılabilir.");
    process.exit(1);
  }
  // --seed G24,G25: baseline'da anahtarı HİÇ olmayan (RULES'a yeni eklenmiş) kuralları bugünkü
  // sayılarıyla bir kez ekler (plan D5). Anahtarı olan kural (sayısı 0 olsa bile, `{}`) seed
  // edilemez; diğer kurallar yalnızca düşer.
  const seedArg = process.argv.indexOf("--seed");
  const seed = new Set(
    seedArg > 0 ? (process.argv[seedArg + 1] ?? "").split(",").filter(Boolean) : [],
  );
  if (seedArg > 0 && !seed.size) {
    console.error("--seed bir kural listesi ister: --seed G24,G25");
    process.exit(1);
  }
  for (const rule of seed) {
    if (!RULES[rule]) {
      console.error(`--seed: bilinmeyen kural ${rule}`);
      process.exit(1);
    }
    if (existing && Object.hasOwn(existing, rule)) {
      console.error(`--seed: ${rule} baseline'da zaten var; yalnızca aşağı yönde yazılabilir.`);
      process.exit(1);
    }
  }
  const actual = actualCounts();
  if (existing) {
    const ups = [];
    for (const [rule, files] of Object.entries(actual))
      for (const [file, n] of Object.entries(files)) {
        if (seed.has(rule)) continue;
        const prev = existing[rule]?.[file] ?? 0;
        if (n > prev) ups.push(`${rule}: ${file} ${prev} → ${n}`);
      }
    if (ups.length) {
      console.error(
        `Baseline yalnızca aşağı yönde yazılabilir; artış reddedildi:\n  ${ups.join("\n  ")}`,
      );
      process.exit(1);
    }
  }
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(actual, null, 2) + "\n");
  const total = Object.values(actual).reduce(
    (s, f) => s + Object.values(f).reduce((a, b) => a + b, 0),
    0,
  );
  console.log(
    `Baseline yazıldı: ${path.relative(ROOT, BASELINE_PATH)} (${Object.keys(actual).length} kural, ${total} ihlal)`,
  );
  for (const [rule, files] of Object.entries(actual))
    console.log(`  ${rule}: ${Object.values(files).reduce((a, b) => a + b, 0)}`);
}

if (require.main === module && process.argv.includes("--write-baseline")) {
  writeBaseline();
} else {
  const baseline = readBaseline() ?? {};

  for (const rule of Object.keys(RULES)) {
    test(`${rule} ratchet: ${HINT[rule]}`, () => {
      const violations = RULES[rule]();
      const expected = baseline[rule] ?? {};
      const problems = [];
      for (const [file, list] of Object.entries(violations)) {
        const allowed = expected[file] ?? 0;
        if (list.length > allowed) {
          const sample = list
            .slice(0, 3)
            .map(
              (v) =>
                `${rule}: ${file}:${v.line} '${String(v.text).slice(0, 70)}' → ${HINT[rule]} ${ref(rule)}`,
            )
            .join("\n");
          problems.push(`${sample}\n  (${file}: ${list.length} ihlal, baseline ${allowed})`);
        }
      }
      for (const [file, allowed] of Object.entries(expected)) {
        const n = violations[file]?.length ?? 0;
        if (n < allowed)
          problems.push(
            `${rule}: ${file} baseline ${allowed}, gerçek ${n} → baseline'ı düşürün: node apps/web/tests/design-system-guard.test.cjs --write-baseline`,
          );
      }
      assert.deepEqual(problems, [], problems.join("\n"));
    });
  }

  test("G13 @media genişlikleri: breakpoint kümesi ya da donmuş legacyBreakpoints", () => {
    const usage = mediaWidthUsage();
    const problems = [];
    for (const [file, queries] of Object.entries(usage))
      for (const [query, lines] of Object.entries(queries)) {
        const listed = (legacyBreakpoints[file] ?? []).find((e) => e.query === query)?.count ?? 0;
        if (lines.length > listed)
          problems.push(
            `G13: app/${file}:${lines[0]} '@media ${query}' → ${HINT.G13} ${ref("G13")}`,
          );
      }
    for (const [file, entries] of Object.entries(legacyBreakpoints))
      for (const e of entries) {
        const n = usage[file]?.[e.query]?.length ?? 0;
        if (n < e.count)
          problems.push(
            `G13: app/${file} '${e.query}' listede ${e.count}, gerçek ${n} → breakpoints.ts legacyBreakpoints listesini düşürün`,
          );
      }
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  test("G4/G9 route registry'ye bağlı: lib/route-registry.ts var (C7'den sonra skip yok)", () => {
    assert.ok(fs.existsSync(REGISTRY_PATH), "lib/route-registry.ts yok: G4/G9 koşamaz");
  });

  test("baseline biçimi: bilinen kurallar, pozitif tam sayılar, her kural anahtar olarak var", () => {
    for (const rule of Object.keys(RULES))
      assert.ok(
        Object.hasOwn(baseline, rule),
        `baseline'da ${rule} anahtarı yok: temizlenen kural {} olarak kalır, yeni kural --seed ile girer`,
      );
    for (const [rule, files] of Object.entries(baseline)) {
      assert.ok(RULES[rule], `baseline'da bilinmeyen kural: ${rule}`);
      for (const [file, n] of Object.entries(files))
        assert.ok(Number.isInteger(n) && n > 0, `${rule}: ${file} geçersiz sayı ${n}`);
    }
  });

  test("steering eşlemesi: her kural bir bölüme, başlıklar 1–14 ardışık", (t) => {
    for (const rule of [...Object.keys(RULES), "G4", "G9", "G13"])
      assert.ok(STEERING_SECTION[rule.replace(/[a-z]$/, "")], `${rule} için steering bölümü yok`);
    if (!fs.existsSync(STEERING_PATH)) {
      t.skip("steering dosyası (.kiro/steering/design-system.md) henüz yok (C19'da eklenir)");
      return;
    }
    const md = fs.readFileSync(STEERING_PATH, "utf8");
    const headings = [...md.matchAll(/^## (\d+)\. (.+)$/gm)].map((m) => ({
      n: Number(m[1]),
      name: m[2].trim(),
    }));
    assert.deepEqual(
      headings.map((h) => h.n),
      Array.from({ length: 14 }, (_, k) => k + 1),
      "bölüm numaraları 1–14 ardışık olmalı",
    );
    for (const name of new Set(Object.values(STEERING_SECTION)))
      assert.equal(
        headings.filter((h) => h.name === name).length,
        1,
        `'## <n>. ${name}' başlığı tam 1 kez olmalı`,
      );
  });
}
