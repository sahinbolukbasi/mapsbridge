// ui-audit Leaflet karşılaştırması K1/K2/K3 (design §2.6 "Leaflet kanıtı", "Testler"; §17.-3 #2, #3).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../../..");
const STRIP = ["--experimental-strip-types", "--disable-warning=ExperimentalWarning"];

/** compareLeaflet'i alt süreçte koşar: { result } ya da { error }. */
function compare(a, b, opts) {
  const script = `
    import { compareLeaflet, summarize } from "./scripts/ui-audit/leaflet-compare.ts";
    const [a, b, opts] = JSON.parse(process.argv[1]);
    try {
      const r = compareLeaflet(a, b, opts);
      console.log(JSON.stringify({ result: { ...r, summary: summarize(r.rows) } }));
    } catch (e) {
      console.log(JSON.stringify({ error: e.message }));
    }
  `;
  const r = spawnSync(
    process.execPath,
    [...STRIP, "--input-type=module", "-e", script, JSON.stringify([a, b, opts])],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

function parseColors(values) {
  const script = `
    import { parseComputedColor } from "./scripts/ui-audit/leaflet-compare.ts";
    console.log(JSON.stringify(JSON.parse(process.argv[1]).map(parseComputedColor)));
  `;
  const r = spawnSync(
    process.execPath,
    [...STRIP, "--input-type=module", "-e", script, JSON.stringify(values)],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const KEY = "/gezgin/|leaflet-popup-content#0|0";
function item(key = KEY, over = {}) {
  return {
    key,
    classes: "leaflet-popup-content",
    geometry: { position: "static", "font-size": "13px", width: "241.00", ...over.geometry },
    color: { color: "rgb(51, 51, 51)", "background-color": "rgba(0, 0, 0, 0)", ...over.color },
    info: { "box-shadow": "none", ...over.info },
  };
}
function snap({ unlayered = false, buildId = "B1", items = [item()], schema = 2 } = {}) {
  return {
    schema,
    build: { outDir: "/out", buildId, unlayered },
    scenarios: { "/maps/": [], "/gezgin/": items },
  };
}
const verdicts = (res) => res.result.rows.filter((r) => r.verdict !== "equal");

test("K1: aynı build'de eşit kümeler geçer", () => {
  const res = compare(snap(), snap({ unlayered: true }), { mode: "cascade" });
  assert.equal(res.result.failed, false);
  assert.equal(res.result.summary.fail, 0);
  assert.ok(res.result.summary.equal > 0);
});

test("K1: renk farkı fail olur (katlama K1'de kabul edilmez)", () => {
  const b = snap({ unlayered: true, items: [item(KEY, { color: { color: "rgb(15, 23, 42)" } })] });
  const res = compare(snap(), b, { mode: "cascade" });
  assert.equal(res.result.failed, true);
  assert.deepEqual(
    verdicts(res).map((r) => [r.property, r.verdict]),
    [["color", "fail"]],
  );
});

test("K1: farklı buildId ya da yanlış unlayered çifti hata verir", () => {
  const msg = "K1 aynı build'in layer'lı/layer'sız çiftini ister";
  assert.equal(
    compare(snap(), snap({ unlayered: true, buildId: "B2" }), { mode: "cascade" }).error,
    msg,
  );
  assert.equal(compare(snap(), snap(), { mode: "cascade" }).error, msg);
  assert.equal(
    compare(snap({ buildId: null }), snap({ unlayered: true, buildId: null }), { mode: "cascade" })
      .error,
    msg,
  );
});

test("schema 2 dışı girdi desteklenmez", () => {
  const res = compare(snap({ schema: 1 }), snap(), { mode: "commits" });
  assert.match(res.error, /anlık görüntü şeması desteklenmiyor/);
});

test("K2/K3: commits modunda unlayered:true girdi hata verir (§17.-3 #3)", () => {
  const msg = "K2/K3 layer'lı anlık görüntü ister";
  assert.equal(compare(snap(), snap({ unlayered: true }), { mode: "commits" }).error, msg);
  assert.equal(compare(snap({ unlayered: true }), snap(), { mode: "commits" }).error, msg);
});

test("K2/K3: CLI commits modunda unlayered:true girdiyle exit 1 ve mesaj verir", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mb-leaflet-cli-"));
  const a = path.join(dir, "a.json");
  const b = path.join(dir, "b.json");
  fs.writeFileSync(a, JSON.stringify(snap()));
  fs.writeFileSync(b, JSON.stringify(snap({ unlayered: true })));
  const r = spawnSync(
    process.execPath,
    [...STRIP, "scripts/ui-audit/cli.ts", "--leaflet-compare", a, b, "--mode", "commits"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /K2\/K3 layer'lı anlık görüntü ister/);
});

test("K2: geometri farkı fail; aynı fark expectedChanges satırıyla expected-change", () => {
  const b = snap({ items: [item(KEY, { geometry: { "font-size": "11px" } })] });
  const failRes = compare(snap(), b, { mode: "commits", expectedChanges: [] });
  assert.equal(failRes.result.failed, true);
  assert.deepEqual(
    verdicts(failRes).map((r) => [r.property, r.verdict]),
    [["font-size", "fail"]],
  );
  const row = {
    key: KEY,
    property: "font-size",
    before: "13px",
    after: "11px",
    reason: "§6.1 asgari 11px",
    commit: "C14",
  };
  const okRes = compare(snap(), b, { mode: "commits", expectedChanges: [row] });
  assert.equal(okRes.result.failed, false);
  assert.deepEqual(
    verdicts(okRes).map((r) => [r.property, r.verdict]),
    [["font-size", "expected-change"]],
  );
  const wrong = { ...row, after: "12px" };
  assert.equal(
    compare(snap(), b, { mode: "commits", expectedChanges: [wrong] }).result.failed,
    true,
  );
});

test("K3: #131b2e → #0f172a expected-fold; #131b2e → #ff0000 fail", () => {
  const a = snap({ items: [item(KEY, { color: { color: "rgb(19, 27, 46)" } })] });
  const fold = compare(a, snap({ items: [item(KEY, { color: { color: "rgb(15, 23, 42)" } })] }), {
    mode: "commits",
  });
  assert.equal(fold.result.failed, false);
  assert.deepEqual(
    verdicts(fold).map((r) => [r.property, r.verdict]),
    [["color", "expected-fold"]],
  );
  const body = compare(
    snap({ items: [item(KEY, { color: { color: "rgb(32, 46, 41)" } })] }),
    snap({ items: [item(KEY, { color: { color: "rgb(15, 23, 42)" } })] }),
    { mode: "commits" },
  );
  assert.equal(body.result.failed, false, "#202e29 → #0f172a da beklenen katlamadır");
  const red = compare(a, snap({ items: [item(KEY, { color: { color: "rgb(255, 0, 0)" } })] }), {
    mode: "commits",
  });
  assert.equal(red.result.failed, true);
});

test("K3: alfa farkı fail", () => {
  const a = snap({
    items: [item(KEY, { color: { "background-color": "rgba(19, 27, 46, 0.5)" } })],
  });
  const b = snap({
    items: [item(KEY, { color: { "background-color": "rgba(15, 23, 42, 0.8)" } })],
  });
  const res = compare(a, b, { mode: "commits" });
  assert.equal(res.result.failed, true);
  assert.match(verdicts(res)[0].note, /alfa/);
});

test("K3: box-shadow farkı yalnızca info", () => {
  const b = snap({
    items: [item(KEY, { info: { "box-shadow": "rgba(13, 40, 30, 0.06) 0px 2px 8px 0px" } })],
  });
  const res = compare(snap(), b, { mode: "commits" });
  assert.equal(res.result.failed, false);
  assert.deepEqual(
    verdicts(res).map((r) => [r.property, r.verdict]),
    [["box-shadow", "info"]],
  );
});

test("anahtar kümesi farkı satırsız fail olur", () => {
  const extra = snap({ items: [item(), item("/gezgin/|leaflet-popup-content#0|0.0")] });
  const added = compare(snap(), extra, { mode: "commits", expectedChanges: [] });
  assert.equal(added.result.failed, true);
  assert.deepEqual(
    verdicts(added).map((r) => [r.property, r.verdict]),
    [["(anahtar)", "fail"]],
  );
  const removed = compare(extra, snap(), { mode: "commits", expectedChanges: [] });
  assert.equal(removed.result.failed, true);
  const k1 = compare(
    snap(),
    { ...extra, build: { ...extra.build, unlayered: true } },
    { mode: "cascade" },
  );
  assert.equal(k1.result.failed, true);
});

test("fazla anahtar + added satırı → expected-change; bir satır yalnızca bir anahtarı kapsar (§17.-3 #2)", () => {
  const k1 = "/gezgin/|leaflet-popup-content#0|0.0";
  const k2 = "/gezgin/|leaflet-popup-content#0|0.1";
  const row = { key: k1, change: "added", reason: "yeni öğe", commit: "C11" };
  const one = compare(snap(), snap({ items: [item(), item(k1)] }), {
    mode: "commits",
    expectedChanges: [row],
  });
  assert.equal(one.result.failed, false);
  assert.deepEqual(
    verdicts(one).map((r) => [r.key, r.verdict]),
    [[k1, "expected-change"]],
  );
  const two = compare(snap(), snap({ items: [item(), item(k1), item(k2)] }), {
    mode: "commits",
    expectedChanges: [row],
  });
  assert.equal(two.result.failed, true, "satırı olmayan ikinci fazla anahtar fail kalmalı");
  const wrongKind = compare(snap(), snap({ items: [item(), item(k1)] }), {
    mode: "commits",
    expectedChanges: [{ ...row, change: "removed" }],
  });
  assert.equal(wrongKind.result.failed, true);
  const removed = compare(snap({ items: [item(), item(k1)] }), snap(), {
    mode: "commits",
    expectedChanges: [{ ...row, change: "removed" }],
  });
  assert.equal(removed.result.failed, false);
});

test("parseComputedColor: rgb, rgba, color(srgb …), transparent ve çözülemeyen biçim", () => {
  assert.deepEqual(
    parseColors([
      "rgb(15, 23, 42)",
      "rgba(0, 0, 0, 0.5)",
      "color(srgb 0.0627 0.725 0.506 / 0.1)",
      "transparent",
      "oklab(0.5 0 0)",
    ]),
    [
      { r: 15, g: 23, b: 42, a: 1 },
      { r: 0, g: 0, b: 0, a: 0.5 },
      { r: 16, g: 185, b: 129, a: 0.1 },
      { r: 0, g: 0, b: 0, a: 0 },
      null,
    ],
  );
  const res = compare(
    snap(),
    snap({ items: [item(KEY, { color: { color: "oklab(0.5 0 0)" } })] }),
    { mode: "commits" },
  );
  assert.equal(res.result.failed, true);
  assert.match(verdicts(res)[0].note, /çözülemeyen/);
});
