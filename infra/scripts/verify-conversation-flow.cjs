const { buildSync } = require("esbuild");
const path = require("node:path"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
async function main() {
  process.env.AWS_REGION = "eu-central-1";
  process.env.BEDROCK_MODEL_ID ||= "eu.anthropic.claude-haiku-4-5-20251001-v1:0";
  process.env.TRAVEL_KNOWLEDGE_BASE_ID = "IDOTP4GQGO";
  process.env.PLACE_RESEARCH_ENABLED = "true";
  const file = path.resolve(__dirname, "../admin-runtime/.build/conversation-test.cjs");
  buildSync({
    entryPoints: [path.resolve(__dirname, "../../apps/web/app/lib/ai/supervisor.ts")],
    outfile: file,
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
  });
  const { runMultiAgentSupervisor } = require(file);
  let conversationState;
  const results = [];
  for (const prompt of [
    "Bana güzel bir gezi planla.",
    "Roma için iki gün, tarih ve müzeler ilgimi çekiyor. Orta bütçeyle bir rota hazırla.",
    "Aynı şehirde kalalım. İkinci güne kahve ekle; diğer durakları koru.",
  ]) {
    const result = await runMultiAgentSupervisor({ prompt, conversationState });
    conversationState = result.conversationState;
    results.push({
      prompt,
      mode: result.responseMode,
      context: result.tripContext,
      answer: result.orchestratorSummary,
      route: result.route,
      placeCount: result.research?.places.length,
    });
    console.log(
      JSON.stringify({
        mode: result.responseMode,
        context: result.tripContext,
        stops: result.route?.stops.length,
        summary: result.orchestratorSummary,
      }),
    );
    if (results.length === 1) {
      assert.equal(result.responseMode, "clarify");
      assert.equal(result.route, undefined);
    } else {
      assert.equal(result.responseMode, "route");
      assert.match(result.route.destination, /Roma/i);
      assert.equal(result.route.estimatedDays, 2);
      assert.ok(result.route.stops.every((s) => result.research.places.some((p) => p.id === s.id)));
    }
  }
  fs.writeFileSync(
    "docs/verification/conversation-flow.json",
    JSON.stringify(results, null, 2) + "\n",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
