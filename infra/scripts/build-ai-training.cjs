const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { buildSync } = require("../../apps/web/node_modules/esbuild");
const dir = path.resolve(__dirname, "../ai-training/.build");
fs.mkdirSync(dir, { recursive: true });
buildSync({
  entryPoints: [path.resolve(__dirname, "../lambda/src/ai/training-worker.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: path.join(dir, "index.js"),
});
execFileSync("zip", ["-q", "-j", path.join(dir, "worker.zip"), path.join(dir, "index.js")]);
console.log("Built training worker");
