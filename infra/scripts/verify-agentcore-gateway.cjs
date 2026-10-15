// Invokes only the read-only places tool. Requires an IAM principal allowed to InvokeGateway.
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { buildSync } = require("../../apps/web/node_modules/esbuild");
async function main() {
  if (!process.env.AGENTCORE_GATEWAY_URL) throw new Error("AGENTCORE_GATEWAY_URL is required");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mapsbridge-gateway-"));
  try {
    const outfile = path.join(dir, "verify.cjs");
    buildSync({
      stdin: {
        contents:
          "export { callPlaceResearchTool } from './agentcore-gateway'; export { isPlaceResearch } from './place-research';",
        resolveDir: path.resolve(__dirname, "../../apps/web/app/lib/ai"),
        loader: "ts",
      },
      bundle: true,
      platform: "node",
      target: "node22",
      format: "cjs",
      outfile,
    });
    const { callPlaceResearchTool, isPlaceResearch } = require(outfile);
    const started = Date.now();
    const result = await callPlaceResearchTool("Rome", ["museum"]);
    if (!isPlaceResearch(result) || result.status !== "available")
      throw new Error("No validated live places returned");
    console.log(
      JSON.stringify({ ok: true, places: result.places.length, latencyMs: Date.now() - started }),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error("AgentCore smoke test failed:", error.name);
  process.exitCode = 1;
});
