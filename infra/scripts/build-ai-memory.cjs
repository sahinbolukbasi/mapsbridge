const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { buildSync } = require("esbuild");
const destination = path.resolve(__dirname, "../ai-memory/.build");
for (const [name, source] of Object.entries({ control: "index", worker: "worker" })) {
  const dir = path.join(destination, name);
  fs.mkdirSync(dir, { recursive: true });
  buildSync({
    entryPoints: [path.resolve(__dirname, `../lambda/src/ai-memory/${source}.ts`)],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    outfile: path.join(dir, "index.js"),
  });
  execFileSync("zip", [
    "-q",
    "-j",
    path.join(destination, `${name}.zip`),
    path.join(dir, "index.js"),
  ]);
  console.log(`Built memory ${name}`);
}
