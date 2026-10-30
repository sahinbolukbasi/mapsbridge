// Build meta okuyucusu ve srcHash (design §10 "Build meta ve tazelik", §16; AC-39, R6-2, R6-3).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { buildState } = require("./helpers/build-meta.cjs");
const { REPO_ROOT, computeSrcHash } = require("../scripts/build-src-hash.cjs");

const HAS_GIT = spawnSync("git", ["--version"]).status === 0;
const NO_GIT = "git bulunamadı; srcHash testleri atlandı";

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Sahte out/ + meta; `overrides` meta alanlarını değiştirir. */
function fakeBuild({ meta = {}, buildDir = true, index = true } = {}) {
  const dir = tmp("mb-build-meta-");
  const outDir = path.join(dir, "out");
  const metaPath = path.join(dir, ".next/build-meta.json");
  const full = {
    schema: 1,
    siteOrigin: "https://mapsbridge.com",
    gitHead: null,
    srcHash: "x",
    buildId: "B1",
    builtAt: new Date(0).toISOString(),
    ...meta,
  };
  fs.mkdirSync(path.dirname(metaPath), { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify(full));
  fs.mkdirSync(outDir, { recursive: true });
  if (index) fs.writeFileSync(path.join(outDir, "index.html"), "<html></html>");
  if (buildDir) fs.mkdirSync(path.join(outDir, "_next/static", full.buildId), { recursive: true });
  return { dir, outDir, metaPath };
}

const state = (b, extra = {}) =>
  buildState({ outDir: b.outDir, metaPath: b.metaPath, currentHash: () => "x", ...extra });

test("buildState: geçerli build ok döner", () => {
  const b = fakeBuild();
  const s = state(b);
  assert.equal(s.ok, true);
  assert.equal(s.outDir, b.outDir);
  assert.equal(s.meta.buildId, "B1");
  assert.equal(state(b, { needsOrigin: true }).ok, true);
});

test("buildState: meta yoksa missing", () => {
  const b = fakeBuild();
  fs.rmSync(b.metaPath);
  const s = state(b);
  assert.equal(s.reason, "missing");
  assert.match(s.message, /build meta yok/);
});

test("buildState: bozuk JSON ve yanlış şema corrupt", () => {
  const b = fakeBuild();
  fs.writeFileSync(b.metaPath, "{bozuk");
  assert.equal(state(b).reason, "corrupt");
  assert.equal(state(fakeBuild({ meta: { schema: 2 } })).reason, "corrupt");
  assert.equal(state(fakeBuild({ meta: { buildId: 42 }, buildDir: false })).reason, "corrupt");
});

test("buildState: out/index.html yoksa missing", () => {
  const s = state(fakeBuild({ index: false }));
  assert.equal(s.reason, "missing");
  assert.match(s.message, /out\/ yok/);
});

test("buildState: buildId dizini yoksa stale", () => {
  const s = state(fakeBuild({ buildDir: false }));
  assert.equal(s.reason, "stale");
  assert.match(s.message, /başka bir build/);
});

test("buildState: hash yoksa no-hash", () => {
  assert.equal(state(fakeBuild(), { currentHash: () => null }).reason, "no-hash");
  assert.equal(state(fakeBuild({ meta: { srcHash: null } })).reason, "no-hash");
});

test("buildState: hash farklıysa stale", () => {
  const s = state(fakeBuild(), { currentHash: () => "y" });
  assert.equal(s.reason, "stale");
  assert.match(s.message, /srcHash eşleşmiyor/);
});

test("buildState: needsOrigin iken origin'siz build no-origin", () => {
  const b = fakeBuild({ meta: { siteOrigin: null } });
  assert.equal(state(b).ok, true);
  assert.equal(state(b, { needsOrigin: true }).reason, "no-origin");
});

function git(repo, ...args) {
  const r = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
}

function tempRepo() {
  const repo = tmp("mb-src-hash-");
  git(repo, "init", "-q");
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), text);
  };
  write(".gitignore", "apps/web/out/\n");
  write("apps/web/app/page.tsx", "export default 1;\n");
  write("apps/web/tests/x.cjs", "1\n");
  write("apps/web/out/index.html", "<html></html>\n");
  write("packages/p/index.ts", "export {};\n");
  git(repo, "add", "-A");
  return { repo, write, hash: () => computeSrcHash({ repoRoot: repo }) };
}

test(
  "computeSrcHash: düzenleme, ekleme ve silme hash'i değiştirir",
  { skip: !HAS_GIT && NO_GIT },
  () => {
    const { repo, write, hash } = tempRepo();
    const h0 = hash();
    assert.match(h0, /^[0-9a-f]{64}$/);
    write("apps/web/app/page.tsx", "export default 2;\n");
    const h1 = hash();
    assert.notEqual(h1, h0, "izlenen dosya düzenlenince hash değişmeli");
    write("apps/web/app/new.ts", "export {};\n");
    const h2 = hash();
    assert.notEqual(h2, h1, "izlenmeyen ve ignore edilmemiş dosya eklenince hash değişmeli");
    fs.rmSync(path.join(repo, "packages/p/index.ts"));
    assert.notEqual(hash(), h2, "dosya silinince hash değişmeli");
  },
);

test(
  "computeSrcHash: ignore edilmiş ve EXCLUDE dosyaları hash'i değiştirmez",
  { skip: !HAS_GIT && NO_GIT },
  () => {
    const { write, hash } = tempRepo();
    const h0 = hash();
    write("apps/web/out/index.html", "<html>değişti</html>\n");
    assert.equal(hash(), h0, "ignore edilmiş dosya");
    write("apps/web/tests/x.cjs", "2\n");
    write("apps/web/AGENTS.md", "otomatik\n");
    write("apps/web/next-env.d.ts", "// yeniden yazıldı\n");
    assert.equal(hash(), h0, "EXCLUDE dosyaları");
  },
);

test("computeSrcHash: cwd'den bağımsızdır (geçici depo)", { skip: !HAS_GIT && NO_GIT }, () => {
  const { repo, hash } = tempRepo();
  const before = hash();
  const cwd = process.cwd();
  try {
    process.chdir(path.join(repo, "apps/web"));
    assert.equal(hash(), before);
  } finally {
    process.chdir(cwd);
  }
});

test(
  "computeSrcHash: gerçek depoda repo kökü ve apps/web cwd'si aynı hash'i verir",
  { skip: !HAS_GIT && NO_GIT },
  () => {
    const cwd = process.cwd();
    try {
      process.chdir(REPO_ROOT);
      const fromRoot = computeSrcHash();
      assert.match(fromRoot, /^[0-9a-f]{64}$/);
      process.chdir(path.join(REPO_ROOT, "apps/web"));
      assert.equal(computeSrcHash(), fromRoot);
    } finally {
      process.chdir(cwd);
    }
  },
);

test("computeSrcHash: git dışı dizinde null döner", { skip: !HAS_GIT && NO_GIT }, () => {
  assert.equal(computeSrcHash({ repoRoot: tmp("mb-no-git-") }), null);
});
