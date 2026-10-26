// Real AWS read/model smoke test; does not alter user records or credits.
const path = require("node:path"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { buildSync } = require("esbuild");
async function main() {
  const outputs = JSON.parse(
    execFileSync("terraform", ["-chdir=infra/travel-rag", "output", "-json"], { encoding: "utf8" }),
  );
  process.env.AWS_REGION = "eu-central-1";
  process.env.TRAVEL_KNOWLEDGE_BASE_ID = outputs.knowledge_base_id.value;
  process.env.BEDROCK_MODEL_ID = "eu.anthropic.claude-haiku-4-5-20251001-v1:0";
  const file = path.resolve(__dirname, "../admin-runtime/.build/travel-rag-smoke.cjs");
  buildSync({
    entryPoints: [path.resolve(__dirname, "../../apps/web/app/lib/ai/supervisor.ts")],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    outfile: file,
  });
  const { runMultiAgentSupervisor } = require(file);
  const response = await runMultiAgentSupervisor({
    prompt:
      "Tokyo için yemek keşfi öner. Tsukishima hangi yemekle bilinir? Kaynak kullan. Rota istemiyorum.",
    preferences: { budget: "Ekonomik" },
    conversationHistory: [{ role: "user", content: "Önce Roma düşünüyordum." }],
  });
  assert.equal(response.provider, "aws_bedrock");
  assert.equal(response.retrievalStatus, "available");
  assert.ok(response.sources.some((s) => new URL(s.url).hostname === "www.gotokyo.org"));
  assert.match(response.orchestratorSummary, /monjayaki/i);
  console.log(
    JSON.stringify(
      {
        ok: true,
        retrievalStatus: response.retrievalStatus,
        sources: response.sources,
        checks: [
          "real-vector-retrieval",
          "source-linked-answer",
          "destination-change",
          "food-question",
        ],
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
