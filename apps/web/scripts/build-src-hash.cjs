// Build girdilerinin içerik hash'i (design §10 "Build meta ve tazelik", R6-2).
// Yazıcı (postbuild.cjs, cwd apps/web) ve testler (cwd repo kökü) aynı fonksiyonu kullanır;
// pathspec'ler repo kökünden çözüldüğü için sonuç cwd'den bağımsızdır.
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = path.resolve(__dirname, "../../..");
// out/'a giren kaynakların tamamı (app/lib/ai/*.ts'nin relative import ettiği kökler dahil).
const ROOTS = [
  "apps/web",
  "packages",
  "services/ai-assistant/src",
  "infra/lambda/src/shared",
  "data/travel",
  "package-lock.json",
];
// Build girdisi olmayan ya da dev/build sırasında yeniden yazılan dosyalar.
const EXCLUDE = [
  /^apps\/web\/(tests|evals)\//,
  /^apps\/web\/(AGENTS|CLAUDE)\.md$/,
  /^apps\/web\/next-env\.d\.ts$/,
];

/** Git-izlenen + izlenmeyen-ama-ignore-edilmemiş dosyaların disk içeriğinden SHA-256; git yoksa null. */
function computeSrcHash({ repoRoot = REPO_ROOT, roots = ROOTS } = {}) {
  const r = spawnSync("git", [
    "-C",
    repoRoot,
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    ...roots,
  ]);
  if (r.error || r.status !== 0) return null;
  const files = [...new Set(r.stdout.toString().split("\0").filter(Boolean))]
    .filter((p) => !EXCLUDE.some((re) => re.test(p)) && fs.existsSync(path.join(repoRoot, p)))
    .sort();
  const h = crypto.createHash("sha256");
  for (const p of files) {
    h.update(p + "\0");
    h.update(fs.readFileSync(path.join(repoRoot, p)));
  }
  return h.digest("hex");
}

module.exports = { REPO_ROOT, ROOTS, EXCLUDE, computeSrcHash };
