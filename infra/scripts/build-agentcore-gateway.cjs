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
execFileSync("zip", ["-q", "-j", path.join(dir, "tools.zip"), path.join(dir, "index.js")]);
console.log("Built AgentCore Gateway places target");
