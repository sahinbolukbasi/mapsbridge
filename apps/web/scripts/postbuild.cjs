// npm "postbuild": next build'den sonra (1) /en sayfalarının statik <html lang>'ını "en" yapar
// (design §4.1 rewriteEnLang, I11), (2) build meta'sını yazar (design §10 "Build meta ve tazelik").
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

const OUT_DIR = path.join(WEB_ROOT, "out");
/**
 * Root layout tek olduğu için Next her sayfaya <html lang="tr"> yazar. out/en/index.html ve
 * out/en/ altındaki her index.html içindeki İLK `<html lang="tr"` ifadesi `<html lang="en"` olur.
 * out/en/index.html yoksa ya da ifade bulunamazsa ölümcül (build durur).
 */
function rewriteEnLang(outDir = OUT_DIR) {
  const enDir = path.join(outDir, "en");
  const root = path.join(enDir, "index.html");
  if (!fs.existsSync(root)) throw new Error("out/en/index.html yok");
  const files = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (name === "index.html") files.push(p);
    }
  };
  walk(enDir);
  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    if (!html.includes('<html lang="tr"'))
      throw new Error(`${path.relative(WEB_ROOT, file)}: '<html lang="tr"' bulunamadı`);
    fs.writeFileSync(file, html.replace('<html lang="tr"', '<html lang="en"'));
  }
  return files.length;
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
  const n = rewriteEnLang();
  console.log(`[postbuild] /en <html lang="en">: ${n} dosya`);
} catch (err) {
  console.error(`/en lang yeniden yazılamadı: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
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
