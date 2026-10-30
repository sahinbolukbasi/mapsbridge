// ui-audit unwrapLayers: @layer sarmalarını açar (design §2.6 "unwrapLayers", Rev 6 K1).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../../..");

/** Her girdi için { ok, out } ya da { ok: false, error } döndürür (tek alt süreç). */
function unwrapAll(inputs) {
  const script = `
    import { unwrapLayers } from "./scripts/ui-audit/unlayer.ts";
    const inputs = JSON.parse(process.argv[1]);
    console.log(JSON.stringify(inputs.map((css) => {
      try { return { ok: true, out: unwrapLayers(css) }; }
      catch (e) { return { ok: false, error: e.message }; }
    })));
  `;
  const r = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--input-type=module",
      "-e",
      script,
      JSON.stringify(inputs),
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
const unwrap = (css) => {
  const [res] = unwrapAll([css]);
  assert.ok(res.ok, res.error);
  return res.out;
};

test("minify edilmiş chunk başlıkları: sıra ifadeleri silinir, bloklar açılır", () => {
  assert.equal(
    unwrap("@layer tokens,base,legacy,chrome;@layer pages{.a{color:red}}@layer primitives;"),
    ".a{color:red}",
  );
  assert.equal(unwrap("@layer chrome;.x{margin:0}"), ".x{margin:0}");
  assert.equal(unwrap("@layer pages{.a{b:c}.d{e:f}}"), ".a{b:c}.d{e:f}");
  assert.equal(
    unwrap(
      "@layer tokens, base, legacy, chrome, pages, primitives;\n@layer legacy {\n  .y { top: 0 }\n}\n",
    ),
    "\n\n  .y { top: 0 }\n\n",
  );
});

test("adsız blok ve iç içe @media/@supports içindeki layer'lar açılır", () => {
  assert.equal(unwrap("@layer{.a{b:c}}"), ".a{b:c}");
  assert.equal(
    unwrap("@media (min-width:640px){@layer x{.a{b:c}}}"),
    "@media (min-width:640px){.a{b:c}}",
  );
  assert.equal(
    unwrap("@supports (display:grid){@layer a.b{@media print{.p{q:r}}}}"),
    "@supports (display:grid){@media print{.p{q:r}}}",
  );
  assert.equal(unwrap("@layer pages{@layer inner;.a{b:c}}"), ".a{b:c}");
});

test("string ve yorum içindeki } ve @layer metnine dokunulmaz", () => {
  const css = ".a::after{content:\"} @layer x{\"}@layer pages{.b{content:'@layer y;'}}";
  assert.equal(unwrap(css), ".a::after{content:\"} @layer x{\"}.b{content:'@layer y;'}");
  assert.equal(
    unwrap("/* @layer pages{ } */@layer pages{.c{d:e}/* } */}"),
    "/* @layer pages{ } */.c{d:e}/* } */",
  );
  assert.equal(unwrap('.e{content:"\\"}"}'), '.e{content:"\\"}"}');
});

test("layer'sız CSS'te no-op ve idempotent", () => {
  const plain = ".leaflet-container{font-size:12px}@media (max-width:767px){.a{b:c}}";
  assert.equal(unwrap(plain), plain);
  const inputs = [
    "@layer tokens,base;@layer legacy{.a{b:c}}@layer chrome,pages,primitives;",
    "@media x{@layer y{.z{w:v}}}",
  ];
  const once = unwrapAll(inputs).map((r) => r.out);
  const twice = unwrapAll(once).map((r) => r.out);
  assert.deepEqual(twice, once);
  assert.ok(once.every((s) => !s.includes("@layer")));
});

test("dengesiz süslü parantezde Türkçe hata", () => {
  const [open, close] = unwrapAll(["@layer pages{.a{b:c}", ".a{b:c}}"]);
  assert.equal(open.ok, false);
  assert.match(open.error, /^unwrapLayers: dengesiz süslü parantez \(konum \d+\)$/);
  assert.equal(close.ok, false);
  assert.match(close.error, /dengesiz süslü parantez \(konum 7\)/);
});
