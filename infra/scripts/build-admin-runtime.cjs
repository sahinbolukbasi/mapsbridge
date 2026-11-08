// infra/admin-runtime/.build/*.zip paketlerini üretir (terraform plan/apply ve CI için).
// Giriş noktaları deploy-api.yml ENTRIES ile aynıdır; yalnız paketlenmiş handler zip'e girer
// (bağımlılık katmanı ya da kimlik bilgisi yok).
// routes.json elle yönetilir (revenuecat, /ai/chat, community… gibi uçlar kaynak taramasıyla
// bulunamaz); bu betik onu artık yeniden yazmaz.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
// esbuild kökte ya da infra/lambda altında kurulu olabilir.
const { buildSync } = require(
  require.resolve("esbuild", { paths: [root, path.join(root, "infra/lambda")] }),
);
const destination = path.join(root, "infra/admin-runtime/.build");
fs.mkdirSync(destination, { recursive: true });
const src = (file) => path.join(root, "infra/lambda/src", file);
const bundles = {
  // local.domains (main.tf)
  admin: src("admin/index.ts"),
  routes: src("routes/index.ts"),
  operations: src("operations/index.ts"),
  ai: src("ai/index.ts"),
  stripe: src("stripe/index.ts"),
  revenuecat: src("revenuecat/index.ts"),
  community: src("community/index.ts"),
  // tekil fonksiyonlar (ai-stream ai.zip'i kullanır)
  "background-monitor": src("background-monitor/index.ts"),
  "billing-reconcile": src("billing/reconcile.ts"),
  "conversion-forwarder": src("billing/conversion-forwarder.ts"),
  "rag-fill": path.join(root, "agents/rag-fill/index.ts"),
};
// Sabit zaman damgası: aynı kaynak aynı zip'i (aynı source_code_hash) üretir.
const fixedTime = new Date("2020-01-01T00:00:00Z");
for (const [name, entry] of Object.entries(bundles)) {
  const directory = path.join(destination, name);
  const outfile = path.join(directory, "index.js");
  buildSync({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    target: "node20", // aws_lambda_function runtime = nodejs20.x
    format: "cjs",
    minify: true,
    outfile,
    nodePaths: [path.join(root, "infra/lambda/node_modules")],
  });
  fs.utimesSync(outfile, fixedTime, fixedTime);
  const zip = path.join(destination, `${name}.zip`);
  fs.rmSync(zip, { force: true });
  execFileSync("zip", ["-q", "-j", "-X", zip, outfile]);
  console.log(`Built ${name}.zip`);
}
