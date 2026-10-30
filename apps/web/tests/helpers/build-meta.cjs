// Build-bağımlı testler için build meta okuyucusu (design §10 "Build meta ve tazelik", R5-2, R6-3).
// Kullanım:
//   const s = buildState({ needsOrigin });
//   if (!s.ok) { if (process.env.REQUIRE_BUILD === "1") assert.fail(s.reason + ": " + s.message); else return t.skip(s.message); }
const fs = require("node:fs");
const path = require("node:path");
const { REPO_ROOT, computeSrcHash } = require("../../scripts/build-src-hash.cjs");

const DEFAULT_OUT_DIR = path.join(REPO_ROOT, "apps/web/out");
const DEFAULT_META_PATH = path.join(REPO_ROOT, "apps/web/.next/build-meta.json");
const BUILD_CMD = "NEXT_PUBLIC_SITE_URL=https://mapsbridge.com npm run build";

const fail = (reason, message) => ({ ok: false, reason, message });

/** Sıralı 7 kontrol; ilk başarısızlık döner. */
function buildState({
  needsOrigin = false,
  outDir = DEFAULT_OUT_DIR,
  metaPath = DEFAULT_META_PATH,
  currentHash = computeSrcHash,
} = {}) {
  if (!fs.existsSync(metaPath)) {
    return fail(
      "missing",
      `build meta yok (apps/web/.next/build-meta.json) — önce \`${BUILD_CMD}\``,
    );
  }
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  } catch (err) {
    return fail("corrupt", `build meta okunamadı (${err.message}) — yeniden build alın`);
  }
  if (!meta || meta.schema !== 1 || typeof meta.buildId !== "string" || !meta.buildId) {
    return fail(
      "corrupt",
      "build meta şeması geçersiz (schema 1 ve buildId bekleniyor) — yeniden build alın",
    );
  }
  if (!fs.existsSync(path.join(outDir, "index.html"))) {
    return fail("missing", "out/ yok — yeniden build alın");
  }
  if (!fs.existsSync(path.join(outDir, "_next/static", meta.buildId))) {
    return fail("stale", "out/ başka bir build'e ait — yeniden build alın");
  }
  const now = currentHash();
  if (!meta.srcHash || !now) {
    return fail("no-hash", "srcHash hesaplanamadı (git yok) — tazelik doğrulanamıyor");
  }
  if (meta.srcHash !== now) {
    return fail("stale", "out/ bayat: srcHash eşleşmiyor — yeniden build alın");
  }
  if (needsOrigin && !meta.siteOrigin) {
    return fail(
      "no-origin",
      `build origin'siz alınmış (NEXT_PUBLIC_SITE_URL yok) — \`${BUILD_CMD}\``,
    );
  }
  return { ok: true, meta, outDir };
}

module.exports = { buildState, DEFAULT_OUT_DIR, DEFAULT_META_PATH };
