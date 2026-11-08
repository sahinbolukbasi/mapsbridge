const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { buildSync } = require("esbuild");
const dir = path.resolve(__dirname, "../agentcore-gateway/.build");
fs.mkdirSync(dir, { recursive: true });
buildSync({
  entryPoints: [path.resolve(__dirname, "../../apps/web/server/ai/gateway-handler.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: path.join(dir, "index.js"),
});
// Veri araçları (uçuş + seyahat uyarısı): bağımlılıksız düz JS; ayrı dizinde index.js olarak paketlenir.
const dataDir = path.join(dir, "data-tools");
fs.mkdirSync(dataDir, { recursive: true });
buildSync({
  entryPoints: [path.resolve(__dirname, "../agentcore-gateway/src/data-tools/index.js")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: path.join(dataDir, "index.js"),
});
for (const zip of ["tools.zip", "data-tools.zip"]) fs.rmSync(path.join(dir, zip), { force: true });
execFileSync("zip", ["-q", "-j", path.join(dir, "tools.zip"), path.join(dir, "index.js")]);
execFileSync("zip", ["-q", "-j", path.join(dir, "data-tools.zip"), path.join(dataDir, "index.js")]);
console.log("Built AgentCore Gateway places + data targets");
