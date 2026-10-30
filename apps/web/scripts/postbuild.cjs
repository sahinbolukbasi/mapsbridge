// npm "postbuild": next build'den sonra build meta'sını yazar (design §10 "Build meta ve tazelik").
// Meta apps/web/.next/build-meta.json'dadır (gitignored, deploy artifact'ına girmez; R6-3).
// Hata ölümcüldür: meta'sız bir build'in sessizce geçmesi istenmez.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { REPO_ROOT, computeSrcHash } = require("./build-src-hash.cjs");

const WEB_ROOT = path.join(REPO_ROOT, "apps/web");
const NEXT_DIR = path.join(WEB_ROOT, ".next");
const META_PATH = path.join(NEXT_DIR, "build-meta.json");

function siteOriginFromEnv() {
  // lib/site-metadata.ts ile aynı kural: boş/yoksa null.
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  return configured ? new URL(configured).origin : null;
}

function gitHead() {
  const r = spawnSync("git", ["-C", REPO_ROOT, "rev-parse", "HEAD"], { encoding: "utf8" });
  return r.error || r.status !== 0 ? null : r.stdout.trim() || null;
}

function writeBuildMeta() {
  let buildId;
  try {
    buildId = fs.readFileSync(path.join(NEXT_DIR, "BUILD_ID"), "utf8").trim();
  } catch (err) {
    throw new Error(`.next/BUILD_ID okunamadı (${err.code ?? err.message})`);
  }
  if (!buildId) throw new Error(".next/BUILD_ID boş");
  const srcHash = computeSrcHash();
  if (!srcHash) throw new Error("srcHash hesaplanamadı (git çalışmıyor)");
  const meta = {
    schema: 1,
    siteOrigin: siteOriginFromEnv(),
    gitHead: gitHead(),
    srcHash,
    buildId,
    builtAt: new Date().toISOString(),
  };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + "\n");
  return meta;
}

try {
  const meta = writeBuildMeta();
  console.log(
    `[postbuild] build meta yazıldı: ${path.relative(REPO_ROOT, META_PATH)} (buildId ${meta.buildId}, origin ${meta.siteOrigin ?? "yok"})`,
  );
} catch (err) {
  console.error(`build meta yazılamadı: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
