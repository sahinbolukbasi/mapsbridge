// Renk kodmodu (design §2.7): exact map, zemin farkındalığı, manuel-kontrast, alfa, ΔE kuralı, TSX modu.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../../..");
const SCRIPT = path.join(root, "scripts/design-system/codemod-colors.ts");
const LAYER = "@layer tokens, base, legacy, chrome, pages, primitives;\n";
const NODE = [
  process.execPath,
  "--experimental-strip-types",
  "--disable-warning=ExperimentalWarning",
];

/** transformCss/transformTsx'i alt süreçte koşar; {out, report} döner. */
function run(fn, src, approved = []) {
  const script = `
    import { ${fn}, emptyReport } from ${JSON.stringify(SCRIPT)};
    const report = emptyReport("css", true);
    const out = ${fn}(${JSON.stringify(src)}, "app/x.file", new Set(${JSON.stringify(approved)}), report);
    console.log(JSON.stringify({ out, report }));
  `;
  const r = spawnSync(NODE[0], [...NODE.slice(1), "--input-type=module", "-e", script], {
    cwd: root,
    encoding: "utf8",
  });
  if (r.status !== 0) return { error: r.stderr };
  return JSON.parse(r.stdout);
}
const css = (body) => `${LAYER}@layer pages {\n${body}\n}\n`;

test("exact map: açık zeminde metin → semantik token, değer korunur", () => {
  const { out, report } = run("transformCss", css(".a { color: #0f172a; background: #ffffff; }"));
  assert.match(out, /\.a \{ color: var\(--color-text\); background: var\(--color-surface\); \}/);
  assert.equal(report.applied.length, 2);
  assert.ok(report.applied.every((c) => c.preserved && c.kind === "exact"));
});

test("#94a3b8 açık zeminde → manuel-kontrast (uygulanmaz), --apply-manual ile uygulanır", () => {
  const src = css(".hint { color: #94a3b8; }");
  const first = run("transformCss", src);
  assert.equal(first.out, src);
  assert.equal(first.report.manualContrast.length, 1);
  const row = first.report.manualContrast[0];
  assert.equal(row.after, "var(--color-text-subtle)");
  assert.equal(row.preserved, false);
  assert.equal(row.background, "light");
  assert.ok(row.contrast >= 4.5);
  const second = run("transformCss", src, [row.id]);
  assert.match(second.out, /color: var\(--color-text-subtle\)/);
  assert.equal(second.report.manualContrast.length, 0);
});

test("zemin farkındalığı: koyu kap içindeki #94a3b8 → text-inverse-subtle + inverse kap kaydı", () => {
  const { out, report } = run(
    "transformCss",
    css(".hero { background: #0d281e; }\n.hero .meta { color: #94a3b8; }"),
  );
  assert.match(out, /\.hero \{ background: var\(--color-surface-inverse\); \}/);
  assert.match(out, /\.hero \.meta \{ color: var\(--color-text-inverse-subtle\); \}/);
  assert.deepEqual(
    report.inverseContainers.map((r) => r.selector),
    [".hero .meta"],
  );
});

test("karışık seçici listesinde yalnız kapsamdan bağımsız birebir token; yoksa belirsiz", () => {
  const { out, report } = run(
    "transformCss",
    css(
      ".dark { background: #0d281e; }\n.dark .x, .light .x { color: #ffffff; }\n.dark .y, .light .y { color: #8dbda9; }",
    ),
  );
  // beyaz: --color-on-primary inverse kapsamında değişmez → uygulanır
  assert.match(out, /\.light \.x \{ color: var\(--color-on-primary\); \}/);
  // palet dışı değer: belirsiz
  assert.match(out, /\.light \.y \{ color: #8dbda9; \}/);
  assert.equal(report.ambiguous.length, 1);
});

test("alfa: hazır token ve color-mix", () => {
  const { out } = run(
    "transformCss",
    css(".a { background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16,185,129,.35); }"),
  );
  assert.match(out, /background: var\(--color-accent-a20\)/);
  assert.match(
    out,
    /border: 1px solid color-mix\(in srgb, var\(--color-accent\) 35%, transparent\)/,
  );
});

test("gölgedeki siyah alfa gölge token'ı ister: uygulanmaz, not düşer", () => {
  const src = css(".a { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); }");
  const { out, report } = run("transformCss", src);
  assert.equal(out, src);
  assert.equal(report.notes.length, 1);
});

test("ΔE ≤ 6 fallback metin dışında uygulanır; karar tablosu satırı kullanılır", () => {
  const { out, report } = run(
    "transformCss",
    css(".a { background: #faf8ff; border-color: #dc2626; }"),
  );
  assert.match(out, /background: var\(--color-bg\)/);
  assert.match(out, /border-color: var\(--color-danger\)/);
  assert.deepEqual(
    report.applied.map((c) => c.kind),
    ["fold", "decided"],
  );
});

test("ΔE > 6 ve tabloda yok → eşlenmemiş, dokunulmaz", () => {
  const src = css(".a { background: #ff00ff; }");
  const { out, report } = run("transformCss", src);
  assert.equal(out, src);
  assert.equal(report.unmapped.length, 1);
});

test("üçüncü taraf ve veri paleti katlanmaz", () => {
  const src = css(".g { background: #4285f4; } .d { background: #8b5cf6; }");
  const { out, report } = run("transformCss", src);
  assert.equal(out, src);
  assert.equal(report.notes.length, 2);
  assert.match(report.notes[0].reason, /google-logo\.tsx/);
  assert.match(report.notes[1].reason, /veri paleti/);
});

test("yorum, string ve url() içindeki renkler atlanır", () => {
  const src = css('.a { /* #ffffff */ content: "#ffffff"; background: url("x.svg#fff"); }');
  const { out, report } = run("transformCss", src);
  assert.equal(out, src);
  assert.equal(report.applied.length, 0);
});

test("tamamı [data-theme=dark] olan blok silinir", () => {
  const { out, report } = run(
    "transformCss",
    css('  .a { color: #0f172a; }\n  [data-theme="dark"] .a { color: #ffffff; }'),
  );
  assert.doesNotMatch(out, /data-theme/);
  assert.equal(report.darkBlocksRemoved.length, 1);
});

test("layer'sız CSS ve ayrıştırılamayan dosya ölümcüldür", () => {
  assert.match(run("transformCss", ".a { color: #fff; }").error, /layer sıra ifadesi/);
  assert.match(run("transformCss", css(".a { color: #fff;")).error, /kapanmamış blok/);
});

test("TSX: yalnızca style={{}} içindeki renk çevrilir; SVG ve JS tüketicisi elle", () => {
  const src = [
    'const pin = "#2563eb";',
    'export const A = () => <div style={{ color: "#0f172a", padding: 4 }}>',
    '  <svg><path fill="#ffffff" /></svg></div>;',
  ].join("\n");
  const { out, report } = run("transformTsx", src);
  assert.match(out, /style=\{\{ color: "var\(--color-text\)", padding: 4 \}\}/);
  assert.match(out, /const pin = "#2563eb"/);
  assert.match(out, /fill="#ffffff"/);
  assert.equal(report.applied.length, 1);
  assert.equal(report.notes.length, 2);
});

test("CLI: eşlenmemiş değer exit 1, diğerleri uygulanır; --dry-run yazmaz; parse hatası hiçbir dosyayı yazmaz", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codemod-"));
  try {
    const a = path.join(dir, "a.css");
    const b = path.join(dir, "b.css");
    fs.writeFileSync(a, css(".a { color: #0f172a; background: #ff00ff; }"));
    const dry = spawnSync(NODE[0], [...NODE.slice(1), SCRIPT, "--dry-run", a], {
      encoding: "utf8",
    });
    assert.equal(dry.status, 1, dry.stderr);
    assert.match(fs.readFileSync(a, "utf8"), /color: #0f172a/);
    const report = path.join(dir, "r.json");
    const real = spawnSync(NODE[0], [...NODE.slice(1), SCRIPT, "--report", report, a], {
      encoding: "utf8",
    });
    assert.equal(real.status, 1);
    assert.match(fs.readFileSync(a, "utf8"), /color: var\(--color-text\); background: #ff00ff;/);
    assert.equal(JSON.parse(fs.readFileSync(report, "utf8")).unmapped.length, 1);
    fs.writeFileSync(a, css(".a { color: #0f172a; }"));
    fs.writeFileSync(b, css(".b { color: #0f172a;"));
    const broken = spawnSync(NODE[0], [...NODE.slice(1), SCRIPT, a, b], { encoding: "utf8" });
    assert.equal(broken.status, 2);
    assert.match(fs.readFileSync(a, "utf8"), /color: #0f172a/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("koyu kap içindeki açık zeminli kural kapsamdan bağımsız token alır", () => {
  const { out, report } = run(
    "transformCss",
    css(
      ".band { background: #0d281e; }\n.band .btn { background: #ffffff; color: #0f172a; border-color: #e2e8f0; }",
    ),
  );
  // color-text / color-border inverse kapsamında değişir → seçilmez.
  assert.match(
    out,
    /\.band \.btn \{ background: var\(--color-surface\); color: var\(--color-neutral-900\); border-color: var\(--color-neutral-200\); \}/,
  );
  assert.equal(report.manualContrast.length, 0);
});

test("tw modu: tw-utils.css C18'de silindi → araç Türkçe hatayla durur (yeniden kullanılmaz)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codemod-tw-"));
  try {
    const tsx = path.join(dir, "x.tsx");
    fs.writeFileSync(tsx, 'export const X = () => <div className="flex gap-2">a</div>;\n');
    const r = spawnSync(
      NODE[0],
      [
        ...NODE.slice(1),
        SCRIPT,
        "--mode",
        "tw",
        "--css",
        path.join(dir, "x.css"),
        "--prefix",
        "tt",
        tsx,
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /tw-utils\.css yok/);
    assert.equal(fs.readFileSync(tsx, "utf8").includes("flex gap-2"), true, "dosya değişmemeli");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("RN modu: string → tokens ifadesi, şablon → ${…}, alfa → hazır token / withAlpha, siyah → black, import eklenir", () => {
  const src = [
    'import { View } from "react-native";',
    'const s = { a: { color: "#0f172a", backgroundColor: "#ffffff", shadowColor: "#000" } };',
    'const b = { borderColor: "rgba(16, 185, 129, 0.2)", backgroundColor: "rgba(255,255,255,0.5)" };',
    "const h = `body { background: #013628; }`;",
    'export const X = () => <Icon color="#ffffff" />;',
  ].join("\n");
  const script = `
    import { transformRn, emptyReport } from ${JSON.stringify(SCRIPT)};
    import { tokens } from ${JSON.stringify(path.join(root, "apps/mobile/src/theme/tokens.ts"))};
    const report = emptyReport("rn", true);
    const out = transformRn(${JSON.stringify(src)}, "apps/mobile/src/x.tsx", tokens.color, "../theme", report);
    console.log(JSON.stringify({ out, report }));
  `;
  const r = spawnSync(NODE[0], [...NODE.slice(1), "--input-type=module", "-e", script], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  const { out, report } = JSON.parse(r.stdout);
  assert.match(out, /import \{ tokens, withAlpha \} from "\.\.\/theme";/);
  assert.match(out, /color: tokens\.color\.text, backgroundColor: tokens\.color\.surface/);
  assert.match(out, /shadowColor: tokens\.color\.black/);
  assert.match(out, /borderColor: tokens\.color\.accentA20/);
  assert.match(out, /withAlpha\(tokens\.color\.surface, 0\.5\)/);
  assert.match(out, /background: \$\{tokens\.color\.primary\}/);
  assert.match(out, /<Icon color=\{tokens\.color\.onPrimary\} \/>/);
  assert.doesNotMatch(out, /#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  assert.equal(report.unmapped.length, 0);
});
