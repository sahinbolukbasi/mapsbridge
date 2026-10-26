// Prepare only the AI bundle. Retain the deployed archives of other services.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { buildSync } = require("esbuild");
async function main() {
  const destination = path.resolve(__dirname, "../admin-runtime/.build");
  fs.mkdirSync(path.join(destination, "ai"), { recursive: true });
  buildSync({
    entryPoints: [path.resolve(__dirname, "../lambda/src/ai/index.ts")],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    outfile: path.join(destination, "ai/index.js"),
  });
  execFileSync("zip", [
    "-q",
    "-j",
    path.join(destination, "ai.zip"),
    path.join(destination, "ai/index.js"),
  ]);
  for (const domain of ["admin", "routes", "operations", "stripe"]) {
    const url = execFileSync(
      "aws",
      [
        "lambda",
        "get-function",
        "--function-name",
        `mapsbridge-prod-${domain}`,
        "--region",
        "eu-central-1",
        "--query",
        "Code.Location",
        "--output",
        "text",
      ],
      { encoding: "utf8" },
    ).trim();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Cannot retrieve deployed ${domain} archive`);
    fs.writeFileSync(
      path.join(destination, domain + ".zip"),
      Buffer.from(await response.arrayBuffer()),
    );
    console.log(`Retained deployed ${domain} archive`);
  }
  console.log("AI deployment artifacts ready");
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
