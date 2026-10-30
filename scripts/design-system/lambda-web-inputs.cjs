#!/usr/bin/env node
// Lambda bundle değişmezlik kontrolü (design §13, NFR-6, AC-30).
// Tüm infra/lambda/src/*/{index,worker,training-worker,tracker-worker}.ts giriş noktalarını esbuild
// metafile ile tarar, bundle'a giren apps/web dosyalarını listeler ve bunların main'e göre
// değişmediğini doğrular (`git diff --quiet main -- <liste>` + her dosyanın main'de var olması).
// Fark → exit 1. Birincil (bağlayıcı) kanıt budur.
//
//   node scripts/design-system/lambda-web-inputs.cjs [--base <ref>] [--list] [--hash [--expect <sha256>]]
//
// --hash: build'in yazdığı infra/terraform/.build/ai/handler.cjs'in SHA-256'sını basar (dosya yoksa
// atlanır). --expect ile verilen değerle karşılaştırır. Bundle içindeki yol/zaman farkları yanlış
// pozitif verebileceği için bu yalnızca ek kanıttır.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const esbuild = require("esbuild");

const ROOT = path.resolve(__dirname, "../..");
const LAMBDA_SRC = path.join(ROOT, "infra/lambda/src");
const ENTRY_NAMES = ["index.ts", "worker.ts", "training-worker.ts", "tracker-worker.ts"];
const HANDLER = path.join(ROOT, "infra/terraform/.build/ai/handler.cjs");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}
const flag = (name) => process.argv.includes(name);

function entryPoints() {
  const out = [];
  for (const dir of fs.readdirSync(LAMBDA_SRC).sort()) {
    for (const name of ENTRY_NAMES) {
      const p = path.join(LAMBDA_SRC, dir, name);
      if (fs.existsSync(p)) out.push(p);
    }
  }
  return out;
}

function webInputs(entries) {
  const result = esbuild.buildSync({
    entryPoints: entries,
    bundle: true,
    write: false,
    metafile: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    outdir: path.join(ROOT, ".lambda-web-inputs-tmp"),
    packages: "external",
    logLevel: "silent",
    absWorkingDir: ROOT,
  });
  return Object.keys(result.metafile.inputs)
    .map((p) => p.split(path.sep).join("/"))
    .filter((p) => p.startsWith("apps/web/"))
    .sort();
}

function git(args) {
  return spawnSync("git", ["-C", ROOT, ...args], { encoding: "utf8" });
}

function main() {
  const base = arg("--base") ?? "main";
  const entries = entryPoints();
  const inputs = webInputs(entries);
  console.log(
    `[lambda-web-inputs] ${entries.length} giriş noktası → ${inputs.length} apps/web girdisi (taban ${base})`,
  );
  if (flag("--list")) for (const p of inputs) console.log(`  ${p}`);

  const problems = [];
  for (const p of inputs) {
    if (git(["cat-file", "-e", `${base}:${p}`]).status !== 0)
      problems.push(`${p}: ${base}'de yok (lambda bundle'ına yeni web dosyası girmiş)`);
  }
  if (inputs.length) {
    const diff = git(["diff", "--quiet", base, "--", ...inputs]);
    if (diff.status === 1) {
      const names = git(["diff", "--name-only", base, "--", ...inputs]).stdout.trim();
      problems.push(`${base}'e göre değişen girdiler:\n${names}`);
    } else if (diff.status !== 0) {
      problems.push(`git diff çalışmadı: ${diff.stderr.trim()}`);
    }
  }

  if (flag("--hash")) {
    if (!fs.existsSync(HANDLER)) {
      console.log("[lambda-web-inputs] --hash: handler.cjs yok (build koşulmadı) — atlandı");
    } else {
      const sha = crypto.createHash("sha256").update(fs.readFileSync(HANDLER)).digest("hex");
      console.log(`[lambda-web-inputs] handler.cjs sha256 ${sha}`);
      const expect = arg("--expect");
      if (expect && expect !== sha)
        problems.push(
          `handler.cjs sha256 beklenenden farklı (${expect}) — ek kanıt, metafile bağlayıcıdır`,
        );
    }
  }

  if (problems.length) {
    for (const p of problems) console.error(`[lambda-web-inputs] HATA: ${p}`);
    process.exit(1);
  }
  console.log("[lambda-web-inputs] OK: lambda'ya giren web dosyaları değişmedi");
}

main();
